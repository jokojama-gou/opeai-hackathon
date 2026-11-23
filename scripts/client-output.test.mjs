import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

test("EAS excludes its shallow Git clone, including compressed credential history", async () => {
  const { Ignore } = require("eas-cli/build/vcs/local.js");
  const rules = await Ignore.createForCheckingAsync(root);
  assert.equal(rules.ignores(".git"), true);
});

test("output scanning rejects Git metadata before relying on literal secret matching", (t) => {
  const output = mkdtempSync(join(tmpdir(), "client-output-"));
  t.after(() => {
    assert.ok(resolve(output).startsWith(resolve(tmpdir()) + "/") || resolve(output).startsWith(resolve(tmpdir()) + "\\"));
    rmSync(output, { recursive: true, force: true });
  });
  mkdirSync(join(output, ".git"));
  writeFileSync(join(output, ".git", "packed-refs"), "artificial compressed history");
  const result = spawnSync(process.execPath, [join(root, "scripts/check-client-secrets.mjs"), output], {
    encoding: "utf8", windowsHide: true,
    env: { ...process.env, EXPO_TOKEN: "synthetic-credential-for-output-check" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Git metadata detected/);
});
