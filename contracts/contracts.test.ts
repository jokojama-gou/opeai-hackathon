import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  validateFixture,
  textRange,
  scriptText,
} from "../packages/api-ts/src/validate";
import type { MvpFixture } from "../packages/api-ts/src/schema";
const fixture = (name: string): MvpFixture =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"),
  );
for (const name of ["duplicate", "conflict", "pending", "expired"])
  test(`${name}: structure, evidence and privacy`, () => {
    validateFixture(fixture(name));
  });
test("code point offsets preserve emoji and reject inverted/outside ranges", () => {
  assert.equal(textRange("A🌱B", 1, 2), "🌱");
  for (const range of [
    [2, 1],
    [0, 4],
    [-1, 1],
    [1, 1],
  ])
    assert.throws(() => textRange("A🌱B", range[0], range[1]));
});
test("duplicate sources, single-sided utterance and repeated text survive", () => {
  const s = validateFixture(fixture("duplicate")).scenarios[0];
  assert.equal(s.conversation!.script.length, 4);
  assert.equal(s.conversation!.script[0].evidence_refs.length, 2);
  assert.equal(
    scriptText(s.conversation!.script[2], s.sources),
    scriptText(s.conversation!.script[3], s.sources),
  );
  assert.notEqual(s.conversation!.script[2].id, s.conversation!.script[3].id);
});
test("conflict alternatives and independent unknown timing/speaker survive", () => {
  const s = validateFixture(fixture("conflict")).scenarios[0];
  assert.match(scriptText(s.conversation!.script[0], s.sources), /土曜.*日曜/);
  assert.equal(s.conversation!.script[0].speaker_label, null);
  assert.equal(s.conversation!.script[0].order_status, "aligned");
  assert.equal(s.conversation!.script[2].order_status, "unknown");
});
for (const [name, corrupt] of Object.entries({
  "missing source": (f: MvpFixture) => {
    f.scenarios[0].sources = [];
  },
  "stale source": (f: MvpFixture) => {
    f.scenarios[0].sources[0].version++;
  },
  "out of bounds": (f: MvpFixture) => {
    f.scenarios[0].conversation!.script[0].evidence_refs[0].char_end = 9999;
  },
  "expired text": (f: MvpFixture) => {
    f.scenarios[0].recordings[0].text_expires_at = "2026-09-01T00:00:00.000Z";
  },
  "unready body": (f: MvpFixture) => {
    f.scenarios[0].conversation!.status = "needs_confirmation";
  },
  "unauthorized body": (f: MvpFixture) => {
    f.scenarios[0].response_status = 404;
  },
  "missing highlight evidence": (f: MvpFixture) => {
    f.scenarios[0].conversation!.highlights[0].utterance_ids = ["absent"];
  },
}))
  test(`reject ${name}`, () => {
    const f = fixture("duplicate");
    corrupt(f);
    assert.throws(() => validateFixture(f));
  });
test("pending snapshot cannot contain peer source or success conversation", () => {
  const f = fixture("pending");
  f.scenarios[0].recordings[0].owner_id = "person-b";
  assert.throws(() => validateFixture(f));
  const g = fixture("pending");
  g.scenarios[0].connection!.conversation_id = "guessed";
  assert.throws(() => validateFixture(g));
});
test("audio expiry keeps text; text expiry and revocation contain no body", () => {
  const f = validateFixture(fixture("expired"));
  assert.equal(f.scenarios[0].sources.length, 1);
  assert.equal(f.scenarios[0].expected.audio_available, false);
  assert.deepEqual(
    f.scenarios.slice(1).map((s) => s.response_status),
    [410, 404],
  );
});
