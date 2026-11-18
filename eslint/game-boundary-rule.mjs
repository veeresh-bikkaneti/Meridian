/**
 * Layering: game never depends on subjects (PR #533 fix round).
 *
 * Mistake class: the "Start over" reset composition
 * (src/game/reset-history.ts, first-load bundle) imported the
 * per-subject progress store's clear-all from
 * src/subjects/shared/, making src/game depend on src/subjects —
 * the first import in that direction, and one that drags the
 * lazily-loaded picker store toward the entry chunk. The shared
 * pieces (the store key, the storage resolution, the clear-all)
 * now live in src/game/subject-progress-store-key.ts, and
 * src/subjects/shared/subject-progress.ts imports and re-exports
 * them from there: subjects depend on game, never the reverse.
 *
 * This block keeps the boundary: the core no-restricted-imports
 * rule, scoped to src/game/**, rejects any import path that
 * crosses into a subjects/ tree. The firing proof lives in
 * scripts/game-boundary-rule.test.mjs.
 */
export const gameBoundaryConfig = {
  files: ["src/game/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "**/subjects/**",
              "../subjects/**",
              "../../subjects/**",
              "../../../subjects/**",
              "../../../../subjects/**",
            ],
            message:
              "src/game must not import from src/subjects — subjects depend on game, never the reverse. Move the shared code under src/game (see src/game/subject-progress-store-key.ts).",
          },
        ],
      },
    ],
  },
};
