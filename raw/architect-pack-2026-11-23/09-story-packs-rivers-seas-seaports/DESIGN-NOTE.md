# Design note — next story packs: Rivers · Seas & Oceans · Famous Seaports

**Status: mockups only, for the owner's design approval. No build in this run.**
Screens: `screens/01–07` (.html + .png, 390px phone width).

## How every pack plugs in [observed]

Same machinery as Capitals (PR #323): a manifest + sidecar of cases dealt from the
pack's own shelf chip inside GeoDetective and Cold Trail — never a standalone mode.
Every case screen carries a briefing in the shipped Direction A pattern
(`packBriefingText`: "Your case: find the capital of Russia."), so the player is
always told exactly what point is being asked for. Curated greatest-hits only,
never exhaustive — that rule is what keeps each deck small and every case famous.

The one design problem these packs share: the games tap **points**, but a river is
a line and an ocean is an area. Each pack below answers that with a target rule,
and the mockups show the rule working, not just state it.

---

## 🏞️ Rivers — mockups 02 (GeoDetective) + 05 (Cold Trail)

- **Target semantics:** one famous point *on* the river — its **mouth**, its
  **source** (only where the source itself is famous), or the **famous city it
  flows through**. The tap lands on that point; the river is the story, never
  the target.
- **Briefing:** "Your case: find where the River Nile meets the sea." /
  "find the city of Vienna, on the River Danube." The river is named up front
  because the point is defined by it — the mystery is *where*, not *which river*.
- **Clue-writing rule:** clues are written to the point, in the shipped five tiers
  (Geography / Climate / History / The Hook / Giveaway). Early clues may travel
  the river's whole journey (length, lands it crosses); the Giveaway names the
  point plainly. No clue may describe only the line ("somewhere along…").
- **Example cases:** the Nile → its mouth on the Mediterranean (mockup 02);
  the Danube → Vienna, the famous city it flows through; the Amazon → its mouth
  on the Atlantic. Cold Trail mirrors: hideout at the point, witnesses in famous
  towns along the same river (mockup 05: Aswan / Cairo / Alexandria → the mouth).
- **Deck size sketch:** ~24 cases (the world's most famous rivers fit the bar at
  roughly two dozen once each must offer a famous point).
- **Honesty verdict: FIT, with the point rule.** A "tap somewhere on the river"
  case would be unjudgeable and is excluded by the rule above — no such case
  can be written under it.

## 🌊 Seas & Oceans — mockups 03 (GeoDetective) + 06 (Cold Trail)

- **Target semantics:** a famous **island** or **coastal point** *in* the named
  sea. The sea is the hunting ground and the theme; the island takes the tap.
  Open water is never a target.
- **Briefing:** "Your case: find the island of Santorini, in the Aegean Sea." —
  both halves stated: the sea (theme) and the point (the ask).
- **Clue-writing rule:** clues are written to the island/coastal point; the
  sea's own fame (its storms, its trade routes, its myths) belongs in The Hook,
  never as a substitute for a point clue. A case is only admitted if a child
  could point at its target on a globe.
- **Example cases:** the Aegean Sea → Santorini (mockup 03); the Caribbean Sea →
  Jamaica; the Indian Ocean → the Maldives. Cold Trail mirrors: witnesses on the
  shores and islands around the same sea, hideout on the island in the middle
  (mockup 06: Athens / Heraklion / Rhodes → Santorini).
- **Deck size sketch:** ~18 cases (famous seas with a famous island or point
  run out faster than rivers do — that is the greatest-hits bar working).
- **Honesty verdict: FIT only under the island/coastal-point rule.** An ocean as
  an area target would be dishonest in a point game; under this rule no pack
  case ever asks for water. If a future case cannot name a famous point, it
  does not enter the deck — the pack stays smaller instead.

## ⚓ Famous Seaports — mockups 04 (GeoDetective) + 07 (Cold Trail)

- **Target semantics:** the port itself. A port is already a point — this pack
  needs no translation, and its cases play exactly like capitals.
- **Briefing:** "Your case: find the port of Singapore."
- **Clue-writing rule:** the shipped five tiers, written to the harbour city —
  its strait or bay in Geography, its trade fame in The Hook, "the ships of
  every land stop here" class of Giveaway. Story hooks are plentiful (end of
  the Trans-Siberian line, the busiest strait on Earth), which is why these
  cases already read well in the core deck.
- **Example cases:** Singapore (mockup 04); Rotterdam; New York Harbor.
  Cold Trail mirrors: witnesses and hideouts are all ports (mockup 07:
  London / Antwerp / Hamburg → Rotterdam), so the sighting stories stay in
  one world of ferries, docks, and cranes.
- **Deck size sketch:** ~24 cases.
- **Honesty verdict: FIT, natively.** The strongest of the three packs,
  mechanically.

## ❓ Owner decision — the seaport migration question (not decided here)

Famous-seaport cases already exist in the core deck — Vladivostok (the case from
today's complaint) is one: a core case the owner met while believing he was in
the Capitals deck. A Famous Seaports pack gives those cases a labelled home, but
what happens to the core copies is your call:

1. **Also in the pack** — the same case can be dealt from either deck. Simplest
   to build; a case solved in one deck may greet the player again in the other.
2. **Core-only** — the pack holds only ports that are not already core cases.
   No repeats; the pack's "greatest hits" claim weakens (Vladivostok,
   Singapore-class ports would be missing from a pack named Famous Seaports
   whenever they already live in core).
3. **Move to the pack** — seaport cases leave the core deck. Cleanest shelves;
   the core deck shrinks, and saved core-deck progress counts shift.

The deck-labelling half of today's complaint is already reflected in these
mockups independent of your pick: every pack case screen names its deck in the
eyebrow ("GeoDetective · Famous Seaports ★") and states its ask in the briefing.

## What approval starts

On your "use them" (as with the band-motion mockups), the build is a separate
dispatch: content packs per deck above, generated through the same pipeline as
Capitals, each PR stopping at READY for your per-PR merge word. Nothing in this
note is a build order yet.
