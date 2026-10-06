# Globe naming follow-up (PARKED — not approved)

**Status:** backlog. Veeresh approved symmetric **country-level** naming for
globe edition on 2026-10-05 ("Your pin: Brazil · True spot: Angola") and
explicitly parked the city-level variant below. Do NOT build without a fresh
explicit approval.

## The parked idea
Globe-edition reveal could name the player's pin at city level, honestly
qualified: "Your pin: near Cuiabá · True spot: near Luanda" (or with country
suffixes: "near Cuiabá, Brazil · near Luanda, Angola").

## Why it was parked
- **Honesty risk:** the pin is a raw lat/lon, not a named place; a
  nearest-city name at globe scale can mislead kids more than it teaches
  (nearest-pool-place budgets, cross-border gates, and ocean pins all need
  fail-closed design first).
- **Kid clarity:** country-level symmetry is the clearer, simpler contract
  for a game whose players are learners; city-level naming adds reading
  load to the miss card.
- The machinery (nearestPoolPlace, 100 km honesty budget, territory-key
  gate) already exists in `src/game/reverse-geocode.ts` from the country
  edition — a future crew would reuse it, not rebuild it.

## What a future build would need
1. A fail-closed globe-only branch in `revealPinLine` that names both sides
   with the same qualifier (never the pin without it).
2. Kid-readable disambiguation when nearest places share names
   (e.g. multiple "San Juan"s across countries).
3. Updated unit + E2E assertions (the current globe specs assert the
   country-level contract; changing them silently would be a regression
   of Veeresh's decision).
4. Veeresh's explicit go-ahead on the exact copy ("near …" vs "around …").

## Reference
- Game-review crew decisions, 2026-10-05: item 2 — globe naming = ship
  symmetric country-level now; city-level parked as follow-up, NOT approved.
- Implementation: PR for `fix/globe-naming-pin-legend` (country-level),
  `src/game/reverse-geocode.ts` → `revealPinLine` globe branch.
