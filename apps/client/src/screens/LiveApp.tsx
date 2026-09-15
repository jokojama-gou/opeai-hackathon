import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useLiveWorkspace } from "../data/WorkspaceProvider";
import { type WorkspaceScreen } from "../data/useLiveWorkspace";
import { RecordingScreen, RoomScreen, RecordsScreen } from "./SetlogScreens";
import { sourceTime } from "../data/repository";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Heading,
  colors,
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
export function LiveApp({ onDemo, nativeNavigation = false, routeScreen }: { onDemo: () => void; nativeNavigation?: boolean; routeScreen?: WorkspaceScreen }) {
  const workspace = useLiveWorkspace();
  const w = { ...workspace, screen: routeScreen ?? workspace.screen };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          title={
            w.connectionError === "invalid"
              ? "接続設定を確認してください"
              : "実機接続の準備中です"
          }
          body={
            w.connectionError === "invalid"
              ? "このビルドの接続先を利用できません。スマホから利用できるHTTPS接続先を設定して、ビルドし直してください。"
              : "このビルドには接続先が設定されていません。開発用のHTTPS接続先を設定すると、ログインと録音の送信を利用できます。"
          }
        />
        <Button label="人工データの画面を確認" onPress={onDemo} />
      </>
    );
  else if (!w.session)
    body = (
      <>
        <View style={{ alignItems: "center", gap: 8, paddingTop: 20 }}>
          <Text style={[styles.title, { fontSize: 36, letterSpacing: -1 }]}>Setlog</Text>
          <Text style={styles.body}>今日の声を、明日の自分へ。</Text>
          <Image source={require("../../assets/setlog/cassette-v1.png")} style={{ width: "100%", maxWidth: 360, aspectRatio: 1.5 }} accessibilityIgnoresInvertColors />
        </View>
        <Card>
          <Heading>おかえりなさい</Heading>
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
            autoCapitalize="none"
            autoCorrect={false}
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
            自分のアカウントで、会話の続きを残しましょう。
          </Text>
        </Card>
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
  else if (w.screen === "recording") body = <RecordingScreen />;
  else if (w.screen === "room") body = <RoomScreen />;
  else if (w.screen === "records") body = <RecordsScreen />;
  else if (w.screen === "confirmation") body = <Empty title="確認" body="会話の共有や記録の確認を、ここにまとめます。このモックでは準備中です。" />;
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
                })
              }
            />
          </Card>
        )}
        {w.policy && w.selected && (
          <Card>
            <Heading>送信先と処理内容を確認</Heading>
            <Text style={styles.muted}>
              書き起こし先: {w.policy.destinations.external_audio_transcription ?? "未設定"}
            </Text>
            <Text style={styles.muted}>{w.policy.descriptions.external_audio_transcription}</Text>
            <Text style={styles.muted}>{w.policy.descriptions.pc_audio_transfer}</Text>
            <Button
              label="この記録を処理する"
              busy={w.busy}
              disabled={!w.policy.transcription_configured || !w.policy.destinations.pc_audio_transfer || !w.connected}
              onPress={() => run(() => w.process())}
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
            key={`context:${w.remoteId}`}
            api={w.api}
            recordingId={w.remoteId}
            onSource={(id) => run(() => w.openRemote(id))}
          />
        )}
        {w.remoteId && w.api && w.session && w.connected && (
          <LiveSharing
            key={`sharing:${w.remoteId}`}
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
  else body = <RecordsScreen />;
  return (
    <View style={styles.page}>
      {!nativeNavigation && <View style={{ padding: 16, gap: 10 }}>
        <View style={[styles.row, { flexWrap: "wrap" }]}>
          {w.session && (
            <Button
              label="設定"
              secondary
              disabled={w.recordingActive}
              onPress={() => w.setScreen("settings")}
            />
          )}
          <Heading>
            {!w.session
              ? "会話の記録"
              : w.screen === "personal"
                ? "自分の記録"
                : w.screen === "recording"
                  ? "録音"
                  : w.screen === "settings"
                    ? "設定"
                    : w.screen === "saved"
                      ? "保存"
                      : w.screen === "today"
                        ? "日付から振り返る"
                        : w.screen === "todos"
                          ? "ToDo"
                          : w.screen === "room"
                            ? "ルーム"
                            : "記録"}
          </Heading>
          <View style={{ flex: 1 }} />
          {w.session && (
            <>
              {(w.screen === "today" || w.screen === "todos") && (
                <Button
                  label="ToDo"
                  secondary
                  onPress={() => w.setScreen("todos")}
                />
              )}
              {w.screen !== "room" && w.screen !== "recording" && (
                <Button
                  label="ルームへ"
                  secondary
                  onPress={() => w.setScreen("room")}
                />
              )}
            </>
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
      </View>}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        {nativeNavigation && w.session && w.recordingActive && w.screen !== "recording" && <Button label="録音中の画面へ" danger onPress={() => w.setScreen("recording")} />}
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
      {w.session && !nativeNavigation && (
        <GlassSurface
          style={{
            padding: 12,
            gap: 10,
            borderTopWidth: 1,
            borderColor: colors.line,
          }}
        >
          {(w.screen === "today" || w.screen === "records") &&
            !w.recordingActive && (
              <Button
                label="記録を始める"
                onPress={() => w.setScreen("recording")}
              />
            )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(
              [
                ["recording", "録音"],
                ["room", "ルーム"],
              ] as const
            ).map(([screen, label]) => {
              const selected =
                screen === "recording"
                  ? w.screen === "recording"
                  : w.screen !== "recording";
              return (
                <Pressable
                  key={screen}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  onPress={() => w.setScreen(screen)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 52,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 10,
                    backgroundColor: selected ? colors.green : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      lineHeight: 24,
                      fontWeight: "600",
                      color: selected ? colors.white : colors.ink,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassSurface>
      )}
    </View>
  );
}
