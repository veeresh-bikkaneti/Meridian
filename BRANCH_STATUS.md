# BRANCH_STATUS — feat/share-card

**Ready for review. Owner merges.** One job: when the game link is shared, chat apps show a preview card (title, description, image).

## Done
- `src/lib/og/share-meta.ts` (new): `shareOrigin(baseUrl)` and `shareMetaTags(...)`. Base `/Meridian/` (GitHub Pages) -> `https://veeresh-bikkaneti.github.io/Meridian/`; any other base -> `https://meridian.knowledgetest.workers.dev/` (`BRAND.siteUrl`).
- `src/routes/__root.tsx` `head()`: emits og:title, og:description, og:type=website, og:url, og:image (absolute), og:image:width=1200, og:image:height=630, og:image:alt, twitter:card=summary_large_image, twitter:title, twitter:description, twitter:image. The old, out-of-date `<meta name="description">` ("The run lasts until the pin misses") is replaced.
- `src/lib/og/site.json`: added `description`.
- Copy: `docs/ops/specs/share-card-copy.md` (3 options, claims traced to README/source, Opus review APPROVE-WITH-NITS, final pick = edited option C). Title 46 chars, description 150.
- Tests: `src/lib/og/share-meta.test.ts` (7: both origins, tag set and attributes, length limits, wording, og.jpg is 1200x630). `scripts/share-card-built.test.mjs` (opt-in: `SHARE_CARD_BUILT=pages|workers|both`, run right after the matching build; skipped in plain `npm test`).

## Gates (final code)
tsc clean; `npm test` 1,315 src pass (+7 new) and the scripts suite green; `node scripts/lint-cards.mjs` GATE PASSED; `npm run build:pages` ok and `SHARE_CARD_BUILT=pages` passes (all 12 tags + description in `dist/client/_shell.html`, Pages origin only); `npm run build` ok and `SHARE_CARD_BUILT=workers` passes; `npm run test:worker` 18/18; `npm run typecheck:worker` clean. No E2E spec touches the head, so none were run.

## Findings (read before merging)
1. **The Workers host already had share tags, and the server middleware overrides ours there.** `server/middleware/grok-pwa.ts` strips every og:/twitter: tag from the HTML on each request and re-injects its own from `site.json` and the request host. On workers.dev the rendered set is: twitter:card, og:title = "Meridian" (site.json title), og:description (our new text, via site.json), og:type = `x:game`, og:image (workers.dev origin), og:image:width/height; og:image:alt from `head()` survives. Missing there: og:url and twitter:title/description/image; the title is the short "Meridian". That is enough for most chat previews (they read og:*), but it is not the same set as Pages. The Pages shell has the full set. Making `head()` win on Workers needs a small change in `scripts/grok-pwa-shared.mjs` (skip the strip/inject when the document already has og:title) and updates to `scripts/grok-pwa-plugin.test.mjs`. Not done: outside this change's scope.
2. **`public/og.jpg` is out of date.** It reads "MERIDIAN / FIVE PLACES". The game is endless. Needs a new image; not changed here.
3. "No ads" is true in the repo (no ad network or library) but was not checked on the live site, so it is not in the copy. "No tracking" is not claimed: optional GA4 and Clarity tags exist.
4. The word "satellite" contains "lite"; a whole-word check passes (and the app already says "satellite" everywhere).

## Not verified
- How WhatsApp/Slack/iMessage/X render the card on real links, and the live pages. Chat apps cache previews; after deploy, refresh with each app's debugger or a changed query string.
- `Workers Builds: meridian` (Cloudflare) check was red on every earlier PR; real CI is `build (22.x)`.
