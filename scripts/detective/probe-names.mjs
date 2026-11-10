#!/usr/bin/env node
/**
 * probe-names.mjs — find a speakable text for each name read the TTS
 * backend refuses (handbook FG-4: 88 planned names, deterministic per
 * string). Needs the TTS tool (/opt/hatch/bin/tts), so it runs on the
 * render machine, not in CI or a cloud session.
 *
 * For every planned name read with no manifest entry it tries, in order:
 *   1. the display name as planned          "Lahore, Pakistan"
 *   2. with a closing full stop              "Lahore, Pakistan."
 *   3. the place alone                       "Lahore"
 *   4. the place alone with a full stop      "Lahore."
 *   5. the place, then the country, as two   "Lahore. Pakistan."
 *      short sentences
 * and prints a JSON object of { geonamesId: firstVariantThatRendered }
 * ready to paste into NAME_SPOKEN_OVERRIDES in render-plan.mjs (variant
 * 1 succeeding means the backend has healed: no override needed, and it
 * is left out). Names where every variant fails are listed on stderr.
 * Nothing is written to public/: after pasting the overrides, render
 * with `node scripts/detective/render-audio.mjs --names` as usual.
 *
 * Usage: node scripts/detective/probe-names.mjs [--limit N]
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NAMES_MIN_POPULATION,
  getEntry,
  readClueFile,
  readManifest,
  readNamesIndex,
} from "./audio-manifest.mjs";
import { VOICES, selectionNamePlan } from "./render-plan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TTS = "/opt/hatch/bin/tts";

/** The variant ladder for one name row (pure; exported for the test). */
export function nameVariants(row, displayText) {
  const place = row.n.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  const country = displayText.includes(", ") ? displayText.slice(displayText.lastIndexOf(", ") + 2) : "";
  const v = [displayText, `${displayText}.`, place, `${place}.`];
  if (country) v.push(`${place}. ${country}.`);
  return [...new Set(v)];
}

/** Every planned name read with no manifest entry, biggest place first. */
export function missingNameRows(root = ROOT) {
  const rows = readNamesIndex(root);
  const wanted = new Map();
  for (const r of rows) if (r.p >= NAMES_MIN_POPULATION) wanted.set(r.id, r);
  for (let i = 0; i <= 496; i++) {
    const c = readClueFile(root, i);
    const r = rows.find((x) => x.id === c.placeId);
    if (r) wanted.set(r.id, r);
  }
  const manifest = readManifest(root);
  return [...wanted.values()]
    .filter((r) => !getEntry(manifest, selectionNamePlan(r)))
    .sort((a, b) => b.p - a.p);
}

function speak(text, out) {
  return new Promise((resolve) => {
    const child = spawn(TTS, ["speak", "--voice", VOICES.holmes, "--language", "en", "--speed", "100", "--output", out, "--text-stdin"], { stdio: ["pipe", "ignore", "ignore"] });
    const timer = setTimeout(() => child.kill("SIGKILL"), 45_000);
    child.on("error", () => { clearTimeout(timer); resolve(false); });
    child.on("close", (code) => { clearTimeout(timer); resolve(code === 0 && existsSync(out)); });
    child.stdin.end(text);
  });
}

async function main() {
  if (!existsSync(TTS)) {
    console.error(`probe-names: ${TTS} not found — run this on the render machine`);
    process.exit(6);
  }
  const li = process.argv.indexOf("--limit");
  const limit = li > 0 ? Number(process.argv[li + 1]) : Infinity;
  const rows = missingNameRows().slice(0, limit);
  const dir = mkdtempSync(join(tmpdir(), "probe-names-"));
  const overrides = {};
  const stuck = [];
  try {
    for (const row of rows) {
      const spec = selectionNamePlan(row);
      const variants = nameVariants(row, spec.text);
      let hit = null;
      for (let i = 0; i < variants.length; i++) {
        if (await speak(variants[i], join(dir, `${spec.geonameId}-${i}.mp3`))) { hit = i; break; }
      }
      if (hit === null) stuck.push(spec.text);
      else if (hit > 0) overrides[spec.geonameId] = variants[hit];
      console.error(`${spec.text}: ${hit === null ? "all variants refused" : hit === 0 ? "renders as planned" : `variant ${hit + 1}`}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(JSON.stringify(overrides, null, 2));
  if (stuck.length) console.error(`still refused (${stuck.length}): ${stuck.join("; ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
