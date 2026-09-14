import { useState } from "react";
import { Text } from "react-native";
import * as Crypto from "expo-crypto";
import { type ApiClient, type Source } from "@hackathon/api";
import { sourceTime } from "../data/repository";
import { Button, Card, Field, Heading, styles } from "../ui/primitives";

export function LiveSourceCard({
  source,
  api,
  run,
  busy,
  onSaved,
  onOpenSaved,
}: {
  source: Source;
  api: ApiClient;
  run: (action: () => Promise<void>) => void;
  busy: boolean;
  onSaved: () => Promise<void>;
  onOpenSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [text, setText] = useState(source.original_text);
  const [rebind, setRebind] = useState<{ id: string; version: number } | null>(
    null,
  );
  const changed = text !== source.original_text;
  async function save() {
    const request_key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify([source.id, source.version, text]),
    );
    await api.request(`/v1/sources/${source.id}/corrections`, "POST", {
      request_key,
      expected_version: source.version,
      replacement: text,
    });
    setEditing(false);
    await onSaved();
  }
  async function saveForLater() {
    const body = {
      expected_version: rebind?.version ?? 0,
      target_kind: "source",
      target_id: source.id,
      target_version: source.version,
      tag: "other",
      private_note: "",
    };
    const path = rebind
      ? `/v1/saved-items/${rebind.id}/rebind`
      : "/v1/saved-items";
    const request_key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify([path, body]),
    );
    const result = await api.request<{
      id: string;
      version: number;
      source_state?: string;
    }>(path, "POST", { request_key, ...body });
    if (result.source_state === "needs_review") setRebind(result);
    else onOpenSaved();
  }
  return (
    <Card>
      <Text style={styles.muted}>
        {sourceTime(source)} · {source.speaker_label ?? "話者不明"}
      </Text>
      <Text style={styles.body}>{source.original_text}</Text>
      {editing ? (
        discard ? (
          <>
            <Heading>変更を保存せず閉じますか？</Heading>
            <Button
              label="編集に戻る"
              secondary
              onPress={() => setDiscard(false)}
            />
            <Button
              label="変更を破棄して閉じる"
              onPress={() => {
                setEditing(false);
                setDiscard(false);
                setText(source.original_text);
              }}
            />
          </>
        ) : (
          <>
            <Text style={styles.muted}>
              変更前の原文を履歴に残します。この入力に依存する古い整理は再確認が必要になります。
            </Text>
            <Field
              label="訂正後の文字"
              multiline
              value={text}
              onChangeText={setText}
              maxLength={1000}
            />
            <Button
              label="訂正を保存"
              busy={busy}
              disabled={
                !changed || !text.trim() || Array.from(text).length > 1000
              }
              onPress={() => run(save)}
            />
            <Button
              label="訂正を閉じる"
              secondary
              disabled={busy}
              onPress={() => (changed ? setDiscard(true) : setEditing(false))}
            />
          </>
        )
      ) : (
        <Button
          label="自分の入力を訂正"
          secondary
          onPress={() => setEditing(true)}
        />
      )}
      {!editing &&
        (rebind ? (
          <>
            <Text style={styles.muted}>
              訂正後のこの原文で保存し直します。古いメモは引き継ぎません。
            </Text>
            <Button
              label="この原文を確認して保存し直す"
              busy={busy}
              onPress={() => run(saveForLater)}
            />
          </>
        ) : (
          <Button
            label="あとで見る"
            secondary
            busy={busy}
            onPress={() => run(saveForLater)}
          />
        ))}
    </Card>
  );
}
