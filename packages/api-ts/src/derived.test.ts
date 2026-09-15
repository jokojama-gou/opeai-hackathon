import { test } from "node:test";
import assert from "node:assert/strict";
import { assertDerived } from "./derived";

test("stale derived responses reject protected optional fields", () => {
  const todo = {
    id: "t",
    version: 2,
    source_state: "unavailable",
    todo_status: "done",
  };
  assert.doesNotThrow(() => assertDerived("TodoView", todo));
  for (const field of ["action", "due", "evidence"]) {
    const extra =
      field === "action"
        ? "old private title"
        : field === "due"
          ? { kind: "date", value: "2026-09-20", time_zone: null }
          : [];
    assert.throws(() => assertDerived("TodoView", { ...todo, [field]: extra }));
  }
  const daily = {
    id: "d",
    version: 1,
    run_id: "r",
    status: "stale",
    error_code: "manifest_changed",
    retryable: false,
  };
  assert.doesNotThrow(() => assertDerived("DailyView", daily));
  assert.throws(() =>
    assertDerived("DailyView", {
      ...daily,
      sections: { topics: [], ideas: [], promises: [], questions: [] },
    }),
  );
});

test("context responses reject private dependencies and owner metadata", () => {
  const context = {
    id: "personal:r",
    kind: "personal",
    context_revision: 1,
    recording_id: "r",
    canonical_start_at: "2026-09-14T00:00:00Z",
    expires_at: "2026-10-14T00:00:00Z",
    manifest_hash: "hash",
    generation_allowed: false,
    status: "ready",
    preparation_reason: null,
    sources: [],
  };
  assert.doesNotThrow(() => assertDerived("PersonalContext", context));
  assert.throws(() =>
    assertDerived("PersonalContext", {
      ...context,
      _dependencies: { consent: "private" },
    }),
  );
  assert.throws(() =>
    assertDerived("PersonalContext", { ...context, owner_id: "other" }),
  );
});
