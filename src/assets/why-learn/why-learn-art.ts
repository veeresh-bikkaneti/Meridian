/**
 * Why Learn page art (owner pick, 2026-11-13: "Go with the A+B blend";
 * owner checklist t352u: no biology anywhere).
 *
 * Two stills, both ORIGINAL art generated for the Why Learn mockups
 * (docs/reviews/2026-11-13-nav-home-council/); no TV-show imagery,
 * characters, logos or footage, no religion or politics, and no biology
 * (the mockup's DNA helix was repainted out of both: a pendulum and a
 * prism in the hero, a prism in the montage). Potted plants are room
 * decor only. No motion.
 *
 * - why-learn-montage.webp: pencil-and-sepia science montage (atom,
 *   planets, E = mc², a² + b² = c², flask, rocket, prism, telescope,
 *   gears, pocket watch) over pale hills. Decorative: a CSS background
 *   only (styles.css, "Why Learn page"), never focusable, no alt. Shown
 *   faint under a 62% parchment veil plus a warm wash (≈ 38%), so no
 *   text sits directly on it. 1280×720, WebP lossy quality 70, method 6,
 *   78,624 bytes. Budget ≤ 80 KiB.
 * - why-learn-hero.webp: warm study scene (chalkboard, flasks, atom
 *   model, pendulum, prism, telescope at a window). Content image with
 *   the alt text below; above the fold, so loaded eagerly. Fixed aspect
 *   ratio per breakpoint in CSS, width/height attributes set, so no
 *   layout shift. 1280×720, WebP lossy quality 82, method 6, 125,678
 *   bytes. Budget < 250 KB.
 *
 * Both are hidden under the high-contrast palette, prefers-contrast:
 * more and forced colours. A replacement must stay inside the budgets
 * and the content rules above.
 */
import heroUrl from "./why-learn-hero.webp";

export const WHY_LEARN_HERO_URL: string = heroUrl;

export const WHY_LEARN_HERO_ALT =
  "Illustrated study desk: a chalkboard reading E = mc² and a² + b² = c², glass flasks, an atom model, a swinging pendulum, a prism casting a rainbow, and a telescope by a window with a rocket in the evening sky.";
