/**
 * Band-variant card media (band-motion port, Units 2–3) — the two
 * band selectors in card-media.ts and the game-app wiring that
 * feeds them.
 *
 * Why this file loads the module the way it does: card-media.ts
 * imports .mp4/.webp files, which Node's test runner cannot load
 * (ERR_UNKNOWN_FILE_EXTENSION) — that is why this repo's other
 * media tests (card-film.test.ts) pin source text instead of
 * importing. The selector matrix below needs the real functions
 * running, so the loader rewrites ONLY the asset import lines of
 * the shipped file into stub URL constants (each import's own
 * file name) and imports the result. Every record and both
 * selector bodies execute exactly as shipped; if a selector's
 * logic changes, this test runs the changed logic.
 *
 * The rest of the file is source pinning in the repo's style:
 * the wiring (selectors are the only band→media path), the byte
 * caps on the real files, and the no-duplicate-still rule for
 * the Trail Scout Review record.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), "utf8");
const assetBytes = (name: string) => statSync(join(here, name)).size;

const media = read("card-media.ts");
const gameApp = readFileSync(join(here, "../../components/game-app.tsx"), "utf8");

type MediaRecord = { videoUrl: string; posterUrl: string; stillUrl: string };
type CardMediaModule = {
  COLDTRAIL_FILM: MediaRecord;
  REVIEW_FILM: MediaRecord;
  COLDTRAIL_FILM_LITTLE_EXPLORER: MediaRecord;
  REVIEW_FILM_TRAIL_SCOUT: MediaRecord;
  coldtrailMediaForBand: (band: string | null | undefined) => MediaRecord;
  reviewMediaForBand: (band: string | null | undefined) => MediaRecord;
};

let mod: CardMediaModule;
let stubDir: string;

before(async () => {
  stubDir = mkdtempSync(join(tmpdir(), "card-media-under-test-"));
  const stubbed = media.replace(
    /^import (\w+) from "(\.\/[^"]+)";$/gm,
    (_line, name: string, path: string) => `const ${name} = "${path}";`,
  );
  assert.ok(!stubbed.includes(".mp4\";") || !/^import .*\.mp4";$/m.test(stubbed), "all asset imports stubbed");
  const stubPath = join(stubDir, "card-media-under-test.ts");
  writeFileSync(stubPath, stubbed);
  mod = (await import(pathToFileURL(stubPath).href)) as CardMediaModule;
});

after(() => {
  rmSync(stubDir, { recursive: true, force: true });
});

describe("coldtrailMediaForBand — full matrix", () => {
  it('"5-7" (Little Explorer) gets the softer variant, by identity', () => {
    assert.equal(mod.coldtrailMediaForBand("5-7"), mod.COLDTRAIL_FILM_LITTLE_EXPLORER);
    assert.ok(mod.COLDTRAIL_FILM_LITTLE_EXPLORER.videoUrl.endsWith("coldtrail-film-little-explorer.mp4"));
    assert.ok(mod.COLDTRAIL_FILM_LITTLE_EXPLORER.posterUrl.endsWith("coldtrail-poster-little-explorer.webp"));
    assert.ok(mod.COLDTRAIL_FILM_LITTLE_EXPLORER.stillUrl.endsWith("coldtrail-still-little-explorer.webp"));
  });

  it("every other value gets the standard record, by identity", () => {
    for (const band of ["8-10", "11-13", null, undefined, "", "5–7", "5-7 ", " 5-7", "5", "little-explorer", "garbage"] as const) {
      assert.equal(
        mod.coldtrailMediaForBand(band as string | null | undefined),
        mod.COLDTRAIL_FILM,
        `band=${JSON.stringify(band)} must fail closed to the standard film`,
      );
    }
    assert.ok(mod.COLDTRAIL_FILM.videoUrl.endsWith("coldtrail-film.mp4"));
  });

  it("is pure: repeated calls return the identical record object", () => {
    assert.equal(mod.coldtrailMediaForBand("5-7"), mod.coldtrailMediaForBand("5-7"));
    assert.equal(mod.coldtrailMediaForBand("11-13"), mod.coldtrailMediaForBand(null));
  });
});

describe("reviewMediaForBand — full matrix", () => {
  it('"8-10" (Trail Scout) gets the regenerated variant, by identity', () => {
    assert.equal(mod.reviewMediaForBand("8-10"), mod.REVIEW_FILM_TRAIL_SCOUT);
    assert.ok(mod.REVIEW_FILM_TRAIL_SCOUT.videoUrl.endsWith("review-film-trail-scout.mp4"));
    assert.ok(mod.REVIEW_FILM_TRAIL_SCOUT.posterUrl.endsWith("review-poster-trail-scout.webp"));
  });

  it("every other value gets the standard record, by identity", () => {
    for (const band of ["5-7", "11-13", null, undefined, "", "8–10", "8-10 ", " 8-10", "8", "trail-scout", "garbage"] as const) {
      assert.equal(
        mod.reviewMediaForBand(band as string | null | undefined),
        mod.REVIEW_FILM,
        `band=${JSON.stringify(band)} must fail closed to the standard film`,
      );
    }
    assert.ok(mod.REVIEW_FILM.videoUrl.endsWith("review-film.mp4"));
  });

  it("is pure: repeated calls return the identical record object", () => {
    assert.equal(mod.reviewMediaForBand("8-10"), mod.reviewMediaForBand("8-10"));
    assert.equal(mod.reviewMediaForBand("5-7"), mod.reviewMediaForBand(undefined));
  });

  it("the Trail Scout record's still is the shared archive-tools.webp import, not a copy", () => {
    assert.equal(mod.REVIEW_FILM_TRAIL_SCOUT.stillUrl, mod.REVIEW_FILM.stillUrl);
    assert.ok(mod.REVIEW_FILM_TRAIL_SCOUT.stillUrl.endsWith("archive-tools.webp"));
    assert.ok(
      media.includes("stillUrl: reviewStillUrl"),
      "the variant record reuses the existing reviewStillUrl import",
    );
    assert.ok(!existsSync(join(here, "review-still-trail-scout.webp")), "no duplicated still file");
  });
});

describe("band variants — byte caps on the real files", () => {
  it("both variant films are <= ~400 KB (the verdict league)", () => {
    assert.ok(assetBytes("coldtrail-film-little-explorer.mp4") <= 400_000,
      `LE Cold Trail film: ${assetBytes("coldtrail-film-little-explorer.mp4")}`);
    assert.equal(assetBytes("coldtrail-film-little-explorer.mp4"), 349_224, "the prep encode, byte-exact");
    assert.ok(assetBytes("review-film-trail-scout.mp4") <= 400_000,
      `TS Review film: ${assetBytes("review-film-trail-scout.mp4")}`);
    assert.equal(assetBytes("review-film-trail-scout.mp4"), 241_829, "the CRF 28 slot-size encode");
  });

  it("the variant posters/still stay in the poster league", () => {
    assert.equal(assetBytes("coldtrail-poster-little-explorer.webp"), 50_100);
    assert.equal(assetBytes("coldtrail-still-little-explorer.webp"), 50_100);
    const tsPoster = assetBytes("review-poster-trail-scout.webp");
    assert.ok(tsPoster >= 5_000 && tsPoster <= 60_000, `TS Review poster: ${tsPoster}`);
  });

  it("the banned mock take is not in the repo", () => {
    assert.ok(!existsSync(join(here, "trail-scout-review.mp4")), "banned mock file must never ship");
    assert.ok(!media.includes("trail-scout-review.mp4"), "no import of the banned mock take");
  });
});

describe("game-app wiring — the selectors are the only band→media path", () => {
  it("Cold Trail and Review pass through their selectors with the in-scope ageBand", () => {
    assert.ok(
      gameApp.includes('<CardFilm className="hv5-pic" media={coldtrailMediaForBand(ageBand)} testId="card-film-coldtrail" band={ageBand} />'),
      "Cold Trail slot goes through coldtrailMediaForBand(ageBand)",
    );
    assert.ok(
      gameApp.includes('<CardFilm className="hv5-art" media={reviewMediaForBand(ageBand)} testId="card-film-review" band={ageBand} />'),
      "Review slot goes through reviewMediaForBand(ageBand)",
    );
  });

  it("game-app never names a variant record directly", () => {
    assert.ok(!gameApp.includes("COLDTRAIL_FILM_LITTLE_EXPLORER"), "LE record only reachable via its selector");
    assert.ok(!gameApp.includes("REVIEW_FILM_TRAIL_SCOUT"), "TS record only reachable via its selector");
    assert.ok(!gameApp.includes("media={COLDTRAIL_FILM}"), "standard Cold Trail record no longer wired directly");
    assert.ok(!gameApp.includes("media={REVIEW_FILM}"), "standard Review record no longer wired directly");
  });

  it("the other three cards keep their plain records", () => {
    assert.ok(gameApp.includes('<CardFilm className="hv5-pic" media={GEODETECTIVE_FILM} testId="card-film-geodetective" band={ageBand} />'));
    assert.ok(gameApp.includes('<CardFilm className="hv5-art" media={JOURNAL_FILM} testId="card-film-journal" band={ageBand} />'));
    assert.ok(gameApp.includes('<CardFilm className="hv5-art" media={GROWNUPS_FILM} testId="card-film-grownups" band={ageBand} />'));
    assert.equal((gameApp.match(/<CardFilm/g) || []).length, 5, "still exactly five film slots");
  });

  it("card-media exports the two variant records and both selectors", () => {
    assert.ok(media.includes("export const COLDTRAIL_FILM_LITTLE_EXPLORER"));
    assert.ok(media.includes("export const REVIEW_FILM_TRAIL_SCOUT"));
    assert.ok(media.includes("export function coldtrailMediaForBand"));
    assert.ok(media.includes("export function reviewMediaForBand"));
  });
});
