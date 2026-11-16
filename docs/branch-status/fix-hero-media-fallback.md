# fix/hero-media-fallback

**Task:** QA/UI-UX council fix (2026-11-16): harden the Why Learn hero
media path. The montage film and poster were the one picker asset class
the service worker did not handle at all (straight to network, HTTP
`max-age=0` revalidation on every visit), the poster `<img>` in
WhyLearnHero had no `onError`, and the `failed` latch never reset — one
transient media failure at mount could empty or freeze the hero slot
for a whole session for a returning, SW-controlled user.

**Owner calls used:**

- Radhae, 2026-11-16: QA + UI/UX council to find what else is broken on
  the live workers.dev site and fix it before handover; the montage
  must play for returning users, not only in fresh sessions.

**Status:** Built and gated locally; draft PR, awaiting the owner's
merge word. Base: main 0d47ad5f (verified 2026-11-16). Companion to
fix/art-off-content-visibility (the council's primary root-cause fix);
this branch is the defence-in-depth half. The two branches both add a
test block to `why-learn-hero.test.ts` at different anchors and both
touch `src/styles.css` in different sections — a trivial rebase may be
needed for whichever lands second.

## Done

- `public/sw.js`: new fetch branch for `<BASE>videos/` — network-first
  with a cache fallback in the versioned asset cache; only full 200
  responses are cached (never a 206 range response). Strategy comment
  updated. Network-first (not cache-first) because the film/poster URLs
  are unhashed and re-cuts ship by replacing the files in place.
  Panel-review disclosures (2026-11-16): (a) the branch matches all of
  `videos/`, so the journal manifests and caption files under it get
  the same network-first + last-good-offline treatment — online
  behaviour unchanged, offline strictly better; the journal clips
  themselves are cross-origin and untouched. (b) The poster is a
  plain GET and is reliably cached; the film is normally range-fetched
  (206, never cached), so this branch does NOT deliver offline film
  replay — its film-side wins are a fresh cut online and no stale pin.
  (c) The offline range-request fallback (a stored 200 answering a
  Range request) is unverified in a real browser; the new pin checks
  the branch's shape only.
- `src/subjects/shared/WhyLearnHero.tsx`: poster `<img>` gains
  `onError` → a final labelled panel (`role="img"`, the montage alt
  text) in the same hero box; `failed`/`posterFailed` latches clear on
  `online` and on return to a visible tab, so the media retry.
- `src/styles.css`: `.why-learn-hero-still` panel styling in the hero
  section.
- Tests: new pins in `why-learn-hero.test.ts` (fallback chain + retry)
  and `scripts/pwa-base-path.test.mjs` (videos branch shape). Targeted
  gates: hero suite 13/13, pwa-base-path + fingerprint-sw +
  build-meta-plugin + pwa suites green, `tsc --noEmit` clean. Full
  suite and build are carried by CI (see PR body).

## Next step

Owner merges (either order with fix/art-off-content-visibility);
then a returning-user check on workers.dev with a throttled/offline
first load: the hero should come back from cache or recover on
reconnect without a manual reload.

## Open questions

- None for this branch. The bundled-still fallback (importing
  `why-learn-hero.webp` as the last resort instead of a text panel)
  was considered and deferred: the hero test pins media to the
  assetBase seam ("never bundled imports"); the labelled panel keeps
  that invariant. Owner can ask for the bundled still instead.

## Ruled out

- Cache-first for videos: would pin returning users to a stale film
  across re-cuts (URLs are unhashed) until a VERSION bump activates.

## Graph

- None.
