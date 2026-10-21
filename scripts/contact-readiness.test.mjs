/**
 * check:contact must never quietly fall back to the shell check: a mistyped
 * flag is a usage error (exit 2), not a green.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./contact-readiness.mjs", import.meta.url));
const run = (...args) =>
  spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", SCRIPT, ...args], {
    env: { ...process.env, CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1/x" },
    encoding: "utf8",
  });

test("a mistyped or unknown argument exits 2 and prints usage, even with a webhook in the shell", () => {
  for (const args of [["--url=https://meridian.test"], ["--urll", "https://meridian.test"], ["--url"], ["--url", "ftp://x"], ["--url", "http://example.com"], ["extra"]]) {
    const r = run(...args);
    assert.equal(r.status, 2, args.join(" "));
    assert.match(r.stderr, /usage: check:contact/);
    assert.ok(!/sink selected/.test(r.stdout), "must not fall through to the shell check");
  }
});

test("no arguments: shell check, says it is not production, and never claims delivery", () => {
  const r = run();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /not production/);
  assert.match(r.stdout, /sink selected: discord/);
  assert.ok(!/will be delivered/.test(r.stdout));
});
