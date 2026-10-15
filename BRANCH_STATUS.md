# BRANCH_STATUS — feat/share-card

**Ready for review. Owner merges.** One job: when the game link is shared, chat apps show a preview card (title, description, image).

## Done
- `src/lib/og/share-meta.ts` (new): `shareOrigin(baseUrl)` and `shareMetaTags(...)`. Base `/Meridian/` (GitHub Pages) -> `https://veeresh-bikkaneti.github.io/Meridian/`; any other base -> `https://meridian.knowledgetest.workers.dev/` (`BRAND.siteUrl`).
- `src/routes/__root.tsx` `head()`: emits og:title, og:description, og:type=website, og:url, og:image (absolute), og:image:width=1200, og:image:height=630, og:image:alt, twitter:card=summary_large_image, twitter:title, twitter:description, twitter:image. The old, out-of-date `<meta name="description">` ("The run lasts until the pin misses") is replaced.
- `src/lib/og/site.json`: added `description`.
- Copy: `docs/ops/specs/share-card-copy.md` (3 options, claims traced to README/source, Opus review APPROVE-WITH-NITS, final pick = edited option C). Title 46 chars, description 150.
- Tests: `src/lib/og/share-meta.test.ts` (7: both origins, tag set and attributes, length limits, wording, og.jpg is 1200x630). `scripts/share-card-built.test.mjs` (opt-in: `SHARE_CARD_BUILT=pages|workers|both`, run right after the matching build; skipped in plain `npm test`).

## Gates (final code)
tsc clean; `npm test` 1,315 src pass and the scripts suite green (778 tests, 0 fail, 9 skipped); `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` ok and `SHARE_CARD_BUILT=pages` passes; `npm run build` ok and `SHARE_CARD_BUILT=workers` passes (both hosts: all 12 tags exactly once, own origin); `npm run test:worker` 18/18; `npm run typecheck:worker` clean. No E2E spec touches the head tags, so none were run.

## Findings (read before merging)
1. **Workers host: `head()` now wins (owner decision, second commit).** `server/middleware/grok-pwa.ts` used to strip every og:/twitter: tag and re-inject its own, so workers.dev showed a short title ("Meridian"), og:type `x:game`, and no og:url or twitter:title/description/image. `injectGrokPwaHead` in `scripts/grok-pwa-shared.mjs` now keeps any share tag the document already carries and adds only the keys it is missing. Pages and Workers both serve the same 12 tags, each with its own origin. Other apps whose pages carry no share tags get the platform tags exactly as before. `scripts/grok-pwa-plugin.test.mjs`: the "overwrites" test and the x:game:image test now describe keep-existing behaviour; four tests added (keep existing, full set untouched and idempotent, streaming injector keeps head tags, existing x:game:image kept).
2. **`public/og.jpg` is out of date.** It reads "MERIDIAN / FIVE PLACES". The game is endless. Not changed in this PR; tracked in a separate issue.
3. "No ads" is true in the repo (no ad network or library) but was not checked on the live site, so it is not in the copy. "No tracking" is not claimed: optional GA4 and Clarity tags exist.
4. The word "satellite" contains "lite"; a whole-word check passes (and the app already says "satellite" everywhere).

## Not verified
- How WhatsApp/Slack/iMessage/X render the card on real links, and the live pages. Chat apps cache previews; after deploy, refresh with each app's debugger or a changed query string.
- `Workers Builds: meridian` (Cloudflare) fails on PR branches; owner says main's deploy is green. Ignored by owner decision. Real CI is `build (22.x)`.
