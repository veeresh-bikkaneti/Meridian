# Screen recordings — auto-animate PR (owner's screen-recording law)

Recorded 2026-10-11 on the built artifact (`npm run build:pages`,
buildId 4c54323) via Playwright `video` on the browser context, served
with `serveBuiltArtifact` on http://127.0.0.1:4123/Meridian/.

- `aa-390-motion-on-full.webm` (390×844, 76s) — full GeoDetective journey,
  motion ON: typing glides suggestions in, guess rows animate in with
  FLIP, case-end reveal card animates in.
- `aa-1280-motion-on.webm` (1280×800, 15s) — abbreviated desktop pass.
- `aa-390-motion-off-reduced.webm` (390×844, 13s) — reduced-motion ON
  (`prefers-reduced-motion: reduce`): zero animation, fully usable
  (type → tap suggestion → submit → read clues).

See the PR body for the timestamp breakdown.
