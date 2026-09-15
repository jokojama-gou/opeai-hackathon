import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { mockSamples } from "../data/mock-transcription";
import { Badge, Button, Card, Check, colors, Heading, styles } from "../ui/primitives";
import { Cassette } from "./SetlogScreens";

type Phase = "idle" | "recording" | "saved" | "processing" | "ready" | "failed" | "empty";
type ResultTab = "transcript" | "summary" | "todos";
type SavedRecord = { sampleIndex: number; checked: number[] };
const resultTabs = [["transcript", "文字起こし"], ["summary", "要約"], ["todos", "ToDo"]] as const;

export function MockTranscriptionScreen({ onExamples }: { onExamples: () => void }) {
  const wide = useWindowDimensions().width >= 900;
  const [page, setPage] = useState<"recording" | "records">("recording");
  const [sampleIndex, setSampleIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<ResultTab>("transcript");
  const [checked, setChecked] = useState<number[]>([]);
  const [saved, setSaved] = useState<SavedRecord[]>([]);
  const [outcome, setOutcome] = useState<"ready" | "failed" | "empty">("ready");
  const [highlight, setHighlight] = useState<number | null>(null);
  const resultScroll = useRef<ScrollView>(null);
  const sample = mockSamples[sampleIndex];
  const busy = phase === "recording" || phase === "processing";
  const savedRecord = saved.find((record) => record.sampleIndex === sampleIndex);

  useEffect(() => {
    if (phase !== "recording") return;
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.min(300, Math.floor((Date.now() - start) / 1000))), 250);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => { if (phase === "recording" && seconds >= 300) setPhase("saved"); }, [phase, seconds]);
  useEffect(() => {
    if (phase !== "processing") return;
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1000),
      setTimeout(() => { setPhase(outcome); setOutcome("ready"); }, 1600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase, outcome]);

  const selectSample = (index: number) => {
    setSampleIndex(index); setPhase("idle"); setSeconds(0); setStep(0);
    setChecked([...(saved.find((record) => record.sampleIndex === index)?.checked ?? [])]); setTab("transcript"); setHighlight(null); setOutcome("ready");
  };
  const process = () => { setStep(0); setTab("transcript"); setHighlight(null); setPhase("processing"); };
  const showSource = (index: number) => { setTab("transcript"); setHighlight(index); resultScroll.current?.scrollTo({ y: 0, animated: false }); };
  const saveRecord = () => setSaved((records) => [{ sampleIndex, checked: [...checked] }, ...records.filter((record) => record.sampleIndex !== sampleIndex)]);
  const openRecord = (record: SavedRecord) => {
    setSampleIndex(record.sampleIndex); setChecked([...record.checked]); setPhase("ready");
    setTab("transcript"); setHighlight(null); setPage("recording");
  };
  const toggleTodo = (index: number) => {
    const next = checked.includes(index) ? checked.filter((item) => item !== index) : [...checked, index];
    setChecked(next);
    setSaved((records) => records.map((record) => record.sampleIndex === sampleIndex ? { ...record, checked: next } : record));
  };

  return <View style={styles.page}>
    <View style={s.topbar}>
      <View style={styles.row}><Text style={s.logo}>Setlog</Text><Badge>モック体験</Badge></View>
      <Text style={styles.muted}>今日の声を、明日の自分へ。</Text>
    </View>
    <View style={[s.shell, { flexDirection: wide ? "row" : "column" }]}>
      <View style={[s.nav, wide ? { width: 180, paddingTop: 30 } : { flexDirection: "row", paddingVertical: 8 }]}>
        {([["recording", "◎", "録音"], ["records", "▤", "自分の記録"]] as const).map(([value, icon, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} aria-selected={page === value} accessibilityState={{ selected: page === value, disabled: busy }} disabled={busy} onPress={() => setPage(value)} style={[s.navItem, !wide && { flex: 1 }, page === value && { backgroundColor: colors.pale }]}><Text style={s.navText}>{icon}　{label}{value === "records" && saved.length ? ` ${saved.length}` : ""}</Text></Pressable>)}
        {wide && <View style={{ flex: 1 }} />}
        {wide && <Text style={[styles.muted, { padding: 12, fontSize: 12 }]}>何気ない会話に、{"\n"}あとから気づくこと。</Text>}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: wide ? 32 : 18, gap: 22 }}>
        <View style={{ gap: 6 }}><Text accessibilityRole="header" style={styles.title}>{page === "records" ? "残した声を、振り返る。" : "話したことが、次の一歩に。"}</Text><Text style={styles.muted}>架空の会話で体験できます。マイク・外部APIは使いません。</Text></View>
        {page === "records" ? <>
          <Text style={styles.muted}>この画面を開いている間のデモ記録です。再読み込みでリセットされます。</Text>
          {!saved.length && <Card><Heading>はじめての記録を残そう</Heading><Text style={styles.muted}>文字起こしの結果から「このデモ記録を保存」を押すと、ここに並びます。</Text><Button label="録音のデモへ" onPress={() => setPage("recording")} /></Card>}
          {saved.map((record) => <Pressable key={record.sampleIndex} accessibilityRole="button" accessibilityLabel={`${mockSamples[record.sampleIndex].title}を開く`} onPress={() => openRecord(record)}><Card><Badge>自分の記録 · モック</Badge><Heading>{mockSamples[record.sampleIndex].title}</Heading><Text style={styles.muted}>{mockSamples[record.sampleIndex].duration} ・ 文字起こし / 要約 / ToDo　 →</Text></Card></Pressable>)}
        </> : <View style={{ flexDirection: wide ? "row" : "column", gap: 24, alignItems: "stretch" }}>
          <View style={{ width: wide ? 340 : "100%", gap: 16 }}>
            <View style={s.recorder}>
              <View style={styles.row}><View style={[s.dot, { backgroundColor: phase === "recording" ? colors.red : colors.green }]} /><Text style={styles.small}>{phase === "recording" ? "デモ録音中" : phase === "saved" ? "サンプルの準備ができました" : "あなたの声の、入り口。"}</Text></View>
              <Cassette recording={phase === "recording"} />
              <Text style={s.timer}>{phase === "recording" ? `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}` : "00:00"}</Text>
              <Text style={[styles.muted, { textAlign: "center" }]}>{sample.title}{"\n"}{sample.duration} の架空サンプル</Text>
              {phase === "recording" ? <Button label="■  デモ録音を止める" danger onPress={() => setPhase("saved")} /> : phase === "saved" ? <Button label="文字起こしする" onPress={process} /> : phase === "processing" ? <Button label="文字起こし中…" busy onPress={() => {}} /> : <Button label={phase === "idle" ? "デモ録音を始める" : "もう一度試す"} onPress={() => { selectSample(sampleIndex); setPhase("recording"); }} />}
              {phase === "idle" && <Pressable accessibilityRole="button" onPress={() => setPhase("saved")} style={s.textButton}><Text style={s.link}>録音をスキップしてサンプルを使う →</Text></Pressable>}
              <Text style={[styles.muted, { fontSize: 12, textAlign: "center" }]}>録音操作はシミュレーションです。</Text>
            </View>
            <Card style={{ gap: 10 }}><Text style={styles.small}>試す会話を選ぶ</Text>{mockSamples.map((item, index) => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={item.title} aria-checked={index === sampleIndex} accessibilityState={{ checked: index === sampleIndex, disabled: busy }} disabled={busy} onPress={() => selectSample(index)} style={[s.sample, index === sampleIndex && { borderColor: colors.green, backgroundColor: "#F1F7EE" }]}><Text style={styles.body}>{item.title}</Text><Text style={styles.muted}>{item.category} ・ {item.duration}</Text></Pressable>)}</Card>
            {(phase === "idle" || phase === "saved") && <View style={{ gap: 8 }}><Text style={styles.muted}>デモの結果</Text><View style={styles.row}>{([["ready", "正常"], ["failed", "エラー"], ["empty", "無音"]] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} aria-checked={outcome === value} accessibilityState={{ checked: outcome === value }} onPress={() => setOutcome(value)} style={[s.chip, outcome === value && { backgroundColor: colors.pale }]}><Text style={s.link}>{label}</Text></Pressable>)}</View></View>}
          </View>
          <View style={[s.results, { flex: wide ? 1 : undefined, minWidth: 0 }]}>
            <View style={s.resultHeader}><View style={{ gap: 6 }}><Text style={styles.small}>会話のノート</Text><Heading>{phase === "ready" ? sample.title : "声が、ことばになる。"}</Heading></View><Badge>{phase === "ready" ? "作成済み · モック" : "自分の記録"}</Badge></View>
            {phase === "ready" ? <>
              <View style={s.resultTabs}>{resultTabs.map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} aria-selected={tab === value} accessibilityState={{ selected: tab === value }} onPress={() => { setTab(value); setHighlight(null); }} style={[s.resultTab, tab === value && { borderBottomColor: colors.green }]}><Text style={[styles.body, tab === value && { color: colors.green, fontWeight: "700" }]}>{label}</Text></Pressable>)}</View>
              <ScrollView ref={resultScroll} style={wide ? { maxHeight: 600 } : undefined} contentContainerStyle={{ padding: 22, gap: 16 }}>
                <Text style={[styles.muted, { fontSize: 12 }]}>{tab === "transcript" ? "用意した原文の見本です。話者ラベルは本人の確認ではありません。" : tab === "summary" ? "AI要約の見本です。各カードから元の発言を確認できます。" : "会話から見つけた候補の見本です。完了状態を試せます。"}</Text>
                {tab === "transcript" && sample.lines.map((line, index) => <View key={line.time} style={[s.utterance, highlight === index && { backgroundColor: colors.pale, borderColor: colors.green }]}><View style={styles.row}><Text style={[s.speaker, { backgroundColor: index % 2 ? "#EDE8FA" : colors.pale }]}>{line.speaker}</Text><Text style={styles.muted}>{line.time}</Text>{highlight === index && <Text style={styles.small}>参照している発言</Text>}</View><Text selectable style={styles.body}>{line.text}</Text></View>)}
                {tab === "summary" && sample.summary.map((item) => <Card key={item.title} style={{ backgroundColor: "#F7FAF4" }}><Heading>{item.title}</Heading><Text style={styles.body}>{item.body}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${item.title}の元の発言`} onPress={() => showSource(item.source)} style={s.textButton}><Text style={s.link}>↗ 元の発言　{sample.lines[item.source].time}</Text></Pressable></Card>)}
                {tab === "todos" && <><Text style={styles.small}>{checked.length} / {sample.todos.length} 完了</Text>{sample.todos.map((todo, index) => <Card key={todo.title}><Check label={todo.title} checked={checked.includes(index)} onChange={() => toggleTodo(index)} /><Text style={styles.muted}>{todo.detail}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${todo.title}の元の発言`} onPress={() => showSource(todo.source)} style={s.textButton}><Text style={s.link}>↗ 元の発言　{sample.lines[todo.source].time}</Text></Pressable></Card>)}</>}
              </ScrollView>
              <View style={s.resultFooter}><Button label={savedRecord ? "自分の記録に保存済み" : "このデモ記録を保存"} secondary disabled={!!savedRecord} onPress={saveRecord} /><Text style={[styles.muted, { fontSize: 12 }]}>保存はこのデモ内だけ。再読み込みでリセットされます。</Text></View>
            </> : phase === "processing" ? <View style={s.placeholder}><ActivityIndicator color={colors.green} size="large" /><Text accessibilityLiveRegion="polite" style={styles.heading}>{["サンプルを読み込んでいます", "ことばを並べています", "要約とToDoをまとめています"][step]}</Text><View style={styles.row}>{["文字起こし", "要約", "ToDo"].map((label, index) => <Text key={label} style={[styles.muted, index <= step && { color: colors.green }]}>{index < step ? "✓" : "○"} {label}</Text>)}</View><Text style={styles.muted}>モックの処理を再現しています。</Text></View> : phase === "failed" || phase === "empty" ? <View style={s.placeholder}><Text style={{ fontSize: 36 }}>{phase === "failed" ? "↻" : "…"}</Text><Heading>{phase === "failed" ? "文字起こしを完了できませんでした" : "発言を見つけられませんでした"}</Heading><Text style={styles.muted}>{phase === "failed" ? "エラーの見本です。再試行すると同じサンプルで正常な結果を確認できます。" : "無音の結果の見本です。別の会話を選ぶか、このサンプルで再試行できます。"}</Text><Button label="サンプルで再試行" onPress={process} /></View> : <View style={s.placeholder}><Text style={s.emptyIcon}>〰</Text><Heading>{phase === "recording" ? "いまは、会話に集中。" : phase === "saved" ? "ことばにする準備ができました。" : "話したあとに、見えてくる。"}</Heading><Text style={[styles.muted, { textAlign: "center", maxWidth: 340 }]}>{phase === "recording" ? "停止したあとに文字起こしできます。" : phase === "saved" ? "「文字起こしする」を押すと、結果がここに表示されます。" : "録音のデモを始めるか、サンプルを選んで、会話がノートになる流れを試してみましょう。"}</Text><View style={styles.row}>{["01  文字起こし", "02  要約", "03  ToDo"].map((label) => <Text key={label} style={s.feature}>{label}</Text>)}</View></View>}
          </View>
        </View>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={onExamples} style={s.textButton}><Text style={styles.muted}>共有・出典・保存の操作デモも見る →</Text></Pressable>
      </ScrollView>
    </View>
  </View>;
}

const s = StyleSheet.create({
  topbar: { paddingHorizontal: 28, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, backgroundColor: colors.white },
  logo: { fontSize: 30, letterSpacing: -1.5, fontWeight: "700", color: colors.green, fontFamily: "NotoSansJP" },
  shell: { flex: 1, width: "100%", maxWidth: 1500, alignSelf: "center" },
  nav: { padding: 12, gap: 6, borderRightWidth: 1, borderColor: colors.line },
  navItem: { minHeight: 50, justifyContent: "center", padding: 12, borderRadius: 14 },
  navText: { color: colors.green, fontSize: 15, fontFamily: "NotoSansJP", fontWeight: "600" },
  recorder: { backgroundColor: "#EFF5E9", borderWidth: 1, borderColor: "#DCE6D3", borderRadius: 24, padding: 22, gap: 12 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  timer: { fontSize: 46, fontWeight: "300", color: colors.ink, fontVariant: ["tabular-nums"], textAlign: "center", letterSpacing: 2 },
  sample: { minHeight: 72, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 4 },
  chip: { minHeight: 48, minWidth: 68, paddingHorizontal: 16, justifyContent: "center", alignItems: "center", borderRadius: 24, borderWidth: 1, borderColor: colors.line },
  textButton: { minHeight: 48, justifyContent: "center" },
  link: { color: colors.green, fontSize: 14, lineHeight: 22, fontFamily: "KosugiMaru" },
  results: { borderWidth: 1, borderColor: colors.line, borderRadius: 24, overflow: "hidden", backgroundColor: colors.white },
  resultHeader: { padding: 24, gap: 14, borderBottomWidth: 1, borderColor: colors.line },
  resultTabs: { flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.line },
  resultTab: { flex: 1, minHeight: 56, justifyContent: "center", alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  resultFooter: { padding: 20, gap: 8, borderTopWidth: 1, borderColor: colors.line },
  placeholder: { minHeight: 360, padding: 26, alignItems: "center", justifyContent: "center", gap: 22, flex: 1 },
  emptyIcon: { fontSize: 56, color: colors.green, backgroundColor: "#F1F7EE", paddingHorizontal: 24, borderRadius: 28 },
  feature: { color: colors.muted, fontSize: 12, padding: 10, borderRadius: 12, backgroundColor: colors.page },
  utterance: { gap: 10, padding: 14, borderWidth: 1, borderColor: "transparent", borderRadius: 14 },
  speaker: { overflow: "hidden", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, color: colors.ink, fontSize: 12, fontWeight: "600" },
});
