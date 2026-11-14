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
 *   model, pendulum, prism, telescope at a window). The hero still
 *   until the montage below replaced it in the slot (2026-11-13);
 *   kept as the pre-montage art. 1280×720, WebP lossy quality 82,
 *   method 6, 125,678 bytes.
 *
 * Both are hidden under the high-contrast palette, prefers-contrast:
 * more and forced colours. A replacement must stay inside the budgets
 * and the content rules above.
 *
 * ── The montage film (2026-11-13 brief: feat/why-learn-montage) ──
 *
 * The hero slot now carries a short montage film instead of the
 * hero still above: the two approved mockup directions blended —
 * the five subjects in picker order, with Newton's laws, g,
 * Kepler's orbits and the stars folded into the physics beats.
 * The film replaces ONLY the hero strip at the top of the picker
 * card; nothing else on the page carries it. The hero still file
 * stays in this folder as the pre-montage art (no longer imported).
 *
 * The film and its poster live in public/videos/ (served as
 * files, never bundled), so a re-cut ships by replacing those two
 * files — the paths below are the only pointers. Facts of the
 * shipped asset, measured on the delivered file:
 *   why-learn-montage.mp4 — 608×1280 (portrait), 10.0 s, 24 fps,
 *     H.264 + AAC audio, 5,153,559 bytes. The hero box is a wide
 *     strip, so the portrait frame is centre-cropped by the
 *     slot's object-fit: cover — a landscape re-cut is the fix if
 *     the owner wants the full scenes.
 *   why-learn-montage-poster.webp — the film's frame at 1 s,
 *     WebP quality 82, 108,616 bytes. It is the <video> poster
 *     AND the still shown under prefers-reduced-motion or when
 *     the film fails to load, so the slot never sits empty.
 * The film's audio is the song track (an original, fast,
 * list-driven theme in the TV science-theme style, written for
 * this card). It starts muted — browsers block audible autoplay —
 * and the hero's sound toggle unmutes it. The words are audio
 * only: no lyric text is rendered anywhere on the page.
 */
export const WHY_LEARN_MONTAGE_PATH = "videos/why-learn-montage.mp4";

export const WHY_LEARN_MONTAGE_POSTER_PATH = "videos/why-learn-montage-poster.webp";

export const WHY_LEARN_MONTAGE_ALT =
  "Montage still: a red bridge truss in front of a chalkboard reading a² + b² = c², with triangle diagrams headed Stability in Triangles.";
