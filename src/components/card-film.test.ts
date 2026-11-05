/**
 * Card films (feat/home-card-films) — the home cards' film slots
 * as governed films behind one shared component: the two game
 * cards' .hv5-pic slots first, then the three spot illustrations'
 * .hv5-art slots (feat/smooth-cards Part 2 redo, 2026-11-03).
 *
 * Same source-pinning style as home-loading-orbs.test.ts (this
 * repo has no React-render harness): the gates, the lazy mount,
 * and the playback governance are pinned by reading the
 * component; the byte caps are pinned against the real asset
 * files; the visual behaviour is covered by the E2E specs
 * (card-redesign + loading-orbs updates) against the built app.
 *
 * Governance history: the component shipped with play-once
 * playback plus a 44x44 pause/play toggle (the WCAG 2.2.2 stop,
 * PR #295/#321 governance). The owner removed that governance
 * for card films on 2026-11-03 (09:05 and 09:07 CST: "we dont
 * need playbutton it should be in autoloop" / "Remove playbutton
 * set it on auto loop"). The play-once and toggle pins below are
 * therefore re-pinned to autoloop: loop on, no button rendered,
 * no end hold. The verdict clip is a different component and
 * keeps its stop; nothing here governs it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), "utf8");

const film = read("card-film.tsx");
const css = read("home-v5.css");
const gameApp = read("game-app.tsx");
const media = readFileSync(join(here, "../assets/home-v5/card-media.ts"), "utf8");
const assetBytes = (name: string) =>
  statSync(join(here, "../assets/home-v5", name)).size;

describe("CardFilm — gates land on the still, video never fetched", () => {
  it("gates: reduced motion (shared hook), Save-Data, deviceMemory <= 2, video error", () => {
    assert.ok(film.includes("usePrefersReducedMotion()"), "reduced motion via the shared hook");
    assert.ok(film.includes("nav.connection?.saveData"), "Save-Data gate");
    assert.ok(
      film.includes("mem > 0 && mem <= 2"),
      "deviceMemory <= 2 gate (globe's threshold)",
    );
    assert.ok(film.includes("onError={handleError}"), "video error falls back (via the bounded-retry handler)");
    assert.ok(
      film.includes("const gated = reducedMotion || staticGate || failed"),
      "all gates compose into the one still branch",
    );
  });

  it("the gated branch renders the still and contains no video element", () => {
    const gateBranch = film.slice(film.indexOf("if (gated) {"), film.indexOf("rootRef} className"));
    assert.ok(gateBranch.includes("media.stillUrl"), "gated branch renders the still");
    assert.ok(!gateBranch.includes("<video"), "gated branch must not mount a video (no fetch)");
    assert.ok(
      film.indexOf("if (gated) {") < film.indexOf("<video"),
      "the still branch returns before any video JSX",
    );
  });
});

describe("CardFilm — lazy mount + autoloop (owner order, 2026-11-03)", () => {
  it("video mounts only near the viewport (IntersectionObserver, 200px, the globe's pattern)", () => {
    assert.ok(film.includes("new IntersectionObserver"), "observer gate");
    assert.ok(film.includes('{ rootMargin: "200px" }'), "200px rootMargin");
    assert.ok(
      film.includes("near ? (\n        <video") || film.includes("{near ? ("),
      "video element is conditional on near",
    );
    assert.ok(film.includes('preload="none"'), "no eager fetch");
    assert.ok(film.includes("media.posterUrl"), "poster fills the slot before the film");
  });

  it("loops: autoPlay + loop + muted + playsInline on the video element", () => {
    // Owner order 2026-11-03 (09:07 CST): "Remove playbutton set
    // it on auto loop." This pin replaces the play-once pin
    // (no-loop + onEnded hold) that governed the component under
    // PR #295/#321.
    const videoTag = film.slice(film.indexOf("<video"), film.indexOf("<video") + 700);
    assert.ok(videoTag.includes("autoPlay"), "plays when mounted");
    assert.ok(videoTag.includes("loop"), "loop attribute — the film repeats");
    assert.ok(videoTag.includes("muted"), "muted (autoplay policy + silent by design)");
    assert.ok(videoTag.includes("playsInline"), "inline on phones");
  });

  it("no end hold: no onEnded, no paused state, no toggle handler", () => {
    // The play-once build held its last frame and let the toggle
    // replay it. Both behaviours died with the owner's autoloop
    // order; these absence pins keep them dead.
    assert.ok(!film.includes("onEnded"), "no end handler — the loop never holds");
    assert.ok(!film.includes("setPaused"), "no paused state");
    assert.ok(!film.includes("onPlay"), "no play event handler");
    assert.ok(!film.includes("onPause"), "no pause event handler");
    assert.ok(!film.includes("card-film-toggle"), "no toggle class or testid suffix");
    assert.ok(!film.includes("onClick"), "no click handler — the component adds no control");
  });

  it("off-screen pause: a threshold-0 observer plays on screen, pauses off screen", () => {
    assert.ok(film.includes("{ threshold: 0 }"), "visibility observer at threshold 0");
    assert.ok(film.includes("film.play().catch(() => {})"), "rejected play() never surfaces");
    assert.ok(film.includes("film.pause()"), "off-screen films pause instead of decoding");
  });

  it("off-screen pause: the observer resolves the CURRENT element inside its callback (panel B1)", () => {
    // Round 1 captured `videoRef.current` once when the effect
    // ran; the retry key remounts the <video> node, so the live
    // observer kept driving the DETACHED old element and the
    // mounted film decoded off-screen forever. The cure resolves
    // the element at event time, inside the callback.
    const effectStart = film.indexOf("// Off-screen pause:");
    const callbackAt = film.indexOf("(entries) => {", effectStart);
    const beforeCallback = film.slice(effectStart, callbackAt);
    assert.ok(
      !beforeCallback.includes("videoRef.current"),
      "no element is captured before the observer callback (a captured element goes stale on remount)",
    );
    const callbackBody = film.slice(callbackAt, film.indexOf("{ threshold: 0 }", callbackAt));
    assert.ok(
      callbackBody.includes("const film = videoRef.current;"),
      "the callback resolves videoRef.current at event time",
    );
    assert.equal(
      (film.match(/videoRef\.current/g) || []).length,
      1,
      "exactly one videoRef.current resolution in the component — inside the callback",
    );
  });

  it("off-screen pause: the effect re-observes when a remount replaces the element (panel round-2 BLOCK)", () => {
    // The B1 cure resolved the element inside the callback, but
    // the effect's deps were still [gated, near]: a retry remount
    // (key change) — or a non-latched media swap — while the slot
    // is NOT intersecting never re-ran the effect, and
    // IntersectionObserver fires no callback without a threshold
    // crossing, so the new element's initial delivery never
    // happened and the remounted film autoplayed and looped
    // off-screen indefinitely. The deps must carry the remount
    // signals so the effect re-observes and the fresh observer's
    // initial delivery pauses/plays the new element.
    const effect = film.slice(film.indexOf("// Off-screen pause:"));
    assert.ok(
      effect.includes("}, [gated, near, attempt, media.videoUrl]);"),
      "pause effect deps include attempt + media.videoUrl, so a remount re-observes",
    );
    assert.equal(
      (film.match(/\}, \[gated, near\]\);/g) || []).length,
      1,
      "only the lazy-mount effect keeps the bare [gated, near] deps",
    );
  });

  it("no timers: nothing replays, pauses on a schedule, or polls", () => {
    assert.ok(!film.includes("setTimeout"), "no timer chains");
    assert.ok(!film.includes("setInterval"), "no polling timers");
  });
});

describe("CardFilm — error latch: URL+band scope, derived (2026-11-04; panel cure)", () => {
  it("the retry/latch scope is band + videoUrl, held as scope strings", () => {
    // Panel B2: a media-only reset left most slots latched for
    // the whole home session — only Review/Cold Trail have
    // band-variant media, and variant selectors fail closed to
    // the standard record. The scope therefore includes the
    // band itself: any band change OR url change is a new scope.
    assert.ok(film.includes("band?: AgeBandId"), "CardFilm takes the current band as a prop");
    assert.ok(
      film.includes('const scope = `${band ?? ""}|${media.videoUrl}`;'),
      "the scope is band + videoUrl",
    );
    assert.ok(
      film.includes("const [spentScope, setSpentScope] = useState<string | null>(null);"),
      "the spent-retry state remembers WHICH scope spent it",
    );
    assert.ok(
      film.includes("const [failedScope, setFailedScope] = useState<string | null>(null);"),
      "the latch state remembers WHICH scope latched",
    );
  });

  it("attempt and failed are DERIVED from the scope — no reset effect, first-render reset", () => {
    // Derivation resets in the same render: a media/band change
    // starts the new film at attempt 0 in its FIRST render (a
    // post-render effect reset first rendered the new film at
    // the stale attempt — a double fetch start — and could
    // charge a stale error to the new film).
    assert.ok(film.includes("const attempt = spentScope === scope ? 1 : 0;"), "attempt is derived");
    assert.ok(film.includes("const failed = failedScope === scope;"), "failed is derived");
    assert.ok(!film.includes("const [attempt, setAttempt]"), "no attempt state to reset");
    assert.ok(!film.includes("const [failed, setFailed]"), "no failed state to reset");
    assert.ok(!film.includes("setFailed(false)"), "no effect resets the latch");
    assert.ok(!film.includes("}, [media.videoUrl]);"), "no media-keyed reset effect survives");
  });

  it("one bounded retry per scope: first error spends it, second error on the same scope latches", () => {
    assert.ok(
      film.includes("if (spentScope !== scope) setSpentScope(scope);"),
      "first error on a scope spends its single retry",
    );
    assert.ok(film.includes("else setFailedScope(scope);"), "second error on the same scope latches");
    assert.ok(
      film.includes("key={`${media.videoUrl}#${attempt}`}"),
      "the attempt count is in the video key, so spending the retry remounts the video once",
    );
    assert.ok(!film.includes("setTimeout") && !film.includes("setInterval"), "no timer-driven retry loop");
  });

  it("leaving a scope clears its record — a band round trip back revives (panel round-2, Office Hours)", () => {
    // Derivation alone revives the slot only while a DIFFERENT
    // scope is showing: latch in band A, switch to B (revived),
    // switch back to A in the same session — the stored record
    // still equals A's scope, so the slot rendered latched on
    // arrival. The cure clears spent/failed when the scope
    // actually transitions, during render (no effect), so every
    // arrival at a scope starts fresh.
    assert.ok(
      film.includes("const [seenScope, setSeenScope] = useState(scope);"),
      "the component remembers the scope it last rendered",
    );
    assert.ok(film.includes("if (seenScope !== scope) {"), "the clearing is keyed on an actual scope transition");
    assert.ok(film.includes("setSeenScope(scope);"), "the transition is recorded");
    assert.ok(film.includes("setSpentScope(null);"), "leaving a scope clears its spent-retry record");
    assert.ok(film.includes("setFailedScope(null);"), "leaving a scope clears its latch record");
  });
});

describe("CardFilm — no stop control on card films (owner autoloop order)", () => {
  it("the component renders no button and no pressed state", () => {
    // Owner order 2026-11-03: the play/pause toggle is removed
    // from every card film. The WCAG 2.2.2 tradeoff is recorded
    // in the component header; the gates above are the stops
    // that remain.
    assert.ok(!film.includes("<button"), "no <button> in the component output");
    assert.ok(!film.includes("aria-pressed"), "no toggle state is exposed");
    assert.ok(!film.includes("Pause the cartoon"), "old pause label gone");
    assert.ok(!film.includes("Play the cartoon"), "old play label gone");
  });

  it("the toggle CSS is deleted from home-v5.css", () => {
    assert.ok(!css.includes(".hv5-card-film-toggle"), "toggle rule gone");
    assert.ok(!css.includes(".hv5-film-icon-play"), "play icon rule gone");
    assert.ok(!css.includes(".hv5-film-icon-pause"), "pause icon rule gone");
  });

  it("the film itself is decoration and never focusable", () => {
    const videoTag = film.slice(film.indexOf("<video"), film.indexOf("<video") + 700);
    assert.ok(videoTag.includes('aria-hidden="true"'), "video is aria-hidden");
    assert.ok(videoTag.includes("tabIndex={-1}"), "video is never focusable");
  });
});

describe("CardFilm — zero CLS: media fills the existing .hv5-pic box", () => {
  it("fill rules exist and the .hv5-pic box geometry is untouched", () => {
    assert.ok(css.includes(".hv5-card-film > img,\n.home-v5 .hv5-card-film > video") ||
      css.includes(".hv5-card-film > video"), "media fill rule exists");
    assert.ok(css.includes("position: absolute"), "media is absolutely filled");
    // The box itself: stack rule still sets the 16/9 box the tour measures.
    assert.ok(css.includes(".hv5-stack .hv5-pic"), "stack pic rule still present");
    assert.ok(css.includes("aspect-ratio: 16 / 9"), "16/9 pic box unchanged");
  });
});

describe("home wiring — five cards, one component, nothing else moves", () => {
  it("both .hv5-pic slots render CardFilm with their card-media entries", () => {
    assert.ok(
      gameApp.includes('<CardFilm className="hv5-pic" media={GEODETECTIVE_FILM} testId="card-film-geodetective" band={ageBand} />'),
      "GeoDetective slot",
    );
    assert.ok(
      gameApp.includes('<CardFilm className="hv5-pic" media={coldtrailMediaForBand(ageBand)} testId="card-film-coldtrail" band={ageBand} />'),
      "Cold Trail slot (band-variant selector, Units 2–3 — the selector returns the standard entry for every band but 5-7)",
    );
  });

  it("all three .hv5-art slots render CardFilm with their card-media entries", () => {
    assert.ok(
      gameApp.includes('<CardFilm className="hv5-art" media={reviewMediaForBand(ageBand)} testId="card-film-review" band={ageBand} />'),
      "Review slot (band-variant selector, Units 2–3 — the selector returns the standard entry for every band but 8-10)",
    );
    assert.ok(
      gameApp.includes('<CardFilm className="hv5-art" media={JOURNAL_FILM} testId="card-film-journal" band={ageBand} />'),
      "Journal slot",
    );
    assert.ok(
      gameApp.includes('<CardFilm className="hv5-art" media={GROWNUPS_FILM} testId="card-film-grownups" band={ageBand} />'),
      "Grown-ups slot",
    );
    assert.equal((gameApp.match(/<CardFilm/g) || []).length, 5, "exactly five film slots — one motion system");
    assert.ok(!gameApp.includes('className="hv5-art" src='), "no .hv5-art slot renders a bare still anymore");
  });

  it("the art slots render picture-first: CardFilm before .hv5-txt in each spot card", () => {
    // WP3 of the rework: the banner sits at the top of the card,
    // so the film element precedes the text column in the DOM,
    // as the film cards' .hv5-pic slots already did.
    for (const filmTestId of ["card-film-review", "card-film-journal", "card-film-grownups"]) {
      const filmAt = gameApp.indexOf(`testId="${filmTestId}"`);
      const txtAt = gameApp.indexOf('<div className="hv5-txt">', filmAt);
      assert.ok(filmAt >= 0 && txtAt > filmAt, `${filmTestId}: a text column follows the film`);
      const between = gameApp.slice(filmAt, txtAt);
      assert.ok(
        between.length < 200 && !between.includes("</"),
        `${filmTestId}: film sits immediately before its text column (picture first)`,
      );
    }
  });

  it("banner geometry lives in the appended art-film block; base art ratios survive", () => {
    assert.ok(css.includes(".home-v5 .hv5-spot .hv5-art {"), "spot art box rule still present");
    assert.ok(css.includes("aspect-ratio: 400 / 269"), "Review art ratio unchanged");
    assert.ok(css.includes(".home-v5 .hv5-journal .hv5-art {"), "Journal art box rule still present");
    assert.ok(css.includes(".home-v5 .hv5-involved .hv5-art {"), "Grown-ups art box rule still present");
    const artBlock = css.slice(css.indexOf("art films (feat/smooth-cards"));
    assert.ok(artBlock.includes("width: calc(100% + 56px)"), "banner spans the full card width");
    assert.ok(artBlock.includes("margin: -26px -28px 18px"), "banner cancels the card padding like .hv5-pic");
    assert.ok(artBlock.includes("mask-image: none"), "corner radial mask removed from the banner");
    assert.ok(artBlock.includes(".home-v5 .hv5-spot .hv5-txt"), "spot text column rule present");
    assert.ok(artBlock.includes("max-width: 100%"), "spot text returns to full width");
    assert.ok(artBlock.includes("height: auto"),
      "aspect cure: the base spot rule's height: 100% is neutralized in the art block, so the banner keeps its native aspect");
  });

  it("art-film CSS: no fade overlay on the art slots; no toggle layer survives", () => {
    // Renamed in the gradient cure (owner ruling, 2026-11-03
    // 10:25 CST): the pic slots' painted landing strip this test
    // once named is deleted entirely — the melt is a pure mask
    // feather now (pinned in home-smooth-cards.test.ts). The art
    // slots' ::after guard stays: no gradient overlay reaches
    // the banners either way.
    assert.ok(css.includes(".home-v5 .hv5-card-film.hv5-art::after {"), "art slots guard the wrapper ::after off");
    const artBlock = css.slice(css.indexOf("art films (feat/smooth-cards"));
    assert.ok(artBlock.includes("content: none"), "no gradient overlay on the art slots");
    assert.ok(!artBlock.includes("z-index: 3"), "the toggle's z-index lift is gone with the toggle");
    assert.ok(!artBlock.includes("hv5-card-film-toggle"), "no toggle rule in the art block");
    assert.ok(!artBlock.includes("pointer-events: auto"), "no pointer-events hand-back for a deleted control");
  });

  it("the locked band still renders LockedLoop, byte-identical branch", () => {
    assert.ok(
      gameApp.includes('isLoopLocked(ageBand, "geodetective")'),
      "lock check untouched",
    );
    assert.ok(
      gameApp.includes('<LockedLoop title="GeoDetective" onGrownUpOpen={onGrownUpOpen} />'),
      "locked variant untouched",
    );
  });

  it("card copy locks are byte-exact (eyebrows + CTAs)", () => {
    for (const locked of [
      "Case file · Unlimited",
      "Case file · Triangulation",
      "Solve a mystery",
      "Start the trail",
      "Jolly was spotted in the snow. Three sightings, three rings — tap where",
    ]) {
      assert.ok(gameApp.includes(locked), `copy lock missing: ${locked}`);
    }
  });

  it("the old stills are gone from the home wiring", () => {
    assert.ok(!gameApp.includes("desertRuinsUrl"), "desert-ruins import removed");
    assert.ok(!gameApp.includes("patagoniaUrl"), "patagonia import removed");
  });
});

describe("card-media — the swap point", () => {
  it("exports one entry per card, each with video + poster + still", () => {
    assert.ok(media.includes("export const GEODETECTIVE_FILM"), "GeoDetective entry");
    assert.ok(media.includes("export const COLDTRAIL_FILM"), "Cold Trail entry");
    assert.ok(media.includes("export const REVIEW_FILM"), "Review entry");
    assert.ok(media.includes("export const JOURNAL_FILM"), "Journal entry");
    assert.ok(media.includes("export const GROWNUPS_FILM"), "Grown-ups entry");
    for (const field of ["videoUrl", "posterUrl", "stillUrl"]) {
      assert.ok(media.includes(field), `field ${field}`);
    }
  });

  it("poster and still are different files per card (documented distinction)", () => {
    assert.ok(media.includes('from "./geodetective-poster.webp"'));
    assert.ok(media.includes('from "./geodetective-still.webp"'));
    assert.ok(media.includes('from "./coldtrail-poster.webp"'));
    assert.ok(media.includes('from "./coldtrail-still.webp"'));
    assert.ok(
      media.includes("Poster vs still"),
      "the distinction is documented in the module header",
    );
  });
});

describe("card-media — byte caps (measured on the real files)", () => {
  it("each film is <= ~400 KB (the verdict league)", () => {
    assert.ok(assetBytes("geodetective-film.mp4") <= 400_000,
      `geodetective film: ${assetBytes("geodetective-film.mp4")}`);
    assert.ok(assetBytes("coldtrail-film.mp4") <= 400_000,
      `coldtrail film: ${assetBytes("coldtrail-film.mp4")}`);
    assert.ok(assetBytes("review-film.mp4") <= 400_000,
      `review film: ${assetBytes("review-film.mp4")}`);
    assert.ok(assetBytes("journal-film.mp4") <= 400_000,
      `journal film: ${assetBytes("journal-film.mp4")}`);
    assert.ok(assetBytes("grownups-film.mp4") <= 400_000,
      `grownups film: ${assetBytes("grownups-film.mp4")}`);
  });

  it("the art posters stay small (poster files, measured)", () => {
    for (const name of ["review-poster.webp", "journal-poster.webp", "grownups-poster.webp"]) {
      const bytes = assetBytes(name);
      assert.ok(bytes >= 5_000 && bytes <= 60_000, `${name}: ${bytes}`);
    }
  });

  it("the art cards' stills ARE the original illustrations (no copies)", () => {
    assert.ok(media.includes('reviewStillUrl from "./archive-tools.webp"') ||
      media.includes('from "./archive-tools.webp"'), "Review still is archive-tools.webp");
    assert.ok(media.includes('from "./journal-tree.webp"'), "Journal still is journal-tree.webp");
    assert.ok(media.includes('from "./binoculars-hat.webp"'), "Grown-ups still is binoculars-hat.webp");
    assert.ok(media.includes('from "./review-poster.webp"') && media.includes('from "./review-film.mp4"'),
      "Review poster + film files");
    assert.ok(media.includes('from "./journal-poster.webp"') && media.includes('from "./journal-film.mp4"'),
      "Journal poster + film files");
    assert.ok(media.includes('from "./grownups-poster.webp"') && media.includes('from "./grownups-film.mp4"'),
      "Grown-ups poster + film files");
  });

  it("posters and stills are in the verdict league (~65-135 KB)", () => {
    for (const name of [
      "geodetective-poster.webp",
      "geodetective-still.webp",
      "coldtrail-poster.webp",
      "coldtrail-still.webp",
    ]) {
      const bytes = assetBytes(name);
      assert.ok(bytes >= 30_000 && bytes <= 140_000, `${name}: ${bytes}`);
    }
  });
});
