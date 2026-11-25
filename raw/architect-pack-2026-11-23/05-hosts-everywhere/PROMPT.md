# 05 — Hosts everywhere (Holmes & Watson beyond GeoDetective)

## Intent (one line)
Extend the Holmes & Watson pair's presence from GeoDetective into Meridian's other games and surfaces, under one consistent set of hosting rules.

## Why (origin)
Owner programme, council-run 2026-11-06 (12 seats). The pair is live in the detective games (PRs #356/#538, flags `detectivePair`, `pair3d` on). The council settled the design positions below; **four rulings are still awaited from the owner** before any build.

## Scope IN
- Doors + celebrations on every surface; in-play hosting GeoDetective-only; Cold Trail silent door hand-off (zero lines); Jolly's moments stay Jolly's (≥75%).

## Scope OUT
- Any build before the owner's four rulings. Re-litigating settled council positions.

## Locked decisions (council, 2026-11-06)
- Handshake: game-end only.
- Pennant: HELD by Watson, on the celebration card only.
- Copy rules — BANNED: plant / claim / conquer / territory / "charting the unknown" / discovered. ALLOWED: found / visited / we were here / charted on our chart.
- The programme adds exactly 1 spoken line.

## Acceptance criteria
- Owner rules on the four awaited points; only then a build brief exists.
- Any hosting addition passes the owner-config playthrough gate.

## Assets & related work (in this folder)
- `GOAL-friend-challenges.md` — adjacent programme record (challenges surfaces interact with hosting).
- Full council record: 2026-11-06 hosts-everywhere council (12 seats) in the session/memory record.

## Open questions for the architect
1. Are the council's settled positions (handshake at game-end only, pennant scope, copy bans) the right constraints, or do they over/under-reach?
2. Which surface should host first once rulings land, and what proves it works?

## Status & evidence
- Pair itself LIVE (PR #538 merged 2026-11-19; flags verified live 2026-11-17). Hosts-everywhere build: not started; 4 rulings awaited since 2026-11-06.

**Verified 2026-11-23 (pack v2):** unchanged on main — `hostsStaging: true`, `detectiveFlank: false` in `public/flags.json`; the 4 rulings are still awaited. (PR #573 moved `DetectivePair` into shared UI, layer 4 — placement only.)
