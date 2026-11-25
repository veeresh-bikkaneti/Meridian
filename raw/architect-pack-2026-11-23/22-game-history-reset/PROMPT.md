# 22 — "Reset my history" in the Review screen

## Intent (one line)
Let a player delete past misses and game history and start over, from a control in the Review screen, with a two-step confirmation naming exactly what gets deleted.

## Why (origin)
Owner-requested control: kids share devices and inherit each other's misses. The reset clears the misses deck, learning records, seen-history, and any paused run that could re-seed them — while keeping badges, settings, and the age profile. The same work fixed the REVIEW button overlay on the card artwork.

## Scope IN
- The reset control + two-step confirmation; the overlay fix with a phone-width overlap test as proof.

## Scope OUT
- Resetting badges, settings, or the age profile (explicitly kept).

## Locked decisions
- Confirmation names exactly what gets deleted (no vague "clear data?").
- A paused run that could re-seed history is cleared too — a reset that quietly resurrects is a failed reset.

## Acceptance criteria
- Owner's phone check: reset on a real device, confirm the misses deck/history are gone and badges/settings/profile survive.

## Assets & related work (in this folder)
- `GOAL.md` — the goal record (scope + what is kept/cleared).

## Open questions for the architect
1. Is two-step confirmation enough friction for an irreversible delete in a kids' app, or should reset sit behind the grown-ups gate like other parent surfaces?

## Status & evidence
- Reset + overlay fixes live on build `b09a5c3` (goal record, 2026-11-07). The owner's phone check is still pending — that check is the only open item.
