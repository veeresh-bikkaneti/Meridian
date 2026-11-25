# 21 — Contact form → Discord: activation

## Intent (one line)
Finish activating the fixed Contact-us form so submissions actually reach Discord — the build merged; the go-live steps remain.

## Why (origin)
The form used to accept submissions and discard them (issue #220). The wiring fix shipped in PR #284 (merged 2026-10-30): submissions store honestly — the sender is thanked only on `stored: true` — with the mailbox and laptop-companion animations in the delivered spec.

## Scope IN (the remaining activation steps)
1. Smoke tests on the live form.
2. A private Discord test submission.
3. The owner's `contactEndpoint` flip to production.

## Scope OUT
- Rebuilding the form; changing the honesty states (thank-you only on `stored: true` is the shipped contract).

## Locked decisions
- Proof of done = a live `stored: true` test landing in Discord, not a green test suite.

## Acceptance criteria
- A real submission from the live site arrives in the owner's Discord with `stored: true` confirmed; the sender-facing thank-you matches.

## Assets & related work (in this folder)
- `GOAL.md` — the goal record (spec summary, PR #284 state, activation checklist).

## Open questions for the architect
1. Is a Discord webhook the right long-term inbox for a public kids'-product contact form (spam, retention), or a stopgap that should graduate?

## Status & evidence
- Build merged 2026-10-30 (main `4597669`). Activation (smoke tests → Discord test → endpoint flip) still awaits the owner since then.

**Update 2026-11-23 (pack v2):** activation is code-complete on main — `contactEndpoint` is live in `public/flags.json` (`https://meridian.knowledgetest.workers.dev/api/contact`), and Phase 5.1 (PR #550) moved the webhook secret to a runtime-only read (`src/lib/contact/runtime-config.server.ts`). Not verifiable from the repo: the smoke-test evidence of a live `stored: true` delivery. The only residue is the owner's confirmation that a real submission landed in Discord.
