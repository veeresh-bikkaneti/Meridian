import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getInteractiveSpec, isInteractiveItem } from "./interactions.ts";
import { getJournalFilm, JOURNAL_FILMS } from "./journal-films.ts";

function cueText(vtt: string): string {
  return vtt
    .split(/\r?\n/)
    .filter((line) => line && line !== "WEBVTT" && !line.includes("-->"))
    .join(" ");
}

test("kept monument clips show their own caption and are not quizzes", () => {
  assert.deepEqual(
    JOURNAL_FILMS.map((film) => film.id),
    ["ww2-monuments:normandy-where", "ww2-monuments:arizona-how-far"],
  );

  for (const film of JOURNAL_FILMS) {
    const slug = film.id.split(":")[1];
    const vtt = readFileSync(
      `docs/scaling/journals/ww2-monuments/${slug}.vtt`,
      "utf8",
    );
    assert.equal(film.caption, cueText(vtt), film.id);
    assert.equal(getJournalFilm(film.id)?.placeName, film.placeName);
    assert.equal(isInteractiveItem(film.id), false);
    assert.equal(getInteractiveSpec(film.id), null);
    assert.match(film.stillUrl, new RegExp(`${slug}\\.webp$`));
    assert.equal(film.posterUrl, film.stillUrl);
  }

  assert.equal(getJournalFilm("ww2-monuments:not-a-clip"), null);
});

test("the problem card shows the film instead of the coming soon stamp", () => {
  const card = readFileSync("src/play-lab/components/ProblemCard.tsx", "utf8");
  assert.match(card, /getJournalFilm\(item\.id\)/);
  assert.match(card, /data-testid="journal-film-caption"/);
  assert.match(card, /data-testid="coming-soon-stamp"/);
  const filmBranch = card.indexOf("journal-film-ready");
  const stampBranch = card.indexOf("coming-soon-stamp");
  assert.ok(filmBranch !== -1 && stampBranch !== -1 && filmBranch < stampBranch);
});
