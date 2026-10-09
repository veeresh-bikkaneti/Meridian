#!/usr/bin/env node
/**
 * Render the Storyteller mascot's 3 narration mp3s with LOCAL Kokoro TTS.
 *
 * Voice: am_fenrir (Kokoro-82M, en-us male) @ speed 1.05 — the game
 * designer's 2026-10-08 pick (trailer energy; retires the old cloud
 * `tts` CLI path per the standing no-cloud/no-key/no-spend rules).
 *
 * Toolchain (all local, $0, offline, keyless):
 *   - kokoro-js + onnxruntime, resolved from the aidemo-pilot engine
 *     checkout (AIDEMO_ENGINE_DIR, default ~/workspace/aidemo-pilot/engine)
 *   - Kokoro-82M q8 ONNX model from the local HuggingFace cache
 *     (allowRemoteModels=false — the run fails loudly instead of
 *     downloading anything)
 *   - ffmpeg: silence trim (≤150 ms edges), ebur128-measured gain to
 *     −16 LUFS integrated, then a 4x-oversampled lookahead limiter
 *     (alimiter level=0) capping true peak at −1.5 dBTP, then 24 kHz
 *     mono MP3. (ffmpeg's loudnorm is unreliable on 2–5 s micro-clips —
 *     its windowed measurement disagrees with ebur128 by ~6 dB on the
 *     staccato summary — so the gain is computed explicitly.)
 *
 * Caption == audio contract: the script extracts the `text` fields from
 * src/components/storyteller-lines.ts and REFUSES to render unless they
 * match the lines below character-for-character. Edit the copy in
 * storyteller-lines.ts first, then run this.
 *
 * Usage:
 *   node scripts/render-storyteller-voice.mjs [--out <dir>]
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

/** The three final lines — MUST equal STORYTELLER_LINES text, char for char. */
const LINES = {
  reveal: {
    file: "reveal-01.mp3",
    text: "Gather round, explorer! Every place hides a story. And this one? This one is a legend.",
    words: 16,
  },
  hook: {
    file: "hook-01.mp3",
    text: "Clue four! The Hook! This is the one that changes everything. Lean in… here it comes!",
    words: 16,
  },
  summary: {
    file: "summary-01.mp3",
    text: "And so the tale ends! What. An. Adventure!",
    words: 8,
  },
};

const VOICE = "am_fenrir";
const SPEED = 1.05;
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const TARGET_LUFS = -16;

function fail(msg) {
  console.error(`render-storyteller-voice: FATAL: ${msg}`);
  process.exit(1);
}

/** Extract STORYTELLER_LINES text fields from the TS source (caption==audio gate). */
async function readCaptionText() {
  const src = await fs.readFile(
    join(repoRoot, "src/components/storyteller-lines.ts"),
    "utf8",
  );
  const out = {};
  for (const key of Object.keys(LINES)) {
    const m = src.match(
      new RegExp(`${key}:\\s*{[^}]*text:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s"),
    );
    if (!m) fail(`could not extract ${key} text from storyteller-lines.ts`);
    out[key] = m[1].replace(/\\(.)/g, "$1");
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

  // 1. Caption == audio contract.
  const captions = await readCaptionText();
  for (const [key, line] of Object.entries(LINES)) {
    if (captions[key] !== line.text) {
      fail(
        `${key}: script text != storyteller-lines.ts text.\n` +
          `  script:  ${JSON.stringify(line.text)}\n` +
          `  caption: ${JSON.stringify(captions[key])}`,
      );
    }
    const wc = line.text.split(/\s+/).filter(Boolean).length;
    if (wc !== line.words) fail(`${key}: word count ${wc} != expected ${line.words}`);
  }
  console.log("caption == audio contract: OK (3/3 lines match character-for-character)");

  // 2. Resolve kokoro-js from the aidemo-pilot engine checkout (never npm-install here).
  const engineDir =
    process.env.AIDEMO_ENGINE_DIR ?? join(homedir(), "workspace/aidemo-pilot/engine");
  const engineRequire = createRequire(join(engineDir, "package.json"));
  let kokoroPath;
  try {
    kokoroPath = engineRequire.resolve("kokoro-js");
  } catch {
    fail(`kokoro-js not resolvable from ${engineDir} (AIDEMO_ENGINE_DIR)`);
  }
  const siblingRequire = createRequire(kokoroPath);
  const { KokoroTTS } = await import(pathToFileURL(kokoroPath).href);
  const transformersMod = await import(
    pathToFileURL(siblingRequire.resolve("@huggingface/transformers")).href
  );
  // @huggingface/transformers ships CJS here — env lives on the default export.
  const env = transformersMod.env ?? transformersMod.default?.env;
  if (!env) fail("could not reach transformers env (offline switch unavailable)");

  // 3. Offline proof: never hit the network; use the existing local cache.
  env.allowRemoteModels = false;
  const cacheBase = join(homedir(), ".cache/huggingface/transformersjs");
  try {
    await fs.access(join(cacheBase, MODEL_ID, "onnx"));
    env.cacheDir = cacheBase;
  } catch {
    fail(`model not in local cache (${cacheBase}/${MODEL_ID}/onnx) and network is disabled`);
  }
  const voiceBin = join(dirname(kokoroPath), "..", "voices", `${VOICE}.bin`);
  try {
    await fs.access(voiceBin);
  } catch {
    fail(`voice file missing: ${voiceBin}`);
  }
  console.log(`kokoro-js: ${kokoroPath}`);
  console.log(`model cache (offline): ${cacheBase}/${MODEL_ID} · voice: ${VOICE} @ ${SPEED}x`);

  // 4. Load the model once, render the three lines.
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: "q8",
    device: "cpu",
  });
  const scratch = await fs.mkdtemp(join(tmpdir(), "storyteller-voice-"));
  console.log(`scratch: ${scratch}`);
  const rawWavs = {};
  for (const [key, line] of Object.entries(LINES)) {
    const audio = await tts.generate(line.text, { voice: VOICE, speed: SPEED });
    const wavPath = join(scratch, `${key}-raw.wav`);
    await fs.writeFile(wavPath, Buffer.from(await audio.toWav()));
    rawWavs[key] = wavPath;
    console.log(`rendered ${key}: ${wavPath}`);
  }
  await tts.model?.dispose?.();

  // 5. Master as a set. loudnorm is unreliable on these 2-5 s micro-clips
  // (its 400 ms-window measurement disagrees with ebur128 by ~6 dB on the
  // staccato summary), so: trim edge silence, measure with ebur128, apply
  // the exact gain to -16 LUFS, then true-peak-limit at -1.5 dBTP with an
  // oversampled lookahead limiter (4x so inter-sample peaks are caught).
  // alimiter needs level=0 — its auto-level default re-gains the output.
  const TRIM =
    "silenceremove=start_periods=1:start_duration=0.15:start_threshold=-45dB," +
    "areverse," +
    "silenceremove=start_periods=1:start_duration=0.15:start_threshold=-45dB," +
    "areverse";
  const LIMIT = "0.8414"; // -1.5 dBTP as linear amplitude
  const measure = async (path) => {
    const { stderr } = await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-i",
      path,
      "-af",
      "ebur128=peak=true:framelog=quiet",
      "-f",
      "null",
      "-",
    ]);
    const integ = parseFloat(stderr.match(/I:\s+([-\d.]+) LUFS/)?.[1] ?? "NaN");
    const tpk = parseFloat(
      stderr.match(/True peak:\s*\n\s*Peak:\s+([-\d.]+) dBFS/)?.[1] ?? "NaN",
    );
    if (!Number.isFinite(integ) || !Number.isFinite(tpk))
      fail(`could not measure loudness of ${path}`);
    return { integ, tpk };
  };

  await fs.mkdir(outDir, { recursive: true });
  const report = [];
  for (const [key, line] of Object.entries(LINES)) {
    const trimmed = join(scratch, `${key}-trimmed.wav`);
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-y",
      "-i",
      rawWavs[key],
      "-af",
      TRIM,
      "-ar",
      "24000",
      "-ac",
      "1",
      trimmed,
    ]);
    const outMp3 = join(outDir, line.file);
    // Iterative: the limiter shaves a little integrated level off the peaks,
    // so re-measure after limiting and correct the residual (converges in
    // 2-3 passes; each pass re-limits so true peak can never escape).
    const stage = (n) => join(scratch, `${key}-stage${n}.wav`);
    let current = trimmed;
    let totalGain = 0;
    for (let pass = 0; pass < 3; pass++) {
      const m = await measure(current);
      const gainDb = TARGET_LUFS - m.integ;
      totalGain += gainDb;
      if (Math.abs(gainDb) < 0.3) break;
      const next = stage(pass);
      await execFileAsync("ffmpeg", [
        "-hide_banner",
        "-nostats",
        "-y",
        "-i",
        current,
        "-af",
        `volume=${gainDb.toFixed(2)}dB,` +
          `aresample=96000:resampler=soxr,` +
          `alimiter=limit=${LIMIT}:attack=7:release=100:level=0,` +
          `aresample=24000:resampler=soxr`,
        "-ar",
        "24000",
        "-ac",
        "1",
        next,
      ]);
      current = next;
    }
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-y",
      "-i",
      current,
      "-ac",
      "1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "64k",
      "-metadata",
      "comment=AI Generated",
      outMp3,
    ]);

    // 6. Verify: duration, integrated loudness, true peak, edge silence.
    const { stdout: probe } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration,size",
      "-of",
      "default=noprint_wrappers=1",
      outMp3,
    ]);
    const dur = parseFloat(probe.match(/duration=([\d.]+)/)[1]);
    const post = await measure(outMp3);
    if (Math.abs(post.integ - TARGET_LUFS) > 1.0)
      fail(`${key}: integrated ${post.integ} LUFS is >1 dB from target ${TARGET_LUFS}`);
    if (post.tpk > -1.0) fail(`${key}: true peak ${post.tpk} dBTP exceeds -1.0 dBTP ceiling`);
    // Edge silence: no leading/trailing silence period >= 150 ms may survive
    // (the trim stage removes them; this is the belt-and-braces check).
    const { stderr: sil } = await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-i",
      outMp3,
      "-af",
      "silencedetect=noise=-45dB:d=0.15",
      "-f",
      "null",
      "-",
    ]);
    for (const m of sil.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)) {
      const sStart = parseFloat(m[1]);
      const sEnd = parseFloat(m[2]);
      const sDur = parseFloat(m[3]);
      if (sDur >= 0.15 && (sStart < 0.3 || sEnd > dur - 0.3))
        fail(`${key}: edge silence ${sDur.toFixed(2)}s at ${sStart.toFixed(2)}s exceeds 150 ms`);
    }
    report.push({ key, file: line.file, dur, integ: post.integ, tpk: post.tpk });
    console.log(
      `mastered ${line.file}: ${dur.toFixed(2)}s · ${post.integ.toFixed(1)} LUFS integrated · ${post.tpk.toFixed(1)} dBTP true peak (total gain ${totalGain.toFixed(1)} dB)`,
    );
  }

  // 7. Set consistency check.
  const lufs = report.map((r) => r.integ);
  const spread = Math.max(...lufs) - Math.min(...lufs);
  console.log(`set loudness spread: ${spread.toFixed(2)} dB (must be <= ~1 dB)`);
  if (spread > 1.0) fail("inter-clip loudness spread exceeds 1 dB");
  console.log(`\nwrote 3 mp3s -> ${outDir}\nraw wavs kept at ${scratch} for inspection`);
}

main().catch((e) => fail(e?.stack ?? String(e)));
