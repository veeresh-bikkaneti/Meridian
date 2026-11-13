#!/usr/bin/env node
// Still + narration to a 10.0s journal clip.
// Usage: node scripts/journal-still-motion.mjs --still <img> --narration <audio> --out <mp4>
// No drawtext. No music bed. Silence after the narration is padding, not a bed.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const WIDTH = 1152;
const HEIGHT = 768;
const FPS = 24;
const DURATION = 10;
const TARGET_LUFS = -18;
const LIMIT = 0.84;

function fail(message, code = 1) {
  console.error(`journal-still-motion: ${message}`);
  process.exit(code);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1] || process.argv[i + 1].startsWith("--")) {
    return null;
  }
  return process.argv[i + 1];
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (result.error) fail(`${cmd} failed to start: ${result.error.message}`);
  return result;
}

function stripId3(narrationPath) {
  const bytes = readFileSync(narrationPath);
  if (bytes.length >= 3 && bytes.subarray(0, 3).toString("ascii") === "ID3") {
    const stripped = join(tmpdir(), `journal-narration-${process.pid}.bin`);
    writeFileSync(stripped, bytes.subarray(37));
    console.log("stripped 37-byte ID3");
    return { path: stripped, temporary: true };
  }
  return { path: narrationPath, temporary: false };
}

function measure(narrationPath) {
  const result = run("ffmpeg", [
    "-hide_banner",
    "-i",
    narrationPath,
    "-af",
    "ebur128=peak=true",
    "-f",
    "null",
    "-",
  ]);
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const integrated = text.match(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/);
  const peak = text.match(/Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/);
  if (!integrated) fail("ebur128 did not report integrated loudness");
  return {
    integrated: Number(integrated[1]),
    peak: peak ? Number(peak[1]) : null,
  };
}

function main() {
  const still = arg("--still");
  const narration = arg("--narration");
  const out = arg("--out");
  if (!still || !narration || !out) {
    fail("need --still, --narration, and --out", 2);
  }

  const audio = stripId3(narration);
  const loudness = measure(audio.path);
  const gain = TARGET_LUFS - loudness.integrated;
  console.log(
    `ebur128 I ${loudness.integrated} LUFS, gain ${gain.toFixed(2)} dB, peak ${loudness.peak ?? "unreported"} dBFS`,
  );
  console.log("no bed");

  mkdirSync(dirname(out), { recursive: true });
  const filter = [
    `[0:v]scale=${WIDTH * 4}:${HEIGHT * 4}:flags=bicubic,split[s0][s1]`,
    `[s0]zoompan=z='min(1+0.0009*on,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=130:s=${WIDTH}x${HEIGHT}:fps=${FPS}[v0]`,
    `[s1]zoompan=z='min(1.05+0.0007*on,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=130:s=${WIDTH}x${HEIGHT}:fps=${FPS}[v1]`,
    `[v0][v1]xfade=transition=fade:duration=0.5:offset=4.9[xf]`,
    `[xf]eq=brightness=0.02:saturation=1.04:enable='between(t,4,6)',trim=duration=${DURATION},setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p[v]`,
    `[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=${gain.toFixed(3)}dB,aresample=192000,alimiter=limit=${LIMIT}:level=0,aresample=48000,apad,atrim=0:${DURATION},asetpts=PTS-STARTPTS[a]`,
  ].join(";");

  const encoded = run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loop",
    "1",
    "-i",
    still,
    "-i",
    audio.path,
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-t",
    String(DURATION),
    "-r",
    String(FPS),
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    out,
  ]);
  if (audio.temporary) rmSync(audio.path, { force: true });
  if (encoded.status !== 0) {
    console.error(encoded.stderr);
    fail(`ffmpeg exited ${encoded.status}`);
  }
  console.log(`wrote ${out}`);
}

main();
