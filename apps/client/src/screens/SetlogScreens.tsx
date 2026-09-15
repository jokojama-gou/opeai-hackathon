import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useLiveWorkspace } from "../data/WorkspaceProvider";
import { Button, Card, Empty, Heading, colors, styles } from "../ui/primitives";
import { RecordingButton } from "../ui/RecordingButton";

function duration(ms: number) { return `${Math.floor(ms / 60000).toString().padStart(2, "0")}:${Math.floor(ms / 1000 % 60).toString().padStart(2, "0")}`; }

function Cassette({ recording }: { recording: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!recording || reduceMotion) return;
    const animation = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true }));
    animation.start();
    return () => { animation.stop(); rotation.setValue(0); };
  }, [recording, reduceMotion, rotation]);
  return <View accessible={false} style={{ width: "100%", maxWidth: 460, aspectRatio: 1.5, alignSelf: "center" }}>
    <Image source={require("../../assets/setlog/cassette-v1.png")} style={{ width: "100%", height: "100%" }} />
    {recording && !reduceMotion && ["33.6%", "66.4%"].map((left) => <Animated.View key={left} pointerEvents="none" style={{ position: "absolute", left: left as `${number}%`, top: "47.2%", width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 17, borderWidth: 2, borderColor: "#FFFFFFBB", transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}><View style={{ position: "absolute", top: 0, left: 14, width: 3, height: 30, backgroundColor: "#FFFFFF99" }} /></Animated.View>)}
  </View>;
}

export function RecordingScreen() {
  const w = useLiveWorkspace();
  const recording = w.capture.phase === "recording";
  const saving = w.capture.phase === "stopping";
  return <View style={{ gap: 18, paddingTop: 12, paddingBottom: 12 }}>
    <View style={{ alignItems: "center", gap: 10 }}>
      <Text style={[styles.title, { textAlign: "center", fontSize: 25 }]}>{recording ? "今日の声を、記録中。" : saving ? "声を、大切に保存中。" : "今日の声を、残そう。"}</Text>
      <Text style={[styles.muted, { textAlign: "center" }]}>{recording ? "話している今も、あとからのヒントに。" : "何気ない会話に、明日のヒントがある。"}</Text>
    </View>
    <Cassette recording={recording} />
    <View style={{ alignItems: "center", gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: recording ? colors.red : colors.green }} /><Text style={styles.muted}>{recording ? "録音中" : saving ? "端末へ保存中" : "いつでも、ここから"}</Text></View>
      <Text style={{ fontSize: 48, lineHeight: 58, color: colors.ink, fontVariant: ["tabular-nums"], fontWeight: "300" }}>{recording || saving ? duration(w.capture.durationMs) : "00:00"}</Text>
    </View>
    <RecordingButton label={recording ? "■  記録を止める" : w.capture.phase === "save_failed" ? "保存を再試行" : "記録を始める"} danger={recording} busy={w.capture.phase === "preparing" || saving} disabled={Platform.OS === "web"} onPress={() => recording ? void w.capture.stop() : w.capture.phase === "save_failed" ? void w.capture.retrySave() : void w.capture.start(w.session!.user_id)} />
    <Text style={[styles.muted, { textAlign: "center", fontSize: 12, lineHeight: 20 }]}>周りの人に、会話を記録することを伝えてください。{"\n"}録音は5分まで。停止すると端末に保存します。</Text>
    {Platform.OS === "web" && <Text style={[styles.muted, { textAlign: "center" }]}>録音はAndroidアプリで使えます。</Text>}
  </View>;
}

export function RoomScreen() {
  const w = useLiveWorkspace();
  const count = w.local.length + w.remote.filter((record) => !w.local.some((local) => local.remote_id === record.id)).length;
  return <View style={{ gap: 26 }}>
    <Text style={styles.muted}>会話をきっかけに、振り返ろう。</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="自分の記録を開く" onPress={() => w.setScreen("records")} style={({ pressed }) => ({ backgroundColor: colors.pale, borderRadius: 22, padding: 24, gap: 18, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF99" }}><SymbolView name={{ ios: "waveform", android: "graphic_eq", web: "graphic_eq" }} tintColor={colors.green} size={24} /></View><Text style={{ color: colors.green, fontSize: 24 }}>↗</Text></View>
      <View style={{ gap: 6 }}><Heading>自分の記録</Heading><Text style={styles.muted}>残した声と、思い出したかったこと。</Text></View>
      <Text style={[styles.small, { color: colors.green }]}>{count}件の記録</Text>
    </Pressable>
    <View style={{ gap: 12 }}><Heading>相手とのルーム</Heading><Card><Text style={styles.body}>ここから、会話がつながる。</Text><Text style={styles.muted}>相手とのルームとAI会話は準備中です。会話を持ち寄る操作は、自分の記録から使えます。</Text></Card></View>
    <View style={{ gap: 12 }}><Heading>あとから振り返る</Heading><Card style={{ padding: 0, overflow: "hidden" }}>{([["saved", "保存したもの", "bookmark"], ["today", "日付から振り返る", "calendar"], ["todos", "ToDo", "checkmark.circle"]] as const).map(([screen, title, icon], index) => <Pressable key={screen} accessibilityRole="button" onPress={() => w.setScreen(screen)} style={({ pressed }) => ({ padding: 18, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 14, borderTopWidth: index ? 1 : 0, borderTopColor: colors.line, backgroundColor: pressed ? colors.pale : colors.white })}><SymbolView name={{ ios: icon, android: index === 0 ? "bookmark" : index === 1 ? "calendar_month" : "check_circle", web: index === 0 ? "bookmark" : index === 1 ? "calendar_month" : "check_circle" }} tintColor={colors.green} size={22} /><Text style={[styles.body, { flex: 1 }]}>{title}</Text><Text style={styles.muted}>›</Text></Pressable>)}</Card></View>
  </View>;
}

export function RecordsScreen() {
  const w = useLiveWorkspace();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const entries = [
    ...w.local.map((r) => ({ id: `local:${r.id}`, date: r.started_at, duration: r.duration_ms, label: r.capture_status === "interrupted" ? "中断した記録" : r.remote_id ? "送信済み" : "この端末に保存", open: () => w.openLocal(r) })),
    ...w.remote.filter((r) => !w.local.some((l) => l.remote_id === r.id)).map((r) => ({ id: `remote:${r.id}`, date: r.stopped_at, duration: r.duration_ms, label: "サーバーに保存", open: () => w.openRemote(r.id) })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) { const day = new Date(entry.date).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }); groups.set(day, [...groups.get(day) ?? [], entry]); }
  return <View style={{ gap: 18 }}>
    <Text style={styles.muted}>会話を残した日から、振り返る。</Text>
    {!entries.length && <Empty title="はじめての記録を残そう" body="録音した会話が、ここに並びます。何気ない会話から始めてみましょう。" />}
    {[...groups].map(([day, records]) => <View key={day} style={{ gap: 8 }}><Pressable accessibilityRole="button" accessibilityState={{ expanded: !collapsed[day] }} onPress={() => setCollapsed((state) => ({ ...state, [day]: !state[day] }))} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={[styles.small, { flex: 1, color: colors.muted, fontSize: 14 }]}>{day} ・ {records.length}件</Text><Text style={styles.muted}>{collapsed[day] ? "+" : "−"}</Text></Pressable>{!collapsed[day] && <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>{records.map((entry, index) => <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`${new Date(entry.date).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}の記録を開く`} onPress={() => void w.perform(entry.open)} style={({ pressed }) => ({ padding: 18, minHeight: 88, gap: 6, borderTopWidth: index ? 1 : 0, borderTopColor: colors.line, backgroundColor: pressed ? colors.pale : colors.white })}><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Text style={[styles.heading, { fontSize: 18, flex: 1 }]}>{new Date(entry.date).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} の記録</Text><Text style={styles.muted}>›</Text></View><Text style={styles.muted}>{duration(entry.duration)}  ・  {entry.label}</Text></Pressable>)}</Card>}</View>)}
    <Button label="一覧を再取得" secondary busy={w.busy} disabled={!w.connected} onPress={() => void w.perform(w.refresh)} />
    <Button label="記録を始める" onPress={() => w.setScreen("recording")} />
  </View>;
}
