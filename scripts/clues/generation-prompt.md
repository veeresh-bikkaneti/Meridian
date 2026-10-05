# GeoDetective — 5-Tier Clue Generation Prompt, v1 (FINAL)

**Status:** FINAL — locked by Veeresh 2026-10-04. This is the production prompt for the 365-set generation run. Do not alter without Veeresh.
**Date:** 2026-10-04
**Implements:** `~/workspace/meridian-loop-brainstorm/synthesis.md` — the unanimous findings, the delta review's "minimum viable replacement" requirements, and the evolved 5-tier ladder.

> **How to read this document:** Rules quoted or cited from the synthesis are marked **[SYNTHESIS]**. Choices marked **[LOCKED — Veeresh 2026-10-04]** are his binding rulings. Remaining **[DRAFT CHOICE]** marks are the author's choices that stand for this production run unless Veeresh overrules them.

---

## 1. What this prompt is for

GeoDetective is Meridian's daily guessing edition: one mystery place per day (UTC day key), five guesses, clues revealed on a narrowing ladder. The player guesses via a constrained typeahead picker.

**[SYNTHESIS]** — Unanimous finding #2: *"4 principles ≠ 4 clue tiers. Principle 4 ('short and story-like') is a style rule, not a content tier. The tiers must be a narrowing ladder (each clue shrinks the candidate set); the principles become universal writing rules applied to every clue."* This prompt therefore defines **5 narrowing tiers**, and applies Veeresh's 4 card rules as universal writing rules on every clue (§4).

**[SYNTHESIS]** — Delta review: *"Content's rewritten 5-tier generation prompt (with name-leak bans, extract-as-only-source, per-clue source fields, rejection path, reading level, difficulty + aliases) is the minimum viable replacement — generate nothing until adopted."* Those seven components are exactly §§5–9 below.

**[SYNTHESIS]** — Unanimous finding #5: the content is the real blocker (5 tiers × 365 days = **1,825 clue strings** minimum). Unanimous finding #3: the pool is a **curated famous-place pool** (500–2,000 guessable places), not the 124k catalog. This prompt assumes the input place comes from that curated pool with substantive source extracts (workflow step A), but the rejection path (§7) still applies per tier.

---

## 2. The 5 tiers

**[SYNTHESIS]** — Delta review, "Tier order — the one real disagreement": game design's order was recommended — **Geography → Climate → History → Hook → Giveaway** — because *"nearly every player sees clues 1–2, so don't bury the educational point"* and the narrative arc runs *land → environment → people*. Content's alternative (climate at 3) lost on a small narrowing-efficiency gap. This prompt adopts the recommended order.

**[SYNTHESIS]** — The narrowing test (from the 4-tier proposal, extended here to five): after clue 1 the player names the *region*; after clue 2 a *sub-region*; after clue 3 a *shortlist*; after clue 4 they are *near-decisive*; clue 5 *converts*. Per-tier narrowing expectations are specified below; the extension of the test to tiers 2/4/5 is a **[DRAFT CHOICE]** (reasoning: the synthesis test only names tiers 1–3; a 5-tier ladder needs a per-tier contract or clue 4 has no defined job).

### Tier 1 — 📍 Geography: place them on the map
- **Purpose:** put the player on the right part of the world.
- **[SYNTHESIS]** — *"plain-spoken regional location + one relational anchor a child knows"* (4-tier proposal, tier 1).
- **Narrowing contract:** after this clue, the player can name the region (e.g., "western India," "the Mediterranean coast").
- **Rules:** plain-spoken, picturable geography (card rule 2). Exactly **one** relational anchor — a bigger place, sea, river, or landform a child already knows (e.g., "south of Delhi," "on the Bay of Bengal"). Never coordinates, never elevation.
- **Source guidance:** location facts come from the extract's geography sentences.

### Tier 2 — 🌤️ Climate: landforms → weather
- **Purpose:** teach the landform→weather intuition. **[SYNTHESIS]** — Delta review: *"Climate tier earns its slot: landforms→weather is real curriculum the game doesn't teach today."*
- **Narrowing contract:** after this clue, the player narrows to a sub-region or climate band (e.g., "somewhere with monsoon summers on that coast").
- **Hard rule — non-redundancy [SYNTHESIS]:** *"The climate clue must add information the geography clue didn't imply ('hot coast' after 'west coast of India' = wasted reveal). Cite the extreme, the paradox, or the place-specific mechanism — never generic weather."*
- **Hard rule — fabrication risk [SYNTHESIS]:** the delta review flags this tier as *"the highest fabrication risk of any tier"* because it *"demands causal explanation from articles that often only state classifications."* Therefore: the climate clue's mechanism/extreme/paradox must be **verbatim-traceable to the extract** (§6). If the extract only states a classification (e.g., "humid subtropical climate") with no mechanism, extreme, or paradox — **reject the set** (§7). Never invent the mechanism.
- **Teaching lens:** prefer the causal link a kid can reuse elsewhere ("mountains wring the rain out of the clouds before it reaches here") over a label ("it has a tropical climate").

### Tier 3 — 📜 History: narrow the shortlist
- **Purpose:** discriminate between the remaining candidates.
- **[SYNTHESIS]** — *"founding story with ONE discriminating detail (year + founder/event)"* (4-tier proposal, tier 2).
- **Narrowing contract:** after this clue, the player holds a shortlist of a handful of places.
- **Rules:** exactly one discriminating detail — a founding year + founder, or a single defining event. Card rule 1 (history first) lives here most naturally. The detail must actually discriminate (founding year shared by fifty cities is not a detail, it's trivia).

### Tier 4 — ✨ Hook: the near-decisive identifier
- **Purpose:** the memorable, retellable fact that should crack it for most players.
- **[SYNTHESIS]** — *"the memorable hook, allowed to be nearly decisive"* (4-tier proposal, tier 3).
- **Narrowing contract:** after this clue, a player who has followed the ladder should be near-decisive — one or two candidates left.
- **Rules:** card rule 3 verbatim — *"One memorable, retellable hook — person, quote, event, movie, record — if a kid can't retell it, the card failed."* Allowed to be nearly decisive, but must still pass the name-leak ban (§5): decisive ≠ named.

### Tier 5 — 🏛️ Giveaway: convert, don't bury
- **Purpose:** confirm the answer for everyone still playing.
- **[SYNTHESIS]** — *"iconic landmark/cultural marker that confirms it"* (4-tier proposal, tier 4); *"Last clue should convert, not bury"* (Key decisions table); delta review: *"tier 5 = giveaway"* and *"tier 5 is a giveaway, not a summary."*
- **Hard rule:** tier 5 is a **giveaway, not a summary**. Do not recap the previous four clues. Give the single most confirming fact — the iconic landmark, the cultural marker, the "oh, of course" detail.
- **Narrowing contract:** after this clue, conversion. A player who read all five clues and still can't answer was never going to; the clue's job is to make the answer feel inevitable in hindsight.
- The name-leak ban (§5) applies at full force here — the temptation to just say it is highest at tier 5.

---

## 3. Universal writing rules (the 4 card rules, every clue, every tier)

**[SYNTHESIS]** — Unanimous finding #2: the principles *"become universal writing rules applied to every clue."*

1. **History first, modern identity second** — where a clue carries time, lead with the past.
2. **Plain geography kids can picture; never elevation, coordinates, or census filler** — no "at 1,200 m," no "population 2.3 million," no lat/lon.
3. **One memorable, retellable hook per clue at most; a kid could retell it to a friend** — if it can't survive retelling, rewrite it.
4. **Short and story-like; numbers only when they teach** — records, firsts, and founding years teach; census numbers don't.

**[DRAFT CHOICE]** — Clue length: **1–2 sentences, roughly 15–40 words** per clue. Reasoning: the synthesis demands "short" but never quantifies; the card rules' "short and story-like" plus a 5-clue reveal budget argues for tight clues, and 40 words is about the most a child will re-read while guessing. Veeresh can tighten or loosen.

**Product philosophy (standing):** players are learners who want to grow — clues teach, not just test. Every tier should leave the player knowing something reusable (a region, a climate mechanism, a founding story), even on days they lose.

---

## 4. Name-leak ban — game over on arrival

**[SYNTHESIS]** — Delta review R1: *"name-leak ban still missing — the prompt never forbids writing the place's name. Game-over on arrival."* This section is the ban.

**The mechanical rule.** No clue may contain, as a case-insensitive substring (ignoring diacritics):
- (a) the place's canonical name or any part of it ("Paris" bans "Parisian" and "Parisians"),
- (b) any recorded alias — historical, native-language, or colloquial (e.g., Bombay for Mumbai) — see §8,
- (c) any demonym or derived term built from the name or its aliases ("Mumbaikar" contains "Mumbai" — banned).

**[LOCKED — Veeresh 2026-10-04]** — The substring rule with diacritic-folding for (a)–(c). Reasoning: it is mechanically checkable by the validator (no judgment calls), and it catches the demonym trap that a whole-word match would miss. Over-strictness risk (banning an innocent shared substring like "ham" in "Birmingham") is accepted: false rejections are cheap, a leaked answer is game-over.

**Indirect giveaways — also banned:**
- Wordplay that resolves to the name: anagrams, "rhymes with…", "sounds like…", spelling it out letter by letter.
- Translations of the name's meaning used as the clue's payload ("the 'city of lakes'") — **[DRAFT CHOICE]** (reasoning: a meaning-translation is a one-step decode to the answer; it converts tier 5 into a spelling test).
- Naming a famous eponymous entity whose name *contains* the place name ("the Paris Agreement" for Paris — caught by the substring rule anyway; listed here so generators don't try to be clever).

**Explicitly allowed (decisive ≠ named):** landmarks, people, events, and titles that do not contain the name ("the Eiffel Tower," "the capital of France" as a tier-5 giveaway). Decisiveness is the tier 4–5 job; only the *name* is forbidden.

---

## 5. Extract-as-only-source + per-clue source fields

**[SYNTHESIS]** — The rewritten prompt requires *"extract-as-only-source"* (delta review) and *"per-clue source fields"*; workflow step B specifies *"extract-as-only-source, rejection path for thin places."* Meridian's standing law: **never invent facts.**

**The rule:** every factual claim in every clue must be supported by the source extracts supplied in the input (§9). The generator may *rephrase for reading level* but may not add facts, mechanisms, dates, or numbers absent from the extracts. Paraphrase is a change of clothing, not a change of facts.

**Per-clue source fields (required, every clue):**
```json
"source": {
  "article": "Mumbai",
  "url": "https://en.wikipedia.org/wiki/Mumbai",
  "quote": "verbatim sentence(s) from the extract supporting this clue"
}
```
**[DRAFT CHOICE]** — Requiring a **verbatim `quote`** per clue (not just article-level citation). Reasoning: "extract-as-only-source" is only auditable if each clue points at the exact supporting sentence; article-level citation lets a generator smuggle in a plausible-but-unsourced detail. This also directly serves the validator's "verbatim check" (workflow step C) and the no-fabrication gate. Cost: slightly longer JSON; worth it.

---

## 6. Rejection path — fail closed, never invent

**[SYNTHESIS]** — Workflow step B: *"rejection path for thin places."* Delta review R4/R5: the missing rejection path combined with the climate tier is *"the highest fabrication risk of any tier."*

**The rule:** if any tier cannot be written from the supplied extracts without inventing, **reject the entire clue set** — do not emit a partial set, do not weaken the tier, do not substitute a generic clue. A 4-clue day breaks the 5-guess contract; a thin place simply isn't a GeoDetective place.

**Rejection record (emit instead of clues):**
```json
{
  "status": "rejected",
  "place_id": "gn-...",
  "rejection": {
    "tier": 2,
    "tier_name": "climate",
    "reason": "extract states 'humid subtropical climate' with no mechanism, extreme, or paradox; non-redundant climate clue not sourceable",
    "missing": "place-specific climate mechanism or extreme in the extract"
  }
}
```

**[LOCKED — Veeresh 2026-10-04]** — Set-level rejection (whole set rejected) rather than tier-level omission. Reasoning: the synthesis says "rejection path for thin places" (place-level), and the game contract is five guesses / five clues; emitting four clues silently changes the game. The rejection record tells the pipeline *what source material to go find* (the `missing` field), which is more useful than a hole in the ladder.

---

## 7. Reading level + retellability

**[SYNTHESIS]** — The rewritten prompt requires *"reading level"*; the human-review rubric grades *"reading level"* and *"retellability."*

**[LOCKED — Veeresh 2026-10-04]** — Target: **a 10-year-old can read each clue aloud without stumbling, and retell its point to a friend the next day.** Concretely: short sentences; no unexplained jargon (a term like "monsoon" is fine *if the clue itself shows what it means* — "the summer winds that dump months of rain at once"); no subordinate-clause pileups; concrete nouns over abstractions. Reasoning: the synthesis never sets an age band; 10 sits in the middle of Meridian's kid audience and matches "retell it to a friend" as the operational test (card rule 3's "if a kid can't retell it, the card failed").

---

## 8. Difficulty + aliases

**[SYNTHESIS]** — The rewritten prompt requires *"difficulty + aliases."* Workflow step E assembles *"difficulty-balanced weeks,"* so difficulty must be recorded per set.

**Difficulty [DRAFT CHOICE]** — integer **1–5**, defined as *guessability for the daily audience*:
- 1 — world-famous; most players solve by clue 3 (e.g., Paris)
- 2 — famous; most solve by clue 4
- 3 — known; the full ladder is usually needed
- 4 — niche-famous; typically needs the giveaway
- 5 — obscure-but-fair; a triumph at clue 5, never unfair before it

Reasoning: the synthesis doesn't define the scale; guessability (not population, not "importance") is what week-balancing needs, and it aligns with Meridian's existing 1–5 difficulty vocabulary. A place whose difficulty can't be honestly placed is a candidate for rejection, not a guess.

**Aliases [DRAFT CHOICE]** — record every name the validator must enforce the leak ban against *and* the typeahead matcher must accept: canonical name, historical names (Bombay), widely-known native/colloquial names, common English variants. Do **not** exhaustively transliterate; if it isn't in the extracts or the curated record, it isn't an alias, it's a guess. Each alias needs a source (extract quote or curated-record citation) — an unsourced alias is a leak-ban hole.

---

## 9. Input contract

The composer feeds the generator exactly this (JSON):

```json
{
  "place": {
    "place_id": "gn-1275339",
    "name": "Mumbai",
    "country": "India",
    "subdivision": "Maharashtra",
    "lat": 19.076,
    "lon": 72.8777
  },
  "curated_aliases": ["Bombay"],
  "extracts": [
    {
      "article": "Mumbai",
      "url": "https://en.wikipedia.org/wiki/Mumbai",
      "text": "full intro extract text…"
    }
  ]
}
```

**[DRAFT CHOICE]** — Extracts are full intro texts (not pre-cut sentences), so the generator can find the mechanism/extreme the validator will demand verbatim quotes for. The curated pool guarantees substantive articles (workflow step A); thin extracts trigger §6, not improvisation.

---

## 10. Output contract

One JSON object per place. Accepted sets:

```json
{
  "schema": "meridian.loop.clues.v1",
  "status": "accepted",
  "place_id": "gn-1275339",
  "answer": {
    "name": "Mumbai",
    "aliases": ["Bombay"],
    "country": "India",
    "subdivision": "Maharashtra",
    "lat": 19.076,
    "lon": 72.8777,
    "difficulty": 2
  },
  "clues": [
    {
      "tier": 1,
      "tier_name": "geography",
      "text": "…",
      "narrowing": "rules out everything outside western coastal India",
      "source": { "article": "Mumbai", "url": "https://…", "quote": "…" }
    },
    { "tier": 2, "tier_name": "climate", "text": "…", "narrowing": "…", "source": {…} },
    { "tier": 3, "tier_name": "history", "text": "…", "narrowing": "…", "source": {…} },
    { "tier": 4, "tier_name": "hook", "text": "…", "narrowing": "…", "source": {…} },
    { "tier": 5, "tier_name": "giveaway", "text": "…", "narrowing": "…", "source": {…} }
  ]
}
```

Rejected sets: the §6 rejection record (same `schema`, `"status": "rejected"`, no `clues`).

**Field notes:**
- `narrowing` **[DRAFT CHOICE]** — one line per clue stating what it rules out. Reasoning: it makes the narrowing test (§2) auditable by the validator and the human reviewer instead of vibes-based. Cheap to write, expensive to fake.
- `answer` block: internal pipeline identity. **[DRAFT CHOICE]** — the published per-day file (`public/loop/clues/{index}.json`) is assembled by **stripping `answer.name`, `answer.aliases`, and region tags**, keeping only target coords + the five clue texts + source links, per the tech lens: *"Clue files contain target coords + 4 clues + source link; NEVER the place name or region tags"* (five clues in the evolved ladder). The generator emits the full record; assembly strips it. This keeps validation (which needs the name for the leak scan) and publication (which must never leak it) from sharing a format.
- `schema` version string: so the validator can refuse records written against a different prompt version.

---

## 11. Illustrative example (not validated — for Veeresh's judgment only)

Place: Paris. *Every line below is illustrative; a real set would carry verbatim quotes and pass the validator.*

- **T1 Geography:** "A capital city in western Europe, sitting on a famous river about a three-hour train ride south of London." *(narrowing: rules out everything outside NW Europe)*
- **T2 Climate:** "Winters here are damp and grey rather than snowy — the nearby ocean keeps the cold from ever settling in for long." *(narrowing: rules out continental-climate capitals; teaches ocean-moderation)*
- **T3 History:** "It grew from a 3rd-century Roman town called Lutetia into the seat of French kings." *(narrowing: shortlist of old Roman-origin capitals)*
- **T4 Hook:** "Revolutionaries stormed its royal prison on July 14th — the day the country still celebrates every year." *(near-decisive; retellable)*
- **T5 Giveaway:** "Its iron lattice tower, built for the 1889 World's Fair, was meant to be torn down after 20 years." *(converts; never says the name)*

---

## 12. Choices & Veeresh's rulings (2026-10-04)

| # | Choice | Status |
|---|--------|--------|
| 1 | Clue length 15–40 words | Stands as drafted |
| 2 | Reading age ~10 | **LOCKED** |
| 3 | Verbatim `quote` per clue | Stands as drafted |
| 4 | Set-level rejection (five-clue fail-closed) | **LOCKED** |
| 5 | Difficulty = guessability 1–5 | Stands as drafted |
| 6 | Substring+diacritic leak rule (strict) | **LOCKED** |
| 7 | Name-meaning translations banned | Stands as drafted |
| 8 | `narrowing` line per clue | Stands as drafted |
| 9 | Assembly strips identity | Stands as drafted |
| 10 | Narrowing test extended to tiers 2/4/5 | Stands as drafted |

**Explicit non-goals (per synthesis):** guess mechanic, day scheme, share grammar, and mode code are specified elsewhere — this prompt covers clue content only.
