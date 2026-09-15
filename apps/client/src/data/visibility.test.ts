import { test } from "node:test";
import assert from "node:assert/strict";
import { VisibilityScope } from "./visibility";
test("background responses cannot reappear after returning to the foreground", () => {
  const scope = new VisibilityScope();
  const oldRequest = scope.checkpoint();
  scope.setVisible(false);
  assert.equal(oldRequest(), false);
  scope.setVisible(true);
  assert.equal(oldRequest(), false);
  assert.equal(scope.checkpoint()(), true);
});
test("changing account or selected record invalidates pending reads", () => {
  const scope = new VisibilityScope();
  const oldRequest = scope.checkpoint();
  scope.invalidate();
  assert.equal(oldRequest(), false);
  assert.equal(scope.checkpoint()(), true);
});
