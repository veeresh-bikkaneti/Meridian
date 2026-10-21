#!/usr/bin/env node
/**
 * contact-readiness.mjs — which contact sink is selected?
 *
 *   npm run check:contact                      # this shell's environment
 *   npm run check:contact -- --url https://meridian.knowledgetest.workers.dev
 *
 * (node --experimental-strip-types, so this script imports the real TS
 * readiness evaluation instead of re-implementing sink selection — one
 * source of truth, in src/lib/contact/contact-readiness.ts.)
 *
 * Prints one honest line and exits 0 only when the Discord sink is selected.
 * Anything else — parked (NoopSink), unreachable, an unexpected answer —
 * prints NOT configured / NOT confirmed and exits 1. Failing is the point:
 * nobody should be able to read this output as "the form will deliver".
 *
 * "Sink selected" is all this proves: a Discord-shaped webhook is set. A
 * revoked or deleted webhook still reads as selected; only the activation
 * smoke (scripts/contact-smoke.mjs) proves Discord accepts a message.
 *
 * Without --url the answer is about THIS SHELL's environment only (and the
 * line says so). A webhook exported in your terminal proves nothing about
 * production; use --url for that. With --url the live worker is asked which
 * sink it selected; the webhook value is never needed or printed.
 * Unknown arguments are an error, so a typo (like `--url=...`) can never
 * quietly fall back to the shell check.
 */
import {
  contactReadinessFromRuntimeEnv,
  contactReadinessFromUrl,
} from "../src/lib/contact/contact-readiness.ts";

const USAGE = "usage: check:contact [-- --url https://<origin>]";
const LOOPBACK_OR_HTTPS = /^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$))/;

/** Returns { url } (url null for the shell check) or null for bad arguments. */
export function parseArgs(args) {
  if (args.length === 0) return { url: null };
  if (args.length === 2 && args[0] === "--url" && LOOPBACK_OR_HTTPS.test(args[1])) return { url: args[1] };
  return null;
}

const parsed = parseArgs(process.argv.slice(2));
if (parsed === null) {
  console.error(USAGE);
  process.exit(2);
}

const r = parsed.url === null ? await contactReadinessFromRuntimeEnv() : await contactReadinessFromUrl(parsed.url);
console.log(r.line);
process.exit(r.configured ? 0 : 1);
