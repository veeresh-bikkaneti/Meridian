import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FLAGS_PATH = join(ROOT, "public", "flags.json");

// Regression guard: the crash-report pipeline was silently disabled for
// months because nothing asserted the *content* of public/flags.json —
// only its fetch-and-parse behavior. If the endpoint is ever removed on
// purpose, update this test deliberately; do not just delete it.
function isValidEndpoint(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length === 0 || v.length > 2048) return false;
  return v.startsWith("https://") || (v.startsWith("/") && !v.startsWith("//"));
}

test("public/flags.json parses and has the expected shape", () => {
  const raw = readFileSync(FLAGS_PATH, "utf8");
  const payload = JSON.parse(raw);
  assert.equal(typeof payload.version, "number", "version must be a number");
  assert.equal(typeof payload.flags, "object", "flags must be an object");
  assert.ok(payload.flags !== null, "flags must not be null");
});

test("public/flags.json wires the observability endpoint", () => {
  const payload = JSON.parse(readFileSync(FLAGS_PATH, "utf8"));
  assert.ok(
    isValidEndpoint(payload.observabilityEndpoint),
    `observabilityEndpoint must be a valid https URL or root-relative path, got: ${JSON.stringify(
      payload.observabilityEndpoint,
    )}`,
  );
});

test("observability endpoint points at the crash-report ingest route", () => {
  const payload = JSON.parse(readFileSync(FLAGS_PATH, "utf8"));
  const endpoint = String(payload.observabilityEndpoint);
  assert.match(
    endpoint,
    /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/ingest$/,
    "endpoint must be the crash-report worker /ingest route",
  );
});
