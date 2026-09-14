import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { type ApiClient } from "@hackathon/api";
import { errorText } from "../data/useLiveWorkspace";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Heading,
  styles,
} from "../ui/primitives";
type Saved = {
  id: string;
  version: number;
  source_state: "available" | "needs_review" | "unavailable";
  text?: string;
  tag?: "idea" | "memory" | "other";
  private_note?: string;
  expires_at?: string;
  recording_id?: string;
};
export function LiveSaved({
  api,
  onSource,
}: {
  api: ApiClient;
  onSource: (recordingId: string) => void;
}) {
  const [items, setItems] = useState<Saved[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  async function refresh() {
    try {
      const values = await api.request<Saved[]>("/v1/saved-items");
      if (
        !Array.isArray(values) ||
        values.some(
          (v) =>
            typeof v.id !== "string" ||
            !["available", "needs_review", "unavailable"].includes(
              v.source_state,
            ),
        )
      )
        throw new Error("保存内容を読み取れませんでした。");
      if (mounted.current) {
        setItems(values);
        setError("");
      }
    } catch (e) {
      if (mounted.current) {
        setItems([]);
        setError(errorText(e));
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [api]);
  useEffect(() => {
    const dates = items.flatMap((item) =>
      item.source_state === "available" && item.expires_at
        ? [Date.parse(item.expires_at)]
        : [],
    );
    if (!dates.length) return;
    const timer = setTimeout(
      () => {
        setItems([]);
        void refresh();
      },
      Math.max(0, Math.min(Math.min(...dates) - Date.now(), 2147483647)),
    );
    return () => clearTimeout(timer);
  }, [items]);
  return (
    <>
      <Heading>自分だけの保存</Heading>
      <Text style={styles.muted}>
        保存しても元の記録の保持期限は延長されません。メモをAIへ送信しません。
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.body}>
          {error}
        </Text>
      )}
      {items.map((item) => (
        <SavedCard
          key={`${item.id}:${item.version}:${item.source_state}`}
          item={item}
          api={api}
          onChanged={refresh}
          onSource={onSource}
        />
      ))}
      {!loading && !items.length && (
        <Empty
          title="保存はまだありません"
          body="自分の文字起こしから「あとで見る」を選べます。"
        />
      )}
      <Button
        label="保存一覧を更新"
        secondary
        busy={loading}
        onPress={() => void refresh()}
      />
    </>
  );
}
function SavedCard({
  item,
  api,
  onChanged,
  onSource,
}: {
  item: Saved;
  api: ApiClient;
  onChanged: () => Promise<void>;
  onSource: (id: string) => void;
}) {
  const [note, setNote] = useState(item.private_note ?? "");
  const [tag, setTag] = useState(item.tag ?? "other");
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function mutate(remove: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const body = {
        expected_version: item.version,
        ...(remove
          ? { confirm_note_deletion: true }
          : { tag, private_note: note }),
      };
      const request_key = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        JSON.stringify([remove, item.id, body]),
      );
      await api.request(
        `/v1/saved-items/${item.id}`,
        remove ? "DELETE" : "PATCH",
        { request_key, ...body },
      );
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Card>
      {item.source_state === "available" ? (
        <>
          <Badge>自分だけ</Badge>
          <Text style={styles.body}>{item.text}</Text>
          <Text style={styles.muted}>
            期限:{" "}
            {item.expires_at
              ? new Date(item.expires_at).toLocaleDateString("ja-JP")
              : "確認が必要"}
          </Text>
          <View style={styles.row}>
            {(["idea", "memory", "other"] as const).map((value) => (
              <Button
                key={value}
                label={
                  { idea: "アイデア", memory: "思い出", other: "その他" }[value]
                }
                secondary={tag !== value}
                onPress={() => setTag(value)}
              />
            ))}
          </View>
          <Field
            label="自分だけのメモ"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
          />
          <Button
            label="メモとタグを保存"
            busy={busy}
            disabled={note === item.private_note && tag === item.tag}
            onPress={() => void mutate(false)}
          />
          {item.recording_id && (
            <Button
              label="元の記録を見る"
              secondary
              onPress={() => onSource(item.recording_id!)}
            />
          )}
        </>
      ) : (
        <>
          <Heading>
            {item.source_state === "needs_review"
              ? "元の記録の確認が必要です"
              : "元の記録を利用できません"}
          </Heading>
          <Text style={styles.muted}>
            引用とメモは表示しません。訂正後の自分の原文から選び直せます。
          </Text>
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.body}>
          {error}
        </Text>
      )}
      {deleting ? (
        <>
          <Text style={styles.body}>保存を解除するとメモも削除します。</Text>
          <Button
            label="メモも削除して保存解除"
            danger
            busy={busy}
            onPress={() => void mutate(true)}
          />
          <Button
            label="解除をやめる"
            secondary
            onPress={() => setDeleting(false)}
          />
        </>
      ) : (
        <Button
          label="保存を解除する"
          secondary
          onPress={() => setDeleting(true)}
        />
      )}
    </Card>
  );
}
