import assert from "node:assert/strict";
import { test } from "node:test";
import { apiConfiguration, initialMode } from "./startup";

test("a configured development build starts with the real API, even for invalid settings", () => {
  assert.equal(initialMode(true, "https://api.example.test"), "api");
  assert.equal(initialMode(true, "invalid"), "api");
  assert.equal(initialMode(true, "  "), "fixture");
  assert.equal(initialMode(false, undefined), "api");
});

test("phone API connections require HTTPS, including loopback", () => {
  for (const platform of ["ios", "android"]) {
    assert.equal(
      apiConfiguration("http://localhost:8000", platform).error,
      "invalid",
    );
    assert.equal(
      apiConfiguration("http://192.168.1.10:8000", platform).error,
      "invalid",
    );
    assert.equal(
      apiConfiguration("https://api.example.test/", platform).baseUrl,
      "https://api.example.test",
    );
  }
});

test("local Web permits only loopback HTTP and rejects credentials in configuration", () => {
  assert.equal(
    apiConfiguration(" http://localhost:8001/ ", "web").baseUrl,
    "http://localhost:8001",
  );
  for (const url of [
    "http://192.168.1.10:8000",
    "https://name:secret@example.test",
    "https://example.test?token=secret",
    "https://example.test#secret",
    "not-a-url",
  ]) {
    assert.equal(apiConfiguration(url, "web").error, "invalid");
  }
  assert.equal(apiConfiguration(undefined, "web").error, "missing");
});
