/**
 * Loading orbs (feat/loading-orbs) — globe zone + lazy card images.
 *
 * There is no React-render harness in this repo (game-app has none, and
 * node:test runs without jsdom), so — following the precedent of
 * game-app-lazy-boundary.test.ts — the wiring is pinned by reading the
 * source: the overlay must exist in the initial render, load/error must
 * move it to the fade-out phase, transition end must unmount it, the
 * cached-complete path must clear it, and no timer chain may exist.
 * The globe's three.js path is not faked: the texture-callback plumbing
 * is pinned here, and the visual transition itself is covered by the
 * test seat's E2E specs against the built app.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), "utf8");

const lazy = read("lazy-home-image.tsx");
const globe = read("home-globe.tsx");
const css = read("home-v5.css");
const styles = readFileSync(join(here, "../styles.css"), "utf8");
const gameApp = read("game-app.tsx");

describe("LazyHomeImage — shared card-image orb", () => {
  it("renders the spinner overlay initially (phase starts loading)", () => {
    assert.ok(
      lazy.includes('useState<"loading" | "fading" | "done">("loading")'),
      "orb phase must start at loading",
    );
    assert.ok(
      lazy.includes('phase !== "done"'),
      "overlay must render while not done",
    );
    assert.ok(
      lazy.includes("meridian-spinner"),
      "must reuse the existing .meridian-spinner, not invent a new orb",
    );
  });

  it("orb clears on img load and on img error (fade, then unmount)", () => {
    assert.ok(lazy.includes('onLoad={() => setPhase("fading")}'), "load must fade");
    assert.ok(lazy.includes('onError={() => setPhase("fading")}'), "error must fade");
    assert.ok(
      lazy.includes('onTransitionEnd={(e) => {') &&
        lazy.includes('if (e.propertyName === "opacity") setPhase("done")'),
      "a single transitionend handler must unmount after the fade",
    );
    assert.ok(!lazy.includes("setTimeout"), "no timer chains anywhere");
    assert.ok(!lazy.includes("setInterval"), "no polling timers");
  });

  it("cached-complete image shows no lingering orb", () => {
    assert.ok(
      lazy.includes("img.complete") && lazy.includes("img.naturalWidth > 0"),
      "mount effect must check complete && naturalWidth",
    );
    assert.ok(
      lazy.includes('if (img.naturalWidth > 0) setPhase("done")'),
      "a complete image with a real bitmap skips the orb outright",
    );
  });

  it("overlay is aria-hidden, pointer-events none, adds no focus stop", () => {
    assert.ok(lazy.includes('aria-hidden="true"'), "overlay must be aria-hidden");
    assert.ok(
      css.includes(".hv5-lazy-orb") && css.includes("pointer-events: none"),
      "card orb CSS must set pointer-events: none",
    );
    assert.ok(!lazy.includes("tabIndex"), "no focus stops on the wrapper");
    assert.ok(!lazy.includes("<button"), "no interactive elements in the wrapper");
  });

  it("wrapper preserves each img's classes, src, alt and aria attributes", () => {
    assert.ok(
      lazy.includes("className ? `hv5-lazy-img ${className}` : \"hv5-lazy-img\""),
      "wrapper must carry the image's layout class",
    );
    assert.ok(lazy.includes('loading="lazy"'), "inner img stays lazy");
    assert.ok(lazy.includes('decoding="async"'), "inner img stays async-decoded");
    assert.ok(
      lazy.includes("aria-hidden={ariaHidden ? true : undefined}"),
      "decorative imgs keep aria-hidden, journal imgs keep none",
    );
  });
});

describe("home page wiring — exactly the six lazy sites, nothing else", () => {
  const sites = [
    '<LazyHomeImage className="hv5-pic" src={desertRuinsUrl} alt="" ariaHidden />',
    '<LazyHomeImage className="hv5-pic" src={patagoniaUrl} alt="" ariaHidden />',
    '<LazyHomeImage className="hv5-art" src={archiveToolsUrl} alt="" ariaHidden />',
    '<LazyHomeImage className="hv5-art" src={journalTreeUrl} alt="" ariaHidden />',
    '<LazyHomeImage className="hv5-art" src={binocularsHatUrl} alt="" ariaHidden />',
    "<LazyHomeImage src={journalImageUrl(note.image)} alt={note.imageAlt} />",
  ];
  it("all six home lazy images use the shared wrapper with exact attrs", () => {
    for (const site of sites) {
      assert.ok(gameApp.includes(site), `missing home site: ${site}`);
    }
  });

  it("no bare lazy <img> remains on the home page", () => {
    assert.ok(
      !gameApp.includes('loading="lazy"'),
      "every home lazy img must go through LazyHomeImage (which sets lazy itself)",
    );
  });

  it("Suspense fallback around HomeGlobe is untouched (fallback={null})", () => {
    assert.ok(
      gameApp.includes("<Suspense fallback={null}>"),
      "the globe-zone Suspense fallback must stay null",
    );
  });

  it("no other wait is touched: edition maps, stories, BootSplash unchanged", () => {
    const lazyUses = (gameApp.match(/<LazyHomeImage/g) || []).length;
    assert.equal(lazyUses, 6, "exactly six wrapper uses — no orbs anywhere else");
  });
});

describe("HomeGlobe — textured-state orb", () => {
  it("orb overlay renders inside the mount while !textured", () => {
    assert.ok(
      globe.includes("const [textured, setTextured] = useState(false)"),
      "textured state must default false",
    );
    assert.ok(
      globe.includes('<div ref={mountRef} className="hv5-globe-mount">'),
      "overlay must live INSIDE the mount div",
    );
    assert.ok(globe.includes("hv5-globe-orb"), "globe orb class must render");
    assert.ok(
      globe.includes("textured ? \"hv5-globe-orb hv5-globe-orb-fading\" : \"hv5-globe-orb\""),
      "textured must switch the overlay to its fading class",
    );
  });

  it("TextureLoader onLoad keeps its colorSpace/anisotropy work and fires onTextured", () => {
    assert.ok(globe.includes("t.colorSpace = THREE.SRGBColorSpace"), "colorSpace kept");
    assert.ok(globe.includes("t.anisotropy = 4"), "anisotropy kept");
    assert.ok(globe.includes("onTextured()"), "onLoad must fire onTextured");
    assert.ok(
      /function initGlobe\([\s\S]*?onTextured: \(\) => void/.test(globe),
      "initGlobe must accept the onTextured callback",
    );
  });

  it("orb fades via one transitionend handler, never a timer chain", () => {
    assert.ok(
      globe.includes('if (e.propertyName === "opacity") setOrbGone(true)'),
      "single transitionend handler must unmount the orb",
    );
    assert.ok(!globe.includes("setTimeout"), "no timer chains in home-globe");
  });

  it("fallback paths show the static disc with no orb, and teardown stays leak-free", () => {
    const fallbackStart = globe.indexOf("if (fallback) {");
    const mountReturn = globe.indexOf('<div ref={mountRef} className="hv5-globe-mount">');
    const fallbackBranch = globe.slice(fallbackStart, mountReturn);
    assert.ok(fallbackBranch.includes("hv5-globe-fallback"), "fallback branch renders the disc");
    assert.ok(!fallbackBranch.includes("hv5-globe-orb"), "fallback img has no orb");
    assert.ok(globe.includes("if (!disposed) setTextured(true)"), "disposed guard kept");
    assert.ok(
      globe.includes("{ rootMargin: \"200px\" }"),
      "the 390px IntersectionObserver gate is unchanged",
    );
    assert.ok(globe.includes('import("three")'), "three.js stays dynamically imported");
    const dynamicOnly = !/^import .*from "three"/m.test(globe);
    assert.ok(dynamicOnly, "three must not become a static import");
  });
});

describe("reduced motion + layout safety", () => {
  it("overlays declare no animation; the spinner's reduced-motion kill applies", () => {
    const orbRules = [
      ...css.matchAll(/\.hv5-(globe|laz[y])-orb[^{]*\{[^}]*\}/g),
    ].map((m) => m[0]);
    assert.ok(orbRules.length >= 2, "orb rules must exist in home-v5.css");
    for (const rule of orbRules) {
      assert.ok(!rule.includes("animation"), `orb rule must not animate: ${rule}`);
    }
    assert.ok(
      styles.includes("@media (prefers-reduced-motion: reduce)") &&
        styles.includes(".meridian-spinner"),
      "styles.css reduced-motion query must kill the spinner spin",
    );
  });

  it("globe overlay is opaque and the mount keeps its aspect-ratio box", () => {
    assert.ok(
      css.includes(".hv5-globe-orb") && css.includes("linear-gradient(180deg, var(--atlas-bg-1), var(--atlas-bg-2))"),
      "globe overlay must be opaque (hero gradient, not transparent)",
    );
    assert.ok(
      css.includes(".hv5-globe-zone") && css.includes("aspect-ratio: 1"),
      "globe zone keeps its aspect-ratio box (no CLS)",
    );
    assert.ok(css.includes(".hv5-globe-orb") && css.includes("transition: opacity 300ms"),
      "globe orb must crossfade via opacity transition");
    assert.ok(css.includes(".hv5-lazy-orb") && css.includes("transition: opacity 300ms"),
      "card orb must crossfade via opacity transition");
  });

  it("no new multi-dot orb design and no new image assets", () => {
    assert.ok(!lazy.includes("dot"), "no invented dot orb in the card wrapper");
    assert.ok(!globe.includes("dot"), "no invented dot orb in the globe");
  });
});
