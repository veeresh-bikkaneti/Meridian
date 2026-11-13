# Branch status: fix/turnstile-csp

## Done
- Based on `feat/live-scrum-board` @ `666c90eb756837e64ce4f145578f0bc6a71be5db`
  (PR #436's head at branch time; #436 not merged, main is `8eb34cb4`).
  This branch stacks on #436; its PR targets `main`.
- CSP widened for Cloudflare Turnstile in BOTH policy homes, kept
  identical (drift test): `public/_headers` and
  `src/lib/security-headers.ts` —
  `https://challenges.cloudflare.com` added to `script-src` (widget
  script) and to `child-src` (widget iframe, via the frame-src
  fallback). Nothing else in the policy changed.
- `scripts/security-headers.test.mjs`: new test asserts the Turnstile
  host in `script-src` + `child-src` and pins the full third-party host
  set of the policy (no other host added).
- Verified, unchanged: the Turnstile script is loaded only by
  `src/board/feature-request-form.tsx` (`TURNSTILE_SCRIPT`), i.e. only
  on /board; game pages never request it.

## Next step
- Owner setup before the form can open (owner-only, not in this PR):
  set the `FEATURE_DISCORD_WEBHOOK_URL` and
  `FEATURE_TURNSTILE_SECRET_KEY` Cloudflare secrets, and the Turnstile
  site key in `public/flags.json` (`featureRequestTurnstileSiteKey`).

## Open questions
- None.

## Ruled out
- An explicit `frame-src` directive: not added — the widget iframe
  renders under the `child-src` allowance in the tested Chromium
  (evidence in the PR body). Revisit only if a target browser is shown
  to ignore the child-src fallback.

## Graph
- No nodes or edges added or changed.
