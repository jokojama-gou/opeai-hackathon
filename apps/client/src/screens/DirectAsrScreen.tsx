import { useEffect, useRef, useState } from "react";
import { AppState, ScrollView, Text, View } from "react-native";
import { Button, Card, Field, Heading, styles } from "../ui/primitives";
import { AsrError, errorLabel, keyFor, providers, runEnsemble, sleep, type EnsembleRun, type Keys } from "../data/direct-asr";
import { transcribe } from "../data/asr-providers";
import { compareTranscripts } from "../data/asr-comparison";
import { bundledKeys, comparisonModel } from "../data/asr-settings";
import { getAudio, loadRecordings, loadRun, providerFetch, removeRecording, saveRun, useDirectCapture, type LocalRecording } from "../platform/audio/direct-device";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const selection = useRef(0);
  const mounted = useRef(true);
  const [tick, setTick] = useState(Date.now());
  const capture = useDirectCapture(recording => {
    setSelected(recording); setRun(null); setDeletePrompt(false); selection.current++;
    void refresh();
  });
  async function refresh() {
    try { const found = await loadRecordings(); if (mounted.current) setRecords(found); }
    catch { if (mounted.current) setError("保存した録音を読み込めませんでした。"); }
  }
  useEffect(() => {
    mounted.current = true; void refresh();
    const timer = setInterval(() => setTick(Date.now()), 1000);
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") operation.current?.abort();
      else { setTick(Date.now()); void refresh(); }
    });
    return () => { mounted.current = false; operation.current?.abort(); clearInterval(timer); subscription.remove(); };
  }, []);
  const capturing = ["preparing", "recording", "stopping"].includes(capture.phase);
  const textValid = run && Date.parse(run.textExpiresAt) > tick;
  const audioValid = selected && Date.parse(selected.audio_expires_at) > tick;
  const compareCount = run?.candidates.filter(c => c.kind === "transcript" && c.status === "succeeded").length ?? 0;
  async function select(recording: LocalRecording) {
    if (operation.current) return;
    const version = ++selection.current;
    setSelected(recording); setRun(null); setExpanded(null); setError(null); setDeletePrompt(false);
    try { const loaded = await loadRun(recording.id); if (mounted.current && version === selection.current) setRun(loaded); }
    catch { setError("書き起こし結果を読み込めませんでした。"); }
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
    if (!selected) return;
    const recording = selected;
    void perform(async signal => {
      const input = await getAudio(recording);
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
      await removeRecording(recording); selection.current++;
      setSelected(null); setRun(null); setDeletePrompt(false); await refresh();
    });
  };
  return <ScrollView style={styles.page} keyboardShouldPersistTaps="handled"><View style={styles.content}>
    <Button label="自分の声を登録する（ログイン不要）" secondary disabled={busy || capturing} onPress={onVoice} />
    <Heading>録音を聞き比べる</Heading>
    <Text style={styles.body}>同じ音声を設定済みの各社へ送り、書き起こしを並べて確認します。</Text>
    <Card>
      <Text style={styles.title}>{time(capture.durationMs)}</Text>
      <Text style={styles.muted}>この端末に保存 · 録音は5分まで</Text>
      {capture.phase === "recording" ? <Button label="録音を停止して保存" onPress={() => { void capture.stop(); }} />
        : <Button label={capturing ? "録音を準備・保存しています" : "録音を開始"} disabled={busy || capturing || capture.phase === "save_failed"}
          onPress={() => { void capture.start("direct-device"); }} />}
      {capture.phase === "save_failed" && <Button label="保存を再試行" onPress={() => { void capture.retrySave(); }} />}
      {capture.error && <Text accessibilityRole="alert" style={styles.body}>{capture.error}</Text>}
    </Card>
    <Button label={settingsOpen ? "設定を閉じる" : "書き起こしの設定"} secondary disabled={busy || capturing} onPress={() => setSettingsOpen(!settingsOpen)} />
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
      disabled={busy || capturing} onPress={() => { void select(r); }} />)}
    {selected && <Card>
      <Text style={styles.heading}>この録音の書き起こし</Text>
      <Text style={styles.muted}>{providers.filter(p => keyFor(keys, p.id)).map(p => p.label).join(" / ") || "APIキー未設定"}</Text>
      {!audioValid && <Text style={styles.muted}>原音の保存期限が切れています。</Text>}
      {!run && <Button label="設定済みの全社で書き起こす" disabled={busy || capturing || !audioValid} onPress={process} />}
      {run && run.candidates.some(c => !["succeeded", "empty"].includes(c.status) && keyFor(keys, c.provider)) && <>
        <Text style={styles.muted}>再試行は未完了の会社だけに再送します。結果不明の処理も再送するため、重ねて実行される場合があります。</Text>
        <Button label="未完了の会社だけ再試行" disabled={busy || capturing || !audioValid} onPress={process} />
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
    <Button label="画面デモを見る" secondary disabled={busy || capturing} onPress={onDemo} />
    <Button label="既存の共有API画面" secondary disabled={busy || capturing} onPress={onLegacy} />
  </View></ScrollView>;
}
