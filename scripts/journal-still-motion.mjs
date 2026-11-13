#!/usr/bin/env node
/**
 * Still plus narration into a 10 second journal clip.
 *
 * node scripts/journal-still-motion.mjs --still <img> --narration <audio> --out <mp4>
 *
 * 1152x768, 24 fps, yuv420p, h264 + AAC. Zoompan framings with a short
 * xfade. Eq and vignette only while t is between 4 and 6 seconds.
 * No drawtext. Gain is measured with ebur128 and aimed at -18 LUFS.
 * A limiter sits near -1 dB. There is no bed input, so the mix note is
 * "no bed". A 37-byte ID3 tag on a WAV is stripped before ffmpeg.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const FPS = 24;
const WIDTH = 1152;
const HEIGHT = 768;
const SEG_FRAMES = 52;
const XFADE_FRAMES = 5;
const SEG_SEC = SEG_FRAMES / FPS;
const XFADE_SEC = XFADE_FRAMES / FPS;
const LIMIT = "0.891";
const TARGET_LUFS = -18;

const FRAMINGS = [
  { z0: 1.0, z1: 1.03, px: 0, py: 0 },
  { z0: 1.03, z1: 1.07, px: 0.015, py: -0.01 },
  { z0: 1.07, z1: 1.1, px: 0, py: -0.015 },
  { z0: 1.1, z1: 1.05, px: -0.01, py: 0 },
  { z0: 1.05, z1: 1.02, px: 0, py: 0.008 },
];

function arg(flag) {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? "" : process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`journal-still-motion: missing ${flag}`);
    process.exit(2);
  }
  return value;
}

function zoomFilter(frame) {
  const span = SEG_FRAMES - 1;
  const z = `${frame.z0}+(${frame.z1}-${frame.z0})*on/${span}`;
  const x = `(iw-iw/zoom)/2+(${frame.px})*iw`;
  const y = `(ih-ih/zoom)/2+(${frame.py})*ih`;
  return [
    `scale=${WIDTH * 2}:${HEIGHT * 2}:flags=lanczos`,
    `zoompan=z='${z}':x='${x}':y='${y}':d=${SEG_FRAMES}:s=${WIDTH}x${HEIGHT}:fps=${FPS}`,
    "format=yuv420p",
  ].join(",");
}

async function stripId3(path, dest) {
  const bytes = await readFile(path);
  if (
    bytes.length > 37 &&
    bytes[0] === 0x49 &&
    bytes[1] === 0x44 &&
    bytes[2] === 0x33
  ) {
    await writeFile(dest, bytes.subarray(37));
    console.log("journal-still-motion: stripped 37-byte ID3 tag");
    return dest;
  }
  return path;
}

async function measure(path) {
  const { stderr } = await execFileAsync(
    "ffmpeg",
    ["-hide_banner", "-i", path, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  const integrated = Number.parseFloat(stderr.match(/I:\s+(-?\d+(?:\.\d+)?) LUFS/)?.[1] ?? "NaN");
  const peakText = stderr.match(/True peak:\s*\n\s*Peak:\s+(-inf|-?\d+(?:\.\d+)?) dBFS/)?.[1] ?? "NaN";
  const peak = peakText === "-inf" ? Number.NEGATIVE_INFINITY : Number.parseFloat(peakText);
  return { integrated, peak, peakText, stderr };
}

async function main() {
  const still = arg("--still");
  const narration = arg("--narration");
  const out = arg("--out");
  console.log("journal-still-motion: no bed");

  const scratch = await mkdtemp(join(tmpdir(), "journal-still-"));
  try {
    const audioIn = await stripId3(narration, join(scratch, "narration.wav"));
    const segs = [];
    for (let i = 0; i < FRAMINGS.length; i += 1) {
      const seg = join(scratch, `seg${i}.mp4`);
      await execFileAsync("ffmpeg", [
        "-hide_banner",
        "-y",
        "-loop",
        "1",
        "-i",
        still,
        "-vf",
        zoomFilter(FRAMINGS[i]),
        "-frames:v",
        String(SEG_FRAMES),
        "-r",
        String(FPS),
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        seg,
      ]);
      segs.push(seg);
    }

    const offsets = [1, 2, 3, 4].map((n) => ((SEG_SEC - XFADE_SEC) * n).toFixed(6));
    const chain = [
      `[0:v][1:v]xfade=transition=fade:duration=${XFADE_SEC.toFixed(6)}:offset=${offsets[0]}[x1]`,
      `[x1][2:v]xfade=transition=fade:duration=${XFADE_SEC.toFixed(6)}:offset=${offsets[1]}[x2]`,
      `[x2][3:v]xfade=transition=fade:duration=${XFADE_SEC.toFixed(6)}:offset=${offsets[2]}[x3]`,
      `[x3][4:v]xfade=transition=fade:duration=${XFADE_SEC.toFixed(6)}:offset=${offsets[3]}[x4]`,
      `[x4]eq=saturation=1.06:contrast=1.03:enable='between(t,4,6)',vignette=angle=PI/5:enable='between(t,4,6)',format=yuv420p[vout]`,
    ].join(";");

    const video = join(scratch, "video.mp4");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-y",
      ...segs.flatMap((seg) => ["-i", seg]),
      "-filter_complex",
      chain,
      "-map",
      "[vout]",
      "-r",
      String(FPS),
      "-frames:v",
      "240",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      video,
    ]);

    const before = await measure(audioIn);
    let gain = 0;
    if (Number.isFinite(before.integrated) && before.integrated > -70) {
      gain = TARGET_LUFS - before.integrated;
    }
    const mastered = join(scratch, "master.wav");
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-y",
      "-i",
      audioIn,
      "-af",
      [
        `volume=${gain.toFixed(2)}dB`,
        "apad",
        "atrim=0:10",
        "aresample=48000:resampler=soxr",
        `alimiter=limit=${LIMIT}:attack=7:release=100:level=0`,
      ].join(","),
      "-ar",
      "48000",
      "-ac",
      "2",
      "-t",
      "10",
      mastered,
    ]);

    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-y",
      "-i",
      video,
      "-i",
      mastered,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(FPS),
      "-frames:v",
      "240",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-t",
      "10",
      "-movflags",
      "+faststart",
      out,
    ]);

    const after = await measure(out);
    console.log(
      `journal-still-motion: gain ${gain.toFixed(2)} dB, integrated ${after.integrated} LUFS, peak ${after.peakText} dBFS, no bed`,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`journal-still-motion: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
