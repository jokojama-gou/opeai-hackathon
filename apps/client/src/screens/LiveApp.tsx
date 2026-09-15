import { useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useLiveWorkspace } from "../data/useLiveWorkspace";
import { type Choices } from "../data/processing";
import { sourceTime } from "../data/repository";
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
import { GlassSurface } from "../ui/GlassSurface";
import { LiveSharing } from "./LiveSharing";
import { LiveSourceCard } from "./LiveSourceCard";
import { LiveSaved } from "./LiveSaved";
import { LiveToday, LiveTodos, LiveContextTools } from "./LiveInsights";
const captureLabels = {
  recording: "録音中",
  stopping: "端末へ保存中",
  saved: "端末に保存済み",
  interrupted: "中断した記録",
  save_failed: "保存の確認が必要",
};
const noChoices: Choices = {
  pc_audio_transfer: false,
  external_audio_transcription: false,
  external_text_generation: false,
};
export function LiveApp({ onDemo }: { onDemo: () => void }) {
  const w = useLiveWorkspace();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [choices, setChoices] = useState<Choices>(noChoices);
  const [deleting, setDeleting] = useState(false);
  const run = (action: () => Promise<void>) => {
    void w.perform(action);
  };
  let body;
  if (!w.ready)
    body = <Empty title="起動しています" body="端末の状態を確認しています。" />;
  else if (!w.api)
    body = (
      <>
        <Empty
          title="実機接続の準備中です"
          body="このビルドには接続先が設定されていません。開発用のHTTPS接続先を設定すると、ログインと録音の送信を利用できます。"
        />
        <Button label="人工データの画面を確認" onPress={onDemo} />
      </>
    );
  else if (!w.session)
    body = (
      <>
        <Card>
          <Badge>自分のアカウントで利用</Badge>
          <Heading>ログイン</Heading>
          <Field
            label="メールアドレス"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            label="パスワード"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Button
            label="ログインする"
            busy={w.busy}
            disabled={!email || !password}
            onPress={() =>
              run(async () => {
                await w.login(email, password);
                setPassword("");
              })
            }
          />
          <Text style={styles.muted}>
            開発用に用意した2人のアカウントを使います。
          </Text>
        </Card>
        <Button label="人工データの画面を確認" secondary onPress={onDemo} />
      </>
    );
  else if (w.screen === "settings")
    body = (
      <>
        <Card>
          <Heading>ログイン中</Heading>
          <Text style={styles.body}>{w.session.email}</Text>
          <Text style={styles.muted}>
            ログアウトしても、自分の未送信録音は端末に残ります。共有本文とログイン情報は消去します。
          </Text>
          <Button
            label="ログアウト"
            disabled={w.recordingActive || w.busy}
            onPress={() => run(w.logout)}
          />
        </Card>
        <Button
          label="人工データの画面へ"
          secondary
          disabled={w.recordingActive || w.busy}
          onPress={onDemo}
        />
      </>
    );
  else if (w.screen === "recording")
    body = (
      <GlassSurface style={{ borderRadius: 24, padding: 24, gap: 20 }}>
        <Badge>
          {w.capture.phase === "recording"
            ? "録音中"
            : w.capture.phase === "stopping"
              ? "端末へ保存中"
              : "本人が開始・停止"}
        </Badge>
        <Text style={[styles.title, { fontSize: 44 }]}>
          {Math.floor(w.capture.durationMs / 60000)
            .toString()
            .padStart(2, "0")}
          :
          {Math.floor((w.capture.durationMs / 1000) % 60)
            .toString()
            .padStart(2, "0")}
        </Text>
        {w.capture.durationMs >= 270000 && (
          <Text accessibilityRole="alert" style={styles.body}>
            残り30秒以内です。5分で自動停止します。
          </Text>
        )}
        <Text style={styles.body}>
          周りの人に、会話を記録することを伝えてください。録音は5分までです。
        </Text>
        {w.capture.phase === "recording" ? (
          <Button
            label="自分の記録を終了"
            danger
            onPress={() => void w.capture.stop()}
          />
        ) : w.capture.phase === "save_failed" ? (
          <Button
            label="保存を再試行"
            onPress={() => void w.capture.retrySave()}
          />
        ) : (
          <Button
            label="記録を始める"
            busy={
              w.capture.phase === "preparing" || w.capture.phase === "stopping"
            }
            disabled={Platform.OS === "web"}
            onPress={() => void w.capture.start(w.session!.user_id)}
          />
        )}
        <Text style={styles.muted}>
          停止後はまず端末に保存します。音声の転送と外部処理は別に確認します。
        </Text>
        {Platform.OS === "web" && (
          <Text style={styles.muted}>
            端末録音はiOS / Androidのdevelopment buildで確認してください。
          </Text>
        )}
      </GlassSurface>
    );
  else if (w.screen === "saved")
    body = w.connected ? (
      <LiveSaved api={w.api} onSource={(id) => run(() => w.openRemote(id))} />
    ) : (
      <Empty
        title="再接続してください"
        body="保存した内容は、現在の権限を確認してから表示します。"
      />
    );
  else if (w.screen === "today" || w.screen === "todos")
    body = w.connected ? (
      w.screen === "today" ? (
        <LiveToday api={w.api} onSource={(id) => run(() => w.openRemote(id))} />
      ) : (
        <LiveTodos api={w.api} onSource={(id) => run(() => w.openRemote(id))} />
      )
    ) : (
      <Empty
        title="再接続してください"
        body="現在の権限を確認してから内容を表示します。"
      />
    );
  else if (w.screen === "personal")
    body = (
      <>
        {w.selected && (
          <Card>
            <Badge>{captureLabels[w.selected.capture_status]}</Badge>
            <Text style={styles.body}>
              {new Date(w.selected.started_at).toLocaleString("ja-JP")}
            </Text>
            <Text style={styles.muted}>
              音声の保存期限:{" "}
              {new Date(w.selected.audio_expires_at).toLocaleDateString(
                "ja-JP",
              )}
            </Text>
            <Button
              label="端末の原音を再生"
              secondary
              disabled={Date.parse(w.selected.audio_expires_at) <= Date.now()}
              onPress={w.playLocal}
            />
            <Button label="再生を停止" secondary onPress={w.stopPlayback} />
            {(!w.selected.checksum || !w.selected.stopped_at) && (
              <Text style={styles.muted}>
                保存の完了を確認できていないため、この録音は送信できません。
              </Text>
            )}
            <Button
              label="この記録を処理する"
              disabled={
                !w.connected ||
                w.busy ||
                !w.selected.checksum ||
                !w.selected.stopped_at
              }
              onPress={() =>
                run(async () => {
                  await w.loadPolicy();
                  setChoices(noChoices);
                })
              }
            />
          </Card>
        )}
        {w.policy && w.selected && (
          <Card>
            <Heading>送信先と処理内容を確認</Heading>
            {(
              [
                "pc_audio_transfer",
                "external_audio_transcription",
                "external_text_generation",
              ] as const
            ).map((key) => (
              <View key={key} style={{ gap: 6 }}>
                <Check
                  label={
                    {
                      pc_audio_transfer: "開発PCへ音声を送る",
                      external_audio_transcription:
                        "指定サービスで音声を書き起こす",
                      external_text_generation: "文字をAIで整理する",
                    }[key]
                  }
                  checked={choices[key]}
                  disabled={
                    (key === "external_audio_transcription" &&
                      !w.policy!.transcription_configured) ||
                    (key === "external_text_generation" &&
                      !w.policy!.generation_configured)
                  }
                  onChange={(value) =>
                    setChoices((current) => ({ ...current, [key]: value }))
                  }
                />
                <Text style={styles.muted}>
                  送信先: {w.policy!.destinations[key] ?? "未設定"}
                </Text>
                <Text style={styles.muted}>{w.policy!.descriptions[key]}</Text>
              </View>
            ))}
            <Button
              label="確認した内容で処理する"
              busy={w.busy}
              disabled={!choices.pc_audio_transfer || !w.connected}
              onPress={() => run(() => w.process(choices))}
            />
          </Card>
        )}
        {!!w.stage && (
          <Card>
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {w.stage}
            </Text>
          </Card>
        )}
        <Heading>自分の文字起こし</Heading>
        {!w.connected ? (
          <Empty
            title="再接続してください"
            body="通信と権限を確認できるまで本文を表示しません。端末内の録音は再生できます。"
          />
        ) : w.sources.length && w.api ? (
          w.sources.map((source) => (
            <LiveSourceCard
              key={`${source.id}:${source.version}`}
              source={source}
              api={w.api!}
              run={run}
              busy={w.busy}
              onSaved={w.reloadSources}
              onOpenSaved={() => w.setScreen("saved")}
            />
          ))
        ) : (
          <Text style={styles.muted}>
            表示できる文字起こしはまだありません。
          </Text>
        )}
        {w.remoteId && (
          <Button
            label="状態を再取得"
            secondary
            disabled={!w.connected}
            onPress={() => run(w.reloadSources)}
          />
        )}
        {w.remoteId && w.sources.length > 0 && w.api && w.connected && (
          <LiveContextTools
            key={w.remoteId}
            api={w.api}
            recordingId={w.remoteId}
            onSource={(id) => run(() => w.openRemote(id))}
          />
        )}
        {w.remoteId && w.api && w.session && w.connected && (
          <LiveSharing
            key={w.remoteId}
            api={w.api}
            userId={w.session.user_id}
            recordingId={w.remoteId}
            sources={w.sources}
          />
        )}
        {w.selected &&
          (deleting ? (
            <Card>
              <Heading>この入力を削除しますか？</Heading>
              <Text style={styles.body}>
                自分の音声と文字を削除し、この入力に依存する結果を利用できなくします。相手の独立入力は別に残ります。
              </Text>
              <Button
                label="削除する"
                danger
                busy={w.busy}
                onPress={() =>
                  run(async () => {
                    await w.removeSelected();
                    setDeleting(false);
                  })
                }
              />
              <Button
                label="キャンセル"
                secondary
                onPress={() => setDeleting(false)}
              />
            </Card>
          ) : (
            <Button
              label="自分の入力を削除"
              secondary
              onPress={() => setDeleting(true)}
            />
          ))}
      </>
    );
  else
    body = (
      <>
        <Text style={styles.muted}>自分の端末で残した記録。</Text>
        <Button label="記録を始める" onPress={() => w.setScreen("recording")} />
        <Heading>この端末の記録</Heading>
        {w.local.map((record) => (
          <Card key={record.id}>
            <Badge>{captureLabels[record.capture_status]}</Badge>
            <Text style={styles.body}>
              {new Date(record.started_at).toLocaleString("ja-JP")}
            </Text>
            <Button
              label="自分の記録を開く"
              secondary
              onPress={() =>
                run(async () => {
                  setDeleting(false);
                  await w.openLocal(record);
                })
              }
            />
          </Card>
        ))}
        {!w.local.length && (
          <Empty
            title="まだ記録はありません"
            body="会話を記録すると、ここから振り返れます。"
          />
        )}
        <Heading>サーバーの記録</Heading>
        {w.remote
          .filter(
            (record) => !w.local.some((value) => value.remote_id === record.id),
          )
          .map((record) => (
            <Card key={record.id}>
              <Text style={styles.body}>
                {new Date(record.stopped_at).toLocaleString("ja-JP")}
              </Text>
              <Button
                label="文字起こしを開く"
                secondary
                onPress={() => run(() => w.openRemote(record.id))}
              />
            </Card>
          ))}
        <Button
          label="一覧を再取得"
          secondary
          disabled={!w.connected}
          onPress={() => run(w.refresh)}
        />
      </>
    );
  return (
    <View style={styles.page}>
      <View style={{ padding: 16, gap: 10 }}>
        <View style={[styles.row, { flexWrap: "wrap" }]}>
          <Heading>
            {w.screen === "personal"
              ? "自分の記録"
              : w.screen === "recording"
                ? "記録中"
                : w.screen === "settings"
                  ? "設定"
                  : w.screen === "saved"
                    ? "保存"
                    : w.screen === "today"
                      ? "今日"
                      : w.screen === "todos"
                        ? "ToDo"
                        : "記録"}
          </Heading>
          <View style={{ flex: 1 }} />
          {w.session && (
            <View style={[styles.row, { flexWrap: "wrap" }]}>
              <Button
                label="今日"
                secondary
                onPress={() => w.setScreen("today")}
              />
              <Button
                label="ToDo"
                secondary
                onPress={() => w.setScreen("todos")}
              />
              <Button
                label="保存"
                secondary
                onPress={() => w.setScreen("saved")}
              />
            </View>
          )}
          <Button
            label="設定"
            secondary
            disabled={w.recordingActive}
            onPress={() => w.setScreen("settings")}
          />
          {w.screen !== "records" && (
            <Button
              label="記録へ"
              secondary
              onPress={() => w.setScreen("records")}
            />
          )}
        </View>
        <Text style={styles.small}>実機・API接続モード</Text>
        {w.recordingActive && w.screen !== "recording" && (
          <Button
            label="録音中の画面へ"
            danger
            onPress={() => w.setScreen("recording")}
          />
        )}
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {(w.error || w.capture.error) && (
          <Card>
            <Text accessibilityRole="alert" style={styles.body}>
              {w.error || w.capture.error}
            </Text>
            <Button
              label="閉じる"
              secondary
              onPress={() => {
                w.setError("");
                w.capture.clearError();
              }}
            />
          </Card>
        )}
        {body}
      </ScrollView>
    </View>
  );
}
