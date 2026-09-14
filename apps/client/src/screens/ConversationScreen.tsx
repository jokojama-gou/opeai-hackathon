import { Pressable, Text, View } from "react-native";
import { scriptText, type Scenario, type ScriptItem } from "@hackathon/api";
import { type DemoRepository, type Screen } from "../data/repository";
import { Badge, Button, Card, Empty, Heading, styles } from "../ui/primitives";
export function ConversationScreen({
  scenario: s,
  repo,
  go,
  onEvidence,
  onSave,
}: {
  scenario: Scenario;
  repo: DemoRepository;
  go: (screen: Screen, id?: string) => void;
  onEvidence: (item: ScriptItem) => void;
  onSave: (item: ScriptItem) => void;
}) {
  if (s.response_status !== 200)
    return (
      <Empty
        title="元の記録を利用できません"
        body="保存期限または共有状態が変わりました。以前の本文は表示しません。"
      />
    );
  if (s.conversation?.status !== "ready")
    return (
      <Card>
        <Heading>
          {s.conversation?.status === "stale"
            ? "整理を更新中"
            : "範囲の確認が必要です"}
        </Heading>
        <Text style={styles.body}>
          {s.conversation?.status === "stale"
            ? "訂正を保存しました。新しい出典による再生成が必要です。人工データでは自動生成しません。"
            : "2つの記録の対応を確認できませんでした。自分の入力範囲を確認し直してください。"}
        </Text>
        <Button label="範囲を確認し直す" onPress={() => go("connect", s.id)} />
        <Button
          label="自分の記録へ"
          secondary
          onPress={() => go("personal", s.id)}
        />
      </Card>
    );
  return (
    <>
      <Badge>
        {s.recordings.length === 2
          ? "2つの記録から作成 · 相手と共有中"
          : "音声期限後の表示見本"}
      </Badge>
      <Text style={styles.title}>{s.label}</Text>
      <Card>
        <Heading>会話の整理</Heading>
        {s.conversation.highlights.map((h) => (
          <Pressable
            accessibilityRole="button"
            key={h.id}
            onPress={() => {
              const item = s.conversation!.script.find((u) =>
                h.utterance_ids.includes(u.id),
              );
              if (item) onEvidence(item);
            }}
          >
            <Text style={styles.body}>{h.text}</Text>
            <Text style={styles.muted}>根拠を確認　↗</Text>
          </Pressable>
        ))}
        <Text style={styles.muted}>確認できた決定はありません</Text>
      </Card>
      <View style={styles.row}>
        <Button label="次の行動" secondary onPress={() => go("todos", s.id)} />
        <Button
          label="予定候補"
          secondary
          onPress={() => go("calendar", s.id)}
        />
      </View>
      <Heading>会話</Heading>
      {s.conversation.script.map((item) => (
        <Card key={item.id}>
          <View style={styles.row}>
            <Badge>
              {item.kind === "conflict"
                ? "相違あり"
                : item.kind === "duplicate"
                  ? "出典2件"
                  : "出典1件"}
            </Badge>
            <Text style={styles.muted}>
              {item.speaker_label ?? "話者不明"}
              {item.order_status === "unknown"
                ? " · 位置を確認できない発言"
                : ""}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="この発言の出典を開く"
            onPress={() => onEvidence(item)}
          >
            <Text style={[styles.body, { fontSize: 18, lineHeight: 31 }]}>
              {scriptText(item, s.sources)}
            </Text>
          </Pressable>
          <View style={styles.row}>
            <Button
              label="元の記録を見る"
              secondary
              onPress={() => onEvidence(item)}
            />
            <Button
              label={
                repo.saved.some(
                  (saved) =>
                    saved.scenario_id === s.id &&
                    saved.utterance_id === item.id,
                )
                  ? "保存済み"
                  : "あとで見る"
              }
              secondary
              onPress={() => onSave(item)}
            />
          </View>
        </Card>
      ))}
    </>
  );
}
