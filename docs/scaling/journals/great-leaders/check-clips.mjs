// Stage A check for the great-leaders journal data. No dependencies.
// Run: node docs/scaling/journals/great-leaders/check-clips.mjs
// Checks: clips.json matches the contract I5 keys (plus the optional stretch), groups, ids, standard
// shape, coordinates and file paths; each captions draft exists and starts
// with WEBVTT; caption, question and retrieval text sit at or below the
// group's reading-grade limit (Flesch-Kincaid, heuristic syllables, +/- 1);
// spoken and shown text carries none of the standard §7a screen terms below
// (a tripwire for review, not a substitute for the human content screen).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const clips = JSON.parse(fs.readFileSync(path.join(here, "clips.json"), "utf8"));
const ledger = fs.readFileSync(path.join(here, "sources.md"), "utf8");
const I5_KEYS = ["id", "group", "objective", "standard", "why", "place", "file", "captions", "retrieval"];
const GROUPS = new Set(["7-10", "10-18", "18+"]);
const MAX_GRADE = { "7-10": 5, "10-18": 12, "18+": 16 }; // top grade of each group (standard §1)
const SCREEN = /\b(god|church|pray\w*|sermon\w*|bible|faith|relig\w*|vote\w*|election\w*|party|parties|politic\w*|protest\w*|march\w*|rights|race|racial|slave\w*|war|wars|battle\w*|assassin\w*|killed|shot|died|death|blood\w*|enem\w*|freedom fighters?)\b/i;
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

const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const seen = new Set();
if (!Array.isArray(clips) || clips.length === 0) errors.push("clips.json must be a non-empty array");
console.log("| id | group | text | FK grade | limit | ok |\n|---|---|---|---|---|---|");
for (const c of clips) {
  const id = c.id ?? "(no id)";
  const keys = Object.keys(c).filter((k) => k !== "stretch").sort().join(",");
  if (keys !== [...I5_KEYS].sort().join(",")) fail(id, `keys must be exactly I5: ${I5_KEYS.join(", ")}`);
  if (!/^great-leaders:[a-z0-9-]+$/.test(id)) fail(id, "id must be great-leaders:<clip>");
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
  if (c.file !== `public/videos/journals/great-leaders/${clip}.mp4`) fail(id, "file path must match the clip id");
  if (c.captions !== `${clip}.vtt`) fail(id, "captions must be <clip>.vtt");
  const vttPath = path.join(here, "captions", c.captions ?? "");
  const vtt = fs.existsSync(vttPath) ? fs.readFileSync(vttPath, "utf8") : "";
  if (!vtt.startsWith("WEBVTT")) fail(id, `captions draft missing or not WEBVTT: captions/${c.captions}`);
  if (!c.retrieval?.question || !c.retrieval?.answer) fail(id, "retrieval needs question and answer");
  if (c.group === "7-10" && /[a-z]\s*[+=]\s*\d|\bsolve\b.*=|\b(sin|cos|tan)\b/i.test(`${c.why} ${c.retrieval?.question}`))
    fail(id, "no algebra or trigonometry in 7-10");
  const cueText = vtt.split(/\r?\n/).filter((l) => l && !/^(WEBVTT|NOTE|\d+$|\d\d:)/.test(l)).join(" ");
  // Optional I5 stretch: an older group, a question and answer, and a fact id in sources.md.
  const ORDER = ["7-10", "10-18", "18+"];
  const st = c.stretch;
  if (st !== undefined) {
    if (!(ORDER.indexOf(st.group) > ORDER.indexOf(c.group))) fail(id, "stretch group must be older than the clip's group");
    if (!st.question || !st.answer) fail(id, "stretch needs question and answer");
    if (!st.fact || !new RegExp(`\\| ${st.fact} \\|`).test(ledger)) fail(id, `stretch fact ${st.fact} not found in sources.md`);
  }
  // Owner calls (2026-11-10): every clip opens with the fixed line, for every
  // group, and the narration stays at about 20 words (fail above 22).
  if (!cueText.startsWith("Hey kids, have you heard about this place?")) fail(id, "captions must open with the fixed line");
  const words = cueText.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  console.log(`| ${id} | ${c.group} | narration words | ${words} | 22 | ${words <= 22 ? "yes" : "NO"} |`);
  if (words > 22) fail(id, `narration is ${words} words; keep it to about 20`);
  const spoken = `${cueText} ${c.why} ${c.retrieval?.question} ${c.retrieval?.answer} ${st?.question ?? ""} ${st?.answer ?? ""}`;
  const hit = spoken.match(SCREEN);
  if (hit) fail(id, `§7a screen term in spoken or shown text: "${hit[0]}"`);
  for (const [label, text] of [["captions", cueText], ["why", c.why], ["retrieval", c.retrieval?.question]]) {
    const g = grade(text ?? ""), lim = MAX_GRADE[c.group], ok = g <= lim;
    if (!ok) fail(id, `${label} reads at grade ${g.toFixed(1)}, above ${lim}`);
    console.log(`| ${id} | ${c.group} | ${label} | ${g.toFixed(1)} | ${lim} | ${ok ? "yes" : "NO"} |`);
  }
  if (st?.question) {
    const g = grade(st.question), lim = MAX_GRADE[st.group] ?? 0, ok = g <= lim;
    if (!ok) fail(id, `stretch reads at grade ${g.toFixed(1)}, above ${lim}`);
    console.log(`| ${id} | ${st.group} | stretch | ${g.toFixed(1)} | ${lim} | ${ok ? "yes" : "NO"} |`);
  }
}
if (errors.length) {
  console.error(`\nFAILED (${errors.length})\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nPASSED: ${clips.length} clips`);
