// Still to a 10.0 s, 1152x768, 24 fps h264 + AAC movie.
// Five zoompan framings, a short fade, eq and vignette on the key-moment
// framing only. Loudness is an ebur128 gain toward -18 LUFS, then a limiter.
// There is no background bed. Silence fills the rest of the 10 seconds.

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const FPS = 24;
const SEG_FRAMES = 53;
const XFADE = 0.25;
const TARGET_LUFS = -18;
const WIDTH = 1152;
const HEIGHT = 768;
const DURATION = 10;

const FRAMINGS = [
  { z: "1.05+0.025*on/52", x: "0.38+0.06*on/52", y: "0.42+0.04*on/52", grade: false },
  { z: "1.07+0.09*on/52", x: "0.42+0.04*on/52", y: "0.34-0.04*on/52", grade: false },
  { z: "1.18", x: "0.48", y: "0.32", grade: true },
  { z: "1.18-0.08*on/52", x: "0.48-0.06*on/52", y: "0.34+0.05*on/52", grade: false },
  { z: "1.12-0.07*on/52", x: "0.40-0.04*on/52", y: "0.46", grade: false },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--still" || arg === "--narration" || arg === "--out") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) fail(`missing value for ${arg}`);
      out[arg.slice(2)] = value;
      i += 1;
      continue;
    }
    fail(`unknown argument ${arg}`);
  }
  if (!out.still || !out.narration || !out.out) {
    fail(
      "usage: node scripts/journal-still-motion.mjs --still <img> --narration <audio> --out <mp4>",
    );
  }
  return {
    still: resolve(out.still),
    narration: resolve(out.narration),
    out: resolve(out.out),
  };
}

function run(bin, args) {
  return execFileAsync(bin, args, {
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
}

async function ffmpeg(args) {
  try {
    return await run("ffmpeg", ["-hide_banner", "-nostats", ...args]);
  } catch (error) {
    const stderr = error.stderr?.toString?.() ?? "";
    fail(stderr.trim().split("\n").slice(-20).join("\n") || error.message);
  }
}

async function measure(path) {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    path,
    "-af",
    "ebur128=peak=true:framelog=quiet",
    "-f",
    "null",
    "-",
  ]);
  const text = stderr.toString();
  const integ = parseFloat(text.match(/I:\s+([-\d.]+) LUFS/)?.[1] ?? "NaN");
  const tpk = parseFloat(text.match(/True peak:\s*\n\s*Peak:\s+([-\d.]+) dBFS/)?.[1] ?? "NaN");
  if (!Number.isFinite(integ) || !Number.isFinite(tpk)) {
    fail(`could not measure loudness of ${path}`);
  }
  return { integ, tpk };
}

async function prepareNarration(src, scratch) {
  const buf = await readFile(src);
  if (buf.length < 10 || buf.subarray(0, 3).toString("latin1") !== "ID3") return src;
  const size =
    ((buf[6] & 0x7f) << 21) |
    ((buf[7] & 0x7f) << 14) |
    ((buf[8] & 0x7f) << 7) |
    (buf[9] & 0x7f);
  const total = size + 10;
  if (total !== 37) return src;
  const dest = join(scratch, "narration-stripped.wav");
  await writeFile(dest, buf.subarray(37));
  console.log("stripped 37-byte ID3v2 tag");
  return dest;
}

function videoFilter() {
  const seg = SEG_FRAMES / FPS;
  const lines = [
    `[0:v]scale=${WIDTH * 2}:${HEIGHT * 2}:flags=lanczos,split=${FRAMINGS.length}${FRAMINGS.map((_, i) => `[s${i}]`).join("")}`,
  ];
  FRAMINGS.forEach((framing, i) => {
    const zoom = [
      `zoompan=z='${framing.z}'`,
      `x='(iw-iw/zoom)*clip(${framing.x}\\,0.02\\,0.98)'`,
      `y='(ih-ih/zoom)*clip(${framing.y}\\,0.02\\,0.98)'`,
      `d=${SEG_FRAMES}`,
      `s=${WIDTH}x${HEIGHT}`,
      `fps=${FPS}`,
    ].join(":");
    const grade = framing.grade
      ? ",eq=brightness=0.03:saturation=1.08,vignette=angle=PI/5:mode=forward"
      : "";
    lines.push(
      `[s${i}]${zoom},fps=${FPS},settb=1/24,setpts=PTS-STARTPTS,format=yuv420p${grade}[v${i}]`,
    );
  });
  let cursor = seg;
  let prev = "v0";
  for (let i = 1; i < FRAMINGS.length; i++) {
    const offset = (cursor - XFADE).toFixed(6);
    const label = i === FRAMINGS.length - 1 ? "xf" : `x${i}`;
    lines.push(
      `[${prev}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset}[${label}]`,
    );
    cursor += seg - XFADE;
    prev = label;
  }
  lines.push(
    `[xf]trim=duration=${DURATION},setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p[vout]`,
  );
  return lines.join(";");
}

async function masterAudio(src, dest) {
  const padded = dest.replace(/\.wav$/, "-padded.wav");
  await ffmpeg([
    "-y",
    "-i",
    src,
    "-af",
    `aresample=48000,apad=whole_dur=${DURATION},atrim=0:${DURATION}`,
    "-ar",
    "48000",
    "-ac",
    "1",
    "-t",
    String(DURATION),
    padded,
  ]);
  const source = await measure(padded);
  let gain = TARGET_LUFS - source.integ;
  let limit = 0.831;
  let mastered = source;
  for (let pass = 0; pass < 4; pass++) {
    await ffmpeg([
      "-y",
      "-i",
      padded,
      "-af",
      `volume=${gain.toFixed(3)}dB,alimiter=limit=${limit.toFixed(4)}:attack=5:release=50:level=0`,
      "-ar",
      "48000",
      "-ac",
      "1",
      "-t",
      String(DURATION),
      dest,
    ]);
    mastered = await measure(dest);
    const loudErr = TARGET_LUFS - mastered.integ;
    const hot = mastered.tpk > -1.4;
    if (!hot && Math.abs(loudErr) <= 0.45) break;
    if (hot) limit = Math.min(limit, 10 ** (-1.8 / 20));
    gain += hot ? Math.min(loudErr, 0) : loudErr;
  }
  return { gain, limit, source, mastered };
}

async function probe(path) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_name,codec_type,width,height,pix_fmt,avg_frame_rate",
    "-of",
    "json",
    path,
  ]);
  return JSON.parse(stdout);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scratch = await mkdtemp(join(tmpdir(), "journal-still-motion-"));
  try {
    const narration = await prepareNarration(args.narration, scratch);
    const videoOnly = join(scratch, "video.mp4");
    const mastered = join(scratch, "master.wav");
    await ffmpeg([
      "-y",
      "-i",
      args.still,
      "-filter_complex",
      videoFilter(),
      "-map",
      "[vout]",
      "-an",
      "-r",
      String(FPS),
      "-frames:v",
      String(FPS * DURATION),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      videoOnly,
    ]);
    const audio = await masterAudio(narration, mastered);
    await ffmpeg([
      "-y",
      "-i",
      videoOnly,
      "-i",
      mastered,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-ar",
      "48000",
      "-ac",
      "1",
      "-t",
      String(DURATION),
      "-movflags",
      "+faststart",
      args.out,
    ]);
    const info = await probe(args.out);
    const loud = await measure(args.out);
    const video = info.streams.find((stream) => stream.codec_type === "video");
    const audioStream = info.streams.find((stream) => stream.codec_type === "audio");
    const duration = Number(info.format.duration);
    console.log("bed: none");
    console.log(`gain_db: ${audio.gain.toFixed(2)}`);
    console.log(`limiter: ${audio.limit.toFixed(4)}`);
    console.log(`source_lufs: ${audio.source.integ.toFixed(1)}`);
    console.log(`source_peak_dbfs: ${audio.source.tpk.toFixed(1)}`);
    console.log(`integrated_lufs: ${loud.integ.toFixed(1)}`);
    console.log(`true_peak_dbfs: ${loud.tpk.toFixed(1)}`);
    console.log(`duration_s: ${duration.toFixed(3)}`);
    console.log(`size: ${video?.width}x${video?.height}`);
    console.log(`pix_fmt: ${video?.pix_fmt}`);
    console.log(`frame_rate: ${video?.avg_frame_rate}`);
    console.log(`video: ${video?.codec_name}`);
    console.log(`audio: ${audioStream?.codec_name}`);
    console.log(`out: ${args.out}`);
    const durationOk = Math.abs(duration - DURATION) < 0.05;
    const pictureOk =
      video?.codec_name === "h264" &&
      video?.width === WIDTH &&
      video?.height === HEIGHT &&
      video?.pix_fmt === "yuv420p" &&
      video?.avg_frame_rate === `${FPS}/1`;
    const audioOk = audioStream?.codec_name === "aac" && loud.tpk <= -1;
    if (!durationOk || !pictureOk || !audioOk) {
      fail("output missed 10.0 s, 1152x768, h264 + AAC, or a peak at or under -1 dB");
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

main();
