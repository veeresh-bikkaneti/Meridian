#!/usr/bin/env node
/**
 * contact-readiness.mjs — is contact delivery actually configured?
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
 * Without --url the answer is about THIS SHELL's environment only (and the
 * line says so). A webhook exported in your terminal proves nothing about
 * production; use --url for that. With --url the live worker is asked which
 * sink it selected; the webhook value is never needed or printed.
 */
import {
  contactReadinessFromRuntimeEnv,
  contactReadinessFromUrl,
} from "../src/lib/contact/contact-readiness.ts";

const args = process.argv.slice(2);
const urlAt = args.indexOf("--url");
if (urlAt !== -1 && !/^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$))/.test(args[urlAt + 1] ?? "")) {
  console.error("usage: check:contact [-- --url https://<origin>]");
  process.exit(2);
}

const r = urlAt === -1 ? await contactReadinessFromRuntimeEnv() : await contactReadinessFromUrl(args[urlAt + 1]);
console.log(r.line);
process.exit(r.configured ? 0 : 1);
