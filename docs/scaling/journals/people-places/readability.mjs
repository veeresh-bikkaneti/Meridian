// Flesch-Kincaid grade for child-facing lines in clips.json.
// Heuristic syllable counter: treat the grade as plus or minus 1.
// Run: node docs/scaling/journals/people-places/readability.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const syl = (w) => {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
};

export const grade = (t) => {
  const sentences = Math.max(1, (t.match(/[.!?]+(\s|$)/g) || []).length);
  const words = t.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  const w = Math.max(1, words.length);
  const s = words.reduce((n, x) => n + (/^\d/.test(x) ? 1 : syl(x)), 0);
  return 0.39 * (w / sentences) + 11.8 * (s / w) - 15.59;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const data = JSON.parse(fs.readFileSync(path.join(here, "clips.json"), "utf8"));
  const fields = (clip) => [
    ["narration", clip.narration],
    ["predict", clip.predict.prompt],
    ["explain", clip.explain],
    ["hint", clip.hint],
    ["retrieval", clip.retrieval.question],
    ["elsewhere", clip.elsewhere.prompt],
  ];
  let failed = 0;
  console.log("| id | field | group | FK | limit | ok |\n|---|---|---|---|---|---|");
  for (const clip of data.clips) {
    const lim = data.maxGrade[clip.group];
    for (const [field, text] of fields(clip)) {
      const g = grade(text);
      const ok = g <= lim;
      if (!ok) failed++;
      console.log(
        `| ${clip.clip} | ${field} | ${clip.group} | ${g.toFixed(1)} | ${lim} | ${ok ? "yes" : "NO"} |`,
      );
    }
  }
  if (failed) {
    console.error(`${failed} line(s) over the band limit`);
    process.exit(1);
  }
}
