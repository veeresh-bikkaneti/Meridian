# Contracts — how parallel streams connect without waiting

**Owner of this file:** the integrator. Streams build against these shapes from
day one. These are interfaces I1 to I5 (not the C3 social-studies
framework). A stream that needs a change asks the integrator; the integrator
changes this file on main, and every stream picks it up by merging main.
Until the owning stream merges, copy the shape into your own folder as
`contracts.local.ts`, then switch to the real import and delete the copy.

## I1. Subject module (owned by `feat/phase0-shell-split`)

Each subject lives in its own folder and is discovered automatically, so
adding one never edits a shared file.

```ts
// src/subjects/<id>/index.ts  (default export)
export type SubjectModule = {
  id: string;                     // folder name, e.g. "math-number"
  title: string;                  // owner copy: TODO until approved
  groups: AgeGroup[];             // which of the three groups it serves
  released: boolean;              // true once a playable slice exists (owner rule, Nov 13: release progressively); educator review runs alongside
  units: UnitItem[];              // I2 data
  load: () => Promise<{ default: React.ComponentType<SubjectProps> }>;
};
export type SubjectProps = { group: AgeGroup; tier: MotionTier; onExit: () => void };
// src/subjects/registry.ts: import.meta.glob("./*/index.ts"), lists released only.
```

## I2. Unit item (every subject)

```ts
export type UnitItem = {
  id: string;                     // "<subject>:<unit>:<item>", stable forever
  group: AgeGroup;
  objective: string;              // "After this, a child can … shown by …"
  standard: { code: string; source: string } | "UNVERIFIED";
  why: string;                    // the real problem that opens it (why first)
  buildsOn: string[];             // UnitItem ids, any subject
  useElsewhere: string[];         // settings from the map's web
};
```

Review-deck entries for a subject item use the item id. Wiring subject items
into `src/game/review-deck.ts` is integrator-only; until then, a subject
records misses in its own module state.

### I2b. Subject item (Phase 3, math first) — contract change

`UnitItem` above stays the projection screens read. The validated record
behind it is `SubjectItem`: the `UnitItem` fields plus its answer,
provenance, media rules and lead policy. Canonical for math:
`src/subjects/math/items.ts` (`MATH_RECORDS`, `SubjectItemSchema`); the
old `answers.ts` is a thin compatibility projection for one release.

```ts
// AnswerEntry is the shared answer shape (src/subjects/shared/answer.ts):
// one question, its correct choice, a one-line derivation, an optional
// numeric value, an optional kind ("choice" default, "number" typed),
// and one optional follow-up question.
export type SubjectItem = UnitItem & {
  answer: AnswerEntry;              // the question, correct choice, derivation
  provenance: "UNVERIFIED" | { source: string; verifiedOn: string }; // YYYY-MM-DD
  media: { id: string; kind: "clip" | "still"; revealsAnswer: boolean }[];
  leadPolicy: "answer-not-in-lead"; // the lead (why) never contains the answer
};
```

For math: provenance is `UNVERIFIED` for all 53 records (no verifiedOn
date exists for these rows), media is `[]` for all 53 (math carries no
clip or still ids today), and leadPolicy is `answer-not-in-lead` for every
record. A build-time validator (`src/subjects/math/validate.ts`, run from
`prebuild`) parses every record and fails on a missing answer, an answer
in the lead, an unknown media id, or a stored current year. Other subjects
adopt `SubjectItem` in their own PRs; until then they keep `UnitItem` plus
their own answers module.

## I3. Age group (owned by `feat/age-groups`)

```ts
export type AgeGroup = "7-10" | "10-18" | "18+";
export function getAgeGroup(): AgeGroup;  // from src/game/age-profile/
```

Until it merges, map the current bands locally: `5-7` and `8-10` to `7-10`,
`11-13` to `10-18`.

## I4. Predict-then-see scene (owned by `feat/science-definitions`)

```ts
// src/scenes/predict-see/types.ts
export type MotionTier = "full" | "lite" | "flat";
export type PredictSeeScene = {
  id: string;
  prompt: string;                 // the question the child predicts
  choices: string[];              // tap targets, no drag needed
  rule: { cause: string; effect: string; source: string };
  mount: (el: HTMLElement, tier: MotionTier) => Promise<{ play: (choice: number) => Promise<void>; dispose: () => void }>;
};
```

three.js is loaded with a dynamic `import("three")` inside `mount`, disposed
on exit, and paused when the tab is hidden. The Flat tier draws a 2D
equivalent with the same rule.

## I5. Journal clip (every journal)

```json
{ "id": "<journal>:<clip>", "group": "7-10", "objective": "", "standard": "UNVERIFIED",
  "why": "", "place": { "lat": 0, "lon": 0, "name": "" },
  "file": "public/videos/journals/<journal>/<clip>.mp4", "captions": "<clip>.vtt",
  "retrieval": { "question": "", "answer": "" } }
```

Optional `stretch` (owner, 2026-11-10): one extra question for an older group,
asked after the retrieval check, on the same clip. Clips without it stay valid.

```json
"stretch": { "group": "18+", "question": "", "answer": "", "fact": "<fact id in sources.md>" }
```

The stretch group is older than the clip's own group, and its answer follows
from a sourced fact in that journal's `sources.md`. It never needs a new video.

Each journal keeps its entries in `public/videos/journals/<journal>/manifest.json`.
The integrator merges them into `public/videos/journal-manifest.json`.
