// Turns one still into a 10.0 s, 1152x768, 24 fps h264 + AAC clip.
// zoompan, a short xfade, and a gentle eq on the key moment when a
// narration file is passed. Loudness uses ebur128 to -18 LUFS, not
// loudnorm, then a limiter near -1 dB. No drawtext. No bed.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const KEEP = [
  "akashi-span",
  "pont-du-gard",
  "eratosthenes-earth",
  "andean-roads",
  "aconcagua-height",
];
const LIMIT = 0.8912509381337456; // -1 dB

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `ffmpeg exited ${result.status}`);
  }
}

function stripId3(src, dest) {
  const buf = readFileSync(src);
  if (buf.length >= 10 && buf.subarray(0, 3).toString("ascii") === "ID3") {
    const size =
      ((buf[6] & 0x7f) << 21) |
      ((buf[7] & 0x7f) << 14) |
      ((buf[8] & 0x7f) << 7) |
      (buf[9] & 0x7f);
    if (10 + size === 37) {
      writeFileSync(dest, buf.subarray(37));
      console.log(`stripped 37-byte ID3 from ${src}`);
      return dest;
    }
  }
  return src;
}

function measure(path) {
  const result = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", path, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const stderr = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const integ = Number(stderr.match(/I:\s+(-?\d+(?:\.\d+)?) LUFS/)?.[1]);
  const peakText = stderr.match(/Peak:\s+(-?\d+(?:\.\d+)?|-inf) dBFS/)?.[1] ?? "missing";
  const peak = peakText === "-inf" ? Number.NEGATIVE_INFINITY : Number(peakText);
  return { integ, peak, peakText, stderr };
}

function renderOne(clip, still, narration, out) {
  mkdirSync(dirname(out), { recursive: true });
  const frames = join(dirname(out), "frames", clip);
  mkdirSync(frames, { recursive: true });
  const videoFilter = [
    "[0:v]scale=1600:1066:force_original_aspect_ratio=increase,crop=1600:1066,split[a][b]",
    "[a]zoompan=z='1+on*0.0006':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=126:s=1152x768:fps=24,fps=24[va]",
    "[b]zoompan=z='1.075-on*0.0006':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=126:s=1152x768:fps=24,fps=24[vb]",
    "[va][vb]xfade=transition=fade:duration=0.5:offset=4.75,format=yuv420p,fps=24,trim=duration=10,setpts=PTS-STARTPTS[v]",
  ].join(";");

  let audioArgs;
  let bed = "no bed";
  if (narration) {
    const clean = stripId3(narration, join(dirname(out), `${clip}-narration.wav`));
    const before = measure(clean);
    if (!Number.isFinite(before.integ)) {
      throw new Error(`could not measure ${clean}`);
    }
    const gain = (-18 - before.integ).toFixed(3);
    const mastered = join(dirname(out), `${clip}-master.wav`);
    ffmpeg([
      "-i",
      clean,
      "-af",
      `volume=${gain}dB,equalizer=f=250:t=q:w=1:g=1.5:enable='between(t\\,4\\,6)',alimiter=limit=${LIMIT}:level=false,apad=whole_dur=10,atrim=duration=10`,
      "-ar",
      "48000",
      "-ac",
      "2",
      mastered,
    ]);
    audioArgs = ["-i", mastered];
    bed = "narration";
    console.log(`${clip} ebur128 before ${before.integ} LUFS gain ${gain} dB`);
  } else {
    audioArgs = ["-f", "lavfi", "-t", "10", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"];
    console.log(`${clip} no bed`);
  }

  ffmpeg([
    "-loop",
    "1",
    "-i",
    still,
    ...audioArgs,
    "-filter_complex",
    videoFilter,
    "-map",
    "[v]",
    "-map",
    "1:a",
    "-t",
    "10",
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
  ]);

  const probe = execFileSync(
    "ffprobe",
    ["-hide_banner", "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate,channels", "-of", "json", out],
    { encoding: "utf8" },
  );
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", out, "-f", "null", "-"], { stdio: "inherit" });
  for (const t of ["2", "6", "9.5"]) {
    ffmpeg(["-ss", t, "-i", out, "-frames:v", "1", join(frames, `t${t}.png`)]);
  }
  const loud = measure(out);
  if (Number.isFinite(loud.peak) && loud.peak > -1) {
    throw new Error(`${clip} peak ${loud.peakText} dBFS is above -1 dB`);
  }
  const report = {
    clip,
    out,
    bed,
    probe: JSON.parse(probe),
    integ: loud.integ,
    peakDbfs: loud.peakText,
  };
  writeFileSync(join(dirname(out), `${clip}.probe.json`), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      clip,
      bed,
      integ: loud.integ,
      peakDbfs: loud.peakText,
      duration: report.probe.format?.duration,
    }),
  );
  return report;
}

const clip = arg("--clip");
const still = arg("--still");
const narration = arg("--narration");
const out = arg("--out");
if (process.argv.includes("--all")) {
  const outDir = join(root, "docs", "scaling", "journals", "people-places", "render-out");
  for (const name of KEEP) {
    renderOne(
      name,
      join(root, "public", "images", "journals", "people-places", `${name}.webp`),
      null,
      join(outDir, `${name}.mp4`),
    );
  }
} else if (clip && still && out) {
  renderOne(clip, still, narration, out);
} else {
  console.error("Usage: node scripts/journal-still-motion.mjs --all");
  console.error("   or: node scripts/journal-still-motion.mjs --clip <id> --still <webp> --out <mp4> [--narration <wav>]");
  process.exit(1);
}
