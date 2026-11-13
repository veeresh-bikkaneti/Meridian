#!/usr/bin/env node
// Still to a 10s journal clip. No drawtext. No bed. No loudnorm.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const WIDTH = 1152;
const HEIGHT = 768;
const FPS = 24;
const FRAMES = 58;
const FADE = 5 * (FRAMES / FPS) - 10;
const FADE_EACH = FADE / 4;
const TARGET_LUFS = -18;
const LIMIT = 10 ** (-1 / 20);

function arg(flag) {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? "" : process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`journal-still-motion: missing ${flag}`);
    process.exit(2);
  }
  return value;
}

function run(args) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-y", ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function measure(path) {
  const result = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", path, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const integrated = Number(text.match(/I:\s+([-\d.]+) LUFS/)?.[1]);
  const peak = Number(text.match(/True peak:[\s\S]*?Peak:\s+([-\d.]+) dBFS/)?.[1]);
  if (!Number.isFinite(integrated) || !Number.isFinite(peak)) {
    console.error(text);
    console.error("journal-still-motion: ebur128 did not report integrated loudness and true peak");
    process.exit(1);
  }
  return { integrated, peak, text };
}

const still = arg("--still");
const narration = arg("--narration");
const out = arg("--out");
const work = mkdtempSync(join(dirname(out), ".motion-"));

try {
  const raw = readFileSync(narration);
  const stripped = raw.subarray(0, 3).toString("ascii") === "ID3" ? raw.subarray(37) : raw;
  const clean = join(work, "narration.wav");
  writeFileSync(clean, stripped);

  const speech = join(work, "speech.wav");
  run([
    "-i",
    clean,
    "-af",
    "silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB:stop_periods=-1:stop_duration=0.12:stop_threshold=-45dB",
    speech,
  ]);
  const before = measure(speech);
  let gainDb = TARGET_LUFS - before.integrated;
  const gained = join(work, "gained.wav");
  let after = { integrated: NaN, peak: NaN };
  for (let pass = 0; pass < 3; pass += 1) {
    run([
      "-i",
      clean,
      "-af",
      `volume=${gainDb.toFixed(4)}dB,alimiter=limit=${LIMIT.toFixed(6)}:level=false:latency=true`,
      gained,
    ]);
    after = measure(gained);
    if (after.peak <= -1) break;
    gainDb -= after.peak + 1 + 0.4;
  }
  if (after.peak > -1) {
    console.error(`journal-still-motion: true peak ${after.peak} dBFS is above -1 dB`);
    process.exit(1);
  }

  const padded = join(work, "padded.wav");
  run(["-i", gained, "-af", "apad=whole_dur=10,atrim=0:10", "-ar", "48000", "-ac", "2", padded]);

  const zooms = [
    "1.01+0.012*on/57",
    "1.03+0.018*on/57",
    "1.06+0.03*on/57",
    "1.09-0.015*on/57",
    "1.07+0.004*on/57",
  ];
  const segments = zooms.map((zoom, index) => {
    const path = join(work, `seg-${index}.mp4`);
    const key = index === 2 ? ",eq=brightness=0.02:saturation=1.05,vignette=PI/5" : "";
    run([
      "-loop",
      "1",
      "-i",
      still,
      "-vf",
      `scale=${WIDTH * 2}:${HEIGHT * 2}:flags=lanczos,zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${FRAMES}:s=${WIDTH}x${HEIGHT}:fps=${FPS},format=yuv420p${key}`,
      "-frames:v",
      String(FRAMES),
      "-r",
      String(FPS),
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      path,
    ]);
    return path;
  });

  const duration = FRAMES / FPS;
  let cursor = duration - FADE_EACH;
  const filters = [];
  let label = "[0:v]";
  for (let index = 1; index < segments.length; index += 1) {
    const next = index === segments.length - 1 ? "[vout]" : `[v${index}]`;
    filters.push(
      `${label}[${index}:v]xfade=transition=fade:duration=${FADE_EACH.toFixed(6)}:offset=${cursor.toFixed(6)}${next}`,
    );
    label = next;
    cursor += duration - FADE_EACH;
  }

  run([
    ...segments.flatMap((path) => ["-i", path]),
    "-i",
    padded,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[vout]",
    "-map",
    `${segments.length}:a`,
    "-t",
    "10",
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
    "128k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    out,
  ]);

  let encoded = measure(out);
  let makeupDb = 0;
  for (let pass = 0; pass < 3 && encoded.integrated < TARGET_LUFS - 0.4; pass += 1) {
    const room = -1 - encoded.peak - 0.3;
    const want = TARGET_LUFS - encoded.integrated;
    const step = Math.min(want, room);
    if (step < 0.05) break;
    makeupDb += step;
    const louder = join(work, `louder-${pass}.mp4`);
    run([
      "-i",
      out,
      "-af",
      `volume=${step.toFixed(4)}dB,alimiter=limit=${LIMIT.toFixed(6)}:level=false:latency=true`,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-t",
      "10",
      "-movflags",
      "+faststart",
      louder,
    ]);
    copyFileSync(louder, out);
    encoded = measure(out);
  }
  if (encoded.peak > -1) {
    console.error(`journal-still-motion: encoded true peak ${encoded.peak} dBFS is above -1 dB`);
    process.exit(1);
  }

  console.log("no bed");
  console.log(
    JSON.stringify({
      speechLufsBefore: before.integrated,
      gainDb: Number(gainDb.toFixed(3)),
      speechLufsAfter: after.integrated,
      wavTruePeakDbfs: after.peak,
      makeupDb: Number(makeupDb.toFixed(3)),
      encodedLufs: encoded.integrated,
      truePeakDbfs: encoded.peak,
      bed: "no bed",
      out,
    }),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
