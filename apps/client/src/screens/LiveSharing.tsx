import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import {
  type ApiClient,
  type ConnectionSnapshot,
  type Source,
  type Recording,
} from "@hackathon/api";
import { errorText } from "../data/useLiveWorkspace";
import {
  Badge,
  Button,
  Card,
  Check,
  Field,
  Heading,
  styles,
} from "../ui/primitives";

type Props = {
  api: ApiClient;
  userId: string;
  recordingId: string;
  sources: Source[];
};
export function LiveSharing({ api, userId, recordingId, sources }: Props) {
  const [connections, setConnections] = useState<ConnectionSnapshot[]>([]);
  const [current, setCurrent] = useState<ConnectionSnapshot | null>(null);
  const [issuedCode, setIssuedCode] = useState("");
  const [code, setCode] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [ranges, setRanges] = useState({
    selfStart: "",
    selfEnd: "",
    peerStart: "",
    peerEnd: "",
  });
  const [checks, setChecks] = useState([false, false, false, false]);
  const [continuing, setContinuing] = useState(false);
  const [revising, setRevising] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  async function refresh() {
    const list = await api.connections();
    if (mounted.current) {
      setConnections(list);
      setCurrent((value) =>
        value
          ? (list.find((item) => item.connection_id === value.connection_id) ??
            null)
          : null,
      );
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh().catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [recordingId]);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function mutate<T>(
    path: string,
    expected_version: number,
    data: object = {},
    keySalt = "",
  ): Promise<T> {
    const payload = { expected_version, ...data };
    const request_key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify([userId, path, payload, keySalt]),
    );
    return api.request<T>(path, "POST", { request_key, ...payload });
  }
  async function connect(accept: boolean) {
    const record = await api.request<Recording>(
      `/v1/recordings/${recordingId}`,
    );
    const result = await mutate<{ connection_id: string; code?: string }>(
      accept ? "/v1/connections/accept" : "/v1/connections",
      record.version,
      {
        recording_id: recordingId,
        ...(accept ? { code: code.toUpperCase().trim() } : {}),
      },
      accept ? "" : String(Math.floor(Date.now() / 600000)),
    );
    const snapshot = await api.connection(result.connection_id);
    if (mounted.current) {
      setCurrent(snapshot);
      setIssuedCode(result.code ?? "");
      await refresh();
    }
  }
  async function confirm() {
    if (!current?.match_id || !current.match_version) return;
    const seconds = (value: string) => {
      if (!/^\d+(\.\d{1,3})?$/.test(value))
        throw new Error("参加時間を秒で入力してください。");
      return Math.round(Number(value) * 1000);
    };
    const selection = sources
      .filter((s) => selected.includes(s.id))
      .map((s) => ({
        source_id: s.id,
        source_version: s.version,
        char_start: 0,
        char_end: Array.from(s.original_text).length,
        start_ms: s.start_ms,
        end_ms: s.end_ms,
      }));
    const next = await mutate<ConnectionSnapshot>(
      `/v1/matches/${current.match_id}/${revising || current.next_actions.includes("revise") ? "revisions" : "confirmations"}`,
      current.match_version,
      {
        selection,
        participation_ranges: {
          self: {
            start_ms: seconds(ranges.selfStart),
            end_ms: seconds(ranges.selfEnd),
          },
          peer: {
            start_ms: seconds(ranges.peerStart),
            end_ms: seconds(ranges.peerEnd),
          },
        },
        same_conversation: checks[0],
        only_two_people: checks[1],
        attribution_confirmed: checks[2],
        participation_confirmed: checks[3],
      },
    );
    if (mounted.current) {
      setCurrent(next);
      setRevising(false);
    }
  }
  async function respond(decision: "allowed" | "rejected") {
    if (!current?.scope_id || !current.scope_version) return;
    const next = await mutate<ConnectionSnapshot>(
      `/v1/share-scopes/${current.scope_id}/responses`,
      current.scope_version,
      { decision, continuing_opt_in: continuing },
    );
    if (mounted.current) setCurrent(next);
  }
  const confirmed =
    current &&
    Object.values(current.confirmation_states).length === 2 &&
    Object.values(current.confirmation_states).every(
      (value) => value === "confirmed",
    );
  return (
    <Card>
      <Heading>一緒にまとめる</Heading>
      <Text style={styles.muted}>
        各自の記録を持ち寄ります。接続だけでは相手の文字や音声を共有しません。
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.body}>
          {error}
        </Text>
      )}
      {!current ? (
        <>
          <Button
            label="接続コードを表示する"
            busy={busy}
            disabled={!sources.length}
            onPress={() => void run(() => connect(false))}
          />
          <Field
            label="相手の接続コード"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            maxLength={8}
          />
          <Button
            label="この記録で接続する"
            busy={busy}
            disabled={code.trim().length !== 8 || !sources.length}
            onPress={() => void run(() => connect(true))}
          />
          {connections.map((item) => (
            <Button
              key={item.connection_id}
              secondary
              label={`${item.peer_display ?? "相手待ち"} · ${item.verification_code ?? "未接続"}`}
              onPress={() => {
                setCurrent(item);
                setChecks([false, false, false, false]);
              }}
            />
          ))}
        </>
      ) : (
        <>
          {!!issuedCode && (
            <>
              <Badge>相手に伝えるコード</Badge>
              <Text selectable style={styles.title}>
                {issuedCode}
              </Text>
            </>
          )}
          <Text style={styles.body}>
            {current.peer_display ?? "相手が接続するのを待っています"}
          </Text>
          {!!current.verification_code && (
            <>
              <Text selectable style={styles.title}>
                照合 {current.verification_code}
              </Text>
              <Text style={styles.muted}>
                対面で同じコードを確認してください。
              </Text>
            </>
          )}
          <Text style={styles.muted}>
            確認期限: {new Date(current.expires_at).toLocaleString("ja-JP")}
          </Text>
          {!!current.match_id &&
            (current.confirmation_states[userId] !== "confirmed" ||
              revising ||
              current.next_actions.includes("revise")) && (
              <>
                <Text style={styles.body}>自分の記録から今回の会話を選ぶ</Text>
                {sources.map((source) => (
                  <Check
                    key={source.id}
                    label={`${source.start_ms === null ? "時刻不明" : source.start_ms / 1000 + "秒"}: ${source.original_text}`}
                    disabled={
                      source.start_ms === null || source.end_ms === null
                    }
                    checked={selected.includes(source.id)}
                    onChange={(value) =>
                      setSelected((items) =>
                        value
                          ? [...items, source.id]
                          : items.filter((id) => id !== source.id),
                      )
                    }
                  />
                ))}
                <Text style={styles.muted}>
                  以下は自分の録音内の秒数です。二人が参加した範囲を各自確認します。
                </Text>
                {(
                  [
                    ["selfStart", "自分の参加開始（秒）"],
                    ["selfEnd", "自分の参加終了（秒）"],
                    ["peerStart", "相手の参加開始（秒）"],
                    ["peerEnd", "相手の参加終了（秒）"],
                  ] as const
                ).map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    value={ranges[key]}
                    keyboardType="decimal-pad"
                    onChangeText={(value) =>
                      setRanges((old) => ({ ...old, [key]: value }))
                    }
                  />
                ))}
                {[
                  "同じ会話の記録である",
                  "会話の参加者はこの2人である",
                  "録音の持ち主と発言者を区別して確認した",
                  "選択範囲と二人の参加時間を確認した",
                ].map((label, index) => (
                  <Check
                    key={label}
                    label={label}
                    checked={checks[index]}
                    onChange={(value) =>
                      setChecks((old) =>
                        old.map((v, i) => (i === index ? value : v)),
                      )
                    }
                  />
                ))}
                <Button
                  label="この範囲で確認する"
                  busy={busy}
                  disabled={!selected.length || !checks.every(Boolean)}
                  onPress={() => void run(confirm)}
                />
              </>
            )}
          {current.match_id && !confirmed && (
            <Text style={styles.muted}>
              双方の会話・帰属・参加確認が揃うまで共有できません。
            </Text>
          )}
          {confirmed && !revising && (
            <>
              <Heading>今回の共有</Heading>
              <Text style={styles.body}>
                選択した範囲の文字・原音・整理結果を相手と共有します。共有後も取り消せます。
              </Text>
              <Check
                label="次回以降も、この相手との確認済み範囲を共有する"
                checked={continuing}
                onChange={setContinuing}
              />
              <Text style={styles.muted}>
                継続は双方が選んだ場合だけ成立します。次回も各自の録音開始と会話・参加範囲の確認は必要です。
              </Text>
              <View style={styles.row}>
                <Button
                  label="今回の共有を許可"
                  busy={busy}
                  onPress={() => void run(() => respond("allowed"))}
                />
                <Button
                  label="共有しない"
                  secondary
                  busy={busy}
                  onPress={() => void run(() => respond("rejected"))}
                />
              </View>
              <Text style={styles.muted}>
                {
                  Object.values(current.share_states).filter(
                    (value) => value === "allowed",
                  ).length
                }{" "}
                / 2 人が今回の共有を許可
              </Text>
            </>
          )}
          {!!current.conversation_id && (
            <Text style={styles.body}>
              双方の許可を確認しました。統合処理はまだ接続されていないため、共有本文は表示できません。
            </Text>
          )}
          {current.scope_id && (
            <Button
              label="今回の共有を取り消す"
              danger
              busy={busy}
              onPress={() =>
                void run(async () => {
                  await mutate(
                    `/v1/share-scopes/${current.scope_id}/revoke`,
                    current.scope_version!,
                  );
                  await refresh();
                })
              }
            />
          )}
          {current.continuing_state === "mutual_active" && (
            <Button
              label="次回からの自動共有を解除"
              secondary
              busy={busy}
              onPress={() =>
                void run(async () => {
                  const grants = await api.request<
                    {
                      id: string;
                      version: number;
                      status: string;
                      connection_ids: string[];
                    }[]
                  >("/v1/continuing-grants");
                  const grant = grants.find(
                    (value) =>
                      value.status === "active" &&
                      value.connection_ids.includes(current.connection_id),
                  );
                  if (grant)
                    await mutate(
                      `/v1/continuing-grants/${grant.id}/revoke`,
                      grant.version,
                    );
                  await refresh();
                })
              }
            />
          )}
          {current.match_id && (
            <>
              <Button
                label="範囲を確認し直す"
                secondary
                disabled={busy}
                onPress={() => {
                  setRevising(true);
                  setChecks([false, false, false, false]);
                  setSelected(
                    current.own_selection.map((value) => value.source_id),
                  );
                }}
              />
              <Button
                label="今回の持ち寄りを取りやめる"
                secondary
                busy={busy}
                onPress={() =>
                  void run(async () => {
                    await mutate(
                      `/v1/matches/${current.match_id}/cancel`,
                      current.match_version!,
                    );
                    setCurrent(null);
                    setIssuedCode("");
                    await refresh();
                  })
                }
              />
            </>
          )}
          <Button
            label="接続一覧に戻る"
            secondary
            disabled={busy}
            onPress={() => {
              setCurrent(null);
              setIssuedCode("");
            }}
          />
        </>
      )}
      <Button
        label="接続状態を更新"
        secondary
        busy={busy}
        onPress={() => void run(refresh)}
      />
    </Card>
  );
}
