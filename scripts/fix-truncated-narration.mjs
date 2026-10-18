#!/usr/bin/env node
/**
 * Fix truncated narration audio (owner report 2026-10-18: narration ends
 * abruptly, final words chopped — e.g. the "Troy?" poke line).
 *
 * ROOT CAUSE (proven): the mastering chain in render-storyteller-voice.mjs
 * and render-storyteller-greets.mjs ran the silence TRIM on the RAW Kokoro
 * output, BEFORE loudness normalization. Kokoro's raw output is quiet with
 * soft onsets/offsets; the -45 dB silence threshold treated audible speech
 * as "silence" and ate up to ~1.1 s of it (summary-01: 2.98 s raw ->
 * 1.92 s mastered, tail cut mid-word at -1.8 dB). The old verify step only
 * checked for edge SILENCE, which a mid-word cut trivially passes.
 *
 * THE FIX: normalize first, then trim with silencedetect+atrim (exact).
 * Two defects compounded in the old chain: (1) it trimmed the quiet RAW
 * output, where -45 dB sits inside audible speech; (2) silenceremove's
 * start_duration=0.15 acts as a hangover that eats ~0.15-0.3 s of audible
 * audio per edge even on normalized audio (measured). silencedetect finds
 * the exact silence boundaries and atrim cuts precisely them — interior
 * pauses are never touched. Plus two new hard guards the old chain lacked:
 *   1. the trim may not remove more than 1.0 s total (beyond that it isn't
 *      edge silence);
 *   2. tail decay: the final 100 ms must be quiet (peak <= -35 dB) or at
 *      least 10 dB below the file's overall peak — a file ending mid-word
 *      fails loudly instead of shipping.
 *
 * SCOPE: the 8 storyteller clips whose tails were measured hot (cut
 * mid-sound): poke-01..05, hook-01, reveal-01, summary-01. All 31 narration
 * clips were envelope-measured; the other 23 decay naturally to silence
 * and are left untouched. Voice is unchanged (am_fenrir @ 1.05x), so the
 * fixed clips match the existing set.
 *
 * Toolchain (all local, $0, offline, keyless) — same as the render scripts:
 *   - kokoro-js + onnxruntime from the aidemo-pilot engine checkout
 *   - Kokoro-82M q8 ONNX from the local HuggingFace cache
 *     (allowRemoteModels=false — fails loudly instead of downloading)
 *   - ffmpeg mastering as described above.
 *
 * Caption == audio contract: texts are derived from
 * src/components/storyteller-lines.ts (STORYTELLER_LINES) and
 * src/components/storyteller-home-copy.ts (POKE_LINES) and must match the
 * expected literals below character-for-character. Edit the copy in the
 * source files first, then run this.
 *
 * Usage:
 *   node scripts/fix-truncated-narration.mjs [--out <dir>] [--dry-run]
 *     (default out: <repo>/public/audio/storyteller)
 */

import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/** The 8 truncated lines — MUST match source captions char for char. */
const LINES = [
  { file: "reveal-01.mp3", src: "storyteller-lines.ts", key: "reveal",
    text: "Gather round, explorer! Every place hides a story. And this one? This one is a legend." },
  { file: "hook-01.mp3", src: "storyteller-lines.ts", key: "hook",
    text: "Clue four! The Hook! This is the one that changes everything. Lean in… here it comes!" },
  { file: "summary-01.mp3", src: "storyteller-lines.ts", key: "summary",
    text: "And so the tale ends! What. An. Adventure!" },
  { file: "poke-01.mp3", src: "storyteller-home-copy.ts", key: "POKE_LINES[0]",
    text: "Heh! That tickles my beard." },
  { file: "poke-02.mp3", src: "storyteller-home-copy.ts", key: "POKE_LINES[1]",
    text: "Careful, explorer — I'm older than these mountains." },
  { file: "poke-03.mp3", src: "storyteller-home-copy.ts", key: "POKE_LINES[2]",
    text: "Poke all you like. I've survived worse… have I told you about Troy? 😌" },
  { file: "poke-04.mp3", src: "storyteller-home-copy.ts", key: "POKE_LINES[3]",
    text: "Hmm? Did the map just move, or was that you?" },
  { file: "poke-05.mp3", src: "storyteller-home-copy.ts", key: "POKE_LINES[4]",
    text: "Alright, alright — pick a place and I'll tell you its tale." },
];

const VOICE = "am_fenrir";
const SPEED = 1.05;
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const TARGET_LUFS = -16;

function fail(msg) {
  console.error(`fix-truncated-narration: FATAL: ${msg}`);
  process.exit(1);
}

/** Unescape a TS double-quoted string literal body. */
function unescapeTs(body) {
  return body.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/gs, (m, esc) => {
    if (esc.startsWith("u")) return String.fromCharCode(parseInt(esc.slice(1), 16));
    if (esc.startsWith("x")) return String.fromCharCode(parseInt(esc.slice(1), 16));
    switch (esc) {
      case "n": return "\n"; case "r": return "\r"; case "t": return "\t";
      default: return esc;
    }
  });
}

async function readCaptions() {
  const linesSrc = await fs.readFile(
    join(repoRoot, "src/components/storyteller-lines.ts"), "utf8");
  const copySrc = await fs.readFile(
    join(repoRoot, "src/components/storyteller-home-copy.ts"), "utf8");
  const out = {};
  for (const line of LINES) {
    let text;
    if (line.src === "storyteller-lines.ts") {
      const m = linesSrc.match(new RegExp(
        `${line.key}:\\s*{[^}]*text:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s"));
      if (!m) fail(`could not extract ${line.key} from storyteller-lines.ts`);
      text = m[1].replace(/\\(.)/g, "$1");
    } else {
      const arrM = copySrc.match(/POKE_LINES[^=]*=\s*\[([\s\S]*?)\];/);
      if (!arrM) fail("could not find POKE_LINES in storyteller-home-copy.ts");
      const elems = [...arrM[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)]
        .map((e) => unescapeTs(e[1]));
      const idx = Number(line.key.match(/\[(\d+)\]/)[1]);
      text = elems[idx];
      if (text === undefined) fail(`POKE_LINES[${idx}] missing`);
    }
    out[line.file] = text;
  }
  return out;
}

async function main() {
  const outDir = (() => {
    const i = process.argv.indexOf("--out");
    return i === -1
      ? join(repoRoot, "public/audio/storyteller")
      : join(repoRoot, process.argv[i + 1] ?? fail("missing --out value"));
  })();
  const dryRun = process.argv.includes("--dry-run");

  // 1. Caption == audio contract.
  const captions = await readCaptions();
  for (const line of LINES) {
    if (captions[line.file] !== line.text) {
      fail(`${line.file}: script text != source caption.\n` +
        `  script:  ${JSON.stringify(line.text)}\n` +
        `  caption: ${JSON.stringify(captions[line.file])}`);
    }
  }
  console.log("caption == audio contract: OK (8/8 lines match character-for-character)");
  if (dryRun) { console.log("dry run: captions OK, skipping render"); return; }

  // 2-3. Kokoro bootstrap (offline), same as the render scripts.
  const engineDir =
    process.env.AIDEMO_ENGINE_DIR ?? join(homedir(), "workspace/aidemo-pilot/engine");
  const engineRequire = createRequire(join(engineDir, "package.json"));
  let kokoroPath;
  try { kokoroPath = engineRequire.resolve("kokoro-js"); }
  catch { fail(`kokoro-js not resolvable from ${engineDir} (AIDEMO_ENGINE_DIR)`); }
  const siblingRequire = createRequire(kokoroPath);
  const { KokoroTTS } = await import(pathToFileURL(kokoroPath).href);
  const transformersMod = await import(
    pathToFileURL(siblingRequire.resolve("@huggingface/transformers")).href);
  const env = transformersMod.env ?? transformersMod.default?.env;
  if (!env) fail("could not reach transformers env (offline switch unavailable)");
  env.allowRemoteModels = false;
  const cacheBase = join(homedir(), ".cache/huggingface/transformersjs");
  try { await fs.access(join(cacheBase, MODEL_ID, "onnx")); env.cacheDir = cacheBase; }
  catch { fail(`model not in local cache and network is disabled`); }
  const voiceBin = join(dirname(kokoroPath), "..", "voices", `${VOICE}.bin`);
  try { await fs.access(voiceBin); }
  catch { fail(`voice file missing: ${voiceBin}`); }
  console.log(`kokoro-js: ${kokoroPath}`);
  console.log(`model cache (offline): ${cacheBase}/${MODEL_ID} · voice: ${VOICE} @ ${SPEED}x`);

  // 4. Render the eight lines.
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "cpu" });
  const scratch = await fs.mkdtemp(join(tmpdir(), "fix-narration-"));
  console.log(`scratch: ${scratch}`);
  const rawWavs = {};
  for (const line of LINES) {
    const audio = await tts.generate(line.text, { voice: VOICE, speed: SPEED });
    const wavPath = join(scratch, `${line.file.replace(/\.mp3$/, "")}-raw.wav`);
    await fs.writeFile(wavPath, Buffer.from(await audio.toWav()));
    rawWavs[line.file] = wavPath;
    console.log(`rendered ${line.file}: ${wavPath}`);
  }
  await tts.model?.dispose?.();

  // 5. Master with the FIXED chain: normalize FIRST, trim LAST — and trim
  // with silencedetect+atrim (exact), NOT silenceremove. The old chain's
  // silenceremove(start_duration=0.15) ate ~0.15-0.3s of audible speech per
  // edge BEYOND the true silence — empirically, even on normalized audio —
  // because start_duration acts as a hangover into non-silence. (Trimming
  // the quiet raw output at -45 dB was even worse: ~1.1s eaten.)
  const LIMIT = "0.8414"; // -1.5 dBTP as linear amplitude
  const measure = async (path) => {
    const { stderr } = await execFileAsync("ffmpeg", [
      "-hide_banner", "-i", path, "-af", "ebur128=peak=true:framelog=quiet",
      "-f", "null", "-",
    ]);
    const integ = parseFloat(stderr.match(/I:\s+([-\d.]+) LUFS/)?.[1] ?? "NaN");
    const tpk = parseFloat(
      stderr.match(/True peak:\s*\n\s*Peak:\s+([-\d.]+) dBFS/)?.[1] ?? "NaN");
    if (!Number.isFinite(integ) || !Number.isFinite(tpk))
      fail(`could not measure loudness of ${path}`);
    return { integ, tpk };
  };
  const probeDur = async (path) => {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", path,
    ]);
    return parseFloat(stdout.trim());
  };
  const tailPeakDb = async (path, seconds) => {
    const { stderr } = await execFileAsync("ffmpeg", [
      "-hide_banner", "-sseof", `-${seconds}`, "-i", path,
      "-af", "astats=metadata=1", "-f", "null", "-",
    ]);
    const m = stderr.match(/Peak level dB:\s*([-\d.]+)/);
    return m ? parseFloat(m[1]) : NaN;
  };

  await fs.mkdir(outDir, { recursive: true });
  for (const line of LINES) {
    const rawDur = await probeDur(rawWavs[line.file]);
    // Normalize first: resample, then iterative gain+limit to TARGET_LUFS.
    const normBase = join(scratch, `${line.file.replace(/\.mp3$/, "")}-norm0.wav`);
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-nostats", "-y", "-i", rawWavs[line.file],
      "-ar", "24000", "-ac", "1", normBase,
    ]);
    let current = normBase;
    for (let pass = 0; pass < 3; pass++) {
      const m = await measure(current);
      const gainDb = TARGET_LUFS - m.integ;
      if (Math.abs(gainDb) < 0.3) break;
      const next = join(scratch,
        `${line.file.replace(/\.mp3$/, "")}-norm${pass + 1}.wav`);
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-nostats", "-y", "-i", current,
        "-af", `volume=${gainDb.toFixed(2)}dB,` +
          `aresample=96000:resampler=soxr,` +
          `alimiter=limit=${LIMIT}:attack=7:release=100:level=0,` +
          `aresample=24000:resampler=soxr`,
        "-ar", "24000", "-ac", "1", next,
      ]);
      current = next;
    }
    // THEN trim: on normalized audio, -45 dB matches only true silence.
    // Trim with silencedetect+atrim (exact): detect silence >=150 ms at
    // -45 dB, cut precisely the periods touching an edge. Interior pauses
    // are never touched. Fails loudly if the total trim exceeds 1.0 s.
    const trimmed = join(scratch, `${line.file.replace(/\.mp3$/, "")}-trimmed.wav`);
    {
      const preDur = await probeDur(current);
      const { stderr: sil } = await execFileAsync("ffmpeg", [
        "-hide_banner", "-nostats", "-i", current,
        "-af", "silencedetect=noise=-45dB:d=0.15", "-f", "null", "-",
      ]);
      let tStart = 0, tEnd = preDur;
      for (const m of sil.matchAll(
        /silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)) {
        const sStart = parseFloat(m[1]), sEnd = parseFloat(m[2]);
        if (sStart <= 0.05) tStart = Math.max(tStart, sEnd);
        if (sEnd >= preDur - 0.05) tEnd = Math.min(tEnd, sStart);
      }
      if (preDur - (tEnd - tStart) > 1.0)
        fail(`${line.file}: edge trim would remove ` +
          `${(preDur - (tEnd - tStart)).toFixed(2)}s — not edge silence`);
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-nostats", "-y", "-i", current,
        "-af", `atrim=start=${tStart.toFixed(3)}:end=${tEnd.toFixed(3)},asetpts=PTS-STARTPTS`,
        "-ar", "24000", "-ac", "1", trimmed,
      ]);
    }
    // Final polish: short fades so the file ends (and starts) at digital
    // silence even though Kokoro's noise floor sits ~-30 dB after the
    // +20 dB normalization gain. 150 ms out / 15 ms in — inaudible as
    // trimming on these 1-5 s clips, removes any residual tick.
    const trimmedDur = await probeDur(trimmed);
    const faded = join(scratch, `${line.file.replace(/\.mp3$/, "")}-faded.wav`);
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-nostats", "-y", "-i", trimmed,
      "-af", `afade=t=in:st=0:d=0.015,afade=t=out:st=${(trimmedDur - 0.15).toFixed(3)}:d=0.15`,
      "-ar", "24000", "-ac", "1", faded,
    ]);
    const outMp3 = join(outDir, line.file);
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-nostats", "-y", "-i", faded,
      "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k",
      "-metadata", "comment=AI Generated", outMp3,
    ]);

    // 6. Verify: loudness, true peak, edge silence, anti-truncation, tail decay.
    const dur = await probeDur(outMp3);
    const post = await measure(outMp3);
    if (Math.abs(post.integ - TARGET_LUFS) > 1.0)
      fail(`${line.file}: integrated ${post.integ} LUFS >1 dB from target`);
    if (post.tpk > -1.0)
      fail(`${line.file}: true peak ${post.tpk} dBTP exceeds ceiling`);
    if (dur < rawDur - 1.1)
      fail(`${line.file}: mastered much shorter than raw ` +
        `(raw ${rawDur.toFixed(2)}s -> ${dur.toFixed(2)}s) — speech may be missing`);
    const tailPeak = await tailPeakDb(outMp3, 0.1);
    const overallPeak = post.tpk;
    if (!(tailPeak <= -35 || overallPeak - tailPeak >= 10))
      fail(`${line.file}: tail does not decay (last 100ms peak ${tailPeak} dB, ` +
        `overall ${overallPeak} dB) — file may end mid-word`);
    const { stderr: sil } = await execFileAsync("ffmpeg", [
      "-hide_banner", "-nostats", "-i", outMp3,
      "-af", "silencedetect=noise=-45dB:d=0.15", "-f", "null", "-",
    ]);
    for (const m of sil.matchAll(
      /silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)) {
      const sStart = parseFloat(m[1]), sEnd = parseFloat(m[2]), sDur = parseFloat(m[3]);
      if (sDur >= 0.15 && (sStart < 0.3 || sEnd > dur - 0.3))
        fail(`${line.file}: edge silence ${sDur.toFixed(2)}s exceeds 150 ms`);
    }
    console.log(`fixed ${line.file}: raw ${rawDur.toFixed(2)}s -> ` +
      `${dur.toFixed(2)}s · ${post.integ.toFixed(1)} LUFS · tail ${tailPeak.toFixed(0)} dB`);
  }
  console.log(`\nwrote 8 fixed mp3s -> ${outDir}`);
}

main().catch((e) => fail(e?.stack ?? String(e)));
