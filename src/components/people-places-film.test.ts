import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PEOPLE_PLACES_FILMS,
  filmsForBand,
  peoplePlacesMedia,
  peoplePlacesNarrationUrl,
} from "./people-places-films.ts";

const clips = JSON.parse(readFileSync("docs/scaling/journals/people-places/clips.json", "utf8"));
const shelf = readFileSync("src/components/people-places-shelf.tsx", "utf8");

test("the shelf is the five kept clips in clips.json order", () => {
  assert.deepEqual(
    PEOPLE_PLACES_FILMS.map((film) => film.clip),
    clips.clips.map((clip: { clip: string }) => clip.clip),
  );
  assert.equal(PEOPLE_PLACES_FILMS.length, 5);
});

test("captions match the narration and the caption file character for character", () => {
  for (const film of PEOPLE_PLACES_FILMS) {
    const row = clips.clips.find((clip: { clip: string }) => clip.clip === film.clip);
    const txt = readFileSync(`docs/scaling/journals/people-places/captions/${film.clip}.txt`, "utf8").trim();
    assert.equal(film.caption, row.narration);
    assert.equal(film.caption, txt);
    assert.equal(film.placeName, row.place.name);
    assert.equal(film.id, row.id);
    assert.equal(film.group, row.group);
    assert.equal(peoplePlacesNarrationUrl(film.clip), null);
    const media = peoplePlacesMedia(film.clip);
    assert.ok(media.stillUrl.endsWith(`${film.clip}.webp`));
    assert.equal(media.posterUrl, media.stillUrl);
    assert.ok(media.videoUrl.endsWith(`${film.clip}.mp4`));
    assert.notEqual(media.videoUrl, media.stillUrl);
  }
});

test("younger bands do not see the older clips", () => {
  assert.deepEqual(
    filmsForBand("7-10").map((film) => film.clip),
    ["akashi-span", "pont-du-gard"],
  );
  assert.deepEqual(
    filmsForBand("10-18").map((film) => film.clip),
    ["akashi-span", "pont-du-gard", "eratosthenes-earth", "andean-roads"],
  );
  assert.equal(filmsForBand("18+").length, 5);
});

test("the shelf reuses CardFilm and does not invent a quiz or a coming-soon stamp", () => {
  assert.match(shelf, /CardFilm/);
  assert.equal(shelf.includes("Coming soon"), false);
  assert.equal(shelf.includes("<img"), false);
  assert.equal(shelf.includes("choices"), false);
  for (const cut of clips.cuts) {
    assert.equal(shelf.includes(cut.id), false);
    assert.equal(
      PEOPLE_PLACES_FILMS.some((film) => film.clip === cut.id),
      false,
    );
  }
});
