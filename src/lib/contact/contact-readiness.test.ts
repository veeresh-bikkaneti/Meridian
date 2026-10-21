/**
 * Pinning tests for the contact readiness check (panel finding B3, #207).
 *
 * The parked state must report NOT configured. The Discord-selected
 * assertion also lives here so the activation follow-up has exactly one
 * place that flips when delivery is wired for real.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { evaluateContactReadiness } from "./contact-readiness.ts";
import { DiscordWebhookSink, selectSink } from "./contact-handler.server.ts";

test("no secret in env → readiness reports NOT configured (parked)", () => {
  const r = evaluateContactReadiness({});
  assert.equal(r.configured, false);
  assert.equal(r.sink, "noop");
  assert.match(r.line, /NOT configured \(parked\)/);
});

test("a look-alike webhook URL still reports NOT configured", () => {
  const r = evaluateContactReadiness({ CONTACT_DISCORD_WEBHOOK_URL: "https://discordapp.com/api/webhooks/1/x" });
  assert.equal(r.configured, false);
  assert.equal(r.sink, "noop");
});

test("a strict discord.com webhook URL selects the Discord sink and reports configured", () => {
  const env = { CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1/x" };
  assert.ok(selectSink(env) instanceof DiscordWebhookSink);
  const r = evaluateContactReadiness(env);
  assert.equal(r.configured, true);
  assert.equal(r.sink, "discord");
});
