#!/usr/bin/env node
/**
 * Render the Storyteller home greetings (greet-01…06.mp3) with LOCAL Kokoro TTS.
 *
 * Voice: am_fenrir (Kokoro-82M, en-us male) @ speed 1.05 — the established
 * 2026-10-08 storyteller-sprint standard (trailer energy). This RETIRES the
 * TruthTeller cloud renders that shipped in #118 for the same 6 slots.
 *
 * Caption == audio contract: the 6 captions are DERIVED from
 * src/components/storyteller-home-copy.ts (the GREETINGS array; GREET_01 is a
 * named constant and is resolved). Nothing is retyped here. A round-trip
 * gate proves each parsed caption re-escapes to literal text present in the
 * source, so a tokenizer bug cannot silently mangle a caption.
 *
 * Toolchain (all local, $0, offline, keyless) — same as
 * scripts/render-storyteller-voice.mjs:
 *   - kokoro-js + onnxruntime, resolved from the aidemo-pilot engine
 *     checkout (AIDEMO_ENGINE_DIR, default ~/workspace/aidemo-pilot/engine)
 *   - Kokoro-82M q8 ONNX model from the local HuggingFace cache
 *     (allowRemoteModels=false — the run fails loudly instead of
 *     downloading anything)
 *   - ffmpeg: silence trim (≤150 ms edges), ebur128-measured gain to
 *     −16 LUFS integrated, then a 4x-oversampled lookahead limiter
 *     (alimiter level=0) capping true peak at −1.5 dBTP, then 24 kHz
 *     mono MP3.
 *
 * Usage:
 *   node scripts/render-storyteller-greets.mjs [--out <dir>]
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

const VOICE = "am_fenrir";
const SPEED = 1.05;
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const TARGET_LUFS = -16;
const MAX_BYTES = 100 * 1024; // each greet mp3 must stay <= 100 KB

function fail(msg) {
  console.error(`render-storyteller-greets: FATAL: ${msg}`);
  process.exit(1);
}

/** Unescape a TS double-quoted string literal body. */
function unescapeTs(body) {
  return body.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/gs, (m, esc) => {
    if (esc.startsWith("u")) return String.fromCharCode(parseInt(esc.slice(1), 16));
    if (esc.startsWith("x")) return String.fromCharCode(parseInt(esc.slice(1), 16));
    switch (esc) {
      case "n": return "\n";
      case "r": return "\r";
      case "t": return "\t";
      case "b": return "\b";
      case "f": return "\f";
      case "v": return "\v";
      case "0": return "\0";
      default: return esc;
    }
  });
}

/** Re-escape a caption into a TS double-quoted literal (round-trip gate). */
function escapeTs(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Derive the 6 GREETINGS captions from src/components/storyteller-home-copy.ts.
 * Returns [{ file, text }]. Fails loudly on any parse anomaly.
 */
async function readGreetingCaptions() {
  const src = await fs.readFile(
    join(repoRoot, "src/components/storyteller-home-copy.ts"),
    "utf8",
  );

  // GREET_01 named constant.
  const m01 = src.match(/export const GREET_01\s*=\s*"((?:[^"\\]|\\.)*)"/s);
  if (!m01) fail("could not extract GREET_01 from storyteller-home-copy.ts");
  const greet01 = unescapeTs(m01[1]);
  if (!escapeTs(greet01) || !src.includes(`"${escapeTs(greet01)}"`))
    fail("GREET_01 round-trip check failed");

  // GREETINGS array initializer — tokenize top-level elements.
  const arrMatch = src.match(
    /export const GREETINGS:\s*readonly string\[\]\s*=\s*\[([\s\S]*?)\];/,
  );
  if (!arrMatch) fail("could not find GREETINGS array in storyteller-home-copy.ts");
  const body = arrMatch[1];
  const elements = [];
  const tokenRe = /"((?:[^"\\]|\\.)*)"|([A-Za-z_$][\w$]*)|(\S)/g;
  let m;
  while ((m = tokenRe.exec(body)) !== null) {
    if (m[1] !== undefined) {
      elements.push({ kind: "string", value: unescapeTs(m[1]) });
    } else if (m[2] !== undefined) {
      if (m[2] === "GREET_01") elements.push({ kind: "string", value: greet01 });
      else fail(`unexpected identifier '${m[2]}' in GREETINGS array`);
    } else if (m[3] !== "," && !/\s/.test(m[3])) {
      fail(`unexpected token '${m[3]}' in GREETINGS array`);
    }
  }
  if (elements.length !== 6)
    fail(`GREETINGS has ${elements.length} elements, expected 6`);

  const captions = elements.map((el, i) => {
    const text = el.value;
    if (!text || !text.trim()) fail(`GREETINGS[${i}] is empty`);
    // Round-trip gate: re-escaped literal must appear verbatim in the source.
    if (el.value !== greet01 || i !== 0) {
      if (!src.includes(`"${escapeTs(text)}"`))
        fail(`GREETINGS[${i}] round-trip check failed (parsed caption not found in source)`);
    }
    return { file: `greet-${String(i + 1).padStart(2, "0")}.mp3`, text };
  });
  // The first element must be the locked GREET_01 (spec §1).
  if (captions[0].text !== greet01) fail("GREETINGS[0] is not GREET_01");
  return captions;
}

async function main() {
  const outDir = (() => {
    const i = process.argv.indexOf("--out");
    return i === -1
      ? join(repoRoot, "public/audio/storyteller")
      : join(repoRoot, process.argv[i + 1] ?? fail("missing --out value"));
  })();

  // 1. Caption == audio contract — derive from source, never retype.
  const CAPTIONS = await readGreetingCaptions();
  console.log("caption == audio contract: OK (6/6 captions derived from storyteller-home-copy.ts)");
  for (const c of CAPTIONS) {
    console.log(`  ${c.file}: ${c.text.length} chars — ${JSON.stringify(c.text.slice(0, 48))}…`);
  }
  if (process.argv.includes("--dry-run")) {
    console.log("dry run: captions OK, skipping render");
    return;
  }

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

  // 4. Load the model once, render the six greetings.
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: "q8",
    device: "cpu",
  });
  const scratch = await fs.mkdtemp(join(tmpdir(), "storyteller-greets-"));
  console.log(`scratch: ${scratch}`);
  const rawWavs = {};
  for (const c of CAPTIONS) {
    const audio = await tts.generate(c.text, { voice: VOICE, speed: SPEED });
    const wavPath = join(scratch, `${c.file.replace(/\.mp3$/, "")}-raw.wav`);
    await fs.writeFile(wavPath, Buffer.from(await audio.toWav()));
    rawWavs[c.file] = wavPath;
    console.log(`rendered ${c.file}: ${wavPath}`);
  }
  await tts.model?.dispose?.();

  // 5. Master as a set. (Same rationale as render-storyteller-voice.mjs:
  // ffmpeg's loudnorm is unreliable on 2–8 s micro-clips, so measure with
  // ebur128, apply the exact gain to -16 LUFS, then true-peak-limit at
  // -1.5 dBTP with a 4x-oversampled lookahead limiter.)
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
  for (const c of CAPTIONS) {
    const key = c.file.replace(/\.mp3$/, "");
    const trimmed = join(scratch, `${key}-trimmed.wav`);
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-y",
      "-i",
      rawWavs[c.file],
      "-af",
      TRIM,
      "-ar",
      "24000",
      "-ac",
      "1",
      trimmed,
    ]);
    const outMp3 = join(outDir, c.file);
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

    // 6. Verify: duration, size, integrated loudness, true peak, edge silence.
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
    const size = parseInt(probe.match(/size=(\d+)/)[1], 10);
    if (size > MAX_BYTES)
      fail(`${c.file}: ${size} bytes exceeds 100 KB budget — needs escalation`);
    const post = await measure(outMp3);
    if (Math.abs(post.integ - TARGET_LUFS) > 1.0)
      fail(`${c.file}: integrated ${post.integ} LUFS is >1 dB from target ${TARGET_LUFS}`);
    if (post.tpk > -1.0) fail(`${c.file}: true peak ${post.tpk} dBTP exceeds -1.0 dBTP ceiling`);
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
        fail(`${c.file}: edge silence ${sDur.toFixed(2)}s at ${sStart.toFixed(2)}s exceeds 150 ms`);
    }
    report.push({ file: c.file, dur, size, integ: post.integ, tpk: post.tpk });
    console.log(
      `mastered ${c.file}: ${dur.toFixed(2)}s · ${(size / 1024).toFixed(1)} KB · ` +
      `${post.integ.toFixed(1)} LUFS integrated · ${post.tpk.toFixed(1)} dBTP true peak ` +
      `(total gain ${totalGain.toFixed(1)} dB)`,
    );
  }

  // 7. Set consistency check.
  const lufs = report.map((r) => r.integ);
  const spread = Math.max(...lufs) - Math.min(...lufs);
  console.log(`set loudness spread: ${spread.toFixed(2)} dB (must be <= ~1 dB)`);
  if (spread > 1.0) fail("inter-clip loudness spread exceeds 1 dB");
  console.log(`\nwrote 6 mp3s -> ${outDir}\nraw wavs kept at ${scratch} for inspection`);
}

main().catch((e) => fail(e?.stack ?? String(e)));
