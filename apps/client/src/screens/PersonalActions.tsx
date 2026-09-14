import { useState } from "react";
import { Text, View } from "react-native";
import {
  type DemoRepository,
  type Saved,
  type Screen,
} from "../data/repository";
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
export type Confirm = (title: string, body: string, action: () => void) => void;
export function TodoScreen({
  repo,
  scenarioId,
  go,
  refresh,
  confirm,
}: {
  repo: DemoRepository;
  scenarioId: string;
  go: (screen: Screen, id?: string) => void;
  refresh: () => void;
  confirm: Confirm;
}) {
  const [tab, setTab] = useState<"candidate" | "open" | "done">("candidate");
  const [action, setAction] = useState("展示に使う写真を選ぶ");
  const [due, setDue] = useState("");
  const [own, setOwn] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <View style={styles.row}>
        {(["candidate", "open", "done"] as const).map((value) => (
          <Button
            key={value}
            label={{ candidate: "候補", open: "未完了", done: "完了" }[value]}
            secondary={tab !== value}
            onPress={() => setTab(value)}
          />
        ))}
      </View>
      {tab === "candidate" ? (
        <Card>
          <Badge>人工の候補 · 担当は未確認</Badge>
          <Heading>写真を選ぶ</Heading>
          <Text style={styles.muted}>
            会話で担当が決まったという意味ではありません。内容と担当を確認してから追加します。
          </Text>
          <Field
            label="自分の作業内容"
            value={action}
            onChangeText={setAction}
          />
          <Field
            label="期限（任意・YYYY-MM-DD）"
            value={due}
            onChangeText={setDue}
            placeholder="未設定"
          />
          <Check
            label="自分の作業として追加する"
            checked={own}
            onChange={setOwn}
          />
          <Button
            label="自分のToDoに追加"
            disabled={!own || !action.trim()}
            onPress={() => {
              try {
                repo.adopt(scenarioId, action, due || null, own);
                refresh();
                setTab("open");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <Button
            label="会話の根拠へ"
            secondary
            onPress={() => go("conversation", scenarioId)}
          />
        </Card>
      ) : (
        <>
          {repo.todos
            .filter((t) => t.status === tab)
            .map((t) => (
              <Card key={t.id}>
                <Heading>
                  {t.source_state === "available"
                    ? t.action
                    : "元の記録を利用できません"}
                </Heading>
                {t.source_state === "available" && (
                  <>
                    <Text style={styles.muted}>
                      {t.due ? `期限: ${t.due}` : "期限は未設定"}
                    </Text>
                    <Button
                      label={
                        t.status === "open" ? "完了にする" : "未完了へ戻す"
                      }
                      onPress={() => {
                        repo.toggleTodo(t.id);
                        refresh();
                      }}
                    />
                    <Button
                      label="根拠を開く"
                      secondary
                      onPress={() => go("conversation", t.scenario_id)}
                    />
                  </>
                )}
                <Button
                  label="ToDoを削除"
                  secondary
                  onPress={() =>
                    confirm(
                      "ToDoを削除しますか？",
                      "元の会話は残ります。",
                      () => {
                        repo.removeTodo(t.id);
                        refresh();
                      },
                    )
                  }
                />
              </Card>
            ))}
          {!repo.todos.some((t) => t.status === tab) && (
            <Empty
              title={
                tab === "open"
                  ? "未完了のToDoはありません"
                  : "完了したToDoはありません"
              }
              body="候補から自分の作業を追加できます。"
            />
          )}
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.body}>
          {error}
        </Text>
      )}
    </>
  );
}
export function SavedScreen({
  repo,
  go,
  edit,
  refresh,
  confirm,
}: {
  repo: DemoRepository;
  go: (screen: Screen, id?: string) => void;
  edit: (saved: Saved) => void;
  refresh: () => void;
  confirm: Confirm;
}) {
  const [filter, setFilter] = useState<"all" | Saved["tag"]>("all");
  return (
    <>
      <Text style={styles.muted}>
        大切にしておきたい発言と、自分だけのメモ。
      </Text>
      <View style={styles.row}>
        {(["all", "idea", "memory", "other"] as const).map((value) => (
          <Button
            key={value}
            label={
              {
                all: "すべて",
                idea: "アイデア",
                memory: "思い出",
                other: "その他",
              }[value]
            }
            secondary={filter !== value}
            onPress={() => setFilter(value)}
          />
        ))}
      </View>
      {repo.saved
        .filter((s) => filter === "all" || s.tag === filter)
        .map((s) => (
          <Card key={s.id}>
            {s.source_state !== "available" ? (
              <>
                <Heading>
                  {s.source_state === "needs_review"
                    ? "根拠の確認が必要です"
                    : "元の記録を利用できません"}
                </Heading>
                <Text style={styles.muted}>
                  以前の引用とメモは表示できません。
                </Text>
              </>
            ) : (
              <>
                <Badge>
                  {
                    { idea: "アイデア", memory: "思い出", other: "その他" }[
                      s.tag
                    ]
                  }
                </Badge>
                <Text style={styles.body}>{s.text}</Text>
                {!!s.note && (
                  <Text style={styles.muted}>自分のメモ: {s.note}</Text>
                )}
                <Button
                  label="根拠を開く"
                  secondary
                  onPress={() => go("conversation", s.scenario_id)}
                />
                <Button
                  label="メモ・タグを編集"
                  secondary
                  onPress={() => edit(s)}
                />
              </>
            )}
            <Button
              label="保存を解除"
              secondary
              onPress={() =>
                confirm(
                  "保存を解除しますか？",
                  "メモも削除します。元の会話は消えません。",
                  () => {
                    repo.removeSaved(s.id, true);
                    refresh();
                  },
                )
              }
            />
          </Card>
        ))}
      {!repo.saved.length && (
        <Empty
          title="まだ保存はありません"
          body="会話の発言で「あとで見る」を押すと、ここから見返せます。"
        />
      )}
    </>
  );
}
