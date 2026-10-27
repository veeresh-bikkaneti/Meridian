# Journal spec — "What the land remembers" (rotating catalog notes)

Status: SPEC for implementation on `feat/homepage-premium-v5` (base:
`origin/main` @ `6cd3bc3`, which already contains the merged PR #158 v5
homepage). Commissioned by Liz, 2026-10-16: "Journal rotates through 106
real catalog notes, three at a time, every 2 hours. The page switches to
the next set on its own." Plus her citation requirement (2026-10-16):
"These specs should provide citation and confidence vote on facts
describing."

> **Amendment — Journal consolidation, Phase 2 (2026-10-16,
> owner-approved, plan Q1).** The original text of this spec described
> a full-viewport overlay / dialog journal view. **That description no
> longer matches what ships.** The host that actually ships is main's
> inline journal section — `<section id="home-journal">` in
> `src/components/game-app.tsx` — and the v2 overlay is not carried:
> there is no dialog/overlay, and no focus trap, Esc-close, or
> focus-return machinery. Sections 5, 6, and 8 below were therefore
> rewritten for the inline host in the consolidation. Everything else
> is carried verbatim from the v2 text, except the §1 generator output
> path, which the port retargeted (see §1). The §8 fake-timer
> unit-test requirement is **not** weakened by the §8 rewrite — see
> §8 for how it is now satisfied.

## 1. Dataset — verified facts

- Source of truth: `PLACES` in `src/game/catalog.ts` — the game's curated
  catalog. **Counted first-hand on 2026-10-16: exactly 106 places, and all
  106 carry both a curated `story` and a `source` ({label, href}).** Liz's
  figure of 106 is confirmed exactly; nothing is padded or invented.
- Dataset rule: the journal dataset = every catalog place with a non-empty
  `story` AND a recorded `source`. A place missing either is **excluded**
  and the generator prints it in its report (today: 0 excluded). This is
  the honest no-citation rule: no source → not published in the journal.
- Generator: `scripts/build-journal-dataset.mjs` (Node, no deps) parses
  `catalog.ts` and emits `src/components/home-journal.data.ts` (generated, committed;
  header names the generator + the regeneration command). Re-running it
  must be byte-stable for unchanged catalog input. A unit test imports
  `PLACES` directly and asserts the generated dataset matches it field
  for field — generation drift fails the suite.
- Catalog `source: src("label", "href")` calls may be wrapped across
  lines (#200): the generator's parser accepts a line break anywhere
  whitespace may appear inside the call — after `src(`, before or after
  the comma, and before `)`. This matters because a formatter pass
  (`.prettierrc` sets `printWidth: 100`) can rewrap a long call into
  exactly that shape; an older one-line-only parser silently dropped
  such a place from the dataset. A `src(` call that is present but
  still unparseable (for example, single-quoted arguments) is not a
  §1 exclusion: the generator fails loudly, naming the place, instead
  of dropping it.
- Note record (one per place): `placeId`, `title` (= place `name`),
  `ring`, `geography` (label from §2), `story` (**verbatim** from the
  catalog — light formatting only, zero invented facts; card content rule
  #5 applies), `citation` {`label`, `href`} (verbatim from place
  `source`), `confidence` {`tier`, `basis`} (computed by §4).

## 2. Geography

A set's shared geography is the catalog `ring` — the game's own geography
tier. Labels (factual for every member, verified against the entries):

| ring | label | places |
|---|---|---|
| `lincoln` | Lincoln, Nebraska | 29 |
| `region` | Lincoln Region, Nebraska | 14 |
| `nebraska` | Nebraska | 19 |
| `usa` | United States | 19 |
| `world` | The World | 25 |

## 3. Sets and rotation

- **Set formation:** within each ring, in catalog order, chunk into
  triples. Pure-geography sets: lincoln 9, region 4, nebraska 6, usa 6,
  world 8 = **33 sets / 99 notes**.
- **Remainder rule (106 = 35×3 + 1), stated exactly:** ring leftovers in
  ring order (lincoln 2, region 2, nebraska 1, usa 1, world 1 = 7 notes)
  form remainder sets of 3, then 3, then **1**: sets R1, R2 (mixed
  geography, labeled "Field Notes", each note keeping its own geography
  eyebrow so no false shared-geography claim is made) and R3, a single
  final note. Totals: **36 sets; 35 full triples + 1 single; every note
  appears exactly once per cycle.**
- **Rotation order:** pure sets in ring order (lincoln → region →
  nebraska → usa → world), then R1, R2, R3.
- **Window:** 2 hours (7,200,000 ms). Current set index =
  `floor(Date.now() / 7_200_000) mod 36` — derived from the wall-clock
  epoch, so every visitor sees the same set in the same window with no
  server state. Full cycle = 36 × 2h = **72 hours (3 days)**.
- **Auto-switch while open:** a timer set for the next window boundary
  recomputes the index when it fires; returning to a visible tab
  (`visibilitychange`) recomputes immediately. No reload, no polling
  loop shorter than the boundary timer (a 30 s safety interval is
  acceptable to survive timer throttling).

## 4. Citation + confidence vote

Every note carries its catalog citation and a **confidence vote computed
mechanically by the generator from the citation's URL host** — never
hand-assigned, never an LLM judgment:

| tier | rule (on `citation.href` host) | basis text | count today |
|---|---|---|---|
| `verified` | host ends in `.gov` or `.edu` | "Government or university source" | 49 |
| `cited` | any other recorded source (encyclopedia or the place's own / an organization's site) | "Named source recorded in the catalog" | 57 |
| `uncited` | no source recorded | — | 0 (excluded by §1) |

Reproducibility: given the catalog, anyone can recompute every vote with
the rule above; the dataset unit tests assert tier counts and spot
values. Display (§5) always shows the tier **as a word**, never by color
alone.

## 5. Surfaces

*Amended in the consolidation (see the amendment note at the top):
the original overlay / dialog description of this section no longer
matches what ships and is replaced by the inline host below.*

- **Home Journal card** (existing v5 card, design unchanged): eyebrow
  "Latest Journal Entry", title "What the land remembers", the existing
  subcopy, and one added quiet line naming the current set:
  `Now showing: {geography} · {n} field notes` (for remainder sets:
  `Now showing: Field Notes`, no count). **READ THE ENTRY is a real
  button** that scroll-jumps to the inline journal section and moves
  focus to it. The nav **JOURNAL** button likewise is a real button
  and uses the same scroll-jump + focus to the section.
- **Inline journal section:** the journal lives in the home page
  itself, as `<section id="home-journal">` in
  `src/components/game-app.tsx`, labelled by its title and carrying
  `tabIndex={-1}` as the scroll-jump focus target. There is **no
  dialog/overlay** — no `role="dialog"`, no `aria-modal`, no close
  button, and nothing to open or close. Content: eyebrow `Journal`,
  title "What the land remembers", the set's geography line, then the
  set's notes in order, each: a storybook-art figure first (all 106 notes
  carry art since 2026-10-17 — wave 2, PR #169, illustrated the remaining
  103; art integrates only through `scripts/journal-art-manifest.json` +
  the dataset generator, never hand-edited), note title (heading),
  its geography eyebrow (e.g. `Lincoln, Nebraska`), the story
  paragraph, and a source line: the citation label as an external
  link (`href` from the catalog, new tab, `rel="noopener noreferrer"`)
  followed by the confidence as text —
  `Confidence: Verified — government or university source.` /
  `Confidence: Cited — named source recorded in the catalog.`
  Footer line: `Entry {k} of 36 · Next entry in {h:mm}` (plain text).
- **The citation link is the only per-note link.** No in-app place
  navigation is invented; the catalog defines no such handler from the
  home screen.

## 6. Accessibility of auto-rotation

*Amended in the consolidation (see the amendment note at the top):
the original blockers in this section named the overlay; the inline
host's blockers below replace them.*

- No `aria-live` region announces rotation; the countdown is plain text
  updated at most once per minute.
- **Content is never swapped under focus:** if the window boundary
  passes while focus is inside the home Journal card, **or inside the
  inline journal section**, the new set is computed but **not applied**
  until focus leaves both the card and the section. A screen-reader
  user is never yanked mid-read.
- Deferral is **focus-only** (owner ruling Q3): a reader who is merely
  scrolled to the section, without focus inside the card or the
  section, is not a blocker, and a swap can still occur under them at a
  window boundary. That residual is accepted as disclosed; it is not
  coded against.
- Reduced motion (`prefers-reduced-motion`): set changes are instant —
  no crossfade or other transition is applied — and the card/nav
  scroll-jumps to the section are likewise instant.
- The confidence marker is text (§4); any icon/color is decorative
  redundancy only.
- Keyboard: READ THE ENTRY and nav JOURNAL are native buttons; both
  scroll to the inline section and move focus to it. There is no
  dialog, so there is no focus trap, no Esc close, and no
  focus-return machinery.

## 7. Failure / empty states

The dataset is static and bundled; there is no fetch and no runtime
empty state. If the generated dataset were empty (a build-time data
failure), the selector returns no current set and the card renders its
previous inert presentation; unit tests pin dataset non-emptiness so
this cannot ship silently.

## 8. Required tests

*Amended in the consolidation (see the amendment note at the top):
the E2E surface below is the inline section, not a view. The unit
fake-timer requirement is **not** weakened by this rewrite — it stays,
and it is now satisfied, as stated in the unit bullet.*

- Unit: window→set-index derivation (deterministic; boundary values;
  same instant → same index on any client), set formation + remainder
  rule (36 sets, sizes 35×3+1, ring purity of the 33, every place
  exactly once), confidence rubric (tier counts 49/57/0 + spot checks),
  dataset-vs-catalog integrity (all fields traceable), auto-switch
  timer behavior with fake timers, focus-deferral of swaps. The
  fake-timer requirement is satisfied by unit-testing the wiring
  mechanism itself: `createJournalRotation` in
  `src/components/home-journal.ts` is exercised with an injected fake
  timer host and a fake clock (boundary timeout applies the next set
  and reschedules; the 30 s safety interval catches a missed/throttled
  boundary; a swap is deferred while focus is inside the section and
  while focus is inside the card, under the
  `shouldApplySetChange({ focusInsideCard, focusInsideSection })`
  predicate; no swap occurs inside one window; `stop()` clears both
  timers). The home component drives exactly that controller — its
  `visibilitychange` and `focusin` listeners call its `recompute()` —
  so the unit tests pin the production mechanism, not a copy of it.
- E2E (adapted spec, `tests/e2e/journal.spec.ts`, run under the
  `journal` Playwright project): the current set renders **inline** in
  the `#home-journal` section — the card's now-showing line, the
  section's geography header, the set's notes (3, or the set's size)
  with per-note confidence lines and dataset-exact citation hrefs, and
  the `Entry {k} of 36` footer; READ THE ENTRY scrolls to the section
  and focuses it; with the browser clock mocked forward 2h the set
  advances on its own without a reload; focus inside the section
  defers a swap until focus leaves; the 1-note remainder set renders
  as "Field Notes". There is no view to open, no Esc close, and no
  focus return to test — that machinery does not exist on the inline
  host.

## 9. Out of scope

Per-place journal pages, in-app navigation from a note to the game map,
search, and any change to the other UNMAPPED items (ABOUT, search).
