# Branch status — feat/build-kanban

## Capsule

Outcome: a hidden, flag-gated live Kanban page at /kanban
showing all 45 handover work items in five columns, with
baseline gauges and a live GitHub overlay that moves cards
as branches and PRs change state. Done condition: the page
renders all 45 cards at 320x568, 390x844, 768x1024 and
1280x800 in the real shell; the overlay puts PR 571's card
in In progress against live GitHub; offline or rate-limited
falls back to the snapshot with a visible "snapshot from
<date>" label; the free-to-claim filter returns no two cards
with overlapping owns; check:entry-size stays under
323,865 B; noRawIo stays at 45.

Base: origin/main 5930e9304bccb9eb38db7ce57bd04698c416be61.
Tier 2, cap 400k tokens (shared lead + helpers).
Owner rulings 2026-11-23: new page (Option A mockup, in the
handover zip), route /kanban, brand lockup home control,
hidden (buildKanban flag, noindex, no sitemap, no nav or
footer link), snapshot per deploy + live overlay.

## Facts (measured on this base)

- cards.json (zip, verified against this main by the owner)
  has 45 cards with exactly six fields: lane (display
  string), col, title, links [{label, href}], evidence
  (prose), dep (prose). Columns: Backlog 19, Blocked 14,
  Done 11, In review 1, In progress 0. Lanes: Architecture
  23, Tech debt 15, Product 7. There is NO id, prompt,
  owner, owns or blockedBy field; prompt numbers live in
  titles ("(prompt 01)") and dep prose; PRs and branches
  live in links hrefs (/pull/N, /tree/<branch>).
- Baselines on this base (parsed): noRawIo 45,
  noUpwardImport 129, shell-ban 14 — the mock's gauge
  values exactly.
- Flags: a flag is a FlagName union member + a
  FLAG_DEFAULTS entry in src/lib/flags.ts, read via
  isEnabled(); prod default-off is `false` in defaults.
- Routes are TanStack file routes: createFileRoute with
  ssr: false and a head() for meta (board.tsx pattern);
  board sets no noindex (it IS indexed) — kanban adds its
  own robots meta and stays out of the static
  public/sitemap.xml.
- Live-feed pattern (src/board/live-feed.ts): snapshot is
  the fallback, the feed upgrades it only when it proves
  itself; getRaw from the transport port; one fetch
  sequence per load, shared in-flight promise, one retry,
  session cache (its TTL is 10 min; the brief sets 5 min
  for kanban — deliberate, recorded here).
- scripts/board/ precedent: refresh-snapshot.mjs refreshes
  the /board snapshot manually (not prebuild-wired);
  publish-kanban.mjs follows the same shape.
- Shell: SiteHeader/SiteFooter/PageColumn in
  src/components/ui; the home control is BrandHomeButton
  ("Meridian home"); hv5 tokens are --hv5-* in
  src/components/home-v5.css; the mock's CSS uses the same
  hexes under local names — the port uses the real tokens.
- Motion budget (src/board/card-animations.tsx): at most
  1 moving window on phones / 2 on desktop, everything else
  shows its end pose; Calm mode and prefers-reduced-motion
  get the still version; animation never carries
  information.

## Seed transform (narrow reading, recorded)

The brief's card schema (id, prompt, owner, owns, pr,
branch, dependsOn, blockedBy) is richer than the source.
The seed extracts only what is structured in the source —
nothing is invented:
- id: slug from the title (deterministic; see Arena).
- pr / branch: parsed from links hrefs.
- prompt: parsed from the title's "(prompt NN)" or dep
  prose where present; otherwise null.
- owner: the lane (the only ownership signal in the
  source); lane also maps to the brief's slugs
  (tech-debt | architecture | product).
- dep prose is preserved verbatim in depText; dependsOn
  (card ids) stays empty — the prose names prompts and
  rulings, not cards, and resolving it would be curation,
  not extraction.
- owns stays empty for every card: the source holds no
  structured paths (evidence mentions files in prose;
  mining prose for paths would fabricate ownership). The
  schema and the free-to-claim filter fully support owns;
  filling it is a follow-up curation pass.
- blockedBy: for col = Blocked cards, the dep prose (it
  states the ruling or wait); otherwise null.

## Statechart

Page states: flag-off (route renders nothing / not-found
behaviour as other gated routes) → loading (bundled
snapshot renders immediately) → live (overlay applied;
cards that moved animate FLIP to their new column) →
snapshot-fallback (overlay failed, offline or rate
limited: snapshot stays, "snapshot from <asOf>" label
visible). Overlay per card: PR merged → Done; PR closed
unmerged → Backlog + note; PR open and ready → In review;
PR open draft → In progress; no PR but branch exists →
In progress; otherwise the snapshot column. Filters are
pure views over the current columns: lane segment (All /
Tech debt / Architecture / Product with counts) and
Free to claim (Backlog + every dependsOn Done + owns
disjoint from every In progress card's owns).

## Architect — layer per file, import direction

| File | Layer | Imports |
| --- | --- | --- |
| src/routes/kanban.tsx | shell (6), may import anything | flags (2), build-board view (lazy) |
| src/lib/flags.ts | domain (2) | one added line only |
| src/build-board/kanban-data.ts | feature (5) | transport port (3), storage slot via ../game/storage-slot.ts (2) — the live-feed precedent; never src/board/** (cross-area) |
| src/build-board/kanban-view.tsx, gauges.tsx | feature (5) | ui shell (4), kanban-data, hv5 tokens via CSS |
| src/build-board/kanban.json, kanban.css | data / styles | — |
| scripts/board/publish-kanban.mjs | build script | reads eslint baselines + kanban.json, writes public/build-board.json and refreshes kanban.json's gauges/asOf (refresh-snapshot shape) |
| tests: src/build-board/kanban-data.test.ts, tests/e2e/kanban.spec.ts | test (arch-exempt) | — |

## Arena — card identity

- Slug-from-title: self-describing in diffs, tests and dep
  references; survives reordering and insertion between
  deploys. Cost: a retitle renames the id (loud, swept in
  one edit).
- Array index (the mock's model): zero invention, cannot
  collide. Cost: inserting or reordering a card silently
  re-keys every later card — stored references and dep
  indices point at the wrong items without any error.

PICKED: slug-from-title. The board is a living document
other agents key work on; silent re-keying is the failure
mode it exists to prevent, while a rename is loud and
grep-able. The seed transform asserts slug uniqueness over
all 45 cards and fails loudly on a collision. The mock's
index was a mock shortcut, not an owner ruling.

## Status

- Shell-ban gauge is 15 on this branch, not the mock's 14: the new route owns its <main> and is baselined in pageLocalMain exactly like src/routes/board.tsx; the publish script counts it live, so the gauge is honest on this branch.
- Fact-find, K1 (seed + publish script + data module + unit
  test), K2 (flag + route + view) and K3 (live overlay +
  Playwright spec) done. K3 notes:
  - kanban-live.ts mirrors live-feed's discipline (transport
    port, one retry of a network error only, shared in-flight
    check, whole-check fallback to null) with the brief's
    5-minute session cache; the view FLIPs only cards whose
    column changed (mock's 650 ms / easing), skipped under
    prefers-reduced-motion, and the stamp reads
    "live · checked <time>" only after a completed check.
  - Two K2 gaps the full unit suite caught, fixed in K3:
    shell-registry entries for routes/kanban.tsx and
    build-board/kanban-view.tsx, and /kanban added to
    static-wellknown's NOINDEX_ROUTES (it must stay out of
    the sitemap — the opposite ruling from /board's).
  - Gates: tsc clean; npm test exit 0 (scripts 1,254 /
    src 3,316, 0 fail); lint:arch clean; build:pages ok;
    entry 323,370 B of 323,865. Playwright kanban.spec.ts
    4/4 locally (four viewports, snapshot fallback label,
    fixture-live PR 571 → In progress, free-to-claim).
- Open questions: none for the owner at this point.

## Graph

For the integrator to fold in at merge (branches never edit
graph.json):

- Node: `branch:feat/build-kanban` (this branch).
- Edges: the branch `depends-on` the transport port and the
  flags module on main, and `relates-to` PR #571 (its card
  is the overlay's worked example).

## Round 2 (2026-11-23, prompt 11, REQUEST CHANGES on #574)

Tier 2, cap 400k, estimate 180k. New commits only on
feat/build-kanban (head db1caef8); main still 5930e930.
Fixes: (1) overlay moves a card only via a `closes` PR or
a `work` branch, forward-only (rank Backlog = Blocked <
In progress < In review < Done); per-number pulls/{n}
lookups for closes PRs on not-Done subtasks, branches
paginated; fixtures recorded in the pack prove the counts
(round-1 rule gives 18 Done, truth 11). (2) Snapshot per
deploy: publish-kanban.mjs joins prebuild/prebuild:pages,
refreshes only gauges.now + builtAt in the public file,
validates the v2 envelope, never rewrites kanban.json at
build. Choice: STOP committing public/build-board.json
(+ .gitignore line) — it is a build artifact regenerated
every deploy; a committed copy can only go stale, which
was the round-1 failure. (3) Shell-ban back to main's 14
(baseline + frozen test reverted byte-for-byte); page
renders in PageShell, no page-local <main> anywhere;
missing <main> landmark is Phase 2 / prompt 03's gap,
noted in the PR body, not fixed here. (4) Board scrolls
inside its own container wherever 5 columns don't fit;
page never scrolls sideways (e2e asserts at 5 viewports).
(5) Schema v2 seed verbatim: 18 stories hold the columns
(rollup computed in code), 45 subtasks inside, plain
titles, role-labelled links, free-to-claim on subtasks
(18 on the snapshot, hotFiles excluded). (6) Gauges show
cleared-since-start from gauges.<name>.start; buttons
>= 44 px; Calm toggle in component state only, motion
registry mirrored in src/build-board/ (no src/board
import). Statechart additions: page data states are now
bundled-snapshot -> public-snapshot (fetched, labelled)
-> live overlay (labelled), any failure keeps the last
good snapshot with the "snapshot from <date>" label.

## Round 2 (PR #574 review fixes)

Fixes 1–6 done: (1) overlay forward-only — a live column
replaces the snapshot column only when it ranks higher;
(2) snapshot per deploy — the bundled kanban.json stays
the offline fallback, publish-kanban.mjs writes the
per-deploy public snapshot at build, public/build-board.json
is gitignored and no longer committed; (3) shell-ban back
to 14 — shell-ban-baseline.json and shared-shell.test.ts
are byte-identical to main again (no baseline growth);
(4) no horizontal overflow at 768; (5) stories with
subtasks — 18 stories / 45 subtasks, human-readable
titles, prRole closes/ref; (6) gauges read the snapshot's
gaugeInfo and all buttons meet the 44px target.

Gates (final run on the round-2 tree): tsc PASS;
npm test PASS (scripts 1,243 pass / 0 fail of 1,254,
src 3,332/3,332); test:worker 239/239 PASS; lint-cards
PASS; build:pages PASS; lint:nav PASS; lint:subjects
PASS; lint:arch PASS (noRawIo 45, layer-baseline
untouched); check:entry-size PASS (323,392 B of
323,865); check:provenance NOT RUN locally — the local
diffing repo has no origin refs ("cannot read
origin/main..HEAD"), CI arbitrates.

Live-data run against real GitHub (parseGithubPull /
parseGithubBranches / applyOverlay on the bundled
snapshot): PR #571 is open + draft; Done stories 2,
architecture Done subtasks 11, and PR #571's subtask
(arch-ports.game-app) holds In review — the forward-only
rule keeps the draft PR from pulling it back to
In progress. Screenshots taken at 320, 390, 768, 1280.
