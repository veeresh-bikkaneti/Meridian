# 13 — GeoDetective unbuilt trio: curated first case, pity logic, Web Audio SFX

## Intent (one line)
Three recorded-but-unbuilt GeoDetective improvements: a curated first case for new players, pity logic after consecutive losses, and Web Audio sound effects.

## Why (origin)
Open items on the GeoDetective record since the edition shipped (387 clue files, unlimited shuffled-deck dealing, streak = consecutive solves, bestStreak persisted). Each was named as wanted; none was ever scheduled.

## Scope IN
1. **Curated first case** — a new player's first case is a chosen, famous, welcoming case rather than a shuffle outcome.
2. **Pity logic after 2 losses** — after two consecutive losses, the dealing softens (fame-ordered/easier pool) so a struggling kid meets a winnable case.
3. **Web Audio SFX** — synthesized in-game sound effects for the detective surface (the game's wider audio is TTS narration; SFX are their own layer).

## Scope OUT
- Changing the deck/dealing contract for returning players beyond the pity rule.
- Recorded audio assets where synthesis is specified (SFX are Web Audio, synthesized).

## Locked decisions
- Dealing is fail-closed (`buildRegionPool`: questions always from the selected region's subset) — pity logic must respect region subsets.
- Scoring v3 and the streak definition are settled; pity changes dealing, not scoring.

## Acceptance criteria
- First case: a fresh profile's first dealt case is the curated one, proven in a clean-profile playthrough.
- Pity: after exactly 2 consecutive losses the next case comes from the softened pool; a solve resets the counter; behaviour pinned by tests incl. negative cases (no softening after 1 loss; no softening across regions).
- SFX: sounds play under the owner's sound settings (sound on in his config) and never block clue audio.

## Assets & related work
- Brief-only folder: the record is the GeoDetective section of MEMORY.md and the goal `geodetective-playable-edition-build`.

## Open questions for the architect
1. Pity logic in a learning game: does visible softening teach persistence or teach that losing is rewarded? Should it be invisible?
2. Curated first case: one global case, or one per age band (the game deals per band 8–10 in the owner's config)?

## Status & evidence
- All three still unbuilt (verified on main @ `5930e930`, 2026-11-23). No design pass yet; this brief is the first consolidated statement of the trio.
- **Update 2026-11-23 (pack v2) — the ground moved:** Phase 3 of the architecture programme is complete: all six school subjects (math #555, physics #562, chemistry #566, general-knowledge + journals #568, social studies #572) are now literal, build-validated `SubjectItem` records. GeoDetective's own case content still lives as clue files in the content layer (`src/game/data/**`) under its own validators — that pattern is unchanged.
- What changed for the trio's build: (1) all browser I/O now sits behind the platform ports (Phase 1 Part A, #569; game-app's turn is draft #571) — a screen may not call `fetch`, storage, or `new Audio(` directly, so Web Audio SFX gets a sanctioned home in the platform audio port, and ClueScene audio already moved onto the shared voice gate (#559); (2) dealing/scoring logic lives in the pure domain layer (no React, no browser globals) — pity logic's home is settled by the layer map; (3) any content the curated first case needs follows the validated-records discipline (literal records + a build-time validator), not ad-hoc JSON.
