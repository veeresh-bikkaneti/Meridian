#!/usr/bin/env node
/**
 * contact-readiness.mjs — is contact delivery actually configured?
 *
 * Run it with: npm run check:contact
 * (node --experimental-strip-types, so this script imports the real TS
 * readiness evaluation instead of re-implementing sink selection —
 * one source of truth, in src/lib/contact/contact-readiness.ts.)
 *
 * Prints one honest line and exits 0 only when a real delivery sink is
 * selected. While delivery is parked (NoopSink) it prints
 * "NOT configured (parked)" and exits 1. Failing is the point: nobody
 * should be able to read this output as "the form will deliver".
 */
import { contactReadinessFromRuntimeEnv } from "../src/lib/contact/contact-readiness.ts";

const r = contactReadinessFromRuntimeEnv();
console.log(r.line);
process.exit(r.configured ? 0 : 1);
