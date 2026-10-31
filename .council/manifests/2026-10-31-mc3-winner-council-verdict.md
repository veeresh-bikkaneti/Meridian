# COUNCIL CONSENSUS MANIFEST — mc3 Compact Links + Winner Declaration (GOVERNING DESIGN DELTA)

- **Convened:** 2026-10-31, by the owner's order ("convene a council of experts with gaming expertise, frontend UI/UX, and game studio, and show me the final verdict").
- **Process:** repo `AGENTS.md` constitution + `docs/ops/agent-council-protocol.md`. Chair sign-off below. Findings bucketed Act On / Consider / Noted / Dismissed (§9).
- **Status: SIGNED — this manifest GOVERNS.** It supersedes the build run's internal Phase-1 delta (`~/workspace/meridian-link-winner/MANIFEST-DELTA-DRAFT.md`, committed `b37f4ab` on `feat/challenge-mc3-codec`) wherever the two differ. Everything in the mc2 manifest (`.council/manifests/2026-10-28-challenge-all-editions.md`) stands except as amended here and there.
- **Design only.** No code was written by this council. Execution tokens in §10 bind the held build run (Op 4) when the owner releases it.
- **Grounded at:** origin/main `5e5a440`. The candidate Package A code on `feat/challenge-mc3-codec @ f438ce8` is **inventory, not verified work** (§8).

## Seats + persona provenance (files loaded verbatim from `~/.codex/agents/`)

| Bench | Seat | Persona file |
|---|---|---|
| 🎮 Gaming | Game Designer | `game-designer.toml` |
| 🎮 Gaming | Level Architect | `level-designer.toml` (file name disclosed; bench title is the owner's) |
| 🎮 Gaming | Game Economy | `economy-designer.toml` |
| 🎮 Gaming | Narrative | `narrative-designer.toml` |
| 🎨 UI/UX | UX Architect | `ux-architect.toml` |
| 🎨 UI/UX | UX Researcher | `ux-researcher.toml` |
| 🎨 UI/UX | UI Designer | `ui-designer.toml` |
| 🎨 UI/UX | Frontend Developer | `frontend-developer.toml` |
| 🎨 UI/UX | Inclusive Visuals (**veto holder, Q4 motion**) | `inclusive-visuals-specialist.toml` |
| 🎨 UI/UX | Accessibility Auditor | `accessibility-auditor.toml` |
| 🏭 Studio | Studio Producer | `studio-producer.toml` |
| 🏭 Studio | Technical Architect | `senior-developer.toml` — **nearest-match disclosed**: no web-stack "technical architect" file exists in the packs (`unity-architect` is engine-specific) |
| 🏭 Studio | Reality Checker | `reality-checker.toml` |
| ⚔️ Adversarial | Systems & Type Architect | `software-architect.toml` (fresh instance, adversarial chair; an earlier instance authored the candidate's §2) |
| ⚔️ Adversarial | Behavioural & Blast-Radius | `behavioral-nudge-engineer.toml` (file name as shipped; covers the behavioural half exactly — the blast-radius half was brief-assigned, disclosed) |
| ⚔️ Adversarial | Security & Red-Team | `penetration-tester.toml` |

Disclosed overlaps: game-designer, ux-researcher, and software-architect instances also sat on the build run's internal council; every seat here was a fresh instance ruling on the candidate as evidence, and the internal council's one contaminated report (premised on a nonexistent "PR #289") was **not** re-used — this council's Security seat attacked the real tree.

## Settled going in (not re-litigated)

Winner design **A is adopted** (owner, 2026-10-29, `~/workspace/meridian-challenge-winner/COUNCIL.md`): sender score in the link, target = best-so-far shown as a goal at start, in-game verdict, king-of-the-hill pass-along, attempts carried. mc1 frozen forever; mc2 decode-forever. No server — links are self-contained, offline-forever, zero-cost. Hand-drawn character animation is banned for this feature (owner rejected 3 prototypes); verdict motion = UI elements only. Forgery of a link score is an **accepted risk** (social stakes, honor system) — the design's job is plausibility gates + disclosure + non-amplification, never the word "verified". Two amendments to A were adopted by this council on concrete evidence and are **flagged for the owner in §9** (farming guard; attempts display narrowed) — either falls if he strikes it.

---

## Q1 — Codec v3 · ✅ RATIFIED as amended (binary mc3; amendments A1–A7 are governing)

Binary-packed base64url stands — no rival came within ~70 chars (numeric JSON ≈ 140+; base85 saves only ~20%). The owner's Nebraska specimen: mc2 payload **274 → mc3 52** (open) / **62** (with winner block); full URL 324 → ≈101 / ≈111 (Reality Checker: byte math VERIFIED).

- **A1 — Varint definition corrected (Systems, Act On; the candidate's text was wrong).** Canonical LEB128 = shortest form. A non-final `0x80` group is **normal** (`rad 128 = 80 01`); the overlong marker is a **multi-byte varint whose final group is `0x00`** → `format`. Field caps restated honestly: a 2-byte varint tops at 16,383 (the candidate's "≤ 65535 in 2 B" was unreachable).
- **A2 — Parse bound stated (Systems, Act On).** All field walks are bounded by the **pre-seal region** `bytes[0 .. len−4)`; the exact-length check compares the walk's end against `len−4`. No field may borrow seal bytes.
- **A3 — Region = explicit registry, varint index (Level Architect + Systems, Act On; replaces positional derivation).** The region field is a **varint ≤ 2 B** (1 B for every index < 128 — all of today's, so lengths are unchanged) indexing an **explicit slug↔index registry in `challenge.ts`**: frozen, append-only, indices never reassigned or reused. State-edition entries record their **parent-country slug**; decode resolves an index only within its parent. Consequences: `regions.ts` may re-sort freely (the candidate's positional coupling + drift-guard deadlock die here); guards become (i) every registry slug resolves via `findRegion`, (ii) no-shrink/no-reorder snapshot. An index ≥ the receiver's registry length fails `region` — see A6.
- **A4 — mc3 gets its own save slot (Technical Architect, Act On; the candidate was silent and unsafe).** mc3-origin challenge saves persist **only** under the new key `meridian.run.mc3`, never read by pre-mc3 builds (mirrors the mc2 precedent: a rolled-back build reading an mc3 save from the mc2 slot would silently drop the winner block on re-share — the downgrade the origin rule forbids). mc3 builds read mc3 → mc2 → mc1 slots in order; the normal-run slot is untouched. Absent winner fields = no target; **partial/malformed winner fields on a save = fail-closed discard of that challenge save**. Flag-off clears all challenge slots (the shipped rule), sparing the normal run — but **not** the attempts store (§Q2-B3).
- **A5 — uint24 tripwire (Systems, Consider → Act On).** A guard test asserts the catalog's maximum GeoNames id < 2²⁴; a dataset refresh crossing it turns the test red deliberately instead of truncating an id at encode time.
- **A6 — Failure-copy classes completed (Systems + Security + Accessibility, Act On).** (i) A **well-formed unknown-version** fragment (prefix `#c=mc<digits>.` + canonical base64url body) on a newer build shows the version failure whose **heading itself** is "This challenge needs the newest Meridian." — a heading distinct from the corrupt-link heading (screen-reader users identify failures by heading; Accessibility Auditor). (ii) An mc3 `region` failure from registry skew (post-seal, so not corruption) maps to the same version-remedy class. (iii) A malformed mc3 keeps the corrupt-link failure. Reasons stay internal.
- **A7 — The old-build story, corrected on evidence (Reality Checker, Act On).** The candidate claimed a pre-v3 build shows the resend remedy for an mc3 link. **False:** a pre-v3 build special-cases only `#c=mc2.`; an mc3 fragment falls to the mc1 decoder, fails `format`, and shows only the bare title **"Could not load this challenge."** — no remedy line exists on that path (`game-app.tsx` boot dispatch at `5e5a440`). The governing mitigation stack is therefore: (1) the creation-text version line (§Q3 — load-bearing, not decoration), (2) the in-app version remedy on builds that have it (A6), (3) nothing retro-changes on old builds. The manifest records this honestly; no surface may claim otherwise.

**Seal wording (Security, Act On).** The 4-byte FNV-1a-32 seal is a **corruption layer** — it catches truncation, chat mangling, and blind edits. It is recomputable by anyone and is **not** an integrity layer or a MAC; no document or surface may call it one. Likewise the exact-length rule prevents **accidental** downgrade only: a deliberate editor can strip the W bit and reseal (erasing a mark from their own chain view) — accepted under the forgery doctrine, and the wording must never claim more.

**Decode gate order (mc3; mc1/mc2 untouched):** type + fragment length (> 127 chars → `tooBig`) → prefix dispatch → canonical base64url decode (failure → `format`) → minimum length (24 B) → **seal** over all-but-last-4 bytes (mismatch → `format`) → reserved bits (`version`) + edition code (3 → `edition`) → scoring byte vs receiver's `SCORING_VERSION` (`scoring`) → radius varint walk within the pre-seal bound → region resolution (`region`; skew → A6 remedy class) → radius envelope + ±10% binding (`radius`; globe exactly 750; state [25,160]; country [40,450] — Reality Checker VERIFIED against the shipped code) → count + ids (5–10, uint24, no zero, no duplicates) → winner block iff W (§Q2 gates) → exact end-of-body at `len−4`.

### The exact v3 field layout (`#c=mc3.` + base64url, canonical, unpadded; fragment ≤ 127 chars)

| # | Field | Size | Rule |
|---|---|---|---|
| B0 | flags | 1 B | bits 7–6 edition (0 globe, 1 country, 2 state; 3 → `edition`); bit 5 = W (winner block present); bits 4–0 reserved, must be 0 (nonzero → `version`) |
| B1 | scoring version `s` | 1 B | must equal receiver's `SCORING_VERSION` (else `scoring`) |
| — | radius `rad` | varint ≤ 2 B | whole km; binding above |
| — | region index | varint ≤ 2 B | §A3 registry, per edition (globe → 0); unknown → `region` |
| — | count `n` | 1 B | 5–10 (else `format`) |
| — | ids | n × 3 B | uint24 BE GeoNames numbers; 0 invalid; duplicates → `format` |
| — | **winner block, iff W** (actor-labelled per §Q2-B2: the first three fields are the **sender's**; `bestScore` is the chain's) | | |
| | `senderMask` | 2 B | uint16 BE; bit (15−i) set ⟺ the **sender** landed inside the circle on stop i; bits ≥ n must be 0 (else `format`) |
| | `senderScore` | varint ≤ 3 B | the minter's score |
| | `bestScore` | varint ≤ 3 B | best score so far on this route, chain-wide |
| | `senderAttempts` | varint ≤ 2 B, 1–255 | §Q2-B2 semantics; encoder saturates at 255 |
| last | seal | 4 B | FNV-1a-32 over all preceding bytes, uint32 BE, full width — corruption layer (§Q1 wording) |

Decoded type is a **discriminated union**: `winner: { senderScore, senderMask, senderAttempts, bestScore } | null`. No caller may read a target from optional fields.

## Q2 — Winner fields · ✅ RATIFIED as amended (packing stands; gates, actors, and stores corrected)

- **B1 — Sequential plausibility bound replaces flat 415n (Game Economy, Act On; proven from `scoring.ts`).** The flat bound `n × 415` is sequentially unattainable (stop 1 caps at 278; the all-tier-5 sequential ceiling at n=10 is **3,340**, not 4,150 — 810 points of impossible headroom). Governing gates, all `format` failures, derived from `scoring.ts` constants (never literals): let `boundᵢ = 0` on a miss, else `min(PLACE_SCORE_CAP, round(100 × 2.5 × comboForStreak(kᵢ))) + REGION_BONUS`, where `kᵢ` = consecutive hits ending at stop i in play order. (i) `senderScore ≤ Σ boundᵢ` over the **sender's** mask; (ii) `bestScore ≤ Σ boundᵢ` over the all-hits mask — define `routeCeiling(n) = Σ boundᵢ(all-hits)` (n=10 → 3,340); (iii) `bestScore ≥ senderScore`; (iv) **`bestScore ≥ 1`** — a zero target is rejected at decode (Systems, Act On: W=1 with all-zero scores otherwise passes every gate and a caller can conflate "target 0" with "no target"; symmetrically, **the encoder never mints W with best 0** — an all-miss completion chain-starts as an open route); (v) `senderAttempts ∈ [1,255]`; (vi) mask bits ≥ n → `format`. **Tripwire:** a unit test drives the synthetic maximum route through `scorePlace` itself and asserts equality with `routeCeiling(n)` — a scoring change re-derives this section in the same PR, like the `SCORING_VERSION` tripwire. Residual truth (Economy, recorded): a full-mask forgery at the ceiling still passes — indistinguishable from perfect play; that is the accepted honor-system risk, contained by disclosure, not by gates.
- **B2 — Actors separated (Systems, Act On; the candidate conflated two players in one block).** `senderScore`, `senderMask`, `senderAttempts` attest the **minter of this link**; `bestScore` attests the chain. `senderAttempts` = **completions of this route (edition + region + ordered ids) by the sender, on their device, including the completion that minted this link** (a completion = reaching the completion screen; walking away is not a completion). Copy consequences are binding in §Q4: attempts may only ever be attributed to the sender's mark, never to "the best" — when `senderScore < bestScore`, the crown-holder's tries are unknown and no surface may state a number for them. No separate first-try bit: "in one go" ⟺ `senderAttempts === 1`. The verdict's bar is always `bestScore`; the sender is the duel (colour), never the bar; no surface declares a win against the sender.
- **B3 — Attempts store (Technical Architect, Act On; replaces the candidate's fingerprint-hash-in-the-save-family).** Own key `meridian.challenge.attempts.v1`, keyed by the **canonical tuple** `s|edition|region|ordered ids` (no hash — collisions impossible; a scoring bump namespaces counts automatically). Cap **512 entries, LRU eviction on write**. **Flag-off does NOT clear this store** (it is longitudinal, earned in normal play too — the candidate's "clears with them, no wider" claim was wider than stated); **Reset-my-history clears it**. A summary exact-route mint counts uniformly: `attempts = storedCount(route) + 1`, then stored.
- **B4 — Farming guard ⚠️ AMENDS ADOPTED A (Behavioural & Blast-Radius, Act On; Chair adopts, owner may strike).** A player's **3rd-or-later completion of the same route tuple cannot raise `best'`** at pass-along minting (`sender'` still updates; the receipt still tells the truth). Rationale: an unconditionally rising crown makes re-sending the easiest familiar route the optimal play — crown-farming inverts the learning loop (repo invariant: learning wins) and accelerates the ratchet-death risk A itself recorded. One line in the verdict's tertiary facts keeps it honest where it binds (§Q4).
- **Mask: INCLUDE stands** (Game Designer, Level Architect, UX, Security-with-fixes vs Systems' DROP). New disposition of the old argument: once actors are separated (B2), the mask coherently attests the **sender**, gate B1(i) binds the sender's score to the sender's own mask, and the strip is the **duel strip** (§Q4) — judged against the sender, never the crown. Hardening adopted from Security: the attested row is **visually distinct** (hollow dots, labelled as the friend's word) and the disclosure **repeats on the verdict screen** — as drafted, the ratchet would propagate a forged crown chain-wide while the strip wore measured-looking glyphs and the only disclosure sat on the welcome card. Systems' DROP dissent is recorded in §9 and the **Package B panel re-hears it with the built strip** (standing precedent from the internal council).

## Q3 — Human-readable layer · ✅ RATIFIED as amended (readability lives in the message + welcome card, never the payload)

- **In-URL readability: REJECTED, again on merits** (no seat revived it): a slug is a second, unauthenticated region claim that can disagree with the sealed one; word encodings cost more chars than the body they replace. ❌ Dismissed.
- **Version-warning conflict: SETTLED (UX Researcher + Narrative concur; Chair adopts).** Creation texts carry the warning; receipts carry none; the old suffix is retired everywhere. The winning line names the app and the requirement in plain words — load-bearing because of §A7 (an old build gives a first-hop receiver **no** guidance at all).
- **Attempts clause removed from all receipts** (Behavioural amendment, §Q4 display ruling): the k=1-brag / k>9-hide asymmetry only ever printed the number when it flattered. Receipts below are final.
- **Welcome card = grouped blocks** (UX Architect amendment): Context (title → fairness → task) / Stakes (one goal card) / Action (map row → disclosure → Start / Not now). The flat 8-line stack is not shipped. Attempts appears **nowhere** on the welcome card (§Q4).

### Byte-exact copy deck — share texts (Narrative seat owns the words; `{…}` are substitutions)

Fresh route (creation, no target):
```
Challenge a friend! 🎯 {n} places · {Region} · {rad} km circle. Same places, same circle for everyone.
(Link opens in the Meridian app — newest version.)
{url}
```
Exact route with target (summary mint):
```
🎯 I scored {sender} on this {Region} route — {n} places, {rad} km circle. Beat that! Same places, same circle for everyone.
(Link opens in the Meridian app — newest version.)
{url}
```
Pass-along receipts (no version line, no tries clause, **no margin number in a loss receipt** — the verdict screen carries margins):
- WIN: `I BEAT IT 🎯 — {mine} on your {Region} route. Best is now {best'} — beat that!`
- HOLD: `DEAD HEAT 🤝 — {mine} on your {Region} route. Target stays {best'} — come and take it.`
- NEAR-MISS: `SO CLOSE 🎯 — {mine} on your {Region} route. The target's still out there — passing it on!`
- LOSS: `IT GOT ME 🎯 — {mine} on your {Region} route. Better luck to the next player — passing it on!`
- Chain-start (no incoming W): `🎯 I scored {mine} on this {Region} route — beat that!`

Fact order for every creation text: score hook → "{n} places · {Region} · {rad} km circle" → fairness line (locked byte-exact: `Same places, same circle for everyone.`) → version line → link alone on the last line. The retired suffix `(Opens in the newest Meridian.)` is used **nowhere** in mc3-era texts.

### Byte-exact copy deck — welcome card (W present; no-W welcomes keep today's lines in the same grouped order, fairness second)

1. Title (unchanged): `A challenge from a friend!`
2. Fairness (locked): `Same places, same circle for everyone.`
3. Task (unchanged): `Find {n} places in {Region}. Get inside the {rad} km circle — closer is better!`
4. **Goal card** — goal line: `🎯 Beat {best} — the best score yet on this route.` · when `sender < best`, nested under it: `Your friend scored {sender} on this one.` · when `sender == best`, folded in instead: `Your friend set it.`
5. Map-choice row (shipped #288 — position and behaviour unchanged).
6. Disclosure, last before the buttons: `One honest note: this score is your friend's word — Meridian can't check scores sent in links.`
7. Start / Not now (unchanged). Initial focus on the card heading; the goal is never the first thing a screen reader meets.

## Q4 — Verdict screen · ✅ RATIFIED as amended (taxonomy fixed; motion REWRITTEN under the Inclusive Visuals veto)

- **Taxonomy (Game Designer + Game Economy convergent fix, Act On).** The candidate's NEAR-MISS formula `max(10% of routeMax, routeMax/(2n))` computes **415** at n=10 — double its own stated 207, wider than any single stop can score. Governing classes, `T = bestScore`, `mine` = my score, shortfall `= T − mine`:
  - **WIN** — `mine > T`.
  - **HOLD** (dead heat) — shortfall `≤ max(5% of T, 25)`. Never moves the ratchet, never worded as a loss.
  - **NEAR-MISS** — not HOLD, shortfall `≤ ⌊(PLACE_SCORE_CAP + REGION_BONUS) / 2⌋ = 207` — half a place cap, constant for all n (both seats' formulas coincide at 207; denominated per-stop, "within one good stop").
  - **LOSS** — otherwise.
  Retry offered for every non-WIN class (primary on NEAR-MISS, quieter on HOLD/LOSS); WIN offers pass-along as primary. **Exits are never visually subordinated** to the share actions, and the verdict also offers **"Share just the route"** (an mc3 no-W mint) as a secondary — sharing never requires disclosing a result (Behavioural guard, adopted).
- **Hierarchy (UX Architect, Act On).** PRIMARY: verdict word (+ shape icon) → score pair + target bar. SECONDARY: margin line → duel line → duel strip. TERTIARY: route-max as a caption under the bar only, `of {routeCeiling} possible` (the anti-wrong-lesson context: margins read against the route's real ceiling, §B1 — at n=10 that is 3,340, not 4,150). The standalone "You landed inside the {R} km circle on {x} of {n} stops." sentence is **cut when the strip is present** — the strip header carries both hit counts and the aria sentence carries the fact (§motion).
- **Copy (Narrative, byte-exact).** Headlines: WIN `You beat it! 🏆` · HOLD `Dead heat! You share the crown! 🤝` · NEAR-MISS `So close! 🎯` · LOSS `Better luck next time! 🍀`. Sub-line (all classes): `You scored {mine} of {routeCeiling} possible on this route.` + margin sentence: WIN `You won by {margin}.` · HOLD `You were just {margin} away from the best of {best}.` · NEAR-MISS `You were {margin} away from the best of {best}.` · LOSS `The best to beat is {best}.` Duel line — only when `sender < best` (when `sender == best` the verdict already is the duel; stating it twice teaches two bars): ahead `You also outscored the friend who sent you this link.` · behind `You didn't quite catch the friend who sent you this link ({sender}).` · level `You matched the friend who sent you this link ({sender}).` Attempts facts (tertiary, post-completion only — §display ruling below): when `sender == best`: `The mark was set in {k} tries.` / `…in one go.` · when `sender < best`: `Your friend's score took them {k} tries.` / `…took them one go.` · own history, when the store has it: `You've finished this route {j} times.` · farming guard, only when it bound this mint: `The target only rises on a player's first two tries at a route.`
- **Attempts display ruling ⚠️ AMENDS the candidate + narrows A (Behavioural dissent, Chair adopts in part, owner may strike).** Attempts is **carried always, displayed rarely**: never on the welcome card (pre-play it reads as a skill label at the decision point — and the mark was set warm while the receiver plays cold, so the number never measured comparable skill), never in receipts, never comparatively. It appears only **post-completion**, as the tertiary facts above (the sender's tries as story; your own count as growth). Game Designer's "shown plainly" position is recorded as dissent in §9.
- **Duel strip (mask, per §Q2).** Two rows in play order. **My row (measured, on-device fact):** hit = filled disc with ✓, miss = hollow ring with ✕, ≥ 16 px. **Their row (sender-attested):** hollow dots in a visibly lighter treatment, row-labelled as the friend's word; the §Q3 disclosure sentence repeats on this screen. Header: `Stop by stop — you landed {myHits}, they landed {theirHits}.` Every dot carries its **place name** (aria-label always; visible on tap/focus — Level Architect: unnamed dots are a second scoreboard, named dots are the hard-stop lesson), and when both players missed the same stop a line names them: `Both missed: {place names} — the hard stops.` If names cannot fit the layout, the strip ships as header counts only (panel checks). The strip carries no outcome colour of its own; the banner owns the outcome.
- **In-run chip (amended by Behavioural guard).** `🎯 {best} · you {running}`, bottom-centre above the aim controls, non-interactive, `aria-hidden` (the live region announces the target at place boundaries only); hides during pin-drag. **Unreachable switch:** once `running + max attainable from the remaining stops < best`, the chip drops the target and shows `landed {x} of {n}` — a deficit counter must not ride a run that can no longer be won. The welcome **practice off-ramp** ("Try it first — just practice": no target, no receipt, no ratchet) is **Consider** — the Package B panel rules on it with the built welcome card; it is not in this build contract.

### Motion spec — FINAL (rewritten: Inclusive Visuals VETO on the candidate's table, cured as specified; UI Designer + Frontend + Accessibility folded in)

The candidate's choreography is **not shipped**: its WIN crossing was one unbounded transient flash with no persistent equivalent (uncertifiable flash tolerance; a blink or a magnifier loses it forever), its scale-arrival moves magnified text, and its count-up displays false intermediate scores to low-vision readers. Governing spec — CSS transforms + opacity only, no blur/shadows, no new assets, nothing animates during route play, tap anywhere skips to the final state, **focus never moves** (completion heading takes focus on mount, before anything moves):

| Element | Full motion | Reduced motion |
|---|---|---|
| Scores | **Final values at frame 0 — no count-up, ever** | same (static) |
| Target bar | Fill sweeps (scaleX) to `mine`'s proportion of `routeCeiling`, 650 ms ease-out; tick present from frame 0: ≥ 4 px, gold `#f2c14e`, labelled `TARGET {best}`, persistent | static bar at final proportion, tick + label present |
| WIN crossing | A **static `✓ PASSED` tag at the tick that remains on screen**; optional single pulse in addition — once, 300 ms, opacity 1 → 0.6 → 1 | tag present; **no pulse** |
| Verdict word + class icon | Opacity fade 200 ms only (**no scale** — layout reserved from frame 0), starting when the bar lands (~650 ms). Icon ≥ 24 px beside the word: ★ WIN · = HOLD · ◐ NEAR-MISS · ✕ LOSS (outcome never rides on colour alone) | present, static |
| Margin line | Persistent large type under the banner: `Won by {m}` / `{m} short of {best}` | same |
| Duel strip | Dots land in place, opacity only, 30 ms stagger, ≤ 300 ms total, after the verdict word | all dots at once |
| Duel line | Fade in 200 ms after the strip (it explains the banner; never precedes it) | present, static |
| Pass-along button | Fades/slides in **last**, after the duel line — a receipt cannot be sent before its result has been read | present, static |

Total ≤ ~1,600 ms. **Announcement (Accessibility amendment):** one `aria-live="polite"` sentence fired **at the verdict-word point** (~650 ms full motion; **immediately** under reduced motion — the candidate's end-of-choreography timing left screen-reader players with heading-then-silence): `{Headline} You scored {mine}. The best was {best}. {Margin sentence} You landed {myHits} of {n} stops, out of {routeCeiling} possible on this route.` **Implementation constraint (Frontend, Act On if any number ever animates):** the bar is compositor-driven (transform); nothing in this choreography may be driven by React state at frame rate — as specified, no JS-driven animation remains, which is the cheapest cure.

## Q5 — Sequencing · ✅ RATIFIED as amended (A → B stacked, with the Producer's discipline + the Frontend condition)

1. **Package A (codec mc3) ships alone.** It delivers owner order #1 by itself (274 → 52/62); mc2 decodes forever, so in-flight links survive; a no-W mc3 plays today's open route. One big PR coupling codec failure modes to taxonomy, motion, and copy was the rejected alternative (Producer).
2. **Package B (winner declaration) stacks on A — and only on A's panel-frozen tip** (Frontend condition, adopted): B's branch starts from the exact tip A's panel approved; a moving A forces B re-verification and `challenge.ts`/`game-app.tsx` conflicts.
3. **Candidate code disposition (Producer, binding).** `f438ce8` is inventory: this manifest is committed **first** on the Package A branch; then a line-by-line re-diff of the candidate against §§Q1–Q2, Q3-failure-copy, and the test spec (§7 below); the full suite re-runs; the complete panel votes on the final tip. **No gate-phase credit carries over** from the superseded-manifest run.
4. **Estimates (Studio Producer, agent-crew working days):** Package A ≈ **1.5 days** on the re-diff path (3–4 if rebuilt from scratch) · Package B ≈ **2–3 days** stacked on the frozen A tip.
5. **Watch item (Noted):** unknown-version failure reports once mc3 ships (old/school-locked devices hitting the dead-end) — observe before building any fallback; no telemetry is added by this design (COPPA-safe coarse buckets only, per the constitution).

## Test-spec deltas (binding on the packages; the candidate's §7 otherwise stands)

- **Sequential-bound tripwire** (§B1) replaces the flat-bound tripwire.
- **Zero-target gate:** W with `bestScore = 0` → `format`; encoder never mints it (all-miss completion chain-starts open).
- **Actor attribution:** a block with `senderScore < bestScore` renders no tries claim about the best; the sender's tries render only in the §Q4 tertiary forms.
- **Registry guards** (§A3) replace the list-drift guard: slugs resolve via `findRegion`; snapshot no-shrink/no-reorder; uint24 catalog-max assertion (§A5).
- **Fuzz expansion (Security, Consider → Act On):** beyond 1,000 seeded mutations — exhaustive truncation/extension at **every** length; a varint dictionary (`80 80 80`, `FF FF 7F`, `80 00`) in **every** varint slot; fragment lengths 126/127/128; base64 edges (padding present, `+`/`/` characters, length %4 == 1, non-zero spare bits in the final character). Decoder never throws, never returns ok with altered semantics.
- **Attempts store:** tuple keying (a scoring bump namespaces), 512-cap LRU eviction, flag-off does **not** clear, Reset-my-history does; farming guard (3rd+ completion of a tuple cannot raise `best'`).
- **Save slots:** mc3 saves only under `meridian.run.mc3`; rollback simulation (mc2-shaped reader) never sees them; partial winner fields on a save discard that save.
- **Verdict E2E:** taxonomy boundaries at the exact formulas (incl. shortfall = 207 vs 208; HOLD at `max(5% of T, 25)` edges); reduced-motion renders final states + `✓ PASSED` + immediate aria sentence; attested row visually distinct + disclosure present on the verdict screen; chip unreachable switch; no-score share mints a decodable no-W mc3.

## Findings record (protocol buckets)

- **Act On — all adopted above:** varint misdefinition (Systems) · parse bound (Systems) · zero-target + actor conflation (Systems) · sequential bound + NEAR-MISS arithmetic (Economy, Game Designer) · region registry + skew remedy (Level Architect, Systems) · mc3 save slot + attempts store (Technical Architect) · old-build story correction (Reality Checker) · failure-heading distinction + aria timing (Accessibility) · motion veto cure (Inclusive Visuals) · attested-row distinction + verdict-screen disclosure + seal/anti-downgrade wording + fuzz expansion (Security) · attempts display narrowing + chip unreachable switch + farming guard + no-score share (Behavioural) · welcome grouping + verdict hierarchy (UX Architect) · motion re-clock (UI Designer) · count-up implementation constraint (Frontend).
- **Consider:** welcome practice off-ramp → Package B panel, with the built card · Systems' mask DROP → re-heard at the Package B panel with the built strip (dissent stands below).
- **Noted:** base64 spare-bit malleability (distinct string, identical contest — benign) · gate-order precedence between `version`/`edition` is internal-only (reasons never surface) · unknown-version support watch (§Q5.5).
- **Dismissed:** in-URL slug/word readability (second unauthenticated claim; costs more than it says) · keep-the-old-suffix-everywhere (truncated, ignored, names neither app nor requirement) · count-up + scale-arrival motion (vetoed: false intermediate scores, magnifier-hostile, transient-only WIN cue) · flat `415n` plausibility bound (sequentially unattainable) · positional region table (couples the codec to `regions.ts` ordering; deadlocks on regeneration).

## Dissent recorded by name

- **Systems & Type Architect — mask DROP** (restated on new grounds: gate B1(i) is vacuous against a resealer, and the mask attests the sender, not the crown). Chair: INCLUDE stands — post-B2 the mask's job is the sender's own plausibility + the duel strip, both honestly labelled; re-hearing at the B panel is the seat's remedy.
- **Behavioural & Blast-Radius — attempts display** (dissents from "shown plainly, never as shame": intent does not control reading; a number beside a crown is a ranking). Chair: adopted in large part (§Q4 display ruling); the seat's full position (never display, even post-completion) is recorded — the post-completion tertiary facts are the compromise, and the owner may strike them too.
- **Game Designer — attempts display** (the seat ratified plain display; the Chair's narrowing overrules it on the Behavioural evidence). Recorded.
- **Studio Producer — process dissent** (against any waiver of the final-tip panel or counting the candidate as verified work). Adopted as §Q5.3; recorded so no future run mistakes it for a preference.

## Arbiter approval

- **Status: APPROVED (design)** — Chair sign-off. All 16 seats ruled; the one veto (Inclusive Visuals, Q4 motion) is cured in the governing spec, not overridden; unresolved objections are carried above verbatim in substance, per protocol §4.
- **Amendments to adopted design A carried for the owner's eye:** §B4 farming guard · §Q4 attempts display narrowing. Either falls on his word; the rest of the manifest stands without them.
- **Execution tokens (for the held build run, on the owner's release only):** Package A `AUTH_RUN_TDD_IMPLEMENTATION` on `feat/challenge-mc3-codec` (this manifest committed first, candidate re-diffed per §Q5.3) · Package B on `feat/challenge-winner-verdict` stacked on A's panel-frozen tip. **Neither token authorizes a merge** — merges remain the owner's per-PR word after the panel approves the final tip.
- **Epistemic baseline:** internal facts read from origin/main `5e5a440` and verified by the Reality Checker seat (specimen lengths, the 415 ceiling and its `min()` mechanism, mc2's exact key set + full-field seal, radius envelopes) — confidence **High**, with the one material correction at §A7.
