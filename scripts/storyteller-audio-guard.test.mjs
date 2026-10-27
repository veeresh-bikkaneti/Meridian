/**
 * storyteller-audio-guard.test.mjs — CI guard for the storyteller clips (#199).
 *
 * Why this exists: PR #174 replaced all 14 storyteller clips with the
 * Grok-generated Santa voice, and Veeresh accepted that voice on
 * 2026-10-21. Nothing in CI checked the clips afterwards, so a future
 * accidental re-render (for example, someone running the old Kokoro
 * render scripts, which are kept for the record and marked DO NOT RUN)
 * would have shipped silently.
 *
 * What is checked, per clip family:
 *   greetings — greet-01…06.mp3 (home banner, via storyteller-assets.json)
 *   pokes     — poke-01…05.mp3  (home banner, via storyteller-assets.json)
 *   narration — reveal-01 / hook-01 / summary-01.mp3 (story cards,
 *               via src/components/storyteller-lines.ts)
 *
 * Tier 1 (always, no tools needed): the exact 14-file set is present —
 * no clip added, removed, or renamed — and every clip's first MP3 frame
 * header parses as 24 kHz, mono, Layer III. The header is parsed in
 * plain Node, so this tier runs in every CI environment.
 *
 * Tier 2 (when ffmpeg is on PATH): integrated loudness of every clip,
 * measured with ffmpeg's ebur128 filter, must sit in the accepted
 * envelope. Measured on the shipped clips with ffmpeg 8.1.2 on
 * 2026-10-26: −16.5…−17.4 LUFS. The guard allows ±0.5 dB of
 * measurement slack: −17.9…−16.0 LUFS. When ffmpeg is absent this
 * tier is an explicit skip (see the test name), never a silent pass —
 * Tier 1 still guards every clip.
 *
 * Honest limit: a file probe cannot prove WHICH voice is speaking —
 * "one voice family" is a human judgement. Format + loudness are the
 * measurable fingerprint of the accepted renders: a re-render from
 * the Kokoro scripts (which master to a different loudness target,
 * −16 LUFS) or from any other toolchain drifts at least one of these
 * numbers, and this test fails.
 *
 * Run: node --test scripts/storyteller-audio-guard.test.mjs
 */
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = path.join(REPO_ROOT, "public/audio/storyteller");
const LINES_TS = path.join(REPO_ROOT, "src/components/storyteller-lines.ts");

export const FAMILIES = {
  greetings: ["greet-01", "greet-02", "greet-03", "greet-04", "greet-05", "greet-06"],
  pokes: ["poke-01", "poke-02", "poke-03", "poke-04", "poke-05"],
  narration: ["reveal-01", "hook-01", "summary-01"],
};
const ALL_CLIPS = Object.values(FAMILIES).flat();

/** Accepted loudness envelope (LUFS integrated) — see the header note. */
export const LUFS_MIN = -17.9;
export const LUFS_MAX = -16.0;

const SAMPLE_RATES = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

/**
 * Parse the first MP3 frame header in a buffer. Returns
 * { sampleRate, channelMode, layerBits } or null when no valid frame
 * is found. channelMode 3 is mono (the MP3 channel-mode field, not a
 * channel count). Skips an ID3v2 tag when present.
 */
export function parseFirstFrameHeader(buf) {
  let off = 0;
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "ID3") {
    const size =
      ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    off = 10 + size;
  }
  for (let i = off; i + 4 <= buf.length; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;
    const b1 = buf[i + 1];
    const b2 = buf[i + 2];
    const b3 = buf[i + 3];
    const versionBits = (b1 >> 3) & 0x3;
    const layerBits = (b1 >> 1) & 0x3;
    if (versionBits === 1 || layerBits === 0) continue; // reserved values
    const srIndex = (b2 >> 2) & 0x3;
    if (srIndex === 3) continue;
    return {
      sampleRate: SAMPLE_RATES[versionBits][srIndex],
      channelMode: (b3 >> 6) & 0x3,
      layerBits,
    };
  }
  return null;
}

function clipPath(name) {
  return path.join(AUDIO_DIR, `${name}.mp3`);
}

test("storyteller clips: the shipped set is exactly the 14 accepted clips", () => {
  const onDisk = readdirSync(AUDIO_DIR)
    .filter((f) => f.endsWith(".mp3"))
    .map((f) => f.replace(/\.mp3$/, ""))
    .sort();
  assert.deepEqual(onDisk, [...ALL_CLIPS].sort());
});

for (const [family, clips] of Object.entries(FAMILIES)) {
  test(`storyteller clips (${family}): every clip is 24 kHz mono MP3`, () => {
    for (const name of clips) {
      const buf = readFileSync(clipPath(name));
      assert.ok(buf.length > 1000, `${name}.mp3 is suspiciously small (${buf.length} bytes)`);
      const header = parseFirstFrameHeader(buf);
      assert.ok(header, `${name}.mp3: no valid MP3 frame header found`);
      assert.equal(header.sampleRate, 24000, `${name}.mp3 sample rate drifted`);
      assert.equal(header.channelMode, 3, `${name}.mp3 is not mono (channel mode ${header.channelMode})`);
      assert.equal(header.layerBits, 1, `${name}.mp3 is not Layer III`);
    }
  });
}

// ------------------------------------------------------------- Tier 2: loudness

const ffmpegProbe = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
const ffmpegAvailable = ffmpegProbe.status === 0;

/** Integrated loudness (LUFS) of one clip via ffmpeg's ebur128 summary. */
function integratedLufs(file) {
  const res = spawnSync(
    "ffmpeg",
    ["-nostdin", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  const out = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
  const matches = [...out.matchAll(/I:\s*(-?[\d.]+)\s*LUFS/g)];
  assert.ok(matches.length > 0, `ffmpeg printed no integrated loudness for ${file}`);
  return Number(matches[matches.length - 1][1]);
}

test(
  "storyteller clips: loudness stays in the accepted envelope (−17.9…−16.0 LUFS)",
  {
    skip: ffmpegAvailable
      ? false
      : "ffmpeg is not on PATH in this environment, so the loudness tier cannot run here. " +
        "This is an explicit skip, not a pass — the format tier above still guards every clip.",
  },
  () => {
    for (const name of ALL_CLIPS) {
      const lufs = integratedLufs(clipPath(name));
      assert.ok(
        lufs >= LUFS_MIN && lufs <= LUFS_MAX,
        `${name}.mp3 integrated loudness ${lufs} LUFS is outside the accepted ` +
          `${LUFS_MIN}…${LUFS_MAX} LUFS envelope (shipped clips measure −16.5…−17.4). ` +
          `This usually means the clip was re-rendered — see src/components/storyteller-lines.ts.`,
      );
    }
  },
);

// ------------------------------------------------------- Header truth (#199 part 2)

test("storyteller-lines.ts header names the accepted Santa voice, not the superseded one", () => {
  const text = readFileSync(LINES_TS, "utf8");
  assert.match(text, /Grok-generated Santa voice/);
  assert.match(text, /DO NOT regenerate/);
  assert.doesNotMatch(text, /Voice: `am_fenrir`/);
});
