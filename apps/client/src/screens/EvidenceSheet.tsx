import { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import {
  scriptText,
  type Scenario,
  type ScriptItem,
  type Source,
} from "@hackathon/api";
import {
  canPlay,
  ownSource,
  sourceTime,
  type DemoRepository,
} from "../data/repository";
import { Badge, Button, Card, Field, Heading, styles } from "../ui/primitives";
export function EvidenceSheet({
  scenario,
  item,
  repo,
  onClose,
  onChange,
}: {
  scenario: Scenario;
  item: ScriptItem;
  repo: DemoRepository;
  onClose: () => void;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<Source | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const close = () => {
    if (
      editing &&
      text !== (ownSource(scenario, editing) ? editing.original_text : "")
    )
      setDiscard(true);
    else onClose();
  };
  const submit = () => {
    if (!editing) return;
    try {
      if (ownSource(scenario, editing))
        repo.correct(scenario.id, editing.id, editing.version, text);
      else repo.report(scenario.id, editing.id, text);
      onChange();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <ScrollView contentContainerStyle={styles.content} style={styles.page}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Heading>
              {editing
                ? ownSource(scenario, editing)
                  ? "文字を訂正"
                  : "気になる点を伝える"
                : "元の記録を確かめる"}
            </Heading>
          </View>
          <Button label="閉じる" secondary onPress={close} />
        </View>
        {discard ? (
          <Card>
            <Heading>変更を保存せず閉じますか？</Heading>
            <Button label="編集に戻る" onPress={() => setDiscard(false)} />
            <Button label="変更を破棄して閉じる" danger onPress={onClose} />
          </Card>
        ) : editing ? (
          <>
            <Card>
              <Text style={styles.muted}>変更前の原文</Text>
              <Text style={styles.body}>{editing.original_text}</Text>
              <Text style={styles.muted}>
                {ownSource(scenario, editing)
                  ? "元の記録を残して訂正します。録音の持ち主と発言した人は同じとは限りません。"
                  : "相手の入力所有者へ指摘を残します。この操作だけで原文は変わりません。"}
              </Text>
            </Card>
            <Field
              label={
                ownSource(scenario, editing) ? "訂正後の文字" : "伝えたいこと"
              }
              multiline
              maxLength={2000}
              value={text}
              onChangeText={setText}
            />
            <Text style={styles.muted}>
              {Array.from(text).length} / 1000文字
            </Text>
            {!!error && (
              <Text accessibilityRole="alert" style={styles.body}>
                {error}
              </Text>
            )}
            <Button
              label={
                ownSource(scenario, editing)
                  ? "訂正を保存"
                  : "指摘を保存（人工データ）"
              }
              disabled={
                !text.trim() ||
                Array.from(text).length > 1000 ||
                (ownSource(scenario, editing) && text === editing.original_text)
              }
              onPress={submit}
            />
          </>
        ) : (
          <>
            <Card>
              <Badge>
                {item.kind === "conflict" ? "原文に相違あり" : "出典を確認"}
              </Badge>
              <Text style={styles.body}>
                {scriptText(item, scenario.sources)}
              </Text>
            </Card>
            {item.evidence_refs.map((ref, index) => {
              const source = scenario.sources.find(
                (s) => s.id === ref.source_id,
              )!;
              const own = ownSource(scenario, source);
              const playable = canPlay(scenario, source);
              return (
                <Card key={`${ref.source_id}-${index}`}>
                  <View style={styles.row}>
                    <Badge>{own ? "自分の入力" : "相手の入力"}</Badge>
                    <Text style={styles.muted}>{sourceTime(source)}</Text>
                  </View>
                  <Text style={styles.body}>{source.original_text}</Text>
                  <Text style={styles.muted}>
                    話者: {source.speaker_label ?? "不明"}
                  </Text>
                  <Text style={styles.muted}>
                    {source.start_ms === null
                      ? "時刻が不明なため再生できません。"
                      : !playable
                        ? "音声の保存期限が過ぎました。"
                        : "人工データのため、この出典に音声はありません。"}
                  </Text>
                  <Button
                    label="原音を再生"
                    secondary
                    disabled
                    onPress={() => {}}
                  />
                  <Button
                    label={own ? "文字を訂正" : "気になる点を伝える"}
                    secondary
                    onPress={() => {
                      setEditing(source);
                      setText(own ? source.original_text : "");
                      setError("");
                    }}
                  />
                  {repo.issues
                    .filter((issue) => issue.source_id === source.id)
                    .map((issue) => (
                      <Text key={issue.id} style={styles.muted}>
                        指摘: {issue.text}（確認待ち）
                      </Text>
                    ))}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
    </Modal>
  );
}
