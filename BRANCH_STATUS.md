# Branch status — fix/200-journal-src-parser

Issue: #200 — journal dataset generator: one-line `src()` parser gotcha.

## Done
- [x] Read issue #200 in full; verified the trap first-hand: the `source:` regex in `parseCatalog()` had no `\s*` after `src(`, before the comma, or before `)`, so a formatter-wrapped call parsed as `source: null` and the place was silently excluded.
- [x] Parser hardened: the regex now tolerates line breaks at every whitespace point inside `src(...)` (after `src(`, around the comma, before `)`). One-line calls parse exactly as before.
- [x] Loud fail: a present-but-unparseable `src(` call throws, naming the place, instead of degrading to a silent exclusion. A genuinely missing `source:` field still parses as `null` and is excluded/reported per spec §1 (existing tests pin this).
- [x] Tests: 6 new cases in `scripts/build-journal-dataset.test.mjs` — wrapped after `src(`, wrapped before `)`, wrapped before the comma, wrapped after the comma (regression pin — that shape already parsed), the fully wrapped Prettier shape, and the loud-fail case. File total 27/27.
- [x] Docs: the gotcha + fix documented in the generator's header comment, in the `parseCatalog` doc comment, and in `docs/journal-spec.md` §1.
- [x] Real regeneration is byte-stable: `node scripts/build-journal-dataset.mjs` on the real catalog reports 106 notes included (Chimney Rock among them) and leaves `src/components/home-journal.data.ts` unchanged.

## Pending
- [ ] Full gates: `npx tsc --noEmit`, `npm test`, `node scripts/lint-cards.mjs`, `npm run build:pages`
- [ ] PR opened (no merge — owner merges)

## Notes
- Coordinator D (QA & Performance + Narrative squad); #193 shipped as PR #256, #191/#199/#214 on sibling branches.
