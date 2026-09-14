import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiClient, ApiError } from "./client";
test("reject insecure non-loopback API endpoint", () => {
  assert.throws(
    () => new ApiClient("http://192.168.1.2:8000", async () => null),
  );
});
test("network loss after mutation is unknown, with no automatic replay", async () => {
  let calls = 0;
  const api = new ApiClient(
    "https://example.invalid",
    async () => "test-token",
    async () => {
      calls++;
      throw new Error("lost");
    },
  );
  await assert.rejects(
    api.request("/v1/recordings", "POST", { request_key: "same-key" }),
    (e: unknown) => e instanceof ApiError && e.code === "result_unknown",
  );
  assert.equal(calls, 1);
});
test("authorization error remains error instead of fixture fallback", async () => {
  const api = new ApiClient(
    "https://example.invalid",
    async () => null,
    async () =>
      new Response(JSON.stringify({ code: "not_found", retryable: false }), {
        status: 404,
      }),
  );
  await assert.rejects(
    api.sources("other"),
    (e: unknown) => e instanceof ApiError && e.status === 404,
  );
});
