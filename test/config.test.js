import test from "node:test";
import assert from "node:assert/strict";
import {
  createConfig,
  decodeConfig,
  encodeConfig,
  normalizeManifestUrl,
} from "../src/config.js";

test("normalizes and round-trips addon configuration", () => {
  assert.equal(
    normalizeManifestUrl("stremio://example.com/addon"),
    "https://example.com/addon/manifest.json",
  );
  const config = createConfig([
    "https://example.com/manifest.json",
    "https://example.com/manifest.json",
    "https://other.example/config/manifest.json?token=abc",
  ]);
  assert.equal(config.upstreams.length, 2);
  assert.deepEqual(decodeConfig(encodeConfig(config)), config);
});

test("rejects unsupported and credential-bearing upstream URLs", () => {
  assert.throws(() => normalizeManifestUrl("ftp://example.com/addon"), /HTTP/);
  assert.throws(() => normalizeManifestUrl("https://user:pass@example.com/addon"), /Credentials/);
  assert.throws(() => createConfig([]), /at least one/i);
});
