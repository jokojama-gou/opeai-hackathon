import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useNetworkState } from "expo-network";
import { useAudioPlayer } from "expo-audio";
import {
  ApiClient,
  ApiError,
  type Job,
  type ProcessingPolicy,
  type Recording,
  type Source,
} from "@hackathon/api";
import { processRecording } from "./processing";
import { readSession, saveSession, type Session } from "./session";
import {
  deleteLocal,
  readLocal,
  writeLocal,
  type LocalRecording,
} from "../platform/audio/storage";
import { useCapture } from "../platform/audio/useCapture";
import { VisibilityScope } from "./visibility";
import { apiConfiguration } from "./startup";
const connection = apiConfiguration(
  process.env.EXPO_PUBLIC_API_URL,
  Platform.OS,
);
const baseUrl = connection.baseUrl;
const messages: Record<string, string> = {
  backend_not_configured: "サーバーの設定が完了していません。",
  unauthenticated: "ログインし直してください。",
  login_failed: "メールアドレスとパスワードを確認してください。",
  connection_unavailable:
    "サーバーに接続できません。接続を確認して再取得してください。",
  result_unknown:
    "処理結果を確認できません。同じ操作として状態を確認してください。",
  asr_not_configured: "書き起こしサービスが未設定です。",
  processor_not_configured: "処理サービスが未設定です。",
  media_probe_not_configured:
    "サーバーの音声形式確認がまだ準備されていません。",
  expired: "この記録の保存期限が過ぎました。",
  not_found: "この記録を利用できません。",
  version_conflict: "内容が更新されています。読み直してください。",
  generation_not_configured: "生成サービスの接続と予算が未設定です。",
  processor_configuration_changed: "処理設定が変わりました。最新の状態を取得して再試行してください。",
  context_not_ready: "文字起こしを準備しています。",
  manifest_changed: "元の記録が更新されました。対象を読み直してください。",
  selection_changed: "対象の記録が変わりました。選択し直してください。",
  too_many_candidates:
    "候補が多いため抽出できませんでした。元の記録を確認してください。",
  generation_budget_exhausted: "生成の予算上限に達しました。",
  generation_queue_full: "処理待ちが多いため、しばらくしてから試してください。",
  duplicate_resolution_required:
    "同じ内容を二重に採用しないため、記録の対応確認が必要です。",
  source_reconfirmation_required: "現在の根拠から確認し直してください。",
  invalid_time_zone: "タイムゾーンを確認してください（例 Asia/Tokyo）。",
  invalid_date: "日付をYYYY-MM-DDで入力してください。",
  invalid_request:
    "入力内容を確認してください。日時には時差とタイムゾーンが必要です。",
};
export const errorCodeText = (code: string) =>
  messages[code] ??
  "処理を完了できませんでした。元の記録と処理状態を確認してください。";
export const errorText = (error: unknown) =>
  error instanceof ApiError
    ? (messages[error.code] ??
      "処理を完了できませんでした。状態を確認してください。")
    : (error as Error).message;
export function useLiveWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const visibility = useRef(new VisibilityScope()).current;
  const alive = useRef(true);
  const busyRef = useRef(false);
  const persistQueue = useRef(Promise.resolve());
  function persist(value: Session | null) {
    persistQueue.current = persistQueue.current
      .catch(() => {})
      .then(() => saveSession(value));
    return persistQueue.current;
  }
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [local, setLocal] = useState<LocalRecording[]>([]);
  const [remote, setRemote] = useState<Recording[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState<LocalRecording | null>(null);
  const [remoteId, setRemoteId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<ProcessingPolicy | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [screen, setScreen] = useState<
    | "room"
    | "records"
    | "recording"
    | "personal"
    | "settings"
    | "saved"
    | "today"
    | "todos"
  >("recording");
  const [active, setActive] = useState(AppState.currentState === "active");
  const network = useNetworkState();
  const connected = network.isConnected !== false && active;
  visibility.setVisible(connected);
  const player = useAudioPlayer();
  const refreshPromise = useRef<Promise<string | null> | null>(null);
  const token = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return null;
    if (current.expires_at > Date.now() / 1000 + 30)
      return current.access_token;
    if (!refreshPromise.current)
      refreshPromise.current = (async () => {
        const api = new ApiClient(baseUrl, async () => null);
        const next = await api.request<Session>("/v1/session/refresh", "POST", {
          refresh_token: current.refresh_token,
        });
        if (!alive.current || sessionRef.current !== current) return null;
        await persist(next);
        if (!alive.current || sessionRef.current !== current) return null;
        sessionRef.current = next;
        setSession(next);
        return next.access_token;
      })().finally(() => {
        refreshPromise.current = null;
      });
    return refreshPromise.current;
  }, []);
  const api = useMemo(() => {
    try {
      return baseUrl ? new ApiClient(baseUrl, token) : null;
    } catch {
      return null;
    }
  }, [token]);
  useEffect(() => {
    alive.current = true;
    readSession()
      .then((value) => {
        if (alive.current) {
          sessionRef.current = value;
          setSession(value);
        }
      })
      .catch(() => setError("保存したログイン情報を読み取れませんでした。"))
      .finally(() => setReady(true));
    return () => {
      alive.current = false;
      sessionRef.current = null;
      visibility.invalidate();
    };
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (value) => {
      visibility.setVisible(value === "active");
      setActive(value === "active");
      if (value !== "active") {
        setSources([]);
        setRemote([]);
        player.pause();
      }
    });
    return () => listener.remove();
  }, [player, visibility]);
  useEffect(() => {
    if (!connected) {
      setSources([]);
      setRemote([]);
      setPolicy(null);
      player.pause();
    }
  }, [connected, player]);
  const refresh = useCallback(async () => {
    const owner = sessionRef.current?.user_id;
    if (!owner) return;
    const valid = visibility.checkpoint();
    const values = await readLocal(owner);
    if (alive.current && sessionRef.current?.user_id === owner)
      setLocal(values);
    if (api && connected) {
      try {
        const result = await api.recordings();
        if (valid()) {
          setRemote(result);
          setError("");
        }
      } catch (e) {
        if (valid()) {
          setRemote([]);
          setSources([]);
          setError(errorText(e));
        }
      }
    }
  }, [api, connected, visibility]);
  useEffect(() => {
    if (session && active) void refresh();
  }, [session, active, refresh]);
  const capture = useCapture((recording) => {
    setSelected(recording);
    setScreen("personal");
    void refresh();
  });
  const recordingActive = ["preparing", "recording", "stopping"].includes(
    capture.phase,
  );
  useEffect(() => {
    if (!jobId || !api || !connected) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const valid = visibility.checkpoint();
    const poll = async () => {
      try {
        const value = await api.job(jobId);
        if (cancelled || !valid()) return;
        setJob(value);
        if (value.status === "ready") {
          setStage("書き起こしが完了しました");
          if (selected?.remote_id) {
            const next = await api.sources(selected.remote_id);
            if (!cancelled && valid()) setSources(next);
          }
          await refresh();
        } else if (value.status === "failed" || value.status === "stale") {
          setError(
            "書き起こしを完了できませんでした。結果不明の処理は自動再送しません。",
          );
        } else timer = setTimeout(poll, 2000);
      } catch (e) {
        if (!cancelled && valid()) {
          setSources([]);
          setError(errorText(e));
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, api, connected, refresh, selected?.remote_id]);
  async function perform(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      if (alive.current) {
        setSources([]);
        setError(errorText(e));
      }
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function login(email: string, password: string) {
    if (!api) return;
    const result = await api.request<Session>("/v1/session", "POST", {
      email,
      password,
    });
    if (!alive.current) return;
    await persist(result);
    if (!alive.current) return;
    visibility.invalidate();
    sessionRef.current = result;
    setSession(result);
    setScreen("recording");
  }
  async function readSources(id: string) {
    if (!api || !connected) return;
    const valid = visibility.checkpoint();
    const next = await api.sources(id);
    if (valid()) setSources(next);
  }
  async function openLocal(value: LocalRecording) {
    visibility.invalidate();
    player.pause();
    setSelected(value);
    setRemoteId(value.remote_id);
    setSources([]);
    setPolicy(null);
    setJob(null);
    setJobId(value.operation?.job_id ?? null);
    setScreen("personal");
    setStage("");
    if (value.remote_id) await readSources(value.remote_id);
  }
  async function openRemote(id: string) {
    visibility.invalidate();
    player.pause();
    setSelected(null);
    setRemoteId(id);
    setSources([]);
    setPolicy(null);
    setJobId(null);
    setStage("");
    setScreen("personal");
    await readSources(id);
  }
  async function logout() {
    visibility.invalidate();
    player.pause();
    sessionRef.current = null;
    setSession(null);
    setSources([]);
    setRemote([]);
    setLocal([]);
    setSelected(null);
    setJobId(null);
    setPolicy(null);
    setScreen("records");
    await persist(null);
  }
  async function process() {
    if (!api || !selected || !policy) return;
    const id = await processRecording(
      api,
      baseUrl,
      token,
      selected,
      policy,
      setStage,
    );
    setJobId(id);
    setRemoteId(selected.remote_id);
    setPolicy(null);
    await refresh();
  }
  async function removeSelected() {
    if (!selected || !api) return;
    if (selected.remote_id) {
      if (selected.deletion_version === undefined) {
        const current = await api.request<Recording>(
          `/v1/recordings/${selected.remote_id}`,
        );
        selected.deletion_version = current.version;
        writeLocal(selected);
      }
      await api.request(`/v1/recordings/${selected.remote_id}`, "DELETE", {
        request_key: selected.id + ":delete:" + selected.deletion_version,
        expected_version: selected.deletion_version,
      });
    }
    visibility.invalidate();
    player.pause();
    deleteLocal(selected);
    setSelected(null);
    setSources([]);
    setJobId(null);
    setScreen("records");
    await refresh();
  }
  async function reloadSources() {
    if (remoteId) await readSources(remoteId);
    await refresh();
  }
  async function loadPolicy() {
    if (api) {
      const valid = visibility.checkpoint();
      const next = await api.policy();
      if (valid()) setPolicy(next);
    }
  }
  useEffect(() => {
    if (!selected) return;
    const remaining = Date.parse(selected.audio_expires_at) - Date.now();
    const timer = setTimeout(
      () => player.pause(),
      Math.max(0, Math.min(remaining, 2147483647)),
    );
    return () => clearTimeout(timer);
  }, [selected, player]);
  function playLocal() {
    if (!selected || Date.parse(selected.audio_expires_at) <= Date.now())
      return;
    player.pause();
    player.replace({ uri: selected.uri });
    player.play();
  }
  return {
    session,
    ready,
    error,
    setError,
    busy,
    stage,
    local,
    remote,
    sources,
    selected,
    remoteId,
    policy,
    job,
    screen,
    setScreen,
    connected,
    connectionError: connection.error,
    api,
    capture,
    recordingActive,
    perform,
    login,
    openLocal,
    openRemote,
    logout,
    process,
    removeSelected,
    reloadSources,
    loadPolicy,
    playLocal,
    stopPlayback: () => player.pause(),
    refresh,
  };
}
