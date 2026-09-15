import { useEffect, useRef, useState } from "react";
import { AppState, ScrollView, Text, View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Button, Card, Field, Heading, styles } from "../ui/primitives";
import { AsrError, errorLabel, keyFor, providers, runEnsemble, sleep, type EnsembleRun, type Keys } from "../data/direct-asr";
import { transcribe } from "../data/asr-providers";
import { compareTranscripts } from "../data/asr-comparison";
import { bundledKeys, comparisonModel } from "../data/asr-settings";
import { prepareDenoisedAudio, type AudioVariant } from "../data/audio-isolation";
import { audioDigest, isolationStore, playbackUri, releasePlaybackUri, getAudio, loadRecordings, loadRun, providerFetch, removeRecording, saveRun, useDirectCapture, type LocalRecording } from "../platform/audio/direct-device";

const statusLabels = { queued: "送信待ち", running: "処理中", succeeded: "完了", empty: "発言なし", failed: "失敗",
  unconfigured: "キー未設定", cancelled: "中止", result_unknown: "結果不明" };
const time = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, "0")}:${Math.floor(ms / 1000 % 60).toString().padStart(2, "0")}`;

export function DirectAsrScreen({ onDemo, onLegacy, onVoice }: { onDemo: () => void; onLegacy: () => void; onVoice: () => void }) {
  const [keys, setKeys] = useState<Keys>({ ...bundledKeys });
  const [model, setModel] = useState(comparisonModel);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [records, setRecords] = useState<LocalRecording[]>([]);
  const [selected, setSelected] = useState<LocalRecording | null>(null);
  const [run, setRun] = useState<EnsembleRun | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const [variant, setVariant] = useState<AudioVariant>("original");
  const [isolating, setIsolating] = useState(false);
  const [isolationError, setIsolationError] = useState<string | null>(null);
  const isolation = useRef<AbortController | null>(null);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const [playingVariant, setPlayingVariant] = useState<AudioVariant>("original");
  const playingUri = useRef<string | null>(null);
  const operation = useRef<AbortController | null>(null);
  const selection = useRef(0);
  const mounted = useRef(true);
  const foreground = useRef(AppState.currentState === "active");
  const [tick, setTick] = useState(Date.now());
  const capture = useDirectCapture(recording => {
    if (!mounted.current) return;
    stopPlayback(); setSelected(recording); setRun(null); setLoadingRun(false); setVariant("original"); setDeletePrompt(false); selection.current++;
    void refresh();
    void denoise(recording, false);
  });
  function stopPlayback() {
    player.pause();
    if (playingUri.current) { releasePlaybackUri(playingUri.current); playingUri.current = null; }
  }
  async function refresh() {
    try { const found = await loadRecordings(); if (mounted.current) {
      setRecords(found); setSelected(current => current ? found.find(r => r.id === current.id) ?? null : null);
    } }
    catch { if (mounted.current) setError("保存した録音を読み込めませんでした。"); }
  }
  useEffect(() => {
    mounted.current = true; void refresh();
    const timer = setInterval(() => setTick(Date.now()), 1000);
    const subscription = AppState.addEventListener("change", state => {
      foreground.current = state === "active";
      if (state !== "active") { operation.current?.abort(); isolation.current?.abort(); stopPlayback(); }
      else { setTick(Date.now()); void refresh(); }
    });
    return () => { mounted.current = false; operation.current?.abort(); isolation.current?.abort(); stopPlayback(); clearInterval(timer); subscription.remove(); };
  }, []);
  const capturing = ["preparing", "recording", "stopping"].includes(capture.phase);
  const textValid = run && Date.parse(run.textExpiresAt) > tick;
  const audioValid = selected && Date.parse(selected.audio_expires_at) > tick;
  useEffect(() => { if (!audioValid) stopPlayback(); }, [audioValid]);
  const compareCount = run?.candidates.filter(c => c.kind === "transcript" && c.status === "succeeded").length ?? 0;
  async function select(recording: LocalRecording, nextVariant: AudioVariant = "original") {
    if (operation.current) return;
    const version = ++selection.current;
    setLoadingRun(true);
    stopPlayback(); setSelected(recording); setVariant(nextVariant); setRun(null); setExpanded(null); setError(null); setDeletePrompt(false);
    try { const loaded = await loadRun(recording.id, nextVariant); if (mounted.current && version === selection.current) setRun(loaded); }
    catch { if (mounted.current && version === selection.current) setError("書き起こし結果を読み込めませんでした。"); }
    finally { if (mounted.current && version === selection.current) setLoadingRun(false); }
  }
  async function denoise(recording: LocalRecording, retry: boolean) {
    if (isolation.current || !mounted.current || !foreground.current) return;
    const controller = new AbortController(); isolation.current = controller;
    setIsolating(true); setIsolationError(null);
    try {
      const work = prepareDenoisedAudio(isolationStore(recording), keyFor(keys, "elevenlabs"), {
        signal: controller.signal, fetch: providerFetch, digest: audioDigest, retry,
      });
      await work;
    } catch (error) {
      if (mounted.current) setIsolationError(error instanceof AsrError ? errorLabel(error.code) : "雑音除去または保存に失敗しました。原音は保存されています。");
    } finally {
      if (isolation.current === controller) isolation.current = null;
      if (mounted.current) { setIsolating(false); await refresh(); }
    }
  }
  async function play(audioVariant: AudioVariant) {
    if (!selected) return;
    const version = selection.current;
    try {
      const uri = await playbackUri(selected, audioVariant);
      if (!mounted.current || !foreground.current || version !== selection.current || Date.parse(selected.audio_expires_at) <= Date.now()) { releasePlaybackUri(uri); return; }
      stopPlayback(); playingUri.current = uri; setPlayingVariant(audioVariant); player.replace({ uri }); player.play();
    } catch { setError("音声を再生できませんでした。保存状態・期限を確認してください。"); }
  }
  async function perform(action: (signal: AbortSignal) => Promise<void>) {
    if (operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setError(null);
    try { await action(controller.signal); }
    catch (e) { if (mounted.current) setError(e instanceof AsrError ? errorLabel(e.code) : "処理または保存を完了できませんでした。"); }
    finally { if (operation.current === controller) operation.current = null; if (mounted.current) setBusy(false); }
  }
  const process = () => {
    if (!selected || loadingRun) return;
    const recording = selected;
    void perform(async signal => {
      const input = await getAudio(recording, variant);
      await runEnsemble(input, keys, transcribe, { signal, fetch: providerFetch,
        previous: run ?? undefined,
        publish: async value => { await saveRun(value); if (mounted.current) setRun(value); } });
    });
  };
  const compare = () => {
    if (!run || run.comparison) return;
    const original = run;
    void perform(async signal => {
      const controller = new AbortController();
      const abort = () => controller.abort(); signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) controller.abort();
      const timer = setTimeout(abort, 120000);
      try {
        const result = await compareTranscripts(original, keyFor(keys, "openai"), model, {
          fetch: providerFetch, signal: controller.signal, sleep, now: Date.now, job: () => {} });
        const updated = { ...original, comparison: result }; await saveRun(updated);
        if (mounted.current) setRun(updated);
      } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
    });
  };
  const drop = () => {
    if (!selected || busy) return;
    const recording = selected;
    void perform(async () => {
      isolation.current?.abort(); stopPlayback();
      await removeRecording(recording); selection.current++;
      setSelected(null); setRun(null); setDeletePrompt(false); await refresh();
    });
  };
  return <ScrollView style={styles.page} keyboardShouldPersistTaps="handled"><View style={styles.content}>
    <Button label="自分の声を登録する（ログイン不要）" secondary disabled={busy || capturing || isolating} onPress={onVoice} />
    <Heading>録音を聞き比べる</Heading>
    <Text style={styles.body}>すぐ表示する書き起こしには原音を使います。録音後はElevenLabsで雑音を除去して音声を保存し、後からの書き起こしに使えます。</Text>
    <Card>
      <Text style={styles.title}>{time(capture.durationMs)}</Text>
      <Text style={styles.muted}>この端末に保存 · 録音は5分まで</Text>
      {capture.phase === "recording" ? <Button label="録音を停止して保存" onPress={() => { void capture.stop(); }} />
        : <Button label={capturing ? "録音を準備・保存しています" : "録音を開始"} disabled={busy || capturing || isolating || capture.phase === "save_failed"}
          onPress={() => { void capture.start("direct-device"); }} />}
      {capture.phase === "save_failed" && <Button label="保存を再試行" onPress={() => { void capture.retrySave(); }} />}
      {capture.error && <Text accessibilityRole="alert" style={styles.body}>{capture.error}</Text>}
    </Card>
    <Button label={settingsOpen ? "設定を閉じる" : "書き起こしの設定"} secondary disabled={busy || capturing || isolating} onPress={() => setSettingsOpen(!settingsOpen)} />
    {settingsOpen && <Card>
      <Text style={styles.muted}>キーがある会社をすべて使います。ここで入力した変更は、この画面を開いている間だけ有効です。</Text>
      {providers.filter(p => p.id !== "openai-diarize").map(p => <Field key={p.id} label={`${p.label} APIキー`}
        secureTextEntry autoCapitalize="none" autoCorrect={false} value={keys[p.id] ?? ""}
        onChangeText={value => setKeys(current => ({ ...current, [p.id]: value }))} />)}
      <Field label="比較用LLM（OpenAIモデルID）" value={model} autoCapitalize="none" onChangeText={setModel} />
    </Card>}
    <Text style={styles.heading}>保存した録音</Text>
    {!records.length && <Text style={styles.muted}>録音を保存すると、ここから書き起こせます。</Text>}
    {records.map(r => <Button key={r.id} secondary label={`${selected?.id === r.id ? "選択中 · " : ""}${new Date(r.started_at).toLocaleString("ja-JP")} · ${time(r.duration_ms)}`}
      disabled={busy || capturing || isolating} onPress={() => { void select(r); }} />)}
    {selected && <Card>
      <Text style={styles.heading}>保存した音声</Text>
      {playerStatus.playing && <Text style={styles.body}>{playingVariant === "denoised" ? "雑音除去済みの音声を再生中" : "原音を再生中"}</Text>}
      <Text style={styles.muted}>{isolating ? "原音は保存済み · 雑音除去を処理中" : selected.denoising?.status === "ready" ? "雑音除去済みの音声を保存しました" : "原音は保存済み · 雑音除去は未完了"}</Text>
      {audioValid && <>
        {selected.denoising?.status === "ready" && <Button label="雑音除去済みの音声を再生" secondary onPress={() => { void play("denoised"); }} />}
        <Button label="原音を再生" secondary onPress={() => { void play("original"); }} />
        <Button label="再生を停止" secondary onPress={stopPlayback} />
        {selected.denoising?.status !== "ready" && <Button label={isolating ? "雑音除去を処理中" : "雑音除去して保存（再試行）"}
          disabled={isolating || capturing} onPress={() => { void denoise(selected, true); }} />}
        {isolating && <Button label="雑音除去の待機を中止" secondary onPress={() => isolation.current?.abort()} />}
      </>}
      {(isolationError || selected.denoising?.error) && <Text accessibilityRole="alert" style={styles.body}>{isolationError ?? errorLabel(selected.denoising?.error ?? null)}</Text>}
      {selected.denoising?.status === "running" && !isolating && <Text style={styles.muted}>中断した処理の結果は不明です。自動では再送しません。</Text>}
      <Text style={styles.heading}>この録音の書き起こし</Text>
      <Button label={variant === "original" ? "選択中 · すぐ書き起こす（原音）" : "すぐ書き起こす（原音）"} secondary disabled={busy || capturing} onPress={() => { void select(selected, "original"); }} />
      <Button label={variant === "denoised" ? "選択中 · 後処理（雑音除去済み）" : "後処理（雑音除去済み）"} secondary disabled={busy || capturing} onPress={() => { void select(selected, "denoised"); }} />
      <Text style={styles.muted}>{providers.filter(p => keyFor(keys, p.id)).map(p => p.label).join(" / ") || "APIキー未設定"}</Text>
      {!audioValid && <Text style={styles.muted}>原音の保存期限が切れています。</Text>}
      {!run && <Button label={loadingRun ? "保存した結果を読込中" : variant === "original" ? "原音で書き起こす" : "雑音除去音声で書き起こす"} disabled={busy || loadingRun || capturing || !audioValid || (variant === "denoised" && selected.denoising?.status !== "ready")} onPress={process} />}
      {run && run.candidates.some(c => !["succeeded", "empty"].includes(c.status) && keyFor(keys, c.provider)) && <>
        <Text style={styles.muted}>再試行は未完了の会社だけに再送します。結果不明の処理も再送するため、重ねて実行される場合があります。</Text>
        <Button label="未完了の会社だけ再試行" disabled={busy || capturing || !audioValid || (variant === "denoised" && selected.denoising?.status !== "ready")} onPress={process} />
      </>}
      {busy && <Button label="待機を中止" secondary onPress={() => operation.current?.abort()} />}
      {run && !textValid && <Text style={styles.body}>書き起こしの保存期限が切れています。</Text>}
      {textValid && run.candidates.map(c => <View key={c.id} style={{ gap: 8 }}>
        <Text style={styles.heading}>{providers.find(p => p.id === c.provider)!.label} · {statusLabels[c.status]}</Text>
        <Text style={styles.muted}>{c.model} · {(c.elapsedMs / 1000).toFixed(1)}秒</Text>
        {c.error && <Text style={styles.muted}>{errorLabel(c.error)}</Text>}
        {c.text && <Text selectable style={styles.body}>{c.text}</Text>}
        {!!c.segments.length && <Button label={expanded === c.id ? "区間を閉じる" : "時刻・話者の区間を見る"} secondary onPress={() => setExpanded(expanded === c.id ? null : c.id)} />}
        {expanded === c.id && c.segments.map(s => <Text key={s.id} selectable style={styles.muted}>
          {s.startMs === null ? "時刻不明" : `${time(s.startMs)}–${time(s.endMs!)}`} · {s.speaker === null ? "話者不明" : `話者 ${s.speaker}`} {s.text}
        </Text>)}
      </View>)}
      {textValid && <>
        <Text style={styles.heading}>LLMで比較</Text>
        <Text style={styles.muted}>文字の違いを比較します。原音による正誤判定ではありません。元の書き起こしは残ります。</Text>
        {!run.comparison && <Button label="書き起こしの違いを比較" disabled={busy || compareCount < 2 || !keyFor(keys, "openai")} onPress={compare} />}
        {run.comparison && <>
          <Text selectable style={styles.body}>{run.comparison.summary}</Text>
          {run.comparison.differences.map((d, i) => <View key={i} style={{ gap: 8 }}>
            <Text style={styles.heading}>{d.topic}</Text><Text selectable style={styles.body}>{d.assessment}</Text>
            {d.quotes.map((q, j) => <Text key={j} selectable style={styles.muted}>{run.candidates.find(c => c.id === q.candidateId)?.model}: 「{q.text}」</Text>)}
          </View>)}
        </>}
      </>}
      <Button label={deletePrompt ? "この端末の録音・全結果を削除する" : "この録音を削除"} danger disabled={busy || capturing}
        onPress={() => deletePrompt ? drop() : setDeletePrompt(true)} />
      {deletePrompt && <Button label="削除をやめる" secondary onPress={() => setDeletePrompt(false)} />}
    </Card>}
    {error && <Text accessibilityRole="alert" style={styles.body}>{error}</Text>}
    <Text style={styles.muted}>この画面の記録は端末内だけに保存します。2台の共有・統合は接続準備中です。</Text>
    <Button label="画面デモを見る" secondary disabled={busy || capturing || isolating} onPress={onDemo} />
    <Button label="既存の共有API画面" secondary disabled={busy || capturing || isolating} onPress={onLegacy} />
  </View></ScrollView>;
}
