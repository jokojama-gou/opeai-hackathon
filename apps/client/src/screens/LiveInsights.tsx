import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import {
  derivedGet,
  derivedList,
  type ApiClient,
  type CandidateView,
  type CitedText,
  type ContextEvidence,
  type Due,
  type PersonalContext,
  type ReviewPreferences,
  type RunView,
  type TodayView,
  type TodoView,
} from "@hackathon/api";
import {
  derivedMutation,
  reviewDate,
  useDerivedSnapshot,
} from "../data/derived";
import { errorText, errorCodeText } from "../data/useLiveWorkspace";
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

type Common = { api: ApiClient; onSource: (recordingId: string) => void };
const endpoint = (id: string) => encodeURIComponent(id);
const runLabels = {
  queued: "処理を待っています",
  running: "生成しています",
  ready: "生成済み",
  needs_confirmation: "確認が必要です",
  failed: "生成できませんでした",
  stale: "元の記録が更新されました",
};

function useOperation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      if (alive.current) setError(errorText(e));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return { busy, run, error };
}

function ErrorMessage({ value }: { value: string }) {
  return value ? (
    <Text accessibilityRole="alert" style={styles.body}>
      {value}
    </Text>
  ) : null;
}

function EvidenceLinks({
  api,
  refs,
  onSource,
}: Common & { refs: ContextEvidence[] }) {
  const op = useOperation();
  return (
    <>
      <ErrorMessage value={op.error} />
      {refs.map((ref, i) => (
        <Button
          key={JSON.stringify(ref)}
          secondary
          label={`根拠${i + 1}を開く`}
          busy={op.busy}
          onPress={() =>
            void op.run(async () => {
              const current = await api.request<{ recording_id: string }>(
                `/v1/contexts/${endpoint(ref.context_id)}/evidence?source_id=${endpoint(ref.source_id)}&version=${ref.source_version}`,
              );
              onSource(current.recording_id);
            })
          }
        />
      ))}
    </>
  );
}

function CitedSections({
  api,
  sections,
  onSource,
}: Common & { sections: Record<string, CitedText[]> }) {
  const labels: Record<string, string> = {
    topics: "話したこと",
    ideas: "アイデア・思い出",
    promises: "約束",
    questions: "残る問い",
    contents: "内容",
    reasons: "理由",
    decisions: "決まったこと",
    unresolved: "未決定",
  };
  return (
    <>
      {Object.entries(sections).map(([key, values]) => (
        <View key={key} style={{ gap: 10 }}>
          <Heading>{labels[key] ?? key}</Heading>
          {values.length ? (
            values.map((value, i) => (
              <View key={i} style={{ gap: 8 }}>
                <Text style={styles.body}>{value.text}</Text>
                <EvidenceLinks
                  api={api}
                  refs={value.evidence}
                  onSource={onSource}
                />
              </View>
            ))
          ) : (
            <Text style={styles.muted}>該当する内容はありません。</Text>
          )}
        </View>
      ))}
    </>
  );
}

export function LiveRun({
  api,
  id,
  onSource,
  onChanged,
}: Common & { id: string; onChanged?: () => void }) {
  const [runId, setRunId] = useState(id);
  const snapshot = useDerivedSnapshot(
    () =>
      derivedGet<RunView>(api, `/v1/agent-runs/${endpoint(runId)}`, "RunView"),
    [api, runId],
  );
  const op = useOperation();
  const value = snapshot.value;
  useEffect(() => {
    if (value?.status === "ready") onChanged?.();
  }, [value?.status]);
  useEffect(() => {
    if (!value || !["queued", "running"].includes(value.status)) return;
    const timer = setTimeout(() => void snapshot.refresh(), 2000);
    return () => clearTimeout(timer);
  }, [value]);
  return (
    <Card>
      <ErrorMessage value={snapshot.error || op.error} />
      <Text style={styles.body}>
        {value ? runLabels[value.status] : "状態を確認しています"}
      </Text>
      {value?.error_code && (
        <Text style={styles.muted}>{errorCodeText(value.error_code)}</Text>
      )}
      {value?.result && "contents" in value.result && (
        <CitedSections
          api={api}
          sections={value.result as unknown as Record<string, CitedText[]>}
          onSource={onSource}
        />
      )}
      {value?.status === "ready" && value.role === "G2" && (
        <Text style={styles.muted}>
          候補は「ToDo」で確認し、自分の作業として追加してください。
        </Text>
      )}
      {value?.retryable && (
        <Button
          label="生成をもう一度試す"
          busy={op.busy}
          onPress={() =>
            void op.run(async () => {
              const next = await derivedMutation<{ id: string }>(
                api,
                `/v1/agent-runs/${endpoint(value.id)}/retry`,
                "POST",
                { expected_version: value.version },
              );
              setRunId(next.id);
            })
          }
        />
      )}
      {value?.status === "stale" && (
        <Text style={styles.muted}>
          現在の記録と対象を確認して、生成し直してください。
        </Text>
      )}
    </Card>
  );
}

export function LiveContextTools({
  api,
  recordingId,
  onSource,
}: Common & { recordingId: string }) {
  const cid = "personal:" + recordingId;
  const snapshot = useDerivedSnapshot(
    () =>
      derivedGet<PersonalContext>(
        api,
        `/v1/contexts/${endpoint(cid)}`,
        "PersonalContext",
      ),
    [api, cid],
  );
  const [runs, setRuns] = useState<Record<string, string>>({});
  const policy = useDerivedSnapshot(() => api.policy(), [api]);
  const op = useOperation();
  const context = snapshot.value;
  useEffect(() => {
    setRuns(context?.latest_runs ?? {});
  }, [context?.manifest_hash, JSON.stringify(context?.latest_runs)]);
  return (
    <>
      <Card>
        <Heading>この記録を振り返る</Heading>
        <ErrorMessage value={snapshot.error || op.error} />
        {context?.status === "needs_confirmation" && (
          <Text style={styles.muted}>
            相手の記録との対応を確認する処理を準備中です。二重の候補を作らないよう、生成を保留しています。
          </Text>
        )}
        {context && !context.generation_allowed && (
          <Text style={styles.muted}>
            文字生成の処理設定が未完了です。
          </Text>
        )}
        {context && policy.value && (
          <>
            <Text style={styles.muted}>
              送信先:{" "}
              {policy.value.destinations.external_text_generation ?? "未設定"}
            </Text>
            <Text style={styles.muted}>
              {policy.value.descriptions.external_text_generation}
            </Text>
          </>
        )}
        {(["G1", "G2"] as const).map((role) => (
          <Button
            key={role}
            secondary
            label={role === "G1" ? "内容を整理する" : "ToDo候補を確認する"}
            busy={op.busy}
            disabled={
              !context ||
              !context.generation_allowed ||
              context.status !== "ready"
            }
            onPress={() =>
              void op.run(async () => {
                if (!context) return;
                const result = await derivedMutation<{ id: string }>(
                  api,
                  `/v1/contexts/${endpoint(cid)}/agent-runs`,
                  "POST",
                  {
                    expected_version: context.context_revision,
                    expected_manifest_hash: context.manifest_hash,
                    role,
                  },
                );
                setRuns((old) => ({ ...old, [role]: result.id }));
              })
            }
          />
        ))}
      </Card>
      {Object.entries(runs).map(([role, id]) => (
        <LiveRun key={id} api={api} id={id} onSource={onSource} />
      ))}
    </>
  );
}

function DueFields({
  due,
  onChange,
}: {
  due: Due | null;
  onChange: (due: Due | null) => void;
}) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <>
      <Text style={styles.muted}>
        期限は本人が確認した内容だけを保存します。
      </Text>
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        {([null, "date", "datetime"] as const).map((kind) => (
          <Button
            key={kind ?? "none"}
            label={
              kind === null ? "期限未定" : kind === "date" ? "日付" : "日時"
            }
            secondary={(due?.kind ?? null) !== kind}
            onPress={() =>
              onChange(
                kind
                  ? {
                      kind,
                      value: "",
                      time_zone: kind === "datetime" ? zone : null,
                    }
                  : null,
              )
            }
          />
        ))}
      </View>
      {due && (
        <Field
          label={
            due.kind === "date"
              ? "期限の日付（例 2026-09-20）"
              : "期限の日時と時差（例 2026-09-20T18:00:00+09:00）"
          }
          value={due.value}
          onChangeText={(value) => onChange({ ...due, value })}
          autoCapitalize="none"
        />
      )}
      {due?.kind === "datetime" && (
        <Field
          label="タイムゾーン（例 Asia/Tokyo）"
          value={due.time_zone ?? ""}
          onChangeText={(time_zone) => onChange({ ...due, time_zone })}
          autoCapitalize="none"
        />
      )}
    </>
  );
}

function CandidateCard({
  api,
  item,
  todo,
  onSource,
  refresh,
}: Common & {
  item: CandidateView;
  todo?: TodoView;
  refresh: () => Promise<void>;
}) {
  const op = useOperation();
  const [action, setAction] = useState(item.action);
  const [due, setDue] = useState<Due | null>(null);
  const [own, setOwn] = useState(false);
  const accepted =
    item.candidate_status === "accepted" &&
    todo?.source_state !== "needs_review";
  return (
    <Card>
      <Badge>
        {item.previously_dismissed
          ? "以前見送った内容の更新候補"
          : "会話からの候補"}
      </Badge>
      <ErrorMessage value={op.error} />
      {accepted ? (
        <Text style={styles.body}>
          採用済みです。自分のToDoから編集できます。
        </Text>
      ) : (
        <>
          <Field
            label="自分が行う作業"
            value={action}
            onChangeText={setAction}
            maxLength={200}
          />
          <DueFields due={due} onChange={setDue} />
          <Check
            label="自分の作業として追加する"
            checked={own}
            onChange={setOwn}
          />
          <Text style={styles.muted}>
            会話で自分が担当と決まったことを意味しません。
          </Text>
          {item.duplicate_unresolved && (
            <Text style={styles.body}>
              他の候補と同じ作業か確認できないため、追加を保留しています。
            </Text>
          )}
          <Button
            label={
              todo?.source_state === "needs_review"
                ? "この内容でToDoを再確認"
                : "自分のToDoに追加"
            }
            busy={op.busy}
            disabled={
              !own ||
              !action.trim() ||
              item.duplicate_unresolved ||
              !!(due && !due.value)
            }
            onPress={() =>
              void op.run(async () => {
                if (todo?.source_state === "needs_review")
                  await derivedMutation(
                    api,
                    `/v1/todos/${endpoint(todo.id)}/reconfirm`,
                    "POST",
                    {
                      expected_version: todo.version,
                      candidate_id: item.id,
                      candidate_version: item.version,
                      action,
                      due,
                      as_own_task: own,
                    },
                  );
                else
                  await derivedMutation(
                    api,
                    `/v1/action-candidates/${endpoint(item.id)}/adopt`,
                    "POST",
                    {
                      expected_version: item.version,
                      action,
                      due,
                      as_own_task: own,
                    },
                  );
                await refresh();
              })
            }
          />
          <Button
            label="この候補を見送る"
            secondary
            busy={op.busy}
            onPress={() =>
              void op.run(async () => {
                await derivedMutation(
                  api,
                  `/v1/action-candidates/${endpoint(item.id)}`,
                  "PATCH",
                  {
                    expected_version: item.version,
                    candidate_status: "dismissed",
                  },
                );
                await refresh();
              })
            }
          />
        </>
      )}
      <EvidenceLinks api={api} refs={item.evidence} onSource={onSource} />
    </Card>
  );
}

function TodoCard({
  api,
  item,
  onSource,
  refresh,
}: Common & { item: TodoView; refresh: () => Promise<void> }) {
  const op = useOperation();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [action, setAction] = useState(item.action ?? "");
  const [due, setDue] = useState<Due | null>(item.due ?? null);
  const change = async (todo_status: "open" | "done") => {
    await derivedMutation(api, `/v1/todos/${endpoint(item.id)}`, "PATCH", {
      expected_version: item.version,
      action,
      due,
      todo_status,
    });
    await refresh();
  };
  return (
    <Card>
      <Badge>{item.todo_status === "done" ? "完了" : "未完了"}</Badge>
      <ErrorMessage value={op.error} />
      {item.source_state === "available" ? (
        <>
          {editing ? (
            <>
              <Field
                label="作業"
                value={action}
                onChangeText={setAction}
                maxLength={200}
              />
              <DueFields due={due} onChange={setDue} />
              <Button
                label="編集を保存"
                busy={op.busy}
                disabled={!action.trim() || !!(due && !due.value)}
                onPress={() => void op.run(() => change(item.todo_status))}
              />
              <Button
                label="編集を破棄"
                secondary
                onPress={() => {
                  setAction(item.action!);
                  setDue(item.due ?? null);
                  setEditing(false);
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.body}>{item.action}</Text>
              <Text style={styles.muted}>
                {item.due
                  ? `期限: ${item.due.value} ${item.due.time_zone ?? ""}`
                  : "期限未定"}
              </Text>
              <Button
                label={
                  item.todo_status === "done" ? "未完了に戻す" : "完了にする"
                }
                busy={op.busy}
                onPress={() =>
                  void op.run(() =>
                    change(item.todo_status === "done" ? "open" : "done"),
                  )
                }
              />
              <Button
                label="ToDoを編集"
                secondary
                onPress={() => setEditing(true)}
              />
            </>
          )}
          <EvidenceLinks
            api={api}
            refs={item.evidence ?? []}
            onSource={onSource}
          />
        </>
      ) : (
        <Text style={styles.body}>
          {item.source_state === "needs_review"
            ? "元の記録が更新されました。現在の候補を確認し直すか、ToDoを削除してください。"
            : "元の記録を利用できません。"}
        </Text>
      )}
      <Button
        label={deleting ? "このToDoを削除する" : "ToDoを削除"}
        danger
        busy={op.busy}
        onPress={() => {
          if (!deleting) {
            setDeleting(true);
            return;
          }
          void op.run(async () => {
            await derivedMutation(
              api,
              `/v1/todos/${endpoint(item.id)}`,
              "DELETE",
              { expected_version: item.version },
            );
            await refresh();
          });
        }}
      />
      {deleting && (
        <Button
          label="削除をやめる"
          secondary
          onPress={() => setDeleting(false)}
        />
      )}
    </Card>
  );
}

export function LiveTodos({ api, onSource }: Common) {
  const snapshot = useDerivedSnapshot(async () => {
    const [todos, candidates] = await Promise.all([
      derivedList<TodoView>(api, "/v1/todos", "TodoView"),
      derivedList<CandidateView>(api, "/v1/action-candidates", "CandidateView"),
    ]);
    return { todos, candidates };
  }, [api]);
  return (
    <>
      <Heading>自分のToDo</Heading>
      <ErrorMessage value={snapshot.error} />
      {snapshot.value?.todos.map((item) => (
        <TodoCard
          key={`${item.id}:${item.version}:${item.source_state}`}
          api={api}
          item={item}
          onSource={onSource}
          refresh={snapshot.refresh}
        />
      ))}
      {snapshot.value && !snapshot.value.todos.length && (
        <Empty
          title="ToDoはまだありません"
          body="記録から候補を抽出し、自分の作業として確認して追加できます。"
        />
      )}
      <Heading>追加前の候補</Heading>
      {snapshot.value?.candidates.map((item) => (
        <CandidateCard
          key={`${item.id}:${item.version}`}
          api={api}
          item={item}
          todo={snapshot.value?.todos.find((t) => t.candidate_id === item.id)}
          onSource={onSource}
          refresh={snapshot.refresh}
        />
      ))}
      <Button
        label="ToDoと候補を更新"
        secondary
        onPress={() => void snapshot.refresh()}
      />
    </>
  );
}

export function LiveToday({ api, onSource }: Common) {
  const preference = useDerivedSnapshot(
    () =>
      derivedGet<ReviewPreferences>(
        api,
        "/v1/preferences",
        "ReviewPreferences",
      ),
    [api],
  );
  const [zone, setZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [changing, setChanging] = useState(false);
  const op = useOperation();
  const saved = preference.value?.review_time_zone;
  return (
    <>
      <Heading>今日の振り返り</Heading>
      <ErrorMessage value={preference.error || op.error} />
      {preference.value && (!saved || changing) ? (
        <Card>
          <Text style={styles.body}>
            振り返りの日付を決めるタイムゾーンを確認してください。会話は開始日に一度だけ数えます。
          </Text>
          <Field
            label="タイムゾーン"
            value={zone}
            onChangeText={setZone}
            autoCapitalize="none"
          />
          <Button
            label="このタイムゾーンで振り返る"
            busy={op.busy}
            onPress={() =>
              void op.run(async () => {
                await derivedMutation(
                  api,
                  "/v1/preferences/review-time-zone",
                  "PATCH",
                  {
                    expected_version: preference.value!.version,
                    review_time_zone: zone,
                  },
                );
                await preference.refresh();
                setChanging(false);
              })
            }
          />
          {saved && (
            <Button
              label="変更をやめる"
              secondary
              onPress={() => setChanging(false)}
            />
          )}
        </Card>
      ) : saved ? (
        <>
          <TodayContent
            key={`${saved}:${preference.value?.version}`}
            api={api}
            zone={saved}
            onSource={onSource}
          />
          <Button
            label="振り返りのタイムゾーンを変更"
            secondary
            onPress={() => {
              setZone(saved);
              setChanging(true);
            }}
          />
        </>
      ) : (
        <Text style={styles.muted}>設定を読み込んでいます。</Text>
      )}
    </>
  );
}

function TodayContent({ api, zone, onSource }: Common & { zone: string }) {
  const [date, setDate] = useState(() => reviewDate(new Date(), zone));
  const snapshot = useDerivedSnapshot(
    () =>
      derivedGet<TodayView>(
        api,
        `/v1/today?date=${endpoint(date)}&zone=${endpoint(zone)}`,
        "TodayView",
      ),
    [api, date, zone],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const op = useOperation();
  const today = snapshot.value;
  useEffect(() => {
    setSelected(today?.default_selected_context_ids ?? []);
  }, [today?.selection_hash]);
  useEffect(() => {
    setRunId(null);
  }, [date]);
  return (
    <>
      <Field
        label="振り返る日（YYYY-MM-DD）"
        value={date}
        onChangeText={setDate}
        autoCapitalize="none"
      />
      <Text style={styles.muted}>{zone}で、この日に始まった会話</Text>
      <ErrorMessage value={snapshot.error || op.error} />
      {today && (
        <>
          <Text style={styles.body}>
            {today.selection_required
              ? "11件以上あります。最大10件を選んでください。"
              : "振り返る記録を選んでください。"}
          </Text>
          {today.contexts.map((c) => (
            <Card key={c.id}>
              <Check
                label={`自分の記録 ${new Date(c.canonical_start_at).toLocaleTimeString("ja-JP", { timeZone: zone })}`}
                checked={selected.includes(c.id)}
                disabled={c.status !== "ready"}
                onChange={(checked) =>
                  setSelected((old) =>
                    checked ? [...old, c.id] : old.filter((id) => id !== c.id),
                  )
                }
              />
              {c.status !== "ready" && (
                <Text style={styles.muted}>統合と重複の確認を準備中です。</Text>
              )}
              <Button
                label="元の記録を確認"
                secondary
                onPress={() => onSource(c.recording_id)}
              />
            </Card>
          ))}
          {!!today.unprepared.length && (
            <Text style={styles.muted}>
              まだ文字起こしが準備できていない記録が{today.unprepared.length}
              件あります。
            </Text>
          )}
          {!today.generation_configured && (
            <Text style={styles.body}>
              生成サービスの接続と予算を設定すると利用できます。
            </Text>
          )}
          <Button
            label={`選択済み${selected.length}件で振り返る`}
            busy={op.busy}
            disabled={
              !today.generation_configured ||
              selected.length === 0 ||
              selected.length > 10 ||
              today.contexts.some(
                (c) => selected.includes(c.id) && !c.generation_allowed,
              )
            }
            onPress={() =>
              void op.run(async () => {
                const result = await derivedMutation<{
                  id: string;
                  run_id: string;
                }>(api, "/v1/daily-reviews", "POST", {
                  expected_version: 0,
                  date,
                  zone,
                  selected_context_ids: [...selected].sort(),
                  expected_manifest_hash: today.selection_hash,
                });
                setRunId(result.run_id);
                await snapshot.refresh();
              })
            }
          />
          {today.contexts.some(
            (c) => selected.includes(c.id) && !c.generation_allowed,
          ) && (
            <Text style={styles.muted}>
              選択した記録の文字生成サービスが未設定です。
            </Text>
          )}
          {runId && (
            <LiveRun
              key={runId}
              api={api}
              id={runId}
              onSource={onSource}
              onChanged={() => void snapshot.refresh()}
            />
          )}
          {today.daily_reviews.map((review) => (
            <Card key={review.id}>
              <Heading>日次振り返り</Heading>
              <Text style={styles.muted}>{runLabels[review.status]}</Text>
              {review.sections && (
                <CitedSections
                  api={api}
                  sections={
                    review.sections as unknown as Record<string, CitedText[]>
                  }
                  onSource={onSource}
                />
              )}
              {review.retryable && (
                <LiveRun
                  key={review.run_id}
                  api={api}
                  id={review.run_id}
                  onSource={onSource}
                  onChanged={() => void snapshot.refresh()}
                />
              )}
            </Card>
          ))}
        </>
      )}
    </>
  );
}
