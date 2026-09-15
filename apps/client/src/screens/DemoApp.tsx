import { useEffect, useState } from "react";
import {
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { type ScriptItem } from "@hackathon/api";
import { DemoRepository, type Saved, type Screen } from "../data/repository";
import {
  Badge,
  Button,
  Card,
  Check,
  colors,
  Empty,
  Field,
  Heading,
  styles,
} from "../ui/primitives";
import { GlassSurface } from "../ui/GlassSurface";
import { EvidenceSheet } from "./EvidenceSheet";
import { TodayScreen } from "./TodayScreen";
import { ConversationScreen } from "./ConversationScreen";
import { SavedScreen, TodoScreen, type Confirm } from "./PersonalActions";
const titles: Record<Screen, string> = {
  today: "今日",
  records: "記録",
  saved: "保存",
  recording: "記録を始める",
  personal: "自分の記録",
  conversation: "会話の記録",
  connect: "一緒にまとめる",
  share: "この範囲を共有",
  settings: "設定",
  todos: "自分のToDo",
  confirmations: "確認したいこと",
  calendar: "予定候補",
  "calendar-settings": "カレンダー設定",
};
type Route = { screen: Screen; id?: string };
export function DemoApp({ onLive }: { onLive: () => void }) {
  const [repo, setRepo] = useState(() => new DemoRepository());
  const [, setRevision] = useState(0);
  const refresh = () => setRevision((v) => v + 1);
  const [history, setHistory] = useState<Route[]>([{ screen: "today" }]);
  const route = history[history.length - 1];
  const [evidence, setEvidence] = useState<{
    id: string;
    item: ScriptItem;
  } | null>(null);
  const [saveTarget, setSaveTarget] = useState<{
    id: string;
    item: ScriptItem;
  } | null>(null);
  const [tag, setTag] = useState<Saved["tag"]>("idea");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<{
    title: string;
    body: string;
    action: () => void;
  } | null>(null);
  const [date, setDate] = useState("2026-09-14");
  const [sharedOnly, setSharedOnly] = useState(false);
  const [code, setCode] = useState("");
  const [same, setSame] = useState(false);
  const [people, setPeople] = useState(false);
  const [participation, setParticipation] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const go = (screen: Screen, id?: string) => {
    setNotice("");
    setHistory((h) => [...h, { screen, id }]);
  };
  const back = () => {
    setNotice("");
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  };
  const tab = (screen: Screen) => {
    setHistory([{ screen }]);
    setNotice("");
  };
  const confirm: Confirm = (title, body, action) =>
    setDialog({ title, body, action });
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (history.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [history.length]);
  const scenario = route.id ? repo.get(route.id) : null;
  const open = (id: string) => {
    const s = repo.get(id);
    go(
      s.kind === "pending" || s.kind === "personal"
        ? "personal"
        : "conversation",
      id,
    );
  };
  const showSave = (id: string, item: ScriptItem) => {
    const old = repo.saved.find(
      (s) => s.scenario_id === id && s.utterance_id === item.id,
    );
    setTag(old?.tag ?? "idea");
    setNote(old?.source_state === "available" ? old.note : "");
    setSaveTarget({ id, item });
  };
  let body;
  switch (route.screen) {
    case "today":
      body = <TodayScreen repo={repo} go={go} />;
      break;
    case "records": {
      const rows =
        date === "2026-09-14"
          ? repo.scenarios.filter(
              (s) =>
                !sharedOnly ||
                (s.kind === "shared" && s.response_status === 200),
            )
          : [];
      body = (
        <>
          <Text style={styles.muted}>話したことと、その手がかり。</Text>
          <Field label="記録の日付" value={date} onChangeText={setDate} />
          <Check
            label="共有会話だけ表示"
            checked={sharedOnly}
            onChange={setSharedOnly}
          />
          <Button
            label="絞り込みを解除"
            secondary
            onPress={() => {
              setDate("2026-09-14");
              setSharedOnly(false);
            }}
          />
          {rows.map((s) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${s.label}を開く`}
              key={s.id}
              onPress={() => open(s.id)}
            >
              <Card>
                <Badge>
                  {s.kind === "pending"
                    ? "相手待ち"
                    : s.response_status !== 200
                      ? "利用できません"
                      : s.conversation?.status === "needs_confirmation"
                        ? "確認が必要"
                        : s.conversation?.status === "stale"
                          ? "更新待ち"
                          : "会話の記録"}
                </Badge>
                <Heading>
                  {s.response_status === 200
                    ? s.label
                    : "元の記録を利用できません"}
                </Heading>
                <Text style={styles.muted}>
                  {s.response_status === 200
                    ? s.conversation?.status === "ready"
                      ? `${s.conversation.script.length}件の発言 · 元の記録を確認できます`
                      : "自分の記録から状態を確認できます"
                    : "保存期限または共有状態が変わりました"}
                  　›
                </Text>
              </Card>
            </Pressable>
          ))}
          {!rows.length && (
            <Empty
              title="条件に合う記録はありません"
              body="日付や相手の絞り込みを解除してください。"
            />
          )}
          <Button label="記録を始める" onPress={() => go("recording")} />
        </>
      );
      break;
    }
    case "conversation":
      body = scenario && (
        <ConversationScreen
          scenario={scenario}
          repo={repo}
          go={go}
          onEvidence={(item) => setEvidence({ id: scenario.id, item })}
          onSave={(item) => showSave(scenario.id, item)}
        />
      );
      break;
    case "personal":
      body =
        !scenario || scenario.response_status !== 200 ? (
          <Empty
            title="文字の保存期限が過ぎました"
            body="元の文字と派生情報を表示できません。"
          />
        ) : (
          <>
            <Badge>自分の記録</Badge>
            <Card>
              <Heading>
                {scenario.kind === "pending"
                  ? "相手の共有確認を待っています"
                  : "入力の状態を確認"}
              </Heading>
              <Text style={styles.muted}>
                相手の原文や音声は、双方の確認が揃うまで表示しません。
              </Text>
              <Text style={styles.body}>
                音声は録音終了から7日、文字と派生情報は原則30日保持します。
              </Text>
              <Button
                label="一緒にまとめる"
                onPress={() => go("connect", scenario.id)}
              />
            </Card>
            {scenario.sources
              .filter((source) =>
                scenario.recordings.some(
                  (r) =>
                    r.id === source.recording_id && r.owner_id === "person-a",
                ),
              )
              .map((source) => (
                <Card key={source.id}>
                  <Text style={styles.body}>{source.original_text}</Text>
                  <Text style={styles.muted}>自分の入力 · 話者は未確認</Text>
                </Card>
              ))}
          </>
        );
      break;
    case "recording":
      body = (
        <GlassSurface style={{ borderRadius: 24, padding: 24, gap: 20 }}>
          <Badge>本人が開始・停止</Badge>
          <Text style={styles.title}>
            周りの人に、会話を記録することを伝えてください
          </Text>
          <Text style={styles.body}>
            記録は1回5分まで。停止後に端末へ保存し、外部への送信は別に確認します。
          </Text>
          <Button label="実機・API接続へ進む" onPress={onLive} />
          <Text style={styles.muted}>
            この画面は人工データの見本です。実際のマイクは使用していません。
          </Text>
        </GlassSurface>
      );
      break;
    case "connect":
      body = (
        <>
          <Card>
            <Heading>同じ会話を持ち寄る</Heading>
            <Text style={styles.body}>
              相手の表示名と照合コードを、対面で確かめます。
            </Text>
            <Field
              label="相手の接続コード（8文字）"
              value={code}
              maxLength={8}
              autoCapitalize="characters"
              onChangeText={setCode}
            />
            <Button
              label="接続状態を確認"
              secondary
              onPress={() =>
                setNotice(
                  "人工データでは実際の接続コードを発行・送信しません。相手の原文は共有確認前には表示しません。",
                )
              }
            />
          </Card>
          <Card>
            <Heading>自分の入力範囲を確認</Heading>
            <Check
              label="対象はこの2人だけで、声と表示相手を照合した"
              checked={people}
              onChange={setPeople}
            />
            <Check
              label="同じ会話の範囲を、自分の原文で確認した"
              checked={same}
              onChange={setSame}
            />
            <Check
              label="この範囲で発言・参加していたことを確認した"
              checked={participation}
              onChange={setParticipation}
            />
            <Text style={styles.muted}>
              時間・発言範囲の実入力は実機モードのサーバー接続で確認します。
            </Text>
            <Button
              label="共有内容の見本へ"
              disabled={!people || !same || !participation}
              onPress={() => go("share", route.id)}
            />
          </Card>
        </>
      );
      break;
    case "share":
      body = (
        <Card>
          <Heading>今回の共有内容</Heading>
          <Text style={styles.body}>
            確認した範囲の文字・音声・統合結果を相手と共有します。どちらかが未回答なら共有は成立しません。
          </Text>
          <Check
            label="この相手との継続共有も希望する"
            checked={continuing}
            onChange={setContinuing}
          />
          <Text style={styles.muted}>
            継続共有も、同じ承認回で双方が選んだ場合だけ有効です。
          </Text>
          <Button
            label="共有確認の状態を確認"
            onPress={() =>
              setNotice(
                "自分の確認だけでは成立しません。この画面は人工データの表示確認で、共有許可は送信されていません。",
              )
            }
          />
          <Button label="あとで確認する" secondary onPress={back} />
        </Card>
      );
      break;
    case "saved":
      body = (
        <SavedScreen
          repo={repo}
          go={go}
          refresh={refresh}
          confirm={confirm}
          edit={(saved) => {
            const s = repo.get(saved.scenario_id);
            const item = s.conversation?.script.find(
              (item) => item.id === saved.utterance_id,
            );
            if (item) showSave(s.id, item);
          }}
        />
      );
      break;
    case "todos":
      body = (
        <TodoScreen
          repo={repo}
          scenarioId={route.id ?? "duplicate"}
          go={go}
          refresh={refresh}
          confirm={confirm}
        />
      );
      break;
    case "confirmations":
      body = (
        <>
          <Text style={styles.muted}>
            原文の相違と、行動に必要な確認をまとめています。
          </Text>
          {repo.get("conflict").conversation?.status === "ready" ? (
            <Card>
              <Badge>原文の相違</Badge>
              <Heading>展示は土曜 / 日曜？</Heading>
              <Text style={styles.body}>
                自動では片方を正解にしません。元の記録を確かめてください。
              </Text>
              <Button
                label="元の文字を確認する"
                onPress={() => open("conflict")}
              />
              <Button
                label="あとで確認する"
                secondary
                onPress={() => setNotice("未解決のまま残しています。")}
              />
            </Card>
          ) : (
            <Empty
              title="利用できる確認項目はありません"
              body="根拠が更新された項目は再確認後に表示します。"
            />
          )}
          <Card>
            <Heading>相手・参加範囲の確認</Heading>
            <Text style={styles.muted}>
              この一覧での回答とは別に、共有前の確認が必要です。
            </Text>
            <Button
              label="持ち寄りの確認へ"
              secondary
              onPress={() => go("connect", "pending")}
            />
          </Card>
        </>
      );
      break;
    case "calendar":
      body = (
        <Card>
          <Badge>候補と登録済みは別です</Badge>
          <Heading>確定した予定はありません</Heading>
          <Text style={styles.body}>
            日時が確定していない候補は、自動登録しません。
          </Text>
          <Button
            label="元の会話を確認する"
            secondary
            onPress={() => open(route.id ?? "conflict")}
          />
          <Button
            label="カレンダー設定"
            secondary
            onPress={() => go("calendar-settings")}
          />
        </Card>
      );
      break;
    case "calendar-settings":
      body = (
        <Card>
          <Heading>カレンダーは未接続です</Heading>
          <Text style={styles.body}>
            予定を外部へ登録するには、本人の接続と登録許可が必要です。
          </Text>
          <Text style={styles.muted}>
            この版では接続先の設定と実登録はまだ利用できません。
          </Text>
          <Button label="Googleカレンダーを接続" disabled onPress={() => {}} />
        </Card>
      );
      break;
    case "settings":
      body = (
        <>
          <Card>
            <Heading>共有の管理</Heading>
            <Text style={styles.body}>
              今回の共有取消と、次回からの継続共有解除は別の操作です。
            </Text>
            {repo.scenarios
              .filter((s) => s.conversation?.status === "ready")
              .map((s) => (
                <Button
                  key={s.id}
                  label={`${s.label}の共有を取り消す`}
                  secondary
                  onPress={() =>
                    confirm(
                      "この会話の共有を取り消しますか？",
                      "共有由来の保存・メモ・ToDoも利用できなくなります。双方の独立入力は別に保持されます。人工データ内だけの操作です。",
                      () => {
                        repo.revoke(s.id);
                        refresh();
                      },
                    )
                  }
                />
              ))}
            <Text style={styles.muted}>有効な継続共有はありません。</Text>
          </Card>
          <Card>
            <Heading>保持と削除</Heading>
            <Text style={styles.body}>
              原音は録音終了から7日、文字と派生物は原則30日。保存やメモを追加しても延長されません。
            </Text>
            <Button
              label="カレンダー設定"
              secondary
              onPress={() => go("calendar-settings")}
            />
          </Card>
          <Card>
            <Heading>開発用の切り替え</Heading>
            <Text style={styles.muted}>
              人工データの操作はメモリ内だけに保存され、リセットすると元に戻ります。
            </Text>
            <Button label="実機・API接続へ" onPress={onLive} />
            <Button
              label="人工データをリセット"
              secondary
              onPress={() => {
                setRepo(new DemoRepository());
                tab("today");
              }}
            />
          </Card>
        </>
      );
      break;
  }
  return (
    <View style={styles.page}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderColor: colors.line,
          gap: 10,
        }}
      >
        <View style={styles.row}>
          {history.length > 1 && (
            <Button label="戻る" secondary onPress={back} />
          )}
          <Text accessibilityRole="header" style={[styles.title, { flex: 1 }]}>
            {titles[route.screen]}
          </Text>
          <Button label="設定" secondary onPress={() => go("settings")} />
        </View>
        <Text style={styles.small}>
          人工データの操作デモ · 実録音・AI処理・共有送信は実行していません
        </Text>
      </View>
      <ScrollView
        key={`${route.screen}-${route.id ?? ""}`}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!!notice && (
          <Card>
            <Text accessibilityRole="alert" style={styles.body}>
              {notice}
            </Text>
            <Button label="閉じる" secondary onPress={() => setNotice("")} />
          </Card>
        )}
        {body}
      </ScrollView>
      <GlassSurface
        style={{
          borderTopWidth: 1,
          borderColor: colors.line,
          padding: 10,
          flexDirection: "row",
          gap: 8,
        }}
      >
        {(["today", "records", "saved"] as const).map((screen) => (
          <Pressable
            key={screen}
            accessibilityRole="tab"
            accessibilityLabel={titles[screen]}
            accessibilityState={{ selected: route.screen === screen }}
            onPress={() => tab(screen)}
            style={{
              flex: 1,
              minHeight: 54,
              borderRadius: 14,
              backgroundColor:
                route.screen === screen ? colors.pale : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 17,
                color: colors.green,
                fontWeight: route.screen === screen ? "700" : "400",
              }}
            >
              {titles[screen]}
            </Text>
          </Pressable>
        ))}
      </GlassSurface>
      {evidence && (
        <EvidenceSheet
          scenario={repo.get(evidence.id)}
          item={evidence.item}
          repo={repo}
          onClose={() => setEvidence(null)}
          onChange={refresh}
        />
      )}
      <Modal
        visible={saveTarget !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSaveTarget(null)}
      >
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
          <Heading>あとで見る</Heading>
          <Text style={styles.muted}>
            保存しても元の記録の保持期限は延長されません。メモは自分だけに表示し、AIへ送信しません。
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
            label="自分のメモ（任意）"
            multiline
            value={note}
            onChangeText={setNote}
            maxLength={1000}
          />
          <Button
            label="保存する"
            onPress={() => {
              try {
                if (saveTarget)
                  repo.save(saveTarget.id, saveTarget.item.id, tag, note);
                refresh();
                setSaveTarget(null);
              } catch (e) {
                setNotice((e as Error).message);
                setSaveTarget(null);
              }
            }}
          />
          <Button
            label="キャンセル"
            secondary
            onPress={() => setSaveTarget(null)}
          />
        </ScrollView>
      </Modal>
      <Modal
        visible={dialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#10251c88",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Card>
            <Heading>{dialog?.title ?? ""}</Heading>
            <Text style={styles.body}>{dialog?.body}</Text>
            <Button
              label="取り消す"
              secondary
              onPress={() => setDialog(null)}
            />
            <Button
              label="確認して実行"
              danger
              onPress={() => {
                dialog?.action();
                setDialog(null);
              }}
            />
          </Card>
        </View>
      </Modal>
    </View>
  );
}
