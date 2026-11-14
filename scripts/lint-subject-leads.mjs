#!/usr/bin/env node
/**
 * lint-subject-leads.mjs: what a child reads in a subject case or a journal
 * clip, checked against the owner's content rules.
 *
 * ONE WALK, EVERY SUBJECT. Each folder in src/subjects/ that exports
 * `itemsForGroup` (items.ts) and `answerFor` (answers.ts) is read the way
 * SubjectCase reads it, so a new subject is covered without editing this
 * file. A subject's LEAD is the text shown before the question:
 *   - `item.why` (SubjectCase's default lead card), and
 *   - the clip caption, when items.ts exports `captionRefFor(itemId)`
 *     (a journal clip shown as captions while its movie is not rendered).
 * Journal clip rows (docs/scaling/journals/<journal>/clips.json) and their
 * .vtt captions are read too: they become leads and narration.
 *
 * RULES (each failure names the fix):
 *   MEASUREMENT  a place story carries a measurement: a clip's why or
 *                narration, its captions, or a caption shown as a lead.
 *                Numbers belong in math hooks only: a subject's own `why`
 *                problem and the answer prompt (owner, b60c16ed). Shares
 *                src/game/story-ai.ts's patterns with lint:content, plus the
 *                units those miss.
 *
 * KNOWN: violations already on main are listed in
 * scripts/lint-subject-leads-baseline.json, printed as KNOWN on every run,
 * and fail as STALE once fixed, so the list only shrinks.
 *
 * Usage: npm run lint:subjects
 *        node --experimental-strip-types scripts/lint-subject-leads.mjs [--baseline <path>]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BANNED_PATTERNS, MEASUREMENT_RE } from "../src/game/story-ai.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const SUBJECTS = join(REPO, "src", "subjects");
const JOURNALS = join(REPO, "docs", "scaling", "journals");
const GROUPS = ["7-10", "10-18", "18+"];

/** Units story-ai's MEASUREMENT_RE does not cover (owner, PR #464 review). */
export const EXTRA_UNITS_RE =
  /\b\d[\d,.]*\s*-?\s*(stadia|stadion|storeys?|arches|yards?|inches|acres?|hectares?|tonnes?|tons|mph|km\/h|kph)\b/i;
const MEASURE_RULES = [...BANNED_PATTERNS, MEASUREMENT_RE, EXTRA_UNITS_RE];

/** First measurement in a text, or null. */
export function findMeasurement(text) {
  for (const re of MEASURE_RULES) {
    const m = re.exec(String(text ?? ""));
    if (m) return m[0];
  }
  return null;
}

/** Cue text of a WebVTT file: headers, NOTE blocks, timings and tags dropped. */
export function vttText(vtt) {
  const out = [];
  for (const block of String(vtt).split(/\r?\n[ \t]*\r?\n/)) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const timing = lines.findIndex((l) => l.includes("-->"));
    if (timing === -1) continue;
    for (const l of lines.slice(timing + 1)) out.push(l.replace(/<[^>]+>/g, "").trim());
  }
  return out.filter(Boolean).join(" ");
}

function captionPath(journal, file) {
  for (const p of [join(JOURNALS, journal, "captions", file), join(JOURNALS, journal, file)]) {
    if (existsSync(p)) return p;
  }
  return null;
}

/** Every lead a subject shows: { where, text, itemId, subject }. */
async function subjectLeads() {
  const leads = [];
  const subjects = [];
  for (const id of readdirSync(SUBJECTS).sort()) {
    const dir = join(SUBJECTS, id);
    if (!statSync(dir).isDirectory()) continue;
    const itemsFile = join(dir, "items.ts");
    const answersFile = join(dir, "answers.ts");
    if (!existsSync(itemsFile) || !existsSync(answersFile)) continue;
    const items = await import(pathToFileURL(itemsFile).href);
    const answers = await import(pathToFileURL(answersFile).href);
    if (typeof items.itemsForGroup !== "function" || typeof answers.answerFor !== "function") continue;
    subjects.push(id);
    for (const group of GROUPS) {
      for (const item of items.itemsForGroup(group)) {
        const answer = answers.answerFor(item.id);
        leads.push({ subject: id, itemId: item.id, kind: "why", where: `src/subjects/${id} ${item.id} why`, text: item.why, answer });
        if (typeof items.captionRefFor === "function") {
          const ref = items.captionRefFor(item.id);
          const p = ref ? captionPath(ref.journal, ref.file) : null;
          if (p) {
            leads.push({
              subject: id,
              itemId: item.id,
              kind: "caption",
              where: `src/subjects/${id} ${item.id} caption ${relative(REPO, p)}`,
              text: vttText(readFileSync(p, "utf8")),
              answer,
            });
          }
        }
      }
    }
  }
  return { leads, subjects };
}

/** Journal clip rows: their `why`, narration and caption files. */
function journalTexts() {
  const out = [];
  if (!existsSync(JOURNALS)) return out;
  for (const journal of readdirSync(JOURNALS).sort()) {
    const file = join(JOURNALS, journal, "clips.json");
    if (!existsSync(file)) continue;
    const data = JSON.parse(readFileSync(file, "utf8"));
    const clips = Array.isArray(data) ? data : Array.isArray(data.clips) ? data.clips : [];
    for (const clip of clips) {
      if (!clip || typeof clip.id !== "string") continue;
      for (const key of ["why", "narration"]) {
        if (typeof clip[key] === "string") {
          out.push({ where: `docs/scaling/journals/${journal}/clips.json ${clip.id} ${key}`, text: clip[key], clip });
        }
      }
      if (typeof clip.captions === "string") {
        const p = captionPath(journal, clip.captions);
        if (p) out.push({ where: `${relative(REPO, p)} (${clip.id} captions)`, text: vttText(readFileSync(p, "utf8")), clip });
      }
    }
  }
  return out;
}

const FIX = {
  MEASUREMENT:
    "place stories carry no measurements (owner rule): reword the clip text, or move the number into the math hook (the answer prompt in src/subjects/<id>/answers.ts)",
};

export async function runLint({ baseline = join(HERE, "lint-subject-leads-baseline.json"), log = console.log } = {}) {
  const { leads, subjects } = await subjectLeads();
  const journal = journalTexts();
  const found = [];
  // A subject's own `why` is its math hook, where numbers belong (owner,
  // b60c16ed: "measurements in math hooks only"). Place stories do not:
  // clip why, narration, captions, and a caption used as a lead.
  const stories = [...leads.filter((r) => r.kind === "caption"), ...journal];
  for (const r of stories) {
    const m = findMeasurement(r.text);
    if (m) found.push({ rule: "MEASUREMENT", where: r.where, match: m });
  }
  const key = (v) => `${v.rule} | ${v.where} | ${v.match}`;
  const known = new Set(
    existsSync(baseline) ? JSON.parse(readFileSync(baseline, "utf8")).entries.map(key) : [],
  );
  const seen = new Set(found.map(key));
  let failed = 0;
  for (const v of found) {
    if (known.has(key(v))) {
      log(`KNOWN ${key(v)}`);
    } else {
      failed++;
      log(`${v.rule} ${v.where}: ${JSON.stringify(v.match)} -> ${FIX[v.rule]}`);
    }
  }
  for (const k of known) {
    if (!seen.has(k)) {
      failed++;
      log(`STALE BASELINE ${k} -> fixed; remove it from scripts/lint-subject-leads-baseline.json`);
    }
  }
  log(`lint-subject-leads: subjects=${subjects.join(",")} leads=${leads.length} journal-texts=${journal.length}`);
  if (subjects.length === 0) {
    failed++;
    log("EMPTY SCAN: no subject exports itemsForGroup + answerFor");
  }
  log(failed ? `lint-subject-leads: GATE FAILED (${failed})` : "lint-subject-leads: GATE PASSED");
  return failed === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--baseline");
  const ok = await runLint(i !== -1 ? { baseline: process.argv[i + 1] } : {});
  process.exit(ok ? 0 : 1);
}
