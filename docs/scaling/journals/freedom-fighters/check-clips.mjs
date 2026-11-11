// Stage A check for the freedom-fighters journal data. No dependencies.
// Run: node docs/scaling/journals/freedom-fighters/check-clips.mjs
// Checks: clips.json matches the contract I5 keys, groups, ids, standard
// shape, coordinates and file paths; each captions draft exists and starts
// with WEBVTT; caption, question and retrieval text sit at or below the
// group's reading-grade limit (Flesch-Kincaid, heuristic syllables, +/- 1).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const clips = JSON.parse(fs.readFileSync(path.join(here, "clips.json"), "utf8"));
const I5_KEYS = ["id", "group", "objective", "standard", "why", "place", "file", "captions", "retrieval"];
const STRETCH_KEYS = ["answer", "fact", "group", "question"]; // optional I5 field (contracts.md, owner 2026-11-10)
const ORDER = { "7-10": 0, "10-18": 1, "18+": 2 };
const GROUPS = new Set(["7-10", "10-18", "18+"]);
const MAX_GRADE = { "7-10": 5, "10-18": 12, "18+": 16 }; // top grade of each group (standard §1)
const VERBS = /can (identify|locate|sort|predict|explain|compare|compute|estimate|solve)\b/;

const syl = (w) => {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
};
const grade = (t) => {
  const sentences = Math.max(1, (t.match(/[.!?:]+(\s|$)/g) || []).length);
  const words = t.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  const n = Math.max(1, words.length);
  const s = words.reduce((k, x) => k + (/^\d/.test(x) ? 1 : syl(x)), 0);
  return 0.39 * (n / sentences) + 11.8 * (s / n) - 15.59;
};

const sources = fs.readFileSync(path.join(here, "sources.md"), "utf8");
const OPENER = "Hey kids, have you heard about this place?";
const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const seen = new Set();
if (!Array.isArray(clips) || clips.length === 0) errors.push("clips.json must be a non-empty array");
console.log("| id | group | text | FK grade | limit | ok |\n|---|---|---|---|---|---|");
for (const c of clips) {
  const id = c.id ?? "(no id)";
  const keys = Object.keys(c).filter((k) => k !== "stretch").sort().join(",");
  if (keys !== [...I5_KEYS].sort().join(",")) fail(id, `keys must be exactly I5: ${I5_KEYS.join(", ")}`);
  if (!/^freedom-fighters:[a-z0-9-]+$/.test(id)) fail(id, "id must be freedom-fighters:<clip>");
  if (seen.has(id)) fail(id, "duplicate id");
  seen.add(id);
  if (!GROUPS.has(c.group)) fail(id, "group must be 7-10, 10-18 or 18+");
  if (!VERBS.test(c.objective ?? "") || !/shown by/.test(c.objective ?? "")) fail(id, "objective needs an observable verb and 'shown by'");
  const std = c.standard;
  if (!(std === "UNVERIFIED" || (std && /^D2\.(His|Geo|Civ|Eco)\.\d+\.\d+-\d+$/.test(std.code) && /^https:\/\//.test(std.source))))
    fail(id, "standard must be UNVERIFIED or a C3 code with an https source");
  const p = c.place ?? {};
  if (!(Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 && p.name)) fail(id, "place needs lat, lon and name");
  const clip = id.split(":")[1];
  if (c.file !== `public/videos/journals/freedom-fighters/${clip}.mp4`) fail(id, "file path must match the clip id");
  if (c.captions !== `${clip}.vtt`) fail(id, "captions must be <clip>.vtt");
  const vttPath = path.join(here, "captions", c.captions ?? "");
  const vtt = fs.existsSync(vttPath) ? fs.readFileSync(vttPath, "utf8") : "";
  if (!vtt.startsWith("WEBVTT")) fail(id, `captions draft missing or not WEBVTT: captions/${c.captions}`);
  if (!c.retrieval?.question || !c.retrieval?.answer) fail(id, "retrieval needs question and answer");
  if (c.group === "7-10" && /[a-z]\s*[+=]\s*\d|\bsolve\b.*=|\b(sin|cos|tan)\b/i.test(`${c.why} ${c.retrieval?.question}`))
    fail(id, "no algebra or trigonometry in 7-10");
  if (c.stretch !== undefined) {
    const st = c.stretch;
    if (Object.keys(st).sort().join(",") !== STRETCH_KEYS.join(",")) fail(id, `stretch keys must be exactly ${STRETCH_KEYS.join(", ")}`);
    if (!GROUPS.has(st.group)) fail(id, "stretch group must be 7-10, 10-18 or 18+");
    if (!/^F\d+-\d+$/.test(st.fact ?? "") || !sources.includes(`| ${st.fact} |`)) fail(id, `stretch fact ${st.fact} not found in sources.md`);
    if (!st.question || !st.answer) fail(id, "stretch needs question and answer");
    if (!(ORDER[st.group] > ORDER[c.group])) fail(id, "stretch group must be older than the clip's group (contracts I5)");
    if (/^F\d+-U\d+$/.test(st.fact ?? "")) fail(id, "stretch fact must not be an UNVERIFIED id");
    if (id === "freedom-fighters:robben-island") {
      const area = Math.PI * (3.3 / 2) * (1.9 / 2);
      if (st.fact !== "F1-8" || !st.answer.startsWith(`About ${area.toFixed(1)} square km`)) fail(id, "Robben Island stretch: fact F1-8, ellipse area pi x 1.65 x 0.95 = 4.9");
    }
    const g = grade(st.question ?? ""), lim = MAX_GRADE[st.group] ?? 16, ok = g <= lim;
    if (!ok) fail(id, `stretch reads at grade ${g.toFixed(1)}, above ${lim}`);
    console.log(`| ${id} | ${st.group} | stretch | ${g.toFixed(1)} | ${lim} | ${ok ? "yes" : "NO"} |`);
  }
  const cueText = vtt.split(/\r?\n/).filter((l) => l && !/^(WEBVTT|NOTE|\d+$|\d\d:)/.test(l)).join(" ");
  const spoken = cueText.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  if (!cueText.startsWith(OPENER)) fail(id, "captions must start with the fixed opener");
  if (/\b(prison(er)?s?|jail|weapon|sword|gun|battle|war|fight(er|ing)?|kill(ed)?|die[ds]?|death|siege|apartheid|racis[mt])\b/i.test(cueText)) fail(id, "narration uses a screened word (standard 7a; remembrance tone)");
  if (spoken > 18) fail(id, `narration is ${spoken} spoken words, limit 18 (owner call)`);
  for (const [label, text] of [["captions", cueText], ["why", c.why], ["retrieval", c.retrieval?.question]]) {
    const g = grade(text ?? ""), lim = MAX_GRADE[c.group], ok = g <= lim;
    if (!ok) fail(id, `${label} reads at grade ${g.toFixed(1)}, above ${lim}`);
    console.log(`| ${id} | ${c.group} | ${label} | ${g.toFixed(1)} | ${lim} | ${ok ? "yes" : "NO"} |`);
  }
}
if (errors.length) {
  console.error(`\nFAILED (${errors.length})\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nPASSED: ${clips.length} clips`);
