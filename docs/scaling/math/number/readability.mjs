// Flesch-Kincaid grade for the draft lines. Heuristic syllable counter, so
// treat the grade as +/- 1. Run: node docs/scaling/math/number/readability.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, "times-table-races-lines.json"), "utf8"));
const syl = (w) => {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
};
const grade = (t) => {
  const sentences = Math.max(1, (t.match(/[.!?]+(\s|$)/g) || []).length);
  const words = t.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  const w = Math.max(1, words.length);
  const s = words.reduce((n, x) => n + (/^\d/.test(x) ? 1 : syl(x)), 0);
  return 0.39 * (w / sentences) + 11.8 * (s / w) - 15.59;
};
let failed = 0;
console.log("| id | group | FK grade | limit | ok |\n|---|---|---|---|---|");
for (const l of data.lines) {
  const g = grade(l.text), lim = data.maxGrade[l.group], ok = g <= lim;
  if (!ok) failed++;
  console.log(`| ${l.id} | ${l.group} | ${g.toFixed(1)} | ${lim} | ${ok ? "yes" : "NO"} |`);
}
process.exit(failed ? 1 : 0);
