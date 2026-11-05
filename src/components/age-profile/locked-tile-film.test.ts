/**
 * Locked tile film (feat/band-motion-locked-tile) — the Little
 * Explorer (5–7) locked GeoDetective tile's picture band.
 *
 * Same source-pinning style as card-film.test.ts (this repo has
 * no React-render harness): the no-toggle rule, the gates, the
 * lazy mount, the loop governance, and the copy lock are pinned
 * by reading the components and CSS; the byte caps are pinned
 * against the real asset files; the visual behaviour is covered
 * by E2E against the built app.
 *
 * Governance history: the film originally played once and rested
 * (bounded play, R2) so the tile would need no stop control. The
 * owner superseded R2 on 2026-11-04 — the film now loops under
 * CardFilm's exact governance. R1 (no control of any kind on the
 * tile) is unchanged and its pins below still stand.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), "utf8");

const film = read("LockedTileFilm.tsx");
const tile = read("LockedLoop.tsx");
const css = read("age-profile.css");
const styles = read("../../styles.css");
const gameApp = read("../game-app.tsx");
const media = read("../../assets/home-v5/locked-tile-media.ts");
const assetBytes = (name: string) =>
  statSync(join(here, "../../assets/home-v5", name)).size;

describe("LockedTileFilm — R1: no toggle, no play icon, no control at all", () => {
  it("renders no button, no link, and no toggle test id", () => {
    assert.ok(!film.includes("<button"), "no button element");
    assert.ok(!film.includes("<a "), "no link element");
    assert.ok(!film.includes("aria-pressed"), "no toggle state of any kind");
    assert.ok(!film.includes("Play the cartoon"), "no play label of any kind");
    assert.ok(!film.includes("onClick"), "nothing in the picture is clickable");
  });

  it("the picture is decoration: aria-hidden, never focusable, pointer-events none", () => {
    const videoTag = film.slice(film.indexOf("<video"), film.indexOf("<video") + 400);
    assert.ok(videoTag.includes('aria-hidden="true"'), "video is aria-hidden");
    assert.ok(videoTag.includes("tabIndex={-1}"), "video is never focusable");
    const picRule = css.slice(css.indexOf(".agep-locked-pic {"));
    assert.ok(picRule.includes("pointer-events: none"), "picture never takes a tap");
  });
});

describe("LockedTileFilm — gates land on the still, video never fetched", () => {
  it("gates: reduced motion (shared hook), Save-Data, deviceMemory <= 2, video error", () => {
    assert.ok(film.includes("usePrefersReducedMotion()"), "reduced motion via the shared hook");
    assert.ok(film.includes("nav.connection?.saveData"), "Save-Data gate");
    assert.ok(film.includes("mem > 0 && mem <= 2"), "deviceMemory <= 2 gate");
    assert.ok(film.includes("onError={handleError}"), "video error falls back (via the bounded-retry handler)");
    assert.ok(
      film.includes("const gated = reducedMotion || staticGate || failed"),
      "all gates compose into the one still branch",
    );
  });

  it("the gated branch renders the still and contains no video element", () => {
    const gateBranch = film.slice(film.indexOf("if (gated) {"), film.indexOf("return (\n    <div ref={rootRef}"));
    assert.ok(gateBranch.includes("stillUrl"), "gated branch renders the resting still");
    assert.ok(!gateBranch.includes("<video"), "gated branch must not mount a video (no fetch)");
  });
});

describe("LockedTileFilm — lazy mount + loop governance (owner ruling, 2026-11-04)", () => {
  it("video mounts only near the viewport (IntersectionObserver, 200px)", () => {
    assert.ok(film.includes("new IntersectionObserver"), "observer gate");
    assert.ok(film.includes('{ rootMargin: "200px" }'), "200px rootMargin");
    assert.ok(film.includes("{near ? ("), "video element is conditional on near");
    assert.ok(film.includes('preload="none"'), "no eager fetch");
    assert.ok(film.includes("posterUrl"), "poster fills the box before the film");
  });

  it("loops like the card films: autoPlay + loop + muted + playsInline", () => {
    // This pin replaces the bounded-play pin (no loop, plays once
    // and rests) that governed the component under R2 — the
    // owner's 2026-11-04 ruling superseded R2.
    assert.ok(film.includes("autoPlay"), "plays when mounted");
    assert.ok(film.includes("muted"), "muted");
    assert.ok(film.includes("playsInline"), "inline on phones");
    const videoTag = film.slice(film.indexOf("<video"), film.indexOf("<video") + 500);
    assert.ok(videoTag.includes("loop"), "loop attribute — the film repeats like the card films");
    assert.ok(!film.includes("setTimeout") && !film.includes("setInterval"), "no timers");
  });

  it("off-screen pause: a threshold-0 observer plays on screen, pauses off screen", () => {
    assert.ok(film.includes("{ threshold: 0 }"), "visibility observer at threshold 0");
    assert.ok(film.includes("film.play().catch(() => {})"), "rejected play() never surfaces");
    assert.ok(film.includes("film.pause()"), "off-screen film pauses instead of decoding");
    assert.ok(film.includes("videoRef"), "the observer drives the mounted video element");
  });

  it("off-screen pause: the observer resolves the CURRENT element inside its callback (panel B1)", () => {
    // Same orphaning defect as CardFilm: round 1 captured
    // `videoRef.current` once when the effect ran, and the retry
    // key remounts the <video> node — the live observer kept
    // driving the detached old element. The cure resolves the
    // element at event time, inside the callback.
    const effectStart = film.indexOf("// Off-screen pause, CardFilm's exact governance:");
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

  it("off-screen pause: the effect re-observes when the retry remounts the element (panel round-2 BLOCK)", () => {
    // Same round-2 shape as CardFilm: deps [gated, near] never
    // re-ran the effect for the remounted element, and a slot
    // that has not intersected yet gets no threshold crossing —
    // the remounted film would loop off-screen indefinitely.
    // The deps must carry `attempt` so the effect re-observes
    // and the fresh observer's initial delivery reaches the new
    // element. (This component's media is constant, so there is
    // no videoUrl term — CardFilm's pin carries one.)
    const effect = film.slice(film.indexOf("// Off-screen pause, CardFilm's exact governance:"));
    assert.ok(
      effect.includes("}, [gated, near, attempt]);"),
      "pause effect deps include attempt, so a remount re-observes",
    );
    assert.equal(
      (film.match(/\}, \[gated, near\]\);/g) || []).length,
      1,
      "only the lazy-mount effect keeps the bare [gated, near] deps",
    );
  });

  it("error latch: one bounded retry per scope, derived (parallel to CardFilm)", () => {
    // The media is a constant, so the scope is just its URL; the
    // states remember WHICH scope spent/latched and attempt +
    // failed are derived — no state reset, no stale charge.
    assert.ok(
      film.includes("const scope = LOCKED_GEODETECTIVE_FILM.videoUrl;"),
      "the scope is the constant film's URL",
    );
    assert.ok(
      film.includes("const [spentScope, setSpentScope] = useState<string | null>(null);"),
      "the spent-retry state remembers WHICH scope spent it",
    );
    assert.ok(
      film.includes("const [failedScope, setFailedScope] = useState<string | null>(null);"),
      "the latch state remembers WHICH scope latched",
    );
    assert.ok(film.includes("const attempt = spentScope === scope ? 1 : 0;"), "attempt is derived");
    assert.ok(film.includes("const failed = failedScope === scope;"), "failed is derived");
    assert.ok(!film.includes("const [attempt, setAttempt]"), "no attempt state to reset");
    assert.ok(!film.includes("const [failed, setFailed]"), "no failed state to reset");
    assert.ok(
      film.includes("if (spentScope !== scope) setSpentScope(scope);"),
      "first error on a scope spends its single retry",
    );
    assert.ok(film.includes("else setFailedScope(scope);"), "second error on the same scope latches");
    assert.ok(
      film.includes("key={`locked#${attempt}`}"),
      "the attempt count is in the video key, so spending the retry remounts the video once",
    );
  });
});

describe("LockedLoop — R5: copy byte-exact, order frozen, picture adds no words", () => {
  it("the four copy pieces appear once each, in today's order", () => {
    const jsx = tile.slice(tile.indexOf("return ("));
    const order = [
      jsx.indexOf("atlas-eyebrow"),
      jsx.indexOf("atlas-dossier-title"),
      jsx.indexOf("Ask a grown-up to open more games"),
      jsx.indexOf("Grown-ups, open here →"),
    ];
    assert.ok(order.every((i) => i >= 0), "all four copy pieces present");
    assert.ok(
      order.every((v, i) => i === 0 || v > order[i - 1]),
      "eyebrow → title → body → link, in that order",
    );
    assert.ok(tile.includes('eyebrow = "More games"'), "eyebrow default is byte-exact");
    assert.ok(tile.includes('className="agep-locked-link"'), "link keeps its text-link class");
    assert.ok(!tile.includes("hv5-chip"), "no chip on the locked tile");
  });

  it("the body-tap pulse and the grown-up path are untouched", () => {
    assert.ok(tile.includes("agep-locked-pulse"), "pulse class still applied");
    assert.ok(tile.includes("onClick={pulse}"), "body tap still pulses the message");
    assert.ok(tile.includes("onClick={onGrownUpOpen}"), "link still opens the grown-up gate");
    assert.ok(
      tile.includes('aria-label="For grown-ups: open game settings"'),
      "grown-up link label unchanged",
    );
  });
});

describe("band selection — only the 5–7 locked tile ever mounts the film", () => {
  it("LockedLoop mounts the film; game-app's locked branch is byte-identical", () => {
    assert.ok(tile.includes("<LockedTileFilm />"), "film mounts inside LockedLoop");
    assert.ok(
      gameApp.includes('<LockedLoop title="GeoDetective" onGrownUpOpen={onGrownUpOpen} />'),
      "game-app locked branch untouched — no new prop, no new import there",
    );
    assert.ok(!gameApp.includes("LockedTileFilm"), "game-app never names the film directly");
    assert.ok(!gameApp.includes("locked-tile-media"), "game-app never names the locked media");
  });
});

describe("grades — the picture's baked grade never stacks with the text grade", () => {
  it("grayscale(0.85) scopes to the tile's text, not the whole tile", () => {
    assert.ok(
      !/\.agep-locked \{\s*filter:/.test(css),
      "the whole-tile filter rule is gone",
    );
    assert.ok(css.includes(".agep-locked-body,"), "text-scoped grade rule exists");
    const picRule = css.slice(css.indexOf(".agep-locked-pic {"), css.indexOf(".agep-locked-pic > img"));
    assert.ok(!picRule.includes("filter"), "no filter on the picture box");
    assert.ok(media.includes("desaturate 0.45"), "the media module records the baked 0.45 grade");
  });

  it("zero CLS: the picture box reserves 16/9 before media loads", () => {
    const picRule = css.slice(css.indexOf(".agep-locked-pic {"), css.indexOf(".agep-locked-pic > img"));
    assert.ok(picRule.includes("aspect-ratio: 16 / 9"), "fixed aspect-ratio box");
    assert.ok(css.includes(".agep-locked-pic > img,"), "media fill rule exists");
    assert.ok(css.includes("position: absolute"), "media absolutely fills the box");
  });
});

describe("hover fix — the locked tile does not lift like a clickable card", () => {
  it("styles.css scopes a no-lift override to the locked tile", () => {
    const rule = styles.slice(styles.indexOf(".atlas-dossier.agep-locked:hover"));
    assert.ok(rule.includes("translate: none"), "no lift");
    assert.ok(rule.includes("border-color: var(--atlas-card-line)"), "resting border kept");
    assert.ok(rule.includes("box-shadow: none"), "no hover shadow");
    assert.ok(
      styles.includes(".atlas-dossier:hover {"),
      "the real dossier hover rule still exists for real cards",
    );
  });
});

describe("locked-tile-media — the swap point + byte caps", () => {
  it("exports one entry with video + poster + still, from three separate files", () => {
    assert.ok(media.includes("export const LOCKED_GEODETECTIVE_FILM"), "locked entry exported");
    assert.ok(media.includes('from "./geodetective-locked-film.mp4"'), "film file");
    assert.ok(media.includes('from "./geodetective-locked-poster.webp"'), "poster file");
    assert.ok(media.includes('from "./geodetective-locked-still.webp"'), "still file");
    for (const field of ["videoUrl", "posterUrl", "stillUrl"]) {
      assert.ok(media.includes(field), `field ${field}`);
    }
  });

  it("film <= ~400 KB; poster and still in the shipped league", () => {
    const filmBytes = assetBytes("geodetective-locked-film.mp4");
    assert.ok(filmBytes <= 400_000, `locked film: ${filmBytes}`);
    for (const name of ["geodetective-locked-poster.webp", "geodetective-locked-still.webp"]) {
      const bytes = assetBytes(name);
      assert.ok(bytes >= 30_000 && bytes <= 140_000, `${name}: ${bytes}`);
    }
  });
});
