# ADR-0001: Share-tag ownership — the page owns, the platform fills gaps

**Status:** Accepted
**Date:** 2026-10-15
**Deciders:** Veeresh (owner)

## Context
Share previews (og:*, twitter:*) were missing on GitHub Pages and partial on Workers.
Two emitters exist: `head()` in src/routes/__root.tsx (both builds) and the platform
injector in server/middleware/grok-pwa.ts via scripts/grok-pwa-shared.mjs (Workers only).
The injector used to strip every share tag and re-inject its own from site.json, so
Workers served 8 of 12 tags with og:type `x:game` and no og:url or twitter text tags.

## Decision
The page owns its share tags. The injector keeps any share tag already in the page and
adds only missing ones. Pages and Workers both serve the same 12 tags exactly once,
each with its own origin. Pages with no share tags still get the platform's set.

## Options considered
| Option | Complexity | Risk | Verdict |
|---|---|---|---|
| A. Injector overwrites (old) | Low | Pages and Workers disagree; head() edits silently lost on Workers | Rejected |
| B. Page owns, injector fills gaps (chosen) | Low | Two emitters can drift | Accepted |
| C. Remove the injector, head() only | Medium | Other pages lose their fallback tags; touches platform code | Deferred |

## Consequences
- Easier: one place (head() + site.json) to change the card; both hosts match.
- Harder: a wrong tag in head() is no longer corrected by the injector.
- Watch: drift between the two emitters. Guarded by the built-output tests for both builds, which assert all 12 tags.

## Follow-ups
1. [ ] New og.jpg (#156): it still says "FIVE PLACES".
2. [ ] Optional: a test that both builds' tag values match except for origin.
3. [ ] Revisit option C if the injector is removed from the platform.
