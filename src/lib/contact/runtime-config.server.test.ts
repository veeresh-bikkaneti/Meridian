/**
 * The contact webhook secret has one source: a runtime read.
 * This file fails while vite.config.ts still bakes the secret, and
 * passes once runtime-config.server.ts is the only reader.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const FAKE_FIRST = "https://discord.com/api/webhooks/1/runtime-first";
const FAKE_SECOND = "https://discord.com/api/webhooks/1/runtime-second";
const FAKE_NITRO = "https://discord.com/api/webhooks/1/runtime-nitro";
const FAKE_PROC = "https://discord.com/api/webhooks/1/runtime-proc";
const FAKE_WORKER = "https://discord.com/api/webhooks/1/runtime-worker";

test("the contact webhook secret is not read at build time", () => {
  const vite = read("vite.config.ts");
  assert.equal(
    vite.includes("CONTACT_DISCORD_WEBHOOK_URL"),
    false,
    "vite.config.ts still bakes CONTACT_DISCORD_WEBHOOK_URL",
  );
  assert.equal(
    vite.includes("__MERIDIAN_SSR_CONTACT_WEBHOOK_URL__"),
    false,
    "vite.config.ts still defines the SSR webhook constant",
  );
  const handler = read("src/lib/contact/contact-handler.server.ts");
  assert.equal(
    handler.includes("__MERIDIAN_SSR_CONTACT_WEBHOOK_URL__"),
    false,
    "the contact handler still reads the build-time webhook constant",
  );
  assert.match(handler, /runtime-config\.server/);
});

test("the config module reads the secret at runtime and has no build define", async () => {
  const src = read("src/lib/contact/runtime-config.server.ts");
  assert.match(src, /CONTACT_DISCORD_WEBHOOK_URL/);
  assert.doesNotMatch(src, /__MERIDIAN_SSR_CONTACT_WEBHOOK_URL__/);
  assert.match(src, /cloudflare:workers/);

  const { pickRuntimeSecret, readContactWebhookSecret, readContactWebhookSecretRuntime } =
    await import("./runtime-config.server.ts");

  assert.equal(pickRuntimeSecret(FAKE_WORKER, FAKE_NITRO, FAKE_PROC), FAKE_WORKER);
  assert.equal(pickRuntimeSecret("  ", FAKE_NITRO, FAKE_PROC), FAKE_NITRO);
  assert.equal(pickRuntimeSecret(undefined, "", FAKE_PROC), FAKE_PROC);
  assert.equal(pickRuntimeSecret(undefined, undefined, "  "), undefined);

  const prev = process.env.CONTACT_DISCORD_WEBHOOK_URL;
  const g = globalThis as { __env__?: Record<string, unknown> };
  const prevNitro = g.__env__;
  try {
    delete g.__env__;
    process.env.CONTACT_DISCORD_WEBHOOK_URL = FAKE_FIRST;
    assert.equal(readContactWebhookSecret(), FAKE_FIRST);
    process.env.CONTACT_DISCORD_WEBHOOK_URL = FAKE_SECOND;
    assert.equal(readContactWebhookSecret(), FAKE_SECOND, "a later runtime value must win; a bake would stay on the first");
    process.env.CONTACT_DISCORD_WEBHOOK_URL = "   ";
    assert.equal(readContactWebhookSecret(), undefined);

    g.__env__ = { CONTACT_DISCORD_WEBHOOK_URL: FAKE_NITRO };
    process.env.CONTACT_DISCORD_WEBHOOK_URL = FAKE_PROC;
    assert.equal(readContactWebhookSecret(), FAKE_NITRO);
    assert.equal(await readContactWebhookSecretRuntime(), FAKE_NITRO);
  } finally {
    if (prev === undefined) delete process.env.CONTACT_DISCORD_WEBHOOK_URL;
    else process.env.CONTACT_DISCORD_WEBHOOK_URL = prev;
    if (prevNitro === undefined) delete g.__env__;
    else g.__env__ = prevNitro;
  }
});
