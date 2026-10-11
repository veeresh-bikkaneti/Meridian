#!/usr/bin/env node --experimental-strip-types
/**
 * BLACK-BOX verification for the storyteller voice restoration
 * (branch feat/storyteller-voice-direction).
 *
 * Asserts on the BUILT app (dist/client, base /Meridian/):
 *   1. Home banner greeting flow runs: figure + caption bubble visible.
 *   2. The caption is today's rotation greeting, and the audio element that
 *      plays is the matching greet-0N.mp3 (restored TruthTeller file).
 *   3. The audio element ACTUALLY PRODUCES SOUND: decoded PCM is routed
 *      through an in-page Web Audio analyser and the frequency data is
 *      non-silent while currentTime advances and the element is unpaused.
 *   4. No console errors / page errors (same filters as the repo specs).
 *
 * Evidence: Playwright records the session video, and an in-page
 * MediaRecorder captures the real audio the page played. The two are muxed
 * into evidence/voice-restoration-session.mp4 — visuals + audible voice.
 *
 * Run: node tests/e2e/voice-restoration-verify.mjs   (exit 0 = PASS)
 */
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { mkdirSync, existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { GREETINGS, greetingIndexForDate } from "../../src/components/storyteller-home-copy.ts";

const ROOT = "/home/hatch/workspace/meridian-voice-direction";
const DIST = path.join(ROOT, "dist/client");
const BASE = "/Meridian/";
const APP = "http://127.0.0.1:4123/Meridian/";
const EVIDENCE = path.join(ROOT, "tests/e2e/evidence");
const OUTFILE = path.join(EVIDENCE, "voice-restoration-session.mp4");

const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
  "base64",
);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json",
};

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({
  executablePath: "/opt/meta-chromium/chrome",
  args: ["--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: EVIDENCE, size: { width: 1440, height: 900 } },
});

// Disable SW; seed tutorial-seen + today's tour date (skip invite, skip tour-return);
// install the audio probe (same contract as tests/e2e/helpers.ts installAudioProbe).
await context.addInitScript(() => {
  try {
    const c = navigator.serviceWorker;
    c.register = () => Promise.reject(new Error("service worker disabled for test"));
  } catch { /* ignore */ }
  try {
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    localStorage.setItem("meridian.tutorialSeen", "1");
    localStorage.setItem("meridian.grandpaTour.lastDate", key);
  } catch { /* ignore */ }
  const w = window;
  const seen = [];
  w.__audioProbe = seen;
  const NativeAudio = window.Audio;
  function ProbedAudio(src) {
    const el = new NativeAudio(src);
    el.__probeSrc = src ?? "";
    seen.push(el);
    return el;
  }
  ProbedAudio.prototype = NativeAudio.prototype;
  w.Audio = ProbedAudio;
});

await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === "server.arcgisonline.com")
    return route.fulfill({ status: 200, body: TILE_STUB, contentType: "image/png" });
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return route.continue();
  let p = decodeURIComponent(url.pathname);
  if (p === "/Meridian" || p === "/Meridian/") p = "/_shell.html";
  else if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.endsWith("/")) p += "_shell.html";
  const file = path.normalize(path.join(DIST, p));
  if (!file.startsWith(DIST + path.sep) && file !== DIST)
    return route.fulfill({ status: 403, body: "forbidden" });
  try {
    const body = await readFile(file);
    return route.fulfill({ status: 200, body, contentType: MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
  } catch {
    return route.fulfill({ status: 404, body: "not found" });
  }
});

const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });

await page.goto(APP);
await page.getByTestId("storyteller-home").waitFor({ timeout: 20_000 });
check("home banner mounts", true);

// Caption: bubble visible with today's rotation greeting.
const idx = greetingIndexForDate(new Date());
const expectedCaption = GREETINGS[idx];
const bubble = page.getByTestId("storyteller-home-bubble");
await bubble.waitFor({ timeout: 10_000 });
const bubbleText = (await bubble.textContent()) ?? "";
check(
  "caption bubble shows today's greeting",
  bubbleText.includes(expectedCaption),
  `greet-0${idx + 1}; caption "${expectedCaption.slice(0, 40)}…"`
);

// Audio element: the greeting must play the matching restored file.
// Text-first: the greeting waits for the first gesture, so tap the heading.
await page.getByTestId("home-heading").click({ timeout: 10_000 });
const probe = await page.waitForFunction(
  () => {
    const seen = window.__audioProbe ?? [];
    return seen.find((el) => (el.__probeSrc ?? "").includes("audio/storyteller/greet-0")) ?? null;
  },
  null, { timeout: 15_000 }
);
const src = await probe.evaluate((el) => el.__probeSrc);
const expectedFile = `greet-0${idx + 1}.mp3`;
check(
  "greeting audio element plays the matching restored file",
  src.endsWith(`/audio/storyteller/${expectedFile}`),
  src
);

// SOUND ACTUALLY FLOWS: route the element through Web Audio, record it, and
// assert the analyser sees non-silent PCM while the element plays.
const audioEvidence = await page.evaluate(async () => {
  const seen = window.__audioProbe ?? [];
  const el = seen.find((e) => (e.__probeSrc ?? "").includes("audio/storyteller/greet-0"));
  const AC = window.AudioContext ?? window.webkitAudioContext;
  const ctx = new AC();
  const source = ctx.createMediaElementSource(el);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  const dest = ctx.createMediaStreamDestination();
  source.connect(analyser);
  analyser.connect(ctx.destination);
  source.connect(dest);
  const rec = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => { rec.onstop = res; });
  rec.start(250);
  const data = new Uint8Array(analyser.frequencyBinCount);
  let peak = 0;
  const t0 = el.currentTime;
  for (let i = 0; i < 16; i++) {          // ~4 s of sampling
    await new Promise((r) => setTimeout(r, 250));
    analyser.getByteFrequencyData(data);
    for (const v of data) if (v > peak) peak = v;
    if (el.ended || el.paused && el.currentTime === 0) break;
  }
  const t1 = el.currentTime;
  rec.stop();
  await done;
  const blob = new Blob(chunks, { type: "audio/webm" });
  const buf = new Uint8Array(await blob.arrayBuffer());
  // base64 without Node's Buffer (not available in the page context)
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
  }
  return {
    paused: el.paused, ended: el.ended, readyState: el.readyState,
    t0: +t0.toFixed(2), t1: +t1.toFixed(2), peakBin: peak,
    bytes: buf.length, b64: btoa(bin),
  };
});
const played = !audioEvidence.paused || (audioEvidence.ended && audioEvidence.t1 > audioEvidence.t0);
check("audio element played (not paused/ended)", played, `paused=${audioEvidence.paused} ended=${audioEvidence.ended} readyState=${audioEvidence.readyState}`);
check(
  "currentTime advances while playing",
  audioEvidence.t1 > audioEvidence.t0,
  `${audioEvidence.t0}s → ${audioEvidence.t1}s`
);
check(
  "decoded PCM is non-silent (sound actually produced)",
  audioEvidence.peakBin > 0,
  `analyser peak bin = ${audioEvidence.peakBin}/255`
);
check("in-page audio captured for evidence", audioEvidence.bytes > 10_000, `${(audioEvidence.bytes / 1024).toFixed(0)} KB webm`);

// Console: same filters as the repo specs.
const relevant = errors.filter(
  (e) => !e.includes("Minified React error #418") && !e.includes("ERR_TUNNEL_CONNECTION_FAILED")
);
check("no console/page errors", relevant.length === 0, relevant.length ? JSON.stringify(relevant).slice(0, 300) : "clean");

// Let the caption bubble linger a beat so the video shows the finished state.
await page.waitForTimeout(1500);

const videoPath = await page.video().path();
await context.close();
await browser.close();

// Evidence: write captured audio, mux with the session video.
mkdirSync(EVIDENCE, { recursive: true });
const audioWebm = path.join(EVIDENCE, "voice-restoration-session-audio.webm");
const { writeFileSync } = await import("node:fs");
writeFileSync(audioWebm, Buffer.from(audioEvidence.b64, "base64"));
execFileSync("ffmpeg", [
  "-y", "-v", "error",
  "-i", videoPath, "-i", audioWebm,
  "-map", "0:v:0", "-map", "1:a:0",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
  "-c:a", "aac", "-b:a", "128k",
  "-shortest", OUTFILE,
], { stdio: "inherit" });
check("evidence video muxed (visuals + audible voice)", existsSync(OUTFILE), OUTFILE);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
