import type { Scenario, Source, ScriptItem, MvpFixture } from "@hackathon/api";
import { scriptText, validateFixture } from "@hackathon/api";
import duplicate from "../../../../contracts/fixtures/duplicate.json";
import conflict from "../../../../contracts/fixtures/conflict.json";
import pending from "../../../../contracts/fixtures/pending.json";
import expired from "../../../../contracts/fixtures/expired.json";

export type SourceState = "available" | "needs_review" | "unavailable";
export type Saved = {
  id: string;
  scenario_id: string;
  utterance_id: string;
  text: string;
  tag: "idea" | "memory" | "other";
  note: string;
  source_state: SourceState;
  version: number;
  saved_at: string;
};
export type Todo = {
  id: string;
  scenario_id: string;
  action: string;
  due: string | null;
  status: "open" | "done";
  source_state: SourceState;
  version: number;
};
export type Issue = {
  id: string;
  source_id: string;
  text: string;
  status: "pending" | "acknowledged" | "dismissed";
};
export type Screen =
  | "today"
  | "records"
  | "saved"
  | "recording"
  | "personal"
  | "conversation"
  | "connect"
  | "share"
  | "settings"
  | "todos"
  | "confirmations"
  | "calendar"
  | "calendar-settings";
export const FIXTURE_NOW = "2026-09-14T03:00:00.000Z";
export const VIEWER = "person-a";
export class DemoRepository {
  readonly mode = "fixture";
  scenarios: Scenario[];
  saved: Saved[] = [];
  todos: Todo[] = [];
  issues: Issue[] = [];
  corrections: {
    source_id: string;
    original: string;
    replacement: string;
    base_version: number;
  }[] = [];
  private counter = 0;
  constructor() {
    this.scenarios = [duplicate, conflict, pending, expired].flatMap(
      (f) => validateFixture(structuredClone(f)).scenarios,
    );
  }
  get(id: string): Scenario {
    const scenario = this.scenarios.find((s) => s.id === id);
    if (!scenario) throw new Error("この記録は見つかりません");
    return scenario;
  }
  private requireAvailable(id: string) {
    const s = this.get(id);
    if (s.response_status !== 200 || s.conversation?.status !== "ready")
      throw new Error("元の記録を利用できません");
    return s;
  }
  save(
    scenarioId: string,
    utteranceId: string,
    tag: Saved["tag"],
    note: string,
  ): Saved {
    if (note.length > 1000)
      throw new Error("メモは1000文字以内で入力してください");
    const s = this.requireAvailable(scenarioId);
    const item = s.conversation!.script.find((u) => u.id === utteranceId);
    if (!item) throw new Error("内容が更新されました。根拠を確認してください");
    const existing = this.saved.find(
      (x) => x.scenario_id === scenarioId && x.utterance_id === utteranceId,
    );
    if (existing) {
      if (existing.source_state !== "available")
        throw new Error("現在の根拠を選び直してください");
      existing.note = note;
      existing.tag = tag;
      existing.version++;
      return existing;
    }
    const result: Saved = {
      id: `saved-${++this.counter}`,
      scenario_id: scenarioId,
      utterance_id: utteranceId,
      text: scriptText(item, s.sources),
      tag,
      note,
      source_state: "available",
      version: 1,
      saved_at: FIXTURE_NOW,
    };
    this.saved.push(result);
    return result;
  }
  removeSaved(id: string, confirmed: boolean) {
    if (!confirmed) throw new Error("メモの削除確認が必要です");
    this.saved = this.saved.filter((s) => s.id !== id);
  }
  adopt(
    scenarioId: string,
    action: string,
    due: string | null,
    ownTask: boolean,
  ): Todo {
    this.requireAvailable(scenarioId);
    if (!ownTask)
      throw new Error("自分の作業として追加することを確認してください");
    if (!action.trim() || Array.from(action).length > 200)
      throw new Error("内容は1〜200文字で入力してください");
    if (
      due &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(due) ||
        new Date(due).toISOString().slice(0, 10) !== due)
    )
      throw new Error("期限は実在する日付をYYYY-MM-DDで入力してください");
    const existing = this.todos.find((t) => t.scenario_id === scenarioId);
    if (existing) return existing;
    const result: Todo = {
      id: `todo-${++this.counter}`,
      scenario_id: scenarioId,
      action: action.trim(),
      due,
      status: "open",
      source_state: "available",
      version: 1,
    };
    this.todos.push(result);
    return result;
  }
  toggleTodo(id: string) {
    const t = this.todos.find((t) => t.id === id);
    if (!t || t.source_state !== "available")
      throw new Error("元の記録を利用できません");
    t.status = t.status === "open" ? "done" : "open";
    t.version++;
  }
  removeTodo(id: string) {
    this.todos = this.todos.filter((t) => t.id !== id);
  }
  correct(
    scenarioId: string,
    sourceId: string,
    baseVersion: number,
    replacement: string,
  ) {
    const s = this.get(scenarioId);
    const source = s.sources.find((x) => x.id === sourceId);
    if (
      !source ||
      !s.recordings.some(
        (r) => r.id === source.recording_id && r.owner_id === VIEWER,
      )
    )
      throw new Error("訂正できるのは自分の入力だけです");
    if (source.version !== baseVersion)
      throw new Error("他の更新があります。読み直してください");
    if (
      !replacement.trim() ||
      Array.from(replacement).length > 1000 ||
      replacement === source.original_text
    )
      throw new Error("変更した文字を1〜1000文字で入力してください");
    this.corrections.push({
      source_id: sourceId,
      original: source.original_text,
      replacement,
      base_version: baseVersion,
    });
    source.original_text = replacement;
    source.version++;
    if (s.conversation) {
      s.conversation.status = "stale";
      s.conversation.script = [];
      s.conversation.highlights = [];
      s.conversation.revision++;
    }
    this.invalidate(scenarioId, "needs_review");
  }
  report(scenarioId: string, sourceId: string, text: string) {
    const s = this.requireAvailable(scenarioId);
    const source = s.sources.find((x) => x.id === sourceId);
    if (
      !source ||
      s.recordings.some(
        (r) => r.id === source.recording_id && r.owner_id === VIEWER,
      )
    )
      throw new Error("自分の入力は訂正してください");
    if (!text.trim() || Array.from(text).length > 1000)
      throw new Error("指摘は1〜1000文字で入力してください");
    this.issues.push({
      id: `issue-${++this.counter}`,
      source_id: sourceId,
      text,
      status: "pending",
    });
  }
  revoke(id: string) {
    const s = this.get(id);
    s.response_status = 404;
    s.sources = [];
    s.recordings = [];
    s.conversation = null;
    s.connection = null;
    this.invalidate(id, "unavailable");
  }
  private invalidate(id: string, state: SourceState) {
    for (const saved of this.saved.filter((s) => s.scenario_id === id)) {
      saved.source_state = state;
      saved.text = "";
      saved.note = "";
    }
    for (const todo of this.todos.filter((t) => t.scenario_id === id)) {
      todo.source_state = state;
      todo.action = "";
      todo.due = null;
    }
  }
  daily(
    ids: string[],
  ): { text: string; scenario_id: string; utterance_id: string }[] {
    if (!ids.length || ids.length > 10 || new Set(ids).size !== ids.length)
      throw new Error("1〜10件の会話を選んでください");
    return ids.map((id) => {
      const s = this.requireAvailable(id);
      const first = s.conversation!.script[0];
      if (!first) throw new Error("会話の準備ができていません");
      return {
        text: scriptText(first, s.sources),
        scenario_id: id,
        utterance_id: first.id,
      };
    });
  }
}
export function sourceTime(
  source: Pick<Source, "start_ms" | "end_ms">,
): string {
  return source.start_ms === null
    ? "時刻不明"
    : `${Math.floor(source.start_ms / 60000)
        .toString()
        .padStart(2, "0")}:${Math.floor((source.start_ms / 1000) % 60)
        .toString()
        .padStart(2, "0")}（推定）`;
}
export function ownSource(s: Scenario, source: Source): boolean {
  return s.recordings.some(
    (r) => r.id === source.recording_id && r.owner_id === VIEWER,
  );
}
export function canPlay(s: Scenario, source: Source): boolean {
  return (
    s.response_status === 200 &&
    source.start_ms !== null &&
    s.recordings.some(
      (r) => r.id === source.recording_id && r.audio_expires_at > FIXTURE_NOW,
    )
  );
}
