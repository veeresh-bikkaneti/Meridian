# COUNCIL CONSENSUS MANIFEST — DELTA: mc3 Compact Links + Winner Declaration

- **Delta to:** `.council/manifests/2026-10-28-challenge-all-editions.md` (the mc2 manifest). Everything in that manifest stands except where this delta expressly amends it (§9 lists every amendment).
- **Council:** Tier-2 focused council per `docs/ops/agent-council-protocol.md`. Chair (coordinator) + Codec/Systems seat (software-architect) + Game Design seat (game-designer) + UX/Motion seat (ux-researcher) + Councilor C (adversarial, separate agent; reality-checker).
- **Owner orders (2026-10-31):** (1) "Map link to challenge a friend is too long… human readable… we share a huge one" — with his real 274-payload-char Nebraska mc2 link pasted as the specimen. (2) "When the challenge is complete the second player should see challenger vs challenger score with some animations motion graphics win or loose. Better luck next time" — with his photo of the shipped completion screen showing only the receiver's own score.
- **Governing design:** winner declaration = Design A, ADOPTED by the owner 2026-10-29 (`~/workspace/meridian-challenge-winner/COUNCIL.md`): score in the link, target shown as a goal at start, in-game verdict, king-of-the-hill pass-along, attempts carried. This delta implements A on mc3; it does not re-open A vs B/C/D.
- **Grounded at:** origin/main `5e5a440` (PR #288 merged). All file:line claims verified against that tree.
- **Status:** DESIGN. Implementation in two packages: **A = codec mc3** (branch `feat/challenge-mc3-codec`), **B = winner declaration** (branch `feat/challenge-winner-verdict`, stacked on A). The manifest is committed FIRST on each package branch.

---

## 1. The problem, in numbers

The owner's specimen link (Nebraska, 10 places, minted by the shipped build):

- Full URL: **324 chars** · mc2 payload: **274 chars** · JSON body: 205 bytes.
- Anatomy: the ten `"gn-NNNNNNN"` id strings ≈ 110 payload chars (~40%); JSON keys, quotes, commas, braces most of the rest; the region slug, radius, scoring version and seal are a rounding error by comparison.

## 2. Codec verdict — mc3, binary; mc1 + mc2 frozen

**mc3 wire format:** `#c=mc3.` + base64url (canonical, unpadded — the shipped `fromBase64Url` discipline, reused) of a packed binary body. Fragment cap: **127 chars total** (prefix 7 + payload ≤ 120); longer fails `tooBig` before parsing.

### 2.1 Byte layout (all integers unsigned; varint = LEB128, 7-bit little-endian groups)

| # | Field | Size | Rule |
|---|---|---|---|
| B0 | flags | 1 B | bits 7–6 edition (0 globe, 1 country, 2 state; 3 → fail `edition`); bit 5 = W (winner block present); bits 4–0 reserved, must be 0 (nonzero → fail `version`) |
| B1 | scoring version `s` | 1 B | must equal the receiver's `SCORING_VERSION` (else `scoring`) |
| — | radius `rad` | varint, ≤2 B, ≤ 65535 | whole km; binding as mc2 (§2.3) |
| — | region index | 1 B | per-edition frozen table (§2.2); unknown for the edition → fail `region` |
| — | count `n` | 1 B | 5–10 (else `format`) |
| — | ids | n × 3 B | uint24 big-endian GeoNames numbers; 0 invalid; duplicates → `format` |
| — | **winner block, iff W** | | |
| | sender hit-mask | 2 B | uint16 BE; bit (15−i) set ⟺ the mark-setter landed inside the circle on place i; bits ≥ n must be 0 (else `format`) |
| | `sender` score | varint, ≤3 B | the score of the player who minted this link |
| | `best` score | varint, ≤3 B | best score so far on this route, chain-wide |
| | `attempts` | varint, ≤2 B, value 1–255 | §4.2 semantics |
| last | seal | 4 B | FNV-1a-32 over **all preceding bytes**, uint32 BE — full width, never truncated or folded (parity with mc2's 32-bit seal) |

Varint discipline: canonical shortest form only — a terminating byte with the high bit set, a non-final 0x80 group (overlong padding), exceeding the field's byte cap, or running past the buffer end are all `format` failures. **Total body length must equal the layout's computed length exactly** — one extra or missing byte anywhere is a `format` failure (this is the anti-downgrade rule: a winner block can never be silently truncated into an open route, and an open route can never grow a partial block).

### 2.2 Region index — frozen, append-only, guarded (Systems seat ruling, Chair adopted)

The index is read **per edition**: globe → index must be 0; country → index into `COUNTRIES` order (0–12 today); state → index into the admin-1 order (0–49 today, the `STATES` order of `ADMIN1_BY_COUNTRY["united-states"]`; future countries' subdivisions append after existing entries, in plug-in order). Indices are **never reassigned and never reused**; the table lives in `challenge.ts` as data + a snapshot.

The codebase's "no second registry" stance (`findRegion`'s comment) is answered by mechanism, not prose — the same class of tripwire as the golden radius table:

- **List-drift guard test:** builds the expected id lists from `regions.ts` live data and asserts the frozen tables match them exactly (order included) **today**. Plugging a new region into `regions.ts` turns this test red deliberately; the same PR must append the new index (never insert) and extend the snapshot.
- **No-shrink snapshot test:** the table may only ever grow by appends; a diff that removes or reorders an entry fails.

Decode still resolves the index → slug → `findRegion(edition, slug)`; an index whose slug the receiver's build does not know fails `region` (the region tables are data-identical across builds at the same scoring era; the guard keeps encoder and decoder tables from drifting apart silently).

### 2.3 Radius binding (unchanged from mc2)

Globe: `rad` must be exactly 750. State/Country: inside the edition envelope (state [25,160], country [40,450]) **and** within ±10% of the receiver's computed `regionRadiusKm` for the named region — else fail `radius`.

### 2.4 Score plausibility (the ±10% rule's sibling for scores)

Derived, never magic numbers: `routeMax(n) = n × (PLACE_SCORE_CAP + REGION_BONUS)` — both imported from `scoring.ts` (today 415 × n; a 10-place route maxes at 4,150). Decode gates, all `format` failures:

1. `best ≥ sender` (a best below its own sender is a corrupt chain).
2. `sender ≤ routeMax(n)` and `best ≤ routeMax(n)`.
3. Mask cross-check: with `pc = popcount(mask)`, `sender ≤ pc × (PLACE_SCORE_CAP + REGION_BONUS)` — a mark claiming points with zero landed stops is impossible, because misses score 0 (`scorePlace` is only ever invoked on a hit; the miss branch of `dropPin` scores 0). The converse is **not** gated: a landed stop can legitimately score 0 (edge-of-circle base rounding), so `sender = 0` with `pc > 0` stays legal.
4. `attempts ∈ [1, 255]` (the encoder saturates at 255: `min(actual, 255)`).

**Tripwire:** a unit test scores the synthetic max route through `scorePlace` itself (base-curve max × tier-5 multiplier × `comboForStreak` cap → the 400 cap binds, +15 bonus) and asserts equality with the bound's per-place term — a scoring change that moves the true max turns it red and forces this section to be re-derived in the same PR, exactly like the `SCORING_VERSION` tripwire.

### 2.5 Decode gate order (mc3; mc1/mc2 orders untouched)

1. type + fragment length (>127 → `tooBig`) → 2. prefix dispatch (`mc3.`) → 3. base64url canonical decode (reused helper; failure → `format`) → 4. minimum length (≥ 1+1+1+1+1+15+4 = 24 bytes) → 5. **seal** over all-but-last-4 bytes (mismatch → `format`) → 6. B0 reserved bits (`version`) + edition code → 7. `s` vs expected → 8. varint walk (rad) with caps → 9. region resolution → 10. radius envelope + binding → 11. count + ids (duplicates, zero) → 12. winner block iff W: mask bits ≥ n, §2.4 gates, attempts range → 13. exact end-of-body.

The seal gates **before** semantics (it needs no parsing — it covers raw bytes), so a tampered link dies at step 5 regardless of which field was touched; the semantic gates behind it are the plausibility layer, not the integrity layer.

### 2.6 Lengths achieved (10 places, winner block present, today's data)

| Route | mc2 payload | mc3 payload | mc3 full URL |
|---|---|---|---|
| Nebraska (owner's specimen), no winner block | 274 | **52** | ≈ 101 |
| Nebraska, winner block (955-class scores) | 274 | **62** | ≈ 111 |
| United Kingdom (country), winner block | — | 63 | ≈ 112 |
| Globe, winner block | — | 62 | ≈ 111 |
| Any State route, winner block | — | 62 (index ⇒ length is region-independent) | ≈ 111 |

## 3. Back-compat + format transition (amends mc2 manifest §1(f) + §2)

1. **mc1: frozen, full stop.** Decoder, golden vectors, save slot, completion surface, re-share — byte-identical, exactly as the mc2 manifest left them. An mc1 receive has no target and never gains one; its completion screen is today's screen.
2. **mc2: decode forever, emit never (once Package A ships).** All creation surfaces emit mc3. The mc2 decoder, its golden vectors, and the mc2 save slot stay untouched; an mc2 receive plays as today's open route (no target — the format carries no score).
3. **Completion re-share — the origin rule, amended:** *never downgrade; forward-upgrade is the rule for mc2.* An mc2-origin completion re-shares as **mc3 with a winner block** (the chain starts at that hop: `sender = best = ` the completer's score). Rationale: mc3 expresses everything mc2 did, plus the winner fields the owner ordered; the mc2 manifest's ban was on mc2→mc1 downgrade (region loss), and this delta extends its principle — a re-share must never LOSE information — rather than breaking it. The radius freeze survives intact: the re-share pins the run's judged radius (the §6 freeze test's rad-90 case re-applies to mc3 emission).
4. **mc3 receive, no W** (a fresh route): plays as an open route; its completion starts a chain exactly as in rule 3.
5. **mc3 receive, with W:** target = `best`; the run snapshots the winner fields at receive (the `challengeRadiusKm` pattern — new run fields, meaningful only on challenge runs; absent on legacy saves = no target).
6. **Old builds:** a pre-v3 build opening an mc3 link fails closed in its mc1 decoder (`format`) and shows failure class 1. Its remedy line ("ask your friend to send the link again") is wrong for this case — recorded honestly; the mitigation is **new in Package A:** a build that sees a fragment matching `#c=mc<digits>.` with an unknown version shows class 1's title with a distinct remedy — **"This challenge needs the newest Meridian."** — instead of the resend line. The new remedy fires **only** for a well-formed unknown-version prefix, never for a malformed mc3 (a broken mc3 keeps the resend remedy).
7. **Scoring cliff:** unchanged — mc3 carries `s` as a full byte and the same tripwire governs bumps; mc3 links die at a scoring bump exactly like mc1/mc2 unless frozen-version judging ships then (owner's standing open question, not re-opened here).

## 4. Winner semantics (Design A, made precise — Game Design seat rulings, Chair adopted)

### 4.1 Two numbers, two jobs

The block carries `sender` (the mark of the player who minted THIS link) and `best` (the chain's best so far). Decode requires `best ≥ sender` (§2.4 gate 1); the encoder guarantees it by construction — at pass-along, `best' = max(best, myScore)` and `sender' = myScore`, so `sender' ≤ best'` always.

- **Target (verdict, welcome headline, in-run chip) = `best`, always.** The crown does not move because a later, weaker mark passed the link along.
- **The duel (colour, never the bar) = `sender`.** Verdict headline classifies vs `best`; a sub-line reports the duel vs `sender` as fact ("You also outscored the friend who sent you this link." / "…didn't quite catch the friend who sent you this link ({sender}).") — triumph copy never keys on `sender` (Councilor C's F5 principle, adopted: no surface may declare a win against a bar the verdict didn't use).
- **Welcome card (W present):** headline goal "🎯 Beat **{best}** — the best score yet on this route."; when `sender < best`, a second line: "Your friend scored **{sender}**. The route's best is **{best}**."; then the unverified-mark line (§5.3). When `sender == best` (every 2-player chain), the single line stands alone.
- **In-run chip:** "🎯 {best}" only — running score is already on screen; mid-run duel math is noise.

### 4.2 Attempts — one definition, every mint

`attempts` = **completions of this route (edition + region + ordered id list) by the player who set the mark this block attests, on their device, including the completion that set the mark.** A completion = finishing the route's last stop (the completion screen reached), win or lose. Walking away mid-run is not a completion. Retries in one sitting count — that is the point of carrying the number.

- Counted under a route fingerprint (a hash of edition + region + ordered ids) in the challenge-save storage family; incremented at each completion; read at mint. Flag-off clearing of challenge saves clears the counts with them (the shipped rule's blast radius, no wider).
- A summary exact-route mint (a normal run's played route): the minting run is one completion of that route, so the fingerprint rule applies uniformly — `attempts = storedCount(route) + 1`, then stored. No special species of mark.
- **No separate first-try bit** (Chair deviation from the Game Design seat's draft, recorded): "first try" is exactly `attempts === 1` under the definition above, so a bit would attest nothing the count doesn't — and one more field is one more thing to be wrong about. UI may render "set in one go" iff `attempts === 1`.
- Display: welcome line ("The best was set in **{k} tries**." / "…in **one go**."), strip header ("…set in {k} tries"), receipt clause (§6). The number is shown plainly, never as shame — and a route the receiver has already completed shows their own count too where the fingerprint store has one ("You've finished this route {j} times — best is still {best}.").

### 4.3 Verdict taxonomy (completion screen, W present)

Let `mine` = my score, `T = best` (the target I played against), `routeMax = n × 415` (§2.4 constants, imported — never a literal).

| Class | Condition | Meaning |
|---|---|---|
| **WIN** | `mine > T` | I take the crown; my score becomes the new best. |
| **HOLD** (dead heat) | `mine ≤ T` and `T − mine ≤ max(5% of T, 25)` | Close enough that the crown is shared. Not a WIN (the ratchet does not move), never worded as a loss. |
| **NEAR-MISS** | not HOLD, and `T − mine ≤ max(10% of routeMax, routeMax/(2n))` | A real loss, within one good stop of the crown (at n=10: within 207 pts). |
| **LOSS** | otherwise | "Better luck next time" family. |

Every verdict screen also shows: both scores, the margin in words, the route max as context ("of **{routeMax}** possible on this route" — the anti-wrong-lesson line: margins are read against the route, not against perfection), the stop-by-stop strip (§4.4), and the pass-along (§4.5). **Retry is offered for every non-WIN class** (primary button on NEAR-MISS, quieter on HOLD/LOSS); a WIN offers pass-along as the primary.

### 4.4 The stop-by-stop strip (mask INCLUDED — Game Design seat, Chair adopted over Systems' DROP)

Systems voted DROP (a second scoreboard invites misreading; +2 bytes). Game Design's case, which the Chair adopts: the strip compares **hits, not scores** — the one head-to-head a kid can count — and the payload's mask cross-check (§2.4 gate 3) makes the mask load-bearing for codec integrity, not decoration. Rules that keep it honest:

- Two rows of dots, one per stop, in play order: mine (✓ inside / · outside — derived from MY run's results, on-device fact) vs theirs (from the mask — **sender-attested**, introduced by the §5.3 disclosure, never worded as verified).
- The strip carries **no win/loss colour of its own**; the verdict banner above it owns the outcome. Header: "Stop by stop — you landed **{myHits}**, they landed **{theirHits}**."
- On the summary-line the shipped sentence survives: "You landed inside the {R} km circle on {myHits} of {n} stops." gains a sibling when W is present: "They landed {theirHits}."

### 4.5 Pass-along (ratchet) + receipts

On completion of a W-carrying (or chain-starting) route, the primary share mints mc3 with: `sender' = mine`, `best' = max(best, mine)`, mask' = MY hit-mask, `attempts'` = my fingerprint count for this route (§4.2), radius = the run's judged radius (freeze rule §3.3). The share text is the **receipt** — the previous sender's only news — pre-written per outcome (draft copy, narrative seat finalises at the Package B panel):

Receipts lead with the outcome word and are social text, not verdicts — **the margin number never appears in a loss receipt** (the verdict screen carries the margin, where it teaches; a chat message only needs the story) (UX seat, Chair adopted over the Game seat's draft, whose margin-in-receipt forms stand superseded here):

- WIN: "I BEAT IT 🎯 — **{mine}** on your {Region} route. Best is now **{best'}** — beat that! (Took me {k} tries.)"
- HOLD: "DEAD HEAT 🤝 — **{mine}** on your {Region} route. Target stays **{best'}** — come and take it."
- NEAR-MISS: "SO CLOSE 🎯 — **{mine}** on your {Region} route. (Took me {k} tries.) The target's still out there — passing it on!"
- LOSS: "IT GOT ME 🎯 — **{mine}** on your {Region} route. Better luck to the next player — passing it on!"
- Chain-start (no incoming W): "🎯 I scored **{mine}** on this {Region} route — beat that! (Set in {k} tries.)"

The completion screen shows the outgoing block's numbers (target the next player will see = `best'`, my attempts) **on the screen, before the share tap** — the composer preview is the verdict screen itself; nothing is minted invisibly (§5.3).

## 5. Surfaces + honesty rules

### 5.1 Creation surfaces (Package A changes only the emitted format)

Picker (a), mid-run (b), reveal (c), summary fresh (d-secondary), review (e): emit mc3, no W — byte-for-byte the same surfaces, labels, and gates as the mc2 manifest. Summary exact (d-primary): emits mc3 **with W** (§4.2: sender = best = the run's score over the shared places, mask = the run's hit pattern over those places, attempts per §4.2) — this is Package B's surface change riding A's codec; in Package A alone (if B has not landed), the summary exact still emits mc3 **without** W (an open route — today's behaviour, shorter link).

### 5.2 Receive + welcome (Package B)

Welcome card gains its winner lines only when W is present, in the §6.3 order (fairness promoted to second; goal block, sender line, attempts line; map row; disclosure last before Start). No-W welcomes keep today's lines, reordered only by the §6.3 fairness promotion.

### 5.3 Disclosure (Councilor C's F8 principle, adopted)

- Welcome card, W present, one plain line (§6.3 wording): **"One honest note: this score is your friend's word — Meridian can't check scores sent in links."** No surface anywhere may call a link-carried mark "verified" (a copy rule the Package B panel greps for).
- The strip's "they landed" is covered by this line; the mask is sender-attested data and the UI never presents it as measured.
- Deliberate forgery stays exactly the accepted risk the winner council recorded (stakes are social; today's chat-text scores have the same trust model). What this delta adds is **disclosure + non-amplification**: forged numbers get no "verified" costume and no silent surface.

### 5.4 Failure copy (Package A)

Three remedy classes from the mc2 manifest stand; class 1 gains the version remedy of §3.6 for well-formed unknown-version fragments only. Reasons stay internal.

## 6. UX + motion (UX/Motion seat rulings, Chair adopted)

### 6.1 Share texts — one fact order for every creation text

`[score hook if any] → "{n} places · {Region} · {rad} km circle" → fairness line (creations) → link, alone on the last line.` Link last and alone (the paste-safe position in every chat app). **The "(Opens in the newest Meridian.)" suffix is RETIRED for mc3-era texts** (UX seat, Chair adopted — this amends §3.6's mitigation (a) as drafted): the suffix sat inside the sender's composed text where it taxed every receipt's grammar, while the case it warned about is now answered inside the app at the moment of failure by the §3.6 version remedy. The load-failure copy is its second backstop. (mc2-era texts in old builds are shipped strings; nothing retro-changes.)

- **Fresh route (no target):** "Challenge a friend! 🎯 {n} places · {Region} · {rad} km circle. Same places, same circle for everyone.\n{url}"
- **Exact route with target (summary mint):** "🎯 I scored **{sender}** on this {Region} route — {n} places, {rad} km circle. Beat that! (Set in {k} tries.) Same places, same circle for everyone.\n{url}" — the tries clause drops when it would shame: it renders as "(Set in one go.)" for k = 1 and is omitted for k > 9 (the welcome card still shows the true count; the chat text is an invitation, not a record).

### 6.2 Readable-URL schemes — REJECTED (UX seat, Chair adopted)

No slug prefix (`#c=nebraska/mc3.…`), no word-encoding. A slug in the fragment is a second, unauthenticated region claim that can disagree with the sealed one (which does the screen then believe?); a slug matching neither (a typo) manufactures a failure class for a cosmetic gain; Georgia-state-vs-Georgia-country needs the edition qualifier anyway, at which point the "readable" prefix reads `state-georgia` — a debug string, not child-friendly text. Word encodings cost more chars than the binary body they would replace. Readability lives in the message and the welcome card (§6.1, §6.3), never in the fragment.

### 6.3 Welcome card — element order (W present)

1. Title (unchanged): "A challenge from a friend!"
2. **Fairness line, promoted to second:** "Same places, same circle for everyone." — the terms before the stakes; a target read after the fairness frame reads as sport.
3. Task line (unchanged): "Find {n} places in {Region}. Get inside the {rad} km circle — closer is better!"
4. **Goal block** (goal grammar, never a gauntlet): "🎯 **Beat {best}** — the best score yet on this route." + nested under it, only when `sender < best`: "Your friend scored **{sender}** on this one." (When `sender == best` the friend line folds into the goal block: "Your friend set it." — one fact, stated once.)
5. **Attempts line:** "The best was set in **{k} tries** — every try counts the same." / "…set in **one go** — every try counts the same."
6. Map-choice row (shipped #288 — position and behaviour unchanged).
7. **Disclosure, last before the buttons** (nearest the decision it qualifies): "One honest note: this score is your friend's word — Meridian can't check scores sent in links." (The word is "your friend's word", never "unverified" — same fact, no accusation.)
8. Start / Not now (unchanged). Initial focus lands on the card heading; the goal is never the first thing a screen reader meets cold.

No-W welcomes carry the same lines as today, ordered as above (fairness second) — a position unification, recorded so the Package B panel diffs it knowingly rather than discovering it.

### 6.4 In-run chip

Content: "🎯 {best} · you {running}" — raw pair, no labels, no duel (at arm's length the sender's number is indistinguishable from a second target; two numbers vs one crown is the whole reason §4.1 exists). Placement: bottom-centre of the map, directly above the aim controls, clear of the satellite canvas' centre and of every ≥44px control; hides while a pin-drag is in flight (the drag owns the bottom edge) and returns on drop. Non-interactive (a status readout cannot be a dead button), `aria-hidden` — the contextual live region carries the target at place boundaries only, so a screen-reader player hears it once per stop, not per render.

### 6.5 Verdict motion (ChallengeComplete, W present)

CSS transforms + opacity only; no blur, no drop-shadows (the #288 fg-token precedent); no new assets; nothing animates during route play. **Total ≤ 1.9 s; a tap anywhere on the card skips to the final state; animations never move focus** (the completion heading receives focus on mount, before anything moves).

| Element | Animation | Duration | Reduced-motion form |
|---|---|---|---|
| Your score | count-up 0 → mine, ease-out, tabular numerals (no layout shift) | 700 ms | final number, instantly |
| Target bar | fill sweeps to mine's proportion; the fixed target tick is present from frame 0; on a WIN the fill crosses the tick and the tick flashes once (opacity pulse) | 650 ms, starts with the count-up | static bar at final proportion |
| Verdict word | scale 0.92 → 1 + fade in — the only element allowed to "arrive" | 250 ms, at ~650 ms (as the count lands) | present, static |
| Stop-by-stop strip | dots land stop-by-stop, 60 ms stagger, hard cap | ≤ 600 ms total | all dots at once |
| Duel line | fade in under the verdict (it explains the banner; it never precedes it) | 200 ms, after the count-up | present, static |
| Pass-along button | fades/slides in LAST, only after the duel line (the receipt cannot be sent before its result has been read) | 200 ms | present, static, first in tab order as today |

**Announcement:** one `aria-live="polite"` sentence, fired when the choreography completes (immediately under reduced motion): "{Verdict word}. You scored {mine}. The best was {best}. {Margin sentence}." — e.g. "You beat it! You scored 1,310. The best was 1,240. You won by 70." A screen-reader player gets the result as one fact, not as fragments arriving over two seconds.

## 7. Test specification (digest — the implementation contract)

**Package A (`src/game/challenge.test.ts` extended; mc1 + mc2 blocks byte-unmodified — GUARD):**
- mc3 golden vectors: hand-packed byte fixtures built in-test by an INDEPENDENT packing routine (the mc2 manifest's rule: encoder and decoder must not share a bug silently), incl. the owner's Nebraska route re-minted (ids/region/radius from his pasted mc2 link, decoded by the shipped mc2 decoder in-test as the cross-check) asserting payload lengths 52 (no winner block) and 62 (winner block at 955-class scores, attempts 1).
- Round-trips: every edition × {W, no-W} × n ∈ {5, 10}; region index edges (globe 0, first/last country, first/last state).
- Strictness: reserved bits → `version`; edition 3 → `edition`; non-canonical varints (overlong, unterminated, over-cap) → `format`; trailing/missing byte → `format`; seal flip at EVERY byte position of a golden link → never `ok` (tamper sweep); duplicate ids; id value 0; count outside 5–10.
- Plausibility: `best < sender` → `format`; scores at routeMax pass, routeMax+1 fail; mask popcount cross-check (sender = pc×415 passes, +1 fails; sender 0 with pc > 0 passes); attempts 0 and 256 fail; mask bits ≥ n set → `format`.
- Radius binding re-run for mc3 (golden ×0.9 / ×1.1 pass, ×1.25 fails `radius`; globe ≠ 750 fails; envelope edges).
- Tripwires: region-table list-drift guard + no-shrink snapshot (§2.2); scoring-bound equality through `scorePlace` (§2.4).
- Transition: the owner's pasted mc2 Nebraska link decodes identically under the new dispatcher; mc2 golden suite untouched; dispatcher routes mc1/mc2/mc3/unknown-version correctly (unknown version → the §3.6 remedy signal, not a run).
- Fuzz: deterministic seeded random byte mutations (≥ 1,000 cases over golden bodies) — decoder never throws, never returns ok with altered semantics.

**Package B:** verdict classification unit matrix (WIN/HOLD/NEAR-MISS/LOSS boundaries at the exact formulas, incl. n=5 Globe and n=10 State); ratchet minting (best' / attempts' / mask' from a completed run); fingerprint counting (completions increment, walk-aways don't, flag-clear wipes); E2E per surface: welcome with W (goal + sender line + disclosure + attempts), welcome without W unchanged, in-run chip, verdict screens per class (copy + strip + max context), pass-along link decodes to the ratcheted block, mc2-receive → mc3-chain-start E2E, mc1 receive → frozen screen E2E (guard), reduced-motion E2E (verdict renders final state, no count-up), aria-live verdict announcement.

## 8. Scope boundary

- **In scope A:** `src/game/challenge.ts` (mc3 section appended; mc1/mc2 code paths untouched), its tests + fixtures, the version-remedy signal in the boot dispatch (`game-app.tsx` fragment handling — the remedy line only), share-text suffix continuity (no text changes in A beyond keeping "(Opens in the newest Meridian.)" on mc3 texts), docs (Handbook challenge chapter + README link-format note).
- **In scope B:** run winner fields + fingerprint store (challenge-save family), welcome card, in-run chip, ChallengeComplete verdict block + motion (CSS in the existing challenge styles; transforms/opacity only, no new assets), pass-along minting + receipt texts, summary exact W minting.
- **Protected:** mc1 decoder + its test blocks + `tests/e2e/friend-challenge.desktop.spec.ts` (frozen); mc2 decoder + golden fixtures; `src/game/data/**`; GeoDetective/Cold Trail; the donation copy lock; `public/flags.json` (no flag change — `friendChallenges` gates mc3 exactly as mc2).
- **Verification labels:** codec/verdict claims are `[verified — VM E2E]` once the suites run; real-device share-sheet behaviour stays `[unverified — real device pending]`, as before.

## 9. Amendments to the mc2 manifest (complete list)

1. §1(f) + §2 contract 3 (origin preservation): completion re-share of an **mc2** route now forward-upgrades to mc3 (§3.3 here). mc1 origin rule unchanged.
2. §1 share-text paragraph: mc3-era texts RETIRE the "(Opens in the newest Meridian.)" suffix (§6.1 — the §3.6 in-app version remedy replaces it); creation texts adopt the §6.1 fact order; winner receipts (§4.5) join the share-text family.
3. §2 (codec verdict): a third sibling format mc3 is the emitted format; mc2 joins mc1 as decode-only.
4. §3 (run model): challenge runs snapshot winner fields at receive; a fingerprint completion counter joins the challenge-save family.
5. §3 failure copy: class 1 gains the unknown-version remedy (§3.6 here).

## 10. Epistemic baseline + the Councilor C record

- Internal facts read from origin/main `5e5a440`: codec, scoring bound (415 = 400 cap + 15 bonus, from `scoring.ts` source), regions, surfaces. Confidence: High.
- **Councilor C's report — disposition (Chair, on evidence):** the seat's findings F2–F6 were premised on a merged "PR #289" adding a `senderScore` field to mc2 and a seal change. **That build does not exist:** `grep -rn senderScore src/` on `5e5a440` is empty and the repository has no PR #289 (verified by the Chair via `gh` after the report landed; the Systems seat's independent read of the same tree confirms mc2's keys are exactly `{v,e,r,rad,s,ids,seed}` with the seal covering all fields). Those findings are recorded as **contaminated — not actionable**, and no remedy from them is imported. Three principles in the report were sound independent of its premises and ARE adopted on their own merits: winner fields live inside the seal (§2.1 — by construction in mc3); verdict copy must key on the target, never the sender (§4.1); link-carried marks must be disclosed as unverified (§5.3). Its F1 (seal truncation) is answered structurally: mc3's seal is full-width FNV-1a-32 (§2.1), so the truncation asymmetry it attacked does not exist in this design.
- **Seat disagreement carried:** Systems (DROP the mask) vs Game Design (INCLUDE) — Chair adopts INCLUDE with the §4.4 honesty rules; Systems' objection stands on the record and the Package B panel re-hears it with the built strip.
- **Chair deviation carried:** the Game Design seat's separate first-try bit is not encoded (§4.2 — derived from `attempts === 1`); the seat's semantics are adopted entire.
- The first UX/Motion seat's full text was lost in transit (its completion preview confirmed it engaged the real surfaces); a replacement seat re-ruled §6 from a verified fact pack. Recorded here so the panel knows §6 has one full reading, not two.

## 11. Arbiter approval

- **Status: APPROVED (design)** — Chair sign-off, complete: all four seats ruled, disagreements disposed in §10, §6 folded in. No implementation starts before this manifest is committed on the Package A branch.
- **Execution tokens:** Package A `AUTH_RUN_TDD_IMPLEMENTATION` on `feat/challenge-mc3-codec`; Package B on `feat/challenge-winner-verdict` stacked on A. Neither token authorizes a merge — merges remain the owner's per-PR word after the panel approves the final tip.
