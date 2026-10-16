# The Meridian Product & Decision Handbook

*Everything Veeresh and Chitti have decided about Meridian — and why — written for
the next person (or the next AI agent) who joins the work.*

---

## Welcome

Meridian is a free geography game for kids: *guess the place, then read its story.*
It was built decision by decision — scoring formulas argued over, character voices
cast like actors, copy locked word by word. This handbook is the record of those
decisions, with the reasoning attached, so a newcomer can help improve Meridian
without re-litigating what's settled or breaking what matters.

**How to use it.** Read the chapters in order the first time. After that, treat it
as a reference: before you change anything, find its chapter and check whether the
thing you're touching is a *decision* (with a reason and usually a date) or an
accident of history. Decisions get changed by Veeresh, on the record — never
silently. Anything marked **OPEN** is genuinely undecided; your input is welcome
there.

**The one rule above all rules:** if any document — including this one — says
"the owner decided," it must be traceable to Veeresh's actual words. If you can't
trace it, treat it as a claim, not a fact, and ask.

## The chapters

| # | Chapter | What it answers |
|---|----------|------------------------------------------------------|
| 1 | [Product vision](01-product-vision.md) | What Meridian is for, who it's for, what success means |
| 2 | [Game design decisions](02-game-design-decisions.md) | Editions, dealing, scoring, reveals, share — the game's rules and their whys |
| 3 | [Characters: Storyteller & Grandpa](03-characters-storyteller-and-grandpa.md) | Who they are, how they speak, their exact locked words, their voices |
| 4 | [Audio & TTS](04-audio-and-tts.md) | The Kokoro natural-tone pipeline, voice casting, SFX, and the newcomer traps |
| 5 | [Content system](05-content-system.md) | How story cards and clues are written, gated, and kept honest |
| 6 | [Design & UX decisions](06-design-and-ux-decisions.md) | The map, the home page's history, accessibility as a product value |
| 7 | [Engineering & ops](07-engineering-and-ops.md) | Stack, flags, gates, crash reporting, and the merge traps |
| 8 | [How we work](08-how-we-work.md) | The people, the review pipeline, the merge law, the scar tissue |
| 9 | [Onboarding](09-onboarding.md) | Your first week: what to read, how to ship a change, the glossary |

## The drawings

Diagrams live inside the chapters, drawn in Mermaid so they version with the text:

- **Edition / picker / dealing flow** — chapter 2
- **TTS production pipeline** — chapter 4
- **Content pipeline** — chapter 5
- **System architecture** (browser → hosts → crash worker → Discord) — chapter 7
- **Review-and-merge pipeline** — chapter 8

## Keeping this book true

- New decision? Add it to its chapter **with the date and Veeresh's words** — not a
  paraphrase of his words, his words.
- Decision reversed? Don't delete the old one; mark it superseded, by what, and when.
  The history is half the value.
- Found an error? The correction process is the project's culture in miniature:
  say it plainly, fix it everywhere it spread, and note the fix.

*Assembled 2026-10-16 by Chitti from a five-writer technical-writing panel,
grounded in the project memory, the repository docs, and Veeresh's recorded
decisions. Sources are listed at the end of every chapter.*
