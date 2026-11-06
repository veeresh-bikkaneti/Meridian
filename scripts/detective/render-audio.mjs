#!/usr/bin/env node
/**
 * render-audio.mjs — the detective audio render CLI.
 *
 * Why: Holmes & Watson lines are pre-rendered on purpose (BUILD-SCOPE
 * §1.5: runtime synthesis cannot pin the approved voices or hold the
 * pitch gates). This tool renders lines with the pinned voices, measures
 * every line's pitch + pace with the voice SPEC's method
 * (measure_pitch.py), retries off-band lines with a ±3 pitch ladder,
 * retries slow lines with a +6 pace ladder (pace-ladder.mjs), and
 * records everything in public/audio/detective/manifest.json. A line
 * that still lands outside its family band — or under its pace floor —
 * is written as "flagged" with the numbers attached — never silently
 * passed.
 *
 * Errors state the fix, not just the failure. Exit codes are an API:
 *   0 ok · 2 usage · 3 source missing/unreadable · 4 render or voice-pin
 *   mismatch · 5 strict pitch gate failed · 6 required tool missing
 *
 * Examples:
 *   node scripts/detective/render-audio.mjs --case 137
 *   node scripts/detective/render-audio.mjs --cases 387-396 --dry-run
 *   node scripts/detective/render-audio.mjs --fixed --json
 *   node scripts/detective/render-audio.mjs --all-phase-a --concurrency 4
 */
import { execFile, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  AUDIO_REL,
  CAPITALS_INDEXES,
  NAMES_MIN_POPULATION,
  entryFromSpec,
  entryKey,
  getEntry,
  readClueFile,
  readManifest,
  readNamesIndex,
  setEntry,
  textHash,
  writeManifest,
} from "./audio-manifest.mjs";
import { MAX_PACE_RETRIES, PACE_STEP, paceFloorFor, selectBestTake, settlePace } from "./pace-ladder.mjs";
import { FIXED_LINES, VOICES, casePlan, displayName, selectionNamePlan } from "./render-plan.mjs";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TTS = "/opt/hatch/bin/tts";
const PITCH_SCRIPT = join(ROOT, "scripts/detective/measure_pitch.py");

const EXIT = { ok: 0, usage: 2, source: 3, render: 4, gate: 5, tool: 6 };

/* Pitch bands (Hz, median F0). Target = council gates; family = the
 * wider mockup-observed range a flagged line may land in. */
function bandFor(spec) {
  if (spec.id === "win-holmes") return { target: [170, 400], family: [160, 400] };
  if (spec.id === "hook-announcement" || spec.id === "suspicion")
    return { target: [100, 135], family: [90, 160] };
  if (spec.voice === VOICES.watson)
    return { target: [82, 100], family: [78, 127] };
  return { target: [120, 145], family: [110, 160] };
}

function usage() {
  return `Usage: render-audio.mjs [selection] [options]

Selections (at least one required):
  --case <i>          one case: 5 clue reads + its answer read
  --cases <a-b>       a range of cases, inclusive
  --answers <a-b>     answer reads only, for a range of cases
  --fixed             the fixed lines (acks, suspicion, decodes, …)
  --names             the >=500k population name tier + all 497 case answers' name reads
  --all-phase-a       --fixed + --cases 387-496 + --answers 0-496 + --names

Options:
  --concurrency <n>   parallel renders (default 4)
  --force             re-render even when the manifest hash already matches
  --dry-run           print the plan, render nothing, write nothing
  --json              machine-readable report on stdout
  --help              this text

Exit codes: 0 ok · 2 usage · 3 source missing · 4 render/voice mismatch ·
5 strict pitch gate failed · 6 required tool missing.`;
}

function parseArgs(argv) {
  const opts = { selections: [], concurrency: 4, force: false, dryRun: false, json: false };
  const range = (label, raw) => {
    const m = /^(\d+)-(\d+)$/.exec(raw ?? "");
    if (!m) throw new Error(`${label} wants a range like 387-396 — got "${raw ?? ""}". Fix the flag and re-run.`);
    return [Number(m[1]), Number(m[2])];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--case") {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v)) throw new Error(`--case wants one case index like 137 — got "${argv[i]}".`);
      opts.selections.push({ type: "cases", from: v, to: v });
    } else if (a === "--cases") { const [from, to] = range("--cases", argv[++i]); opts.selections.push({ type: "cases", from, to }); }
    else if (a === "--answers") { const [from, to] = range("--answers", argv[++i]); opts.selections.push({ type: "answers", from, to }); }
    else if (a === "--fixed") opts.selections.push({ type: "fixed" });
    else if (a === "--names") opts.selections.push({ type: "names" });
    else if (a === "--all-phase-a") opts.selections.push({ type: "phaseA" });
    else if (a === "--concurrency") {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v) || v < 1) throw new Error(`--concurrency wants a positive integer — got "${argv[i]}".`);
      opts.concurrency = v;
    } else if (a === "--force") opts.force = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--json") opts.json = true;
    else throw new Error(`unknown flag "${a}" — run with --help for the full command surface.`);
  }
  return opts;
}

/** Expand selections into a deduped job list of render specs. */
function buildJobs(opts) {
  const jobs = new Map();
  const add = (spec) => jobs.set(entryKey(spec), spec);
  let rows = null;
  const namesRows = () => (rows ??= readNamesIndex(ROOT));
  const addCase = (i, { clues = true, answer = true } = {}) => {
    const clueFile = readClueFile(ROOT, i);
    const row = namesRows().find((r) => r.id === clueFile.placeId);
    if (!row) {
      throw new Error(`case ${i}: place ${clueFile.placeId} is not in public/loop/names.v2.json — fix the clue file or rebuild the names catalog, then re-run`);
    }
    const plan = casePlan(clueFile, displayName(row), i);
    if (clues) plan.clues.forEach(add);
    if (answer) add(plan.answer);
  };
  const expand = (sel) => {
    if (sel.type === "fixed") FIXED_LINES.forEach(add);
    else if (sel.type === "cases") for (let i = sel.from; i <= sel.to; i++) addCase(i);
    else if (sel.type === "answers") for (let i = sel.from; i <= sel.to; i++) addCase(i, { clues: false });
    else if (sel.type === "names") {
      const wanted = new Map();
      for (const r of namesRows()) if (r.p >= NAMES_MIN_POPULATION) wanted.set(r.id, r);
      for (let i = 0; i <= 496; i++) {
        const clueFile = readClueFile(ROOT, i);
        const row = namesRows().find((r) => r.id === clueFile.placeId);
        if (row) wanted.set(row.id, row);
      }
      for (const r of wanted.values()) add(selectionNamePlan(r));
    } else if (sel.type === "phaseA") {
      expand({ type: "fixed" });
      for (const i of CAPITALS_INDEXES) addCase(i);
      expand({ type: "answers", from: 0, to: 496 });
      expand({ type: "names" });
    }
  };
  for (const sel of opts.selections) expand(sel);
  return [...jobs.values()];
}

async function measure(file) {
  const [pitch, probe] = await Promise.all([
    run("python3", [PITCH_SCRIPT, file]).then((r) => JSON.parse(r.stdout)),
    run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", file]).then((r) =>
      JSON.parse(r.stdout),
    ),
  ]);
  return {
    hz: typeof pitch.f0_median_hz === "number" ? pitch.f0_median_hz : null,
    durationSec: Math.round(Number(probe.format.duration) * 100) / 100,
  };
}

function wordsOf(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Run tts with the spoken text on stdin. NOTE: this goes through spawn
 * with an explicitly ended stdin pipe on purpose — the promisified
 * execFile `input` shortcut leaves this tts build waiting on stdin
 * forever (measured: no completion in 60 s, vs ~2 s via spawn).
 */
const TTS_TIMEOUT_MS = 45_000;
function runTts(args, text) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(TTS, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectPromise(new Error(`tts did not finish within ${TTS_TIMEOUT_MS / 1000}s (the service occasionally stalls on a call)`));
    }, TTS_TIMEOUT_MS);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => { clearTimeout(timer); rejectPromise(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise(stdout);
      else rejectPromise(new Error(`tts exited ${code}: ${stderr.trim() || stdout.trim()}`));
    });
    child.stdin.end(text);
  });
}

/** One tts call, retried once — a stalled call is a known service flake. */
async function renderWithRetry(args, text, key) {
  let lastError;
  for (let i = 0; i < 2; i++) {
    try {
      return await runTts(args, text);
    } catch (e) {
      lastError = e;
    }
  }
  throw Object.assign(
    new Error(`tts render failed for ${key} after 2 attempts: ${lastError.message} — re-run; if it persists, check ${TTS} is healthy`),
    { exit: EXIT.render },
  );
}

/** Render one spec (pitch ladder, then pace ladder) and return its entry. */
async function renderOne(spec, { force, manifest }) {
  const existing = getEntry(manifest, spec);
  const finalPath = join(ROOT, AUDIO_REL, spec.file);
  if (
    !force &&
    existing &&
    existing.status === "ok" &&
    existing.textHash === textHash(spec) &&
    existsSync(finalPath)
  ) {
    return { spec, entry: existing, skipped: true };
  }
  mkdirSync(dirname(finalPath), { recursive: true });
  const band = bandFor(spec);

  /* One render at one speed: leaves the audio at finalPath and returns
   * its measurements. Shared by both ladders so a take always means
   * the same thing whichever ladder asked for it. */
  const renderAtSpeed = async (speed) => {
    const tmp = `${finalPath}.tmp.mp3`;
    if (existsSync(tmp)) unlinkSync(tmp);
    const stdout = await renderWithRetry([
      "speak", "--voice", spec.voice, "--language", "en",
      "--speed", String(speed), "--output", tmp, "--text-stdin",
    ], spec.text, entryKey(spec));
    let reported = null;
    try { reported = JSON.parse(stdout).voice; } catch { /* handled below */ }
    if (reported !== spec.voice) {
      if (existsSync(tmp)) unlinkSync(tmp);
      throw Object.assign(
        new Error(`voice mismatch for ${entryKey(spec)}: asked for ${spec.voice}, the renderer reported ${JSON.stringify(reported)} — do not ship this line; re-run the render`),
        { exit: EXIT.render },
      );
    }
    if (spec.gainDb !== 0) {
      const gained = `${finalPath}.gain.mp3`;
      await run("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-af", `volume=${spec.gainDb}dB`, gained]);
      unlinkSync(tmp);
      renameSync(gained, finalPath);
    } else {
      renameSync(tmp, finalPath);
    }
    const m = await measure(finalPath);
    const wpm = m.durationSec > 0 ? Math.round((wordsOf(spec.text) / m.durationSec) * 60) : null;
    return { hz: m.hz, wpm, durationSec: m.durationSec, speed };
  };

  /* Pitch ladder: ±3 speed nudges toward the target band, as before. */
  let speed = spec.speed;
  let pitchTake = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    pitchTake = await renderAtSpeed(speed);
    if (pitchTake.hz === null) break; // unmeasurable — flagged below, no ladder to climb
    if (pitchTake.hz >= band.target[0] && pitchTake.hz <= band.target[1]) break;
    if (attempt < 2) speed += pitchTake.hz < band.target[0] ? 3 : -3;
  }
  const inTarget = pitchTake.hz !== null && pitchTake.hz >= band.target[0] && pitchTake.hz <= band.target[1];
  const inFamily = pitchTake.hz !== null && pitchTake.hz >= band.family[0] && pitchTake.hz <= band.family[1];

  /* Pace ladder: a settled take under its wpm floor retries at +6
   * speed (max MAX_PACE_RETRIES). Every take overwrites finalPath, so
   * the current best take's audio is snapshotted as we go and restored
   * at the end if a later, worse take overwrote it. The decision logic
   * itself is pure — see pace-ladder.mjs. */
  const floor = paceFloorFor(spec);
  const takes = [pitchTake];
  let bestSnapshot = null;
  let lastRenderedSpeed = pitchTake.speed;
  if (
    floor !== null &&
    pitchTake.hz !== null &&
    typeof pitchTake.wpm === "number" &&
    pitchTake.wpm < floor
  ) {
    bestSnapshot = `${finalPath}.pace-best.mp3`;
    copyFileSync(finalPath, bestSnapshot); // the pitch take is best so far
    for (let retry = 1; retry <= MAX_PACE_RETRIES; retry++) {
      if (selectBestTake(takes, band.family).wpm >= floor) break;
      const take = await renderAtSpeed(pitchTake.speed + PACE_STEP * retry);
      lastRenderedSpeed = take.speed;
      takes.push(take);
      if (selectBestTake(takes, band.family) === take) copyFileSync(finalPath, bestSnapshot);
    }
  }
  const { best, paceFlagged, status } = settlePace({
    takes, familyBand: band.family, floor, pitchInTarget: inTarget,
  });
  if (bestSnapshot) {
    if (best.speed !== lastRenderedSpeed) copyFileSync(bestSnapshot, finalPath);
    unlinkSync(bestSnapshot);
  }

  // In target and at pace (possibly after ladder nudges, recorded in
  // the note) = ok. Flagged is reserved for lines still outside target
  // or under their pace floor after the ladders — and a pitch flag is
  // never lifted by pace (settlePace keeps it).
  const notes = [];
  if (spec.note) notes.push(spec.note);
  if (!inTarget) {
    notes.push(
      `pitch ${pitchTake.hz ?? "unmeasured"} Hz outside target ${band.target[0]}-${band.target[1]} Hz` +
        (inFamily ? ` — inside the wider family band ${band.family[0]}-${band.family[1]} Hz, accepted as flagged` : ` — OUTSIDE the family band ${band.family[0]}-${band.family[1]} Hz too; human ear check required`),
    );
  }
  if (pitchTake.speed !== spec.speed) notes.push(`pitch retry ladder moved speed ${spec.speed} -> ${pitchTake.speed}`);
  if (best.speed !== pitchTake.speed) notes.push(`pace retry ladder moved speed ${pitchTake.speed} -> ${best.speed}`);
  if (paceFlagged) {
    notes.push(
      `pace ${best.wpm} wpm below the ${floor} wpm floor after ${takes.length - 1} pace ${takes.length - 1 === 1 ? "retry" : "retries"} — best in-family take kept, flagged for a human ear check`,
    );
  }
  const entry = entryFromSpec(
    { ...spec, speed: best.speed },
    {
      measuredHz: best.hz,
      measuredWpm: best.wpm,
      durationSec: best.durationSec,
      status,
      note: notes.length ? notes.join("; ") : undefined,
    },
  );
  return { spec, entry, skipped: false };
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(EXIT.usage);
  }
  if (opts.help) { console.log(usage()); return; }
  if (!opts.selections.length) {
    console.error(`error: nothing to render — pass a selection (try --case 137, or --help for all of them)`);
    process.exit(EXIT.usage);
  }
  for (const tool of [TTS, "/usr/bin/python3"]) {
    if (!existsSync(tool)) {
      console.error(`error: required tool missing at ${tool} — install/restore it, then re-run`);
      process.exit(EXIT.tool);
    }
  }

  let jobs;
  try {
    jobs = buildJobs(opts);
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(EXIT.source);
  }

  if (opts.dryRun) {
    const plan = jobs.map((s) => ({ key: entryKey(s), text: s.text, voice: s.voice, speed: s.speed, gainDb: s.gainDb, file: s.file }));
    if (opts.json) console.log(JSON.stringify({ dryRun: true, lines: plan }, null, 1));
    else for (const p of plan) console.log(`${p.key}  ${p.file}  speed ${p.speed}  ${JSON.stringify(p.text)}`);
    console.log(`dry run: ${plan.length} line(s) planned, nothing rendered`);
    return;
  }

  const manifest = readManifest(ROOT);
  const results = [];
  const failures = [];
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const spec = jobs[cursor++];
      try {
        const r = await renderOne(spec, { force: opts.force, manifest });
        setEntry(manifest, r.spec, r.entry);
        // Persist per line: a stalled batch must not lose finished lines.
        writeManifest(ROOT, manifest);
        results.push(r);
        if (!opts.json) {
          console.log(
            `${entryKey(spec)}  speed ${r.entry.speed}  ${r.entry.measuredHz ?? "?"} Hz  ${r.entry.measuredWpm ?? "?"} wpm  ${r.skipped ? "skipped (hash match)" : r.entry.status}`,
          );
        }
      } catch (e) {
        failures.push({ key: entryKey(spec), message: e.message, exit: e.exit ?? EXIT.render });
        if (!opts.json) console.error(`FAIL ${entryKey(spec)}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, jobs.length) }, worker));
  writeManifest(ROOT, manifest);

  // Strict gates (batch-level; no flagged acceptance). Baseline = the
  // acks' median pitch, from this batch or the manifest.
  const gateFailures = [];
  const ackHz = FIXED_LINES.filter((l) => l.kind === "ack")
    .map((l) => getEntry(manifest, l)?.measuredHz)
    .filter((n) => typeof n === "number");
  const baseline = median(ackHz);
  const renderedIds = new Set(results.filter((r) => !r.skipped).map((r) => r.spec.id));
  if (baseline !== null && renderedIds.has("win-holmes")) {
    const win = getEntry(manifest, FIXED_LINES.find((l) => l.id === "win-holmes"));
    if (!(win.measuredHz >= 170 && win.measuredHz >= baseline * 1.35)) {
      gateFailures.push(`win-holmes measured ${win.measuredHz} Hz — strict gate wants >=170 Hz AND >=35% above the acks baseline ${baseline} Hz (>=${Math.round(baseline * 1.35)} Hz). Re-render the win line, or fix the baseline batch first.`);
    }
  }
  if (baseline !== null && renderedIds.has("hook-announcement")) {
    const hook = getEntry(manifest, FIXED_LINES.find((l) => l.id === "hook-announcement"));
    if (!(hook.measuredHz < baseline)) {
      gateFailures.push(`hook-announcement measured ${hook.measuredHz} Hz — strict gate wants it BELOW the acks baseline ${baseline} Hz (hushed register). Re-render it at a lower speed.`);
    }
  }

  const report = {
    rendered: results.filter((r) => !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    flagged: results.filter((r) => !r.skipped && r.entry.status === "flagged").map((r) => entryKey(r.spec)),
    failures: failures.map((f) => f.key),
    gateFailures,
    lines: results.map((r) => ({
      key: entryKey(r.spec), speed: r.entry.speed, measuredHz: r.entry.measuredHz,
      measuredWpm: r.entry.measuredWpm, durationSec: r.entry.durationSec,
      status: r.skipped ? "skipped" : r.entry.status,
    })),
  };
  if (opts.json) console.log(JSON.stringify(report, null, 1));
  else {
    console.log(`done: ${report.rendered} rendered, ${report.skipped} skipped, ${report.flagged.length} flagged, ${failures.length} failed`);
    for (const g of gateFailures) console.error(`STRICT GATE: ${g}`);
  }
  if (failures.length) process.exit(Math.max(...failures.map((f) => f.exit)));
  if (gateFailures.length) process.exit(EXIT.gate);
}

main().catch((e) => {
  console.error(`error: ${e.message} — re-run with --help if the command line is in doubt`);
  process.exit(EXIT.render);
});
