import assert from "node:assert/strict";
import { test } from "node:test";
import { DemoRepository, canPlay } from "./repository";
test("saving deduplicates and does not delete source on removal", () => {
  const repo = new DemoRepository();
  const saved = repo.save("duplicate", "utterance-1", "idea", "本人メモ");
  assert.equal(
    repo.save("duplicate", "utterance-1", "memory", "更新").id,
    saved.id,
  );
  assert.equal(repo.saved.length, 1);
  assert.throws(() => repo.removeSaved(saved.id, false));
  repo.removeSaved(saved.id, true);
  assert.equal(repo.get("duplicate").sources.length, 5);
});
test("todo requires adoption, retry deduplicates and done can be undone", () => {
  const repo = new DemoRepository();
  assert.throws(() => repo.adopt("duplicate", "写真を選ぶ", null, false));
  const todo = repo.adopt("duplicate", "写真を選ぶ", null, true);
  assert.equal(repo.adopt("duplicate", "写真を選ぶ", null, true).id, todo.id);
  repo.toggleTodo(todo.id);
  assert.equal(todo.status, "done");
  repo.toggleTodo(todo.id);
  assert.equal(todo.status, "open");
});
test("correction is owner-only and hides stale derived data including notes", () => {
  const repo = new DemoRepository();
  repo.save("duplicate", "utterance-1", "idea", "メモ");
  repo.adopt("duplicate", "写真を選ぶ", null, true);
  assert.throws(() => repo.correct("duplicate", "b1", 1, "変更"));
  assert.throws(() => repo.correct("duplicate", "a1", 2, "変更"));
  repo.correct("duplicate", "a1", 1, "展示の相談をしよう。");
  assert.equal(repo.corrections[0].original, "展示のアイデアを話そう🌱");
  assert.equal(repo.saved[0].note, "");
  assert.equal(repo.todos[0].action, "");
  assert.equal(repo.get("duplicate").conversation!.status, "stale");
});
test("revocation removes body from saved, todo and daily input", () => {
  const repo = new DemoRepository();
  repo.save("duplicate", "utterance-1", "idea", "private");
  repo.adopt("duplicate", "作業", null, true);
  repo.revoke("duplicate");
  assert.equal(repo.saved[0].source_state, "unavailable");
  assert.equal(repo.todos[0].action, "");
  assert.throws(() => repo.daily(["duplicate"]));
});
test("expired and unknown-time audio is not playable", () => {
  const repo = new DemoRepository();
  const expired = repo.get("audio-expired");
  assert.equal(canPlay(expired, expired.sources[0]), false);
  const conflict = repo.get("conflict");
  assert.equal(canPlay(conflict, conflict.sources[3]), false);
});
