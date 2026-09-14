import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type DemoRepository, type Screen } from "../data/repository";
import {
  Badge,
  Button,
  Card,
  Check,
  Empty,
  Field,
  Heading,
  styles,
} from "../ui/primitives";
export function TodayScreen({
  repo,
  go,
}: {
  repo: DemoRepository;
  go: (screen: Screen, id?: string) => void;
}) {
  const [date, setDate] = useState("2026-09-14");
  const [selected, setSelected] = useState([
    "duplicate",
    "conflict",
    "audio-expired",
  ]);
  const [daily, setDaily] = useState<ReturnType<
    DemoRepository["daily"]
  > | null>(null);
  const [error, setError] = useState("");
  const available = repo.scenarios.filter(
    (s) => s.response_status === 200 && s.conversation?.status === "ready",
  );
  const stale = daily?.some(
    (item) => !available.some((s) => s.id === item.scenario_id),
  );
  return (
    <>
      <Text style={styles.muted}>会話の中にあったことを、もう一度。</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="振り返る日" value={date} onChangeText={setDate} />
        </View>
        <Button
          label="9月14日へ"
          secondary
          onPress={() => setDate("2026-09-14")}
        />
      </View>
      <Card>
        <Badge>この日に始まった会話</Badge>
        <Heading>
          {date === "2026-09-14"
            ? `${available.length}件の会話が残っています`
            : "この日の会話はありません"}
        </Heading>
        <Text style={styles.muted}>人工データは日本時間で表示しています。</Text>
        {date === "2026-09-14" &&
          available.map((s) => (
            <Check
              key={s.id}
              label={s.label}
              checked={selected.includes(s.id)}
              onChange={(value) =>
                setSelected((ids) =>
                  value ? [...ids, s.id] : ids.filter((id) => id !== s.id),
                )
              }
            />
          ))}
        <Button
          label={`選択した${date === "2026-09-14" ? selected.length : 0}件の振り返りを確認`}
          disabled={
            date !== "2026-09-14" || !selected.length || selected.length > 10
          }
          onPress={() => {
            try {
              setDaily(repo.daily(selected));
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
        <Text style={styles.muted}>
          画面確認用の原文抜粋です。AI生成は実行しません。
        </Text>
        {!!error && (
          <Text accessibilityRole="alert" style={styles.body}>
            {error}
          </Text>
        )}
      </Card>
      {daily &&
        date === "2026-09-14" &&
        (stale ? (
          <Empty
            title="振り返りの更新が必要です"
            body="元の記録が変更されました。利用できる会話を選び直してください。"
          />
        ) : (
          <Card>
            <Badge>振り返りの見本</Badge>
            <Heading>話したこと</Heading>
            {daily.map((d) => (
              <Pressable
                accessibilityRole="button"
                key={d.scenario_id}
                onPress={() => go("conversation", d.scenario_id)}
                style={{ paddingVertical: 10 }}
              >
                <Text style={styles.body}>{d.text}</Text>
                <Text style={styles.muted}>元の会話へ　↗</Text>
              </Pressable>
            ))}
            <Text style={styles.muted}>
              アイデア・約束・残る問いは、生成API接続後に根拠とともに表示します。
            </Text>
          </Card>
        ))}
      <View style={styles.row}>
        <Button
          label="確認したいこと"
          secondary
          onPress={() => go("confirmations")}
        />
        <Button
          label="自分のToDo"
          secondary
          onPress={() => go("todos", "duplicate")}
        />
      </View>
      <Heading>未完了のToDo</Heading>
      <Text style={styles.muted}>
        当日以外の会話から追加した作業も含みます。
      </Text>
      {repo.todos
        .filter((t) => t.status === "open" && t.source_state === "available")
        .slice(0, 3)
        .map((t) => (
          <Card key={t.id}>
            <Text style={styles.body}>{t.action}</Text>
            <Button
              label="ToDoを開く"
              secondary
              onPress={() => go("todos", t.scenario_id)}
            />
          </Card>
        ))}
      {!repo.todos.length && (
        <Text style={styles.muted}>
          会話の候補から、自分の作業を追加できます。
        </Text>
      )}
      <Button label="記録を始める" onPress={() => go("recording")} />
    </>
  );
}
