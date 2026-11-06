#!/usr/bin/env node
/**
 * check-audio-manifest.mjs — the CI staleness gate for detective audio.
 *
 * Why: a clue edit after rendering would otherwise ship a voice line
 * saying the old words. This gate recomputes every claimed manifest
 * entry's hash from the CURRENT sources (clue files + render plan +
 * names catalog — text only, never audio bytes, so it stays fast) and
 * fails the build when a render is stale or missing. It also enforces
 * the per-case CLUES-ONLY size budget (checkClueBudgets in
 * audio-manifest.mjs): a case whose five clue reads together exceed
 * 500,000 B on disk fails the gate. Node-only: no python, no ffmpeg,
 * safe for the prebuild chain.
 *
 * Exit codes: 0 clean · 2 stale/missing (each line named) · 3 manifest
 * unreadable. Usage: check-audio-manifest.mjs [--root <dir>] [--json]
 * (--root exists so the gate can be demonstrated against a copied tree.)
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MANIFEST_REL, checkClueBudgets, readManifest, verifyManifest } from "./audio-manifest.mjs";

const args = process.argv.slice(2);
let root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let json = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--root") root = resolve(args[++i]);
  else if (args[i] === "--json") json = true;
  else if (args[i] === "--help") {
    console.log("Usage: check-audio-manifest.mjs [--root <dir>] [--json]\nExit codes: 0 clean · 2 stale/missing · 3 manifest unreadable.");
    process.exit(0);
  } else {
    console.error(`error: unknown flag "${args[i]}" — run with --help`);
    process.exit(2);
  }
}

let manifest;
try {
  if (!existsSync(join(root, MANIFEST_REL))) {
    // No manifest yet = nothing claimed, nothing to gate. (The renderer
    // creates it on first use; coverage claims begin with real renders.)
    if (json) console.log(JSON.stringify({ ok: true, checked: 0, problems: [], note: "no manifest present" }));
    else console.log("detective audio: no manifest present — nothing claimed, gate passes");
    process.exit(0);
  }
  manifest = readManifest(root);
} catch (e) {
  console.error(`error: manifest unreadable: ${e.message} — fix or delete ${join(root, MANIFEST_REL)} and re-render`);
  process.exit(3);
}

let result;
try {
  const verified = verifyManifest(root, manifest);
  const budgetProblems = checkClueBudgets(root, manifest);
  result = {
    ...verified,
    ok: verified.ok && budgetProblems.length === 0,
    problems: [...verified.problems, ...budgetProblems],
  };
} catch (e) {
  console.error(`error: could not recompute expected renders: ${e.message}`);
  process.exit(3);
}

if (json) {
  console.log(JSON.stringify(result, null, 1));
} else if (result.ok) {
  console.log(`detective audio: manifest clean (${result.checked} entries verified)`);
} else {
  console.error(`detective audio: ${result.problems.length} stale/missing entr${result.problems.length === 1 ? "y" : "ies"}:`);
  for (const p of result.problems) console.error(`  ${p.kind}  ${p.key} — ${p.detail}`);
  console.error("fix: re-render the named lines with scripts/detective/render-audio.mjs");
}
process.exit(result.ok ? 0 : 2);
