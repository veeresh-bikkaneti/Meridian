/**
 * Why Learn page art (owner pick, 2026-11-13: "Go with the A+B blend").
 *
 * Two decorative stills, both ORIGINAL art generated for the Why Learn
 * mockups (docs/reviews/2026-11-13-nav-home-council/); no TV-show
 * imagery, characters, logos or footage, no religion or politics. Both
 * are decoration only: the montage is a CSS background and the hero is
 * an <img alt="" aria-hidden>. No motion. Both are hidden under the
 * high-contrast palette, prefers-contrast: more and forced colours
 * (styles.css, "Why Learn page").
 *
 * - why-learn-montage.webp — option A's sepia science montage
 *   (chalkboard equation, atom, planets, rocket, glassware) over pale
 *   hills. 1280×720, WebP lossy, 81,864 bytes (79.9 KiB). Shown faint:
 *   a 62% parchment veil plus a warm wash sit over it, so it reads at
 *   about 38% and no text sits directly on it.
 * - why-learn-hero.webp — option B's warm study scene for the A+B
 *   blend (desk, chalkboard, telescope). 1280×720, WebP lossy, 91,174
 *   bytes (89.0 KiB), cropped by the box with object-fit: cover.
 *
 * Encode: both files ship exactly as the mockup step encoded them. A
 * fresh pass at quality 82 from these files measured larger
 * (montage 91,096 B, hero 104,058 B) and would add a second lossy
 * generation, so neither was re-encoded. Budget: ≤ 80 KiB montage,
 * ≤ 90 KiB hero; a replacement must stay inside it.
 */
// The montage is a CSS background (styles.css, "Why Learn page"), so only
// the hero is imported here.
import heroUrl from "./why-learn-hero.webp";

export const WHY_LEARN_HERO_URL: string = heroUrl;
