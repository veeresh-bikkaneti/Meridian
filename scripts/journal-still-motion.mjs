#!/usr/bin/env node
// node scripts/journal-still-motion.mjs --still <img> --out <mp4> [--narration <audio>]

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WIDTH = 1152;
const HEIGHT = 768;
const FPS = 24;
const FRAMES = 240;
const SEGMENT_FRAMES = 126;
const XFADE_SECONDS = 0.5;
const XFADE_OFFSET = 4.75;

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) {
    console.error(`journal-still-motion: missing ${name}`);
    process.exit(1);
  }
  return process.argv[i + 1];
}

export function stripId3(buf) {
  if (buf.length < 10 || buf.subarray(0, 3).toString("ascii") !== "ID3") {
    return { audio: buf, stripped: 0 };
  }
  const size =
    ((buf[6] & 0x7f) << 21) |
    ((buf[7] & 0x7f) << 14) |
    ((buf[8] & 0x7f) << 7) |
    (buf[9] & 0x7f);
  const total = 10 + size;
  if (total > buf.length) {
    throw new Error(`ID3 tag claims ${total} bytes, file is ${buf.length}`);
  }
  return { audio: buf.subarray(total), stripped: total };
}

function assertStrip37() {
  const payload = Buffer.alloc(27, 1);
  const header = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 27]);
  const body = Buffer.from("RIFF");
  const packed = Buffer.concat([header, payload, body]);
  if (header.length + payload.length !== 37) {
    throw new Error("self-check built a tag that is not 37 bytes");
  }
  const { audio, stripped } = stripId3(packed);
  if (stripped !== 37 || audio.toString("ascii") !== "RIFF") {
    throw new Error(`self-check expected a 37-byte strip, got ${stripped}`);
  }
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function videoFilter() {
  const scale = `scale=1440:960:force_original_aspect_ratio=increase,crop=1440:960`;
  const pan = (zoom, xExpr) =>
    `${scale},zoompan=z='${zoom}':x='${xExpr}':y='(ih-ih/zoom)/2':d=${SEGMENT_FRAMES}:s=${WIDTH}x${HEIGHT}:fps=${FPS},setsar=1`;
  const graph = [
    `[0:v]${pan("1+0.08*on/125", "(iw-iw/zoom)/2")}[a]`,
    `[0:v]${pan("1.08-0.04*on/125", "(iw-iw/zoom)*on/125")}[b]`,
    `[a][b]xfade=transition=fade:duration=${XFADE_SECONDS}:offset=${XFADE_OFFSET},eq=brightness='0.02*between(t,6,8)':saturation='1+0.06*between(t,6,8)',format=yuv420p[v]`,
  ].join(";");
  if (graph.includes("drawtext") || graph.includes("loudnorm")) {
    throw new Error("filter graph must not draw text or use loudnorm");
  }
  return graph;
}

function measure(path) {
  const result = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const integrated = text.match(/^\s*I:\s+(-?\d+(?:\.\d+)?|-?inf)\s+LUFS/m);
  const peak = text.match(/^\s*Peak:\s+(-?\d+(?:\.\d+)?|-?inf)\s+dBFS/m);
  return {
    integrated: integrated ? integrated[1] : "unparsed",
    peak: peak ? peak[1] : "unparsed",
    raw: text,
  };
}

function main() {
  assertStrip37();
  const still = arg("--still");
  const out = arg("--out");
  const narrationFlag = process.argv.indexOf("--narration");
  const narration = narrationFlag === -1 ? null : process.argv[narrationFlag + 1];
  const scratch = mkdtempSync(join(tmpdir(), "journal-still-"));
  const videoOnly = join(scratch, "video.mp4");
  const audioOnly = join(scratch, "audio.wav");

  run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-loop",
    "1",
    "-framerate",
    String(FPS),
    "-i",
    still,
    "-filter_complex",
    videoFilter(),
    "-map",
    "[v]",
    "-frames:v",
    String(FRAMES),
    "-r",
    String(FPS),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-an",
    videoOnly,
  ]);

  let bed = "no bed";
  if (!narration) {
    run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-t",
      "10",
      audioOnly,
    ]);
  } else {
    const stripped = stripId3(readFileSync(narration));
    const wav = join(scratch, "narration.bin");
    writeFileSync(wav, stripped.audio);
    console.log(`id3 stripped bytes: ${stripped.stripped}`);
    const voiced = join(scratch, "voiced.wav");
    run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      wav,
      "-filter_complex",
      "[0:a]aformat=channel_layouts=stereo:sample_rates=48000,asplit=2[dry][tmp];[tmp]equalizer=f=2000:t=q:w=1:g=2.5,volume='if(between(t,6,8),1,0)':eval=frame[wet];[dry]volume='if(between(t,6,8),0.85,1)':eval=frame[base];[base][wet]amix=inputs=2:duration=longest:normalize=0,apad=pad_dur=10,atrim=0:10[a]",
      "-map",
      "[a]",
      voiced,
    ]);
    const before = measure(voiced);
    const integrated = Number(before.integrated);
    if (!Number.isFinite(integrated) || integrated < -70) {
      run("ffmpeg", [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        voiced,
        "-af",
        "alimiter=limit=0.891:level=false",
        audioOnly,
      ]);
    } else {
      bed = "narration";
      const gain = (-18 - integrated).toFixed(3);
      run("ffmpeg", [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        voiced,
        "-af",
        `volume=${gain}dB,alimiter=limit=0.891:level=false,atrim=0:10`,
        audioOnly,
      ]);
    }
  }

  run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    videoOnly,
    "-i",
    audioOnly,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-t",
    "10",
    "-movflags",
    "+faststart",
    out,
  ]);

  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", out, "-f", "null", "-"]);
  const probe = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_name,width,height,avg_frame_rate,channels,sample_rate",
    "-of",
    "json",
    out,
  ]);
  const loud = measure(out);
  console.log(`bed: ${bed}`);
  console.log(`integrated_lufs: ${loud.integrated}`);
  console.log(`peak_dbfs: ${loud.peak}`);
  console.log(probe);
}

const isDirect = process.argv[1] && process.argv[1].endsWith("journal-still-motion.mjs");
if (isDirect) main();
