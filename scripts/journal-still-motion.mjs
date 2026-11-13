#!/usr/bin/env node
/**
 * 10s still-motion for one journal clip.
 * Camera move on the still, short crossfade, narration mastered with
 * ebur128 to -18 LUFS and a limiter. No drawtext. No music bed.
 *
 * node scripts/journal-still-motion.mjs --still <img> --audio <wav> --out <mp4>
 * Omit --audio for a silent AAC track. The script prints "no bed".
 */
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? "" : (process.argv[i + 1] ?? "");
}

function fail(msg) {
  console.error(`journal-still-motion: ${msg}`);
  process.exit(1);
}

async function stripId3(src, dest) {
  const data = await fs.readFile(src);
  if (!data.subarray(0, 3).equals(Buffer.from("ID3")) || data.length < 10) {
    await fs.copyFile(src, dest);
    return;
  }
  const size = data.readUInt32BE(6);
  const synchsafe =
    ((size & 0x7f000000) >> 3) |
    ((size & 0x7f0000) >> 2) |
    ((size & 0x7f00) >> 1) |
    (size & 0x7f);
  const tagLen = 10 + synchsafe;
  await fs.writeFile(dest, data.subarray(Math.min(tagLen, data.length)));
}

async function measure(path) {
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
  const integ = Number(stderr.match(/I:\s+([-\d.]+) LUFS/)?.[1]);
  const peak = Number(stderr.match(/Peak:\s+([-\d.]+) dBFS/)?.[1]);
  if (!Number.isFinite(integ) || !Number.isFinite(peak)) {
    fail(`could not measure ${path}`);
  }
  return { integ, peak };
}

async function main() {
  const still = arg("--still");
  const audio = arg("--audio");
  const out = arg("--out");
  if (!still || !out) fail("need --still and --out");
  await fs.mkdir(join(out, ".."), { recursive: true });
  const scratch = await fs.mkdtemp(join(tmpdir(), "journal-still-"));

  const video = [
    "[0:v]scale=3456:2304,zoompan=z='min(1+0.0012*on,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=144:s=1152x768:fps=24,format=yuv420p[va]",
    "[1:v]scale=3456:2304,zoompan=z='1.15-0.0004*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=108:s=1152x768:fps=24,format=yuv420p[vb]",
    "[va][vb]xfade=transition=fade:duration=0.5:offset=5.5,fps=24,trim=duration=10,setpts=PTS-STARTPTS[v]",
  ];

  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", still, "-i", still];
  let bed = "narration";
  if (!audio) {
    bed = "no bed";
    console.log("no bed");
    args.push(
      "-f",
      "lavfi",
      "-t",
      "10",
      "-i",
      "anullsrc=r=48000:cl=stereo",
    );
    video.push("[2:a]atrim=0:10,aformat=sample_fmts=fltp:channel_layouts=stereo[a]");
  } else {
    const clean = join(scratch, "narration.wav");
    await stripId3(audio, clean);
    const before = await measure(clean);
    const gain = (-18 - before.integ).toFixed(4);
    const mastered = join(scratch, "master.wav");
    await execFileAsync("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      clean,
      "-af",
      `volume=${gain}dB,equalizer=f=3000:t=q:w=1:g=2:enable='between(t,3.5,7.5)',alimiter=limit=0.841:level=0,apad=whole_dur=10,atrim=0:10`,
      "-ar",
      "48000",
      "-ac",
      "2",
      mastered,
    ]);
    args.push("-i", mastered);
    video.push("[2:a]aformat=sample_fmts=fltp:channel_layouts=stereo[a]");
  }

  args.push(
    "-filter_complex",
    video.join(";"),
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-t",
    "10.0",
    "-r",
    "24",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    out,
  );
  await execFileAsync("ffmpeg", args);
  const after = await measure(out);
  if (after.peak > -1) fail(`${out} peak ${after.peak} dBFS is above -1 dB`);
  console.log(JSON.stringify({ out, bed, ...after }));
}

main().catch((err) => fail(err?.message ?? String(err)));
