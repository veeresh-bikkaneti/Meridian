# Branch status — phase3/gk-journals

## Capsule

Outcome: general-knowledge and journals items become literal,
validated `SubjectItem` records in each subject's `items.ts`,
in the exact shape chemistry already uses (math's schema,
never forked), each with a `validate.ts` that runs at build.
Done condition: both subjects' projections (units + answers)
deep-equal their frozen pre-move fixtures; item counts
unchanged (GK 10 live ids, journals 16 live ids); both
validators appended to `prebuild` and `prebuild:pages` (GK
first, then journals); all §9 gates pass; no player-visible
change.

Base: `origin/main` 7c04e3a7992b33ac8c98b86a85d4b25861048c47.
Tier 2, cap 400k tokens (shared lead + helpers).

The plan named in the brief (phase-3-content-projection.md)
is not present in the repo; this slice follows the brief plus
the three prior phase-3 records (math, physics, chemistry
branch-status files) and the chemistry tree itself.

## Facts (re-run on this base)

- Chemistry pattern: freeze old exports to
  `__fixtures__/main-<sha>.json` BEFORE editing; generate
  records into items.ts by script from the frozen exports
  (never retyped); answers.ts becomes a compat projection of
  the records; the JSON adapter stays for non-live rows;
  validate.ts mirrors the previous subject's and is appended
  to both prebuild lines; records.test.ts = validator
  rejections + fixture equality (units and answers, deal
  order separate). [fact-find, this branch's evidence pack]
- GK today: adapter over docs/scaling/general-knowledge/
  items.json (17 rows); 10 live ids; 9 static answers + the
  opera-years answer computed at play time
  (`operaYearsEntry(year)`, opened 1973) with a matching
  computed scene (`operaSceneForYear`). No validate.ts,
  records.test.ts, or __fixtures__ yet.
- Journals today: adapter over 4 clips.json files (14 rows);
  16 live ids including derived `:stretch` items; NO static
  answers — `journalAnswers(year)` builds the whole answer
  record from a year argument; no scenes.ts (captions
  instead); the journal manifest check
  (scripts/validate-journal-manifest.mjs) already runs in
  prebuild and stays untouched.
- package.json prebuild tails today end math → physics →
  chemistry validators; social-studies has none on main yet
  (its append is in flight in another PR — conflict fix at
  integration: take main's line, re-append this slice's two).
- Baseline entries inside the two folders: GK 11, journals 8.
  Chemistry's migration removed ZERO of its entries (the
  compat answers and the registry type import were kept
  deliberately). This slice removes only entries that
  actually die, and only inside its two folders.
- Provenance for every record is UNVERIFIED (no dates exist;
  never invent one); media is [] as in the done subjects;
  known giveaway leaks are carried as KNOWN_GIVEAWAY_CASES so
  the validator and lint:subjects agree.

## Statechart (one item's road through this slice)

- adapter-only (today: rows in JSON, answers static or
  computed in answers.ts)
- → frozen: the subject's current units + answers are dumped
  to `__fixtures__/main-7c04e3a7.json` before any edit (the
  equality oracle; journals answers frozen at a pinned year
  recorded in the fixture)
- → recorded: a literal SubjectItem for the item exists in
  items.ts and passes validate.ts (schema, answer present,
  duplicate id, giveaway incl. follow-ups, media ids, no
  stored year)
- → projected: units + answers derive from the records and
  deep-equal the fixture. Every live item must reach
  projected; nothing ships half-moved.

## Architect — layer per file, import direction

All files sit in their subject folder under src/subjects/
(feature layer, same as chemistry's). Imports mirror
chemistry's exactly:

| File | Change | Imports (direction: down/across to shared + math, as chemistry) |
| --- | --- | --- |
| general-knowledge/items.ts | records added; adapter kept | ../registry.ts (types, kept deliberately), ../math/items.ts (schema + types), docs JSON |
| general-knowledge/answers.ts | becomes compat projection | ./items.ts, ../shared/answer.ts, ../shared/years.ts (only if a computed entry still needs it) |
| general-knowledge/validate.ts | NEW | ./items.ts (+ shared lint-mirror helpers as chemistry's does) |
| general-knowledge/records.test.ts | NEW | ./items.ts, ./answers.ts, ./validate.ts, fixture |
| general-knowledge/__fixtures__/main-7c04e3a7.json | NEW | — |
| general-knowledge/scenes.ts, index.ts, Case | unchanged | — |
| journals/items.ts | records added; adapter + captionRefFor kept | same shape as GK |
| journals/answers.ts | year-parameterised projection over records; `journalAnswers(year)` signature preserved | ./items.ts, ../shared/answer.ts, ../shared/years.ts |
| journals/validate.ts | NEW | ./items.ts |
| journals/records.test.ts, __fixtures__ | NEW | as GK |
| journals/captions.ts, caption-files.ts, index.ts, Case | unchanged | — |
| package.json | prebuild + prebuild:pages appends only | — |
| eslint/layer-baseline.json | only this slice's dead lines inside the two folders, if any | — |

## Arena — how computed answers fit the records pattern

- Proposal A (records hold the static truth, generators fed
  by the records): every live item gets a record; computations
  keep their signatures and read their inputs (anchor years)
  from record data. Its homework: of journals' 16 answers,
  only two truly depend on the current year, two are fixed
  gaps between stored dates, twelve are literals. Weakest
  point, by its advocate's account: for computed items the
  validator checks inputs, not outputs.
- Proposal B (records only for genuine statics, computed
  stays code beside the records): GK would get 9 records and
  opera stays a code-generated item; journals prompts embed
  the year itself ("It is ${year} now"), so a literal record
  would freeze a falsehood. Weakest point, by its advocate's
  account: two subjects end with a permanent asterisk, and a
  pinned-year assertion is weaker than a validated literal.

PICKED: A, amended by B's honesty rule. Every live item gets
one validated record (the goal's own words), but a record
holds only static truth: anchor years live as data where the
existing schema honestly holds them, otherwise as the named
constant beside the generator — the schema is never forked
and nothing year-dependent is ever typed as a literal.
Generators stay code, keep their exact signatures, and are
fed by the records. validate.ts therefore tells both
truthful stories: the records validate, and at a pinned year
every live id's projected answer exists and is well-formed.
Fixture equality at the pinned year is the byte-for-byte
proof (answering A's weakest point); no item hides in a side
channel (answering B's).

## Status

- Both subjects built (fixture freeze first, records test
  RED first, records generated by script from the frozen
  data) and verified at integration: both validators print
  valid (10 + 16), subject suites 37/37, layer-baseline test
  5/5 with NO baseline changes (every import that had an
  entry is still there — chemistry's precedent held).
- GK opera: the record carries the generator's specimen at
  the lint pin year (2091); the projected answer is always
  computed by operaYearsEntry at play time, pinned in
  records.test.ts against the generator at 2026 and at 2091.
- Journals computed answers: the 2 year-gap entries are
  template records ({year}/{years} placeholders, no stored
  year); anchor years stay named constants in answers.ts
  beside the generator (the schema has no honest field for
  an anchor); the generator re-fills templates byte-exactly
  and still moves with the clock (2030/2050 pinned in
  journals.test.ts).
- package.json: both validators appended to prebuild and
  prebuild:pages, GK first, then journals.
- Gates and panel run at integration (see the PR body).

## Graph

For the integrator to fold in at merge (branches never edit
graph.json):

- Node: `branch:phase3/gk-journals` (this branch).
- Edges: the branch `depends-on` the chemistry/math records
  pattern (src/subjects/chemistry/, src/subjects/math/).
