# Decision memo: on-device AI for kids' story text (WI-5)

- **Date:** 2026-10-21
- **Status:** Decision requested from the owner (Veeresh). No code changed by this memo.
- **Code read:** `origin/main` at `4ef6875` (all file:line cites below are against that commit).
- **Not verified:** I did not run the app, did not run a real Gemini Nano model, and have no
  telemetry on how many kids actually have a model installed (the app records none). Anything
  about Chrome's model availability comes from the code's own comments, not from a test.

## 1. The short version

Meridian has **three** places where a Chrome on-device model touches what a child reads, not two.
The owner's description covers two of them. The third is the riskiest.

| # | What it does | Where | Filter | Cache |
|---|---|---|---|---|
| 1 | **Rewrites the hand-written story** on a hit card (any place that is not "blurb-only") | `src/components/game-app.tsx:778-805`, `3839-3863`, `src/game/rewrite.ts` | Only "no more than 2 `.`/`!`/`?` characters" and non-empty (`rewrite.ts:16-19`) | `meridian.story.<placeId>`, **no expiry** (`game-app.tsx:755-777`) |
| 2 | **Writes a new story sentence** for blurb-only places (about 116,000 of 124,690) from the model's own memory | `src/game/story-ai.ts`, called at `result-card.tsx:220` | Length, a short banned-pattern list, and "no scope-flip words" (`story-ai.ts:305-318`); **no grounding** because no source text is ever passed | `meridian.ai-story.v1.<id>`, 180 days |
| 3 | **Picks which sports teams** to show for a city | `src/game/sports-ai.ts`, called at `result-card.tsx:210` | JSON parse plus an allow-list: team must be in the 154-team roster, with its league, in the queried city | `meridian:sports-ai:v1:<id>`, 180 days |

**Recommendation: Option C.** Remove all runtime generation. Keep the curated text that already
ships. Grow coverage through the content pipeline, which has human review. Reasons, in one line
each:

1. Paths 1 and 2 break the card rule "No fabrication, ever - no LLM near place data" by design, not by accident.
2. Path 3 (sports) can never add anything the curated data does not already say; it can only drop a team. It has risk and no upside.
3. Nothing about a model-written sentence can be audited, reproduced, or recalled once it is on a child's device.
4. Everyone on Safari, Firefox, mobile, and in our E2E suite already plays the app without any of this.

## 2. What the code actually does

### 2.1 Where it differs from the owner's description

| Owner's description | What the code does |
|---|---|
| "Story rewrites and sports-team lookups" (two features) | Three features. The story **rewrite** (path 1) and the blurb-only **story generation** (path 2) are separate code paths with separate filters and separate caches. |
| "Filtered by regex" | Path 3 is filtered by an allow-list, not regex. Path 2 uses regex plus length. **Path 1 has no regex at all**: it only counts sentence-ending characters (`rewrite.ts:16-19`). |
| "Validated against team lists" | True for path 3 only (`sports-ai.ts:121-149`). Paths 1 and 2 have nothing to validate against at runtime. |
| "Cached for 180 days" | True for paths 2 and 3 (`story-ai.ts:501`, `sports-ai.ts:163`). **Path 1 is cached forever**, no timestamp at all (`game-app.tsx:759-777`). The original design doc says so on purpose: "Do not rewrite that place again on this device" (`docs/superpowers/specs/2026-09-28-state-editions-design.md`, "Story rewrite"). |
| "Sports-team lookups" | The model is woken for **every** generated (`gn-<digits>`) place, about 124,000 of them, not only the 53 cities in the roster (`sports-ai.ts:352-364`). For any city not in the roster, `validateAiTeams` returns `[]` (`sports-ai.ts:123-124`) and the empty result is cached for 180 days. The work is wasted and it is the same battery cost the code comment at `game-app.tsx:3852-3855` says it wants to avoid. |
| "No LLM near place data" (AGENTS.md, handbook 05 s2 and s6: "architectural, not aspirational") | The runtime contradicts this. The sports carve-out is documented ("approved 2026-10-01 for Big-5 team names only", `sports-ai.ts:3-5`). The story-ai header cites "Architecture decision (Veeresh, 2026-10-02)" (`story-ai.ts:4`). **I could not find the owner's own words for that 10-02 decision anywhere in the repo.** The handbook's own provenance rule (s7) says an uncited "owner decided" line is a review BLOCK. |
| README: rewrite uses "only the facts already written" (`README.md:126`) | Nothing enforces that. The prompt asks politely ("Do not add facts", `game-app.tsx:785-787`); the filter does not check it. |

### 2.2 Data flow

```
Hit or miss card mounts (ResultCard, only after reveal is done)
 |
 |-- useAiSportsTeams(place)      result-card.tsx:210
 |     gate: id looks like gn-<digits>   sports-ai.ts:352-353
 |     cache hit?  -> re-validate against roster, use it          sports-ai.ts:174-193
 |     else if Chrome model "available" -> prompt -> JSON -> allow-list -> cache (even [])
 |     result: REPLACES the baked "Home of the ..." sentence with the (sorted) subset
 |
 |-- useAiStory(place)            result-card.tsx:220
 |     gate: gn- id, not curated, no ladder fact, no history        story-ai.ts:579-586
 |     skipped when navigator.webdriver is true (E2E)               story-ai.ts:611
 |     cache hit?  -> show cached string AS IS (no re-validation)   story-ai.ts:522-537, 616-620
 |     else model "available" -> prompt (no source text) -> validate -> cache (even "")
 |     result: one extra sentence appended after the blurb, with a small "AI" badge
 |
 v
Hit card only, in game-app.tsx effect (phase === "story")          game-app.tsx:3839-3863
      authored = storyForBand(place, band)   <- the hand-written/pipeline story for the kid's age band
      shown immediately, then, unless story-ai owns this place:
      revealStory() -> cached rewrite (any string) or ask the model for a 2-sentence rewrite
      result: REPLACES the whole story text on screen, no badge
```

Other facts about the flow:

- **Who sees it.** Chrome only, and only where a model is already installed. The code never
  triggers a download (`story-ai.ts:42-43`, `sports-ai.ts:241-244`, `game-app.tsx:781-782`).
  Everyone else gets the baked text. That includes Safari, Firefox, mobile (per
  `sports-ai.ts:27-30`) and the Playwright browser, which exposes no model
  (`story-ai.ts:36-40`). So **none of the AI paths has any E2E coverage**; `tests/e2e/` has no
  reference to them except a CSS selector for the badge.
- **No consent, no flag, no age gate.** There is no setting, parental gate, or remote kill
  switch for any of the three paths. `src/lib/flags.ts:34` defines only `pwaUpdateToast`,
  `learningOutcomes`, `globeTierSplit`, and its rule is that defaults equal current production
  behaviour (`flags.ts:38-41`), so a flag for this would be fail-open (AI stays on if the
  flags file cannot be fetched). Today the only way to turn this off is a code change and deploy.
- **Ages.** All bands 5-13 get all three paths. The model's output is not adjusted for age.
- **Disclosure.** Only path 2 carries the "AI" badge (`result-card.tsx:109-114`, rendered at
  `492-497` and `602-608`): 10px text with a tooltip, which does not fire on touch and will not
  be read by a 5-year-old. Paths 1 and 3 change what the child reads with **no label at all**.
- **Prompt content.** Path 1 sends the authored story. Path 2 sends "Place: <name>, <region>"
  (`story-ai.ts:359`, label from `cityLabelForPlace`). Path 3 sends the same label inside
  quotes (`sports-ai.ts:262-268`). No child input, no pin position, no profile data goes into
  any prompt. The Wikipedia extract that would ground path 2 is **never passed**; the code
  comment says this was "accepted deliberately; the extract-fetch upgrade is a tracked
  follow-up" (`result-card.tsx:212-218`).
- **Determinism.** Both session helpers ask for `temperature: 0` and, if the browser rejects
  that, silently retry with defaults (`story-ai.ts:445-448`, `sports-ai.ts:288-291`). So output
  can be non-deterministic, and the model itself differs by Chrome version and device.

### 2.3 Read-aloud interaction

- The speaker button is on the **hit** card only (`result-card.tsx:445-468`) and speaks
  `baseStory` (`result-card.tsx:211`, `464`). That is the (possibly rewritten) story, **without**
  the path-2 sentence and **without** the path-3 sports override.
- Auto-play (ages 5-7 by default, or "always" if the kid chose it) speaks once per card and is not
  re-triggered when the text changes (`ReadAloudButton.tsx:142`, deps are `speakKey, mode,
  autoplay` only). The rewrite arrives asynchronously, so auto-play normally speaks the authored
  text while a later manual tap may speak the rewrite. I have not measured the timing.
- Result: what a young child **hears** and what they **see** can differ. The product promise is
  read-along (the locked line "The words are right here - read along with me",
  `ReadAloudButton.tsx:44`, shown when speech is unavailable). With AI on, the spoken words and the
  printed words are not guaranteed to match.
- `speechSynthesis` is described in the component as device-local. Whether the voice Chrome picks
  is local or network-backed I did not verify; worth a one-line check before we claim "nothing
  leaves the device" anywhere.

### 2.4 Things in the code that matter for safety

1. **Rewrite cache ignores age band.** The key is the place id only (`game-app.tsx:755-757`) and
   a cached string is returned without looking at what was authored (`rewrite.ts:8-10`). The
   card story is band-specific (`storyForBand`, `game-app.tsx:3850`), so a rewrite of an 11-13
   story can later be shown to a 5-7 profile on the same device (shared tablet, sibling, or a
   child who changes age setting).
2. **Rewrite filter is nearly empty.** A one-sentence preamble such as "Here is the rewrite:" or a
   one-sentence refusal passes (only more than two `.`/`!`/`?` characters is rejected). No length cap, no banned list, no check that
   numbers or elevation were not introduced. Card rule 2 ("never elevation or coordinates") is
   not enforced on this path. A side effect that is safe but wasteful: abbreviations like
   "St. Louis" or "D.C." push a legitimate rewrite over the limit and it is dropped.
3. **Path-2 story has no grounding.** With no source text, the prompt says "answer only from
   well-established facts you are sure about" (`story-ai.ts:353-355`) and the validator can only
   check length, the banned list, and flip words (`story-ai.ts:314-316`). The date, hedge, and
   word-grounding checks all need a source and are skipped (`story-ai.ts:307-313`). The
   named-after check is exported but never run (`story-ai.ts:29-32`). There is no check at
   all for violent, frightening, or otherwise age-inappropriate wording, and the prompt
   asks for "a memorable hook - a person, event, quote, movie, or record", which for many
   towns means a battle, a massacre, or a disaster.
4. **Story cache is not re-validated on read** (`story-ai.ts:522-537`), unlike the sports cache,
   which re-checks every entry against the roster (`sports-ai.ts:185`). If we ever tighten the
   validator, bad strings already on devices stay for up to 180 days.
5. **Sports AI can only subtract.** The curated sentence is already baked into the blurb at
   build time (e.g. Washington's blurb lists all five teams). The AI answer is accepted only
   if each team is in that same city's curated list (`sports-ai.ts:137`), so the best case is
   an identical line and the worst case is a line with a team missing. The roster was built from
   non-official fallback pages because the league sites were blocked
   (`src/game/data/sports-sources.md`, "League directories") and it flags at least one
   time-sensitive entry (Athletics).
6. **Empty results are cached for 180 days** in both story-ai and sports-ai, so a place that
   failed once on a device is never retried, even after Chrome updates the model.
7. **No audit trail.** Nothing records what was generated, on which model version, for which
   place. Observability (`docs/observability.md`) carries no AI events. If a parent reports a
   bad sentence, we cannot reproduce it or find out how many devices have it.
8. **Tests are stubs.** `story-ai.test.ts`, `sports-ai.test.ts`, `rewrite.test.ts` test the
   validators and hooks with fake model replies. There is no corpus of real model output and no
   test that a model reply is safe for a 5-year-old.

## 3. The options

The key to reading the tables: "fabrication" here means the card rule ("no LLM near place data").

### Option A. Keep as is

| Dimension | Assessment |
|---|---|
| **Child-safety risk** | **High** on paths 1 and 2, low on path 3. Concrete failure modes: (a) hallucinated history for obscure towns on ~116,000 cards, with nothing to check it against; (b) frightening wording (violence, disaster) with no tone filter; (c) preamble or refusal text shown as story (path 1); (d) prompt injection by place name: names come from GeoNames, a crowd-edited dataset, and go unescaped into the prompt (`story-ai.ts:359`). Path 3 is safe from this because only allow-listed team names can come out. Path 2 is not, and path 1's input is our own text but its output is unchecked; (e) filter bypass: path 1 has no filter beyond sentence count, path 2's list is six regexes plus a measurement regex; (f) cache poisoning: one bad string sticks for 180 days (path 2) or forever (path 1), is never re-checked, and cannot be recalled by us; (g) different kids see different sentences for the same place on different devices and model versions; (h) no audit trail, so no investigation and no number for "how many kids saw it". |
| **Conflict with "no fabrication"** | **Direct** for paths 1 and 2. Path 3 is within the carve-out, but adds nothing. |
| **Privacy** | Inference is on-device; the app sends nothing to a server for any of this, and prompts contain only a place label or our own story. Not true or not checked: it is not "no data stored", because model text is saved in `localStorage` on shared devices (school computers keep it between kids); Chrome's own model download and any Chrome-side handling of Prompt API usage is outside our control; and the voice used by read-aloud I did not verify. No new third party. COPPA: no personal information is collected by these paths, but the concern here is content a minor is shown, not data collected. |
| **Effort** | 0. Ongoing: someone must watch for bad outputs and there is no tooling to do so. |
| **Device impact** | Chrome desktop with a model only; battery and memory cost whenever the model wakes (up to twice per new place: sports query plus story query); a 30 s timeout each (`story-ai.ts:421`). |

### Option B. Restrict to sports-team lookups only

Remove paths 1 and 2. Keep path 3 (and, ideally, gate it to the 53 roster cities).

| Dimension | Assessment |
|---|---|
| **Child-safety risk** | **Low.** The model can only choose among 154 curated names; injection, scary wording and hallucination cannot reach the screen as free text. Residual: a correct team can go missing from the line; stale 180-day cache; no audit trail; unlabelled change. |
| **Conflict with "no fabrication"** | Low in letter (the carve-out covers it), but the principle is "no LLM near place data" and this is still a model near place data. And there is no benefit to defend: the AI cannot add a team the curated data lacks, so "AI-first" is a label, not a feature. |
| **Privacy** | Same as A, smaller surface (prompt is a city label only). |
| **Effort** | **About half a day to 1 day.** Delete `rewrite.ts`, `rewrite.test.ts`, `story-ai.ts`, `story-ai.test.ts`; remove `useAiStory`, `AiStoryBadge`, `AI_STORY_BADGE` use in `result-card.tsx`; remove the rewrite helpers and effect branch in `game-app.tsx`; add a roster-city gate in `useAiSportsTeams`; purge the two removed cache namespaces; update README/handbook; remove the `.ai-story-badge` CSS, `scripts/bounded-text-registry.mjs` entry, and its entry in `tests/e2e/result-card-overflow.mobile.spec.ts`. |
| **Device impact** | Smaller. Still Chrome-with-model only, still a model wake for a feature with no output the app lacked already. |

### Option C. Remove all runtime generation; use pre-written, human-reviewed text from the content pipeline

Delete paths 1, 2 and 3. The sports sentence stays as it is today: baked into the blurb by
`scripts/build-geonames-dataset.mjs` from `src/game/data/sports-notes.json` (that script reads
the JSON directly, so the data file and build stay). Blurb-only places keep their plain geography
blurb, which is deterministic (this is what every non-Chrome kid sees today). Coverage grows
only through the existing pipeline (Wikipedia merge, fact ladder, curated notes), gated by
`lint-cards.mjs` and Veeresh's sampling review.

| Dimension | Assessment |
|---|---|
| **Child-safety risk** | **Lowest.** Every sentence a child reads exists in the repo, went through the card gate, can be diffed in a PR, and is identical on every device. Failure modes left are the pipeline's own (a bad Wikipedia extract), which are reviewable and recallable by a deploy. |
| **Conflict with "no fabrication"** | **None.** It makes the handbook sentence true: "no LLM near place data". |
| **Privacy** | Strictly better. No model, no AI text in `localStorage`. After the one-time purge nothing AI-related is stored. Nothing new is sent anywhere. |
| **Effort** | **About 1 to 1.5 days** for one PR, including review and the gates. Files: `src/components/result-card.tsx` (hooks, imports, `AiStoryBadge`, composition at `210-227`, two render blocks), `src/components/game-app.tsx` (import `16-17`, types and helpers `483-486`, `722-805`, effect branch `3852-3863`; keep `setStory(authored)` so the age-band story still renders), delete `src/game/rewrite.ts`, `rewrite.test.ts`, `story-ai.ts`, `story-ai.test.ts`, `sports-ai.ts`, `sports-ai.test.ts` (`sports-ai.ts` is imported only by `result-card.tsx` and `story-ai.ts`; `sports-notes.json` stays), `src/styles.css` (`.ai-story-badge`), `scripts/bounded-text-registry.mjs`, `tests/e2e/result-card-overflow.mobile.spec.ts`, comments in `scripts/card-compose.mjs`, `README.md:97,126`, `docs/handbook/05-content-system.md`. Tests to add: a unit test that purges the three cache namespaces once and is idempotent; a guard test that fails if `LanguageModel` appears in `src/`; one Playwright spec that stubs `window.LanguageModel` with `addInitScript` and asserts the card text is unchanged and the stub is never called. Existing E2E specs are unaffected because the model never ran in them. |
| **Device impact** | Positive. No model wake, no 30 s timers, same experience on every browser. Lost: the AI sentence and rewrite for Chrome users who have a model installed (an audience nobody has measured). |

The honest cost of C: it does not give the ~116,000 blurb-only places a story. Their card stays
"X is a town in southern Khuzestan, Iran." The only way to give them real stories is the
pipeline, which today has 8,797 history hooks and 247 ladder facts (two region files) out of
124,690 places. That is a content-funding question, not a runtime one; see the follow-up in section 5 and question 7 in section 7.

### Option D (hybrid). Keep runtime AI, but behind a grown-up opt-in, grounded only

Default OFF. A grown-up switch in settings turns on a *labelled* rewrite and sentence. Story
generation only runs when a source extract is supplied and passes the full validator
(content-word grounding, hedges, dates). Sentence shown with a clear "written by AI" label,
spoken text matches shown text.

| Dimension | Assessment |
|---|---|
| **Child-safety risk** | **Medium.** Better than A (consent, grounding, labels) but a model still writes sentences a child reads. Grounding stops invented facts, not tone. It needs a tone filter we have not built, and it still has no audit trail. |
| **Conflict with "no fabrication"** | Still a conflict with the literal rule ("no LLM near place data"); needs the owner to amend rule 5. |
| **Privacy** | Grounding needs the Wikipedia extract at runtime. Either the browser fetches `en.wikipedia.org` for each place a child views (a new network request revealing the place and the child's IP to a third party, against "no new third parties") or we ship extracts in the bundle (size cost; the app already guards Safari memory budgets). On-device inference itself stays local. |
| **Effort** | **3 to 5 days**: settings UI and a parent gate (I did not check whether the app already has one), extract delivery, tone filter, label and read-aloud parity, new tests and E2E with a stubbed model. |
| **Device impact** | Same as A for those who opt in; none for everyone else. |

### Option E (hybrid). Draft with an LLM offline, human-review, ship as static text

An LLM (or a person with an LLM) drafts kid-friendly versions of verified extracts at build time;
a reviewer approves each batch; the approved text ships like any other pipeline text. Runtime has
no model.

| Dimension | Assessment |
|---|---|
| **Child-safety risk** | **Low to medium**, depending on review depth. Output is fixed, diffable, and recallable. Risk is review fatigue: at thousands of places, sampling (as for the 387 clue sets) is not the same as reading every card. |
| **Conflict with "no fabrication"** | Conflicts with rule 5 as written (and handbook s6: "no LLM drafting place facts"). Would need an explicit owner amendment. The pipeline today already reaches verbatim sentences without any LLM, so E is only needed if verbatim extracts are judged too hard for kids to read. |
| **Privacy** | Neutral for children (no runtime anything). Source extracts go to whichever model drafts them; that is a build-side choice and a new third party if it is a hosted model, so it fails "$0 and no new third parties" unless done by hand or locally. |
| **Effort** | **3 to 6 days** for the first batch (draft prompt, extractor, validator reuse from `scripts/facts-validate.mjs` as referenced at `story-ai.ts:26-27`, review queue, merge path) plus the owner's review time on every batch. |
| **Device impact** | None. Same as C. |

### Side-by-side

| | A. As is | B. Sports only | C. Remove, pipeline text | D. Opt-in grounded | E. Offline draft + review |
|---|---|---|---|---|---|
| Free-text a model can put in front of a child | Yes (2 paths) | No | No | Yes, opt-in | No |
| Matches AGENTS.md rule 5 as written | No | Arguable | **Yes** | No (needs amendment) | No (needs amendment) |
| Audit trail / recall | None | None | **Full (git)** | None | Full (git) |
| Same text on every device | No | Mostly | **Yes** | No | Yes |
| New third party | No | No | No | Likely (Wikipedia at runtime) | Possible (drafter) |
| Effort | 0 | 0.5-1 day | **1-1.5 days** | 3-5 days | 3-6 days + review |
| Loses today's AI sentence for Chrome users | No | Yes | Yes | Only if not opted in | Yes (replaced by static) |

## 4. Recommendation

**Choose C, in one PR, and treat B as a fallback only if the owner wants to keep a visible AI
feature for now.**

Why C rather than B:

- B keeps a path that cannot be better than doing nothing. The curated sports line is already
  on every card; the model can only match it or remove a team from it.
- B leaves the three open questions of any model-in-the-loop feature (consent, labelling,
  recall) unanswered, for no gain.
- The code needed to remove paths 1 and 2 is the same size as the code needed to remove path
  3 as well. Doing both is cheaper in review than doing one.

Why C rather than D or E:

- D and E both need the owner to amend rule 5, and D adds a runtime network call to a third
  party or a bundle-size cost. E adds a hosted-model dependency unless it is done locally or by hand.
  Neither is needed to protect kids today. Both stay available later; C does not close the door.
- C is the only option that makes the sentence in AGENTS.md, handbook 05 and the README true as
  written.

What C costs, plainly: Chrome users with a model installed stop seeing the AI sentence and the
two-sentence rewrite. Nobody has measured that group, and it is not the audience the app is
designed for (kids on tablets and school devices, many of whom are not on desktop Chrome).

## 5. Migration and rollback plan for C

**Before the PR (owner, 10 minutes):** confirm the decision (section 7, Q1-Q3).

**PR 1: "Remove runtime on-device AI" (about 1 to 1.5 days)**

1. Branch from `main`; add `BRANCH_STATUS.md` per AGENTS.md.
2. Remove the three call paths and delete the files listed in Option C. Keep
   `setStory(authored)` in the `game-app.tsx` effect so the age-band story still shows.
3. Add the one-time purge: on boot, remove keys starting `meridian.story.`,
   `meridian.ai-story.v1.`, `meridian:sports-ai:v1:`, then set a marker (for example
   `meridian.ai-purge.v1`) so it runs once. Note `meridian.story.` does not match the
   unrelated `meridian.storyteller.*` keys (checked: the dot after "story" separates them).
   Wrap in try/catch like the rest of the storage code.
4. Add the guard test and the stubbed-model E2E spec (Option C, effort row).
5. Update `README.md:97,126`, `docs/handbook/05-content-system.md` (s2, s6), and the
   `scripts/card-compose.mjs` comments, so docs match the deployed build. Record in the PR that the
   2026-10-01 sports carve-out and the 2026-10-02 story-ai decision are superseded.
6. Run all gates from AGENTS.md: `npx tsc --noEmit`, `npm test`, `node scripts/lint-cards.mjs`
   (GATE PASSED), `npm run build:pages`, Playwright against the built artifact.
7. Manual check in a Chrome that has a model: hit card and miss card show the baked text only; no
   "AI" badge; read-aloud text equals on-screen text; DevTools shows no `LanguageModel` calls.

**After merge:** no data migration is needed beyond the purge (all AI text is regenerable and
nothing else depends on it). Check that the purge marker is set on one real device.

**Rollback:** `git revert` of the single PR restores all three paths exactly (the code stays in
history). Caches would simply re-fill. Because removal lowers risk, there is no automatic
rollback trigger; revert only if the owner decides AI is wanted back, and then use Option D's
safeguards instead of the old behaviour.

**If the owner wants a pause before deciding:** there is no safe switch today (see 2.2: no flag,
and a flag would default to on). The smallest safe interim is the PR itself.

**Follow-up (separate work item):** raise pipeline coverage so blurb-only places gain real
stories: more Wikipedia merges and ladder facts, with the existing validators and Veeresh's
sampling. This is where "history first" gets served for those cards.

## 6. What I would watch for in review

- That the guard test really would fail on a re-introduced `LanguageModel` reference.
- That `result-card.tsx` still composes `baseStory` plus the baked sports sentence unchanged.
- That nothing else imports `geonameIdOf` / `cityLabelForPlace` from `sports-ai.ts` (today only
  `story-ai.ts` and `result-card.tsx` use that module; checked with `git grep`).
- That purge runs before the first card renders but never blocks boot.

## 7. Owner decision needed

| # | Question | My default |
|---|---|---|
| 1 | Approve **Option C**: remove all three runtime AI paths (rewrite, blurb-only story, sports override)? | Yes |
| 2 | If not C, is **B** (sports only) acceptable, knowing it adds nothing the curated line lacks? | Prefer C |
| 3 | Treat the 2026-10-01 sports carve-out and the 2026-10-02 story-ai decision as **superseded**, and update README and handbook to match? | Yes |
| 4 | Purge AI text already cached on kids' devices (one-time)? | Yes |
| 5 | Provenance: do you have your own words/date for the 2026-10-02 "Wikidata primary, on-device runtime fallback" decision? I could not find them in the repo, and handbook s7 asks for them. | Add to PR description if you have them |
| 6 | Allow **E** (offline LLM drafting with human review) in future? It needs rule 5 amended. | No, not now |
| 7 | Fund pipeline coverage for the ~116,000 blurb-only places as the replacement for runtime AI? (priority and who reviews) | Yes, as a separate work item |
| 8 | Optional: do you want a one-line check that read-aloud voices are local, before we describe the app as "nothing leaves the device"? | Yes |
