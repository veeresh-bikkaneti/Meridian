# fix/workers-deploy-parity

**Task:** QA/UIUX council fix (2026-11-16): close the deploy-parity gap
between the two live builds. The council proved by fetching both
shells that the Workers (SSR) build — the site most users use — lacks
the `?nosw=1` escape hatch and the crash watchdog that the Pages build
injects into its shell, and that the two builds report different
build-id formats (Workers `0d47ad5`, 7 chars, from the git fallback;
Pages `0d47ad5fab3b`, 12 chars, from GITHUB_SHA). A returning user
with a wedged service worker on the main site had no self-rescue, and
boot failures there left no report.

**Owner calls used:**

- Radhae, 2026-11-16: QA + UI/UX council to find what else is broken
  on the live workers.dev site and fix it before handover.

**Status:** Built and gated locally; draft PR, awaiting the owner's
merge word. Base: main 0d47ad5f (verified 2026-11-16).

## Done

- `server/middleware/grok-pwa.ts`: HTML responses now also stream in
  the hatch (before `</head>`, so it runs before bundle code) and the
  crash watchdog (before `</body>`), through a generic close-tag
  injector. Both are marker-idempotent.
- `scripts/grok-pwa-shared.mjs`: `createCloseTagInjector` (streaming
  tail-window injector: bytes flow with only a small tail held back,
  insertion happens at the byte offset and the stream is never decoded
  as UTF-8, so chunk splits — including mid-character — are safe;
  documents without the close tag pass through unchanged);
  `snapshotBuildId` (reads the prebuild-baked `public/build-meta.json`
  — the same source and the same "unknown" fallback as the Pages
  watchdog plugin, so the identical-stamp claim holds on the standard
  prebuild path; a bare `vite build` without prebuild bakes "unknown",
  exactly as the Pages watchdog does there); re-exports of the two
  renderers so the middleware consumes them through the shared seam.
  Matching declarations in `grok-pwa-shared.d.mts`.
- Panel review (2026-11-16) BLOCKED the first injector version on two
  measured defects — whole-stream UTF-8 decoding corrupted characters
  split across chunks, and buffering to `</body>` defeated streaming
  and delayed the rescue scripts. The tail-window rewrite above is
  the cure; two regression pins cover both defects (145/145 suites).
- `scripts/grok-pwa-plugin.mjs`: the `virtual:grok-og-identity` module
  also bakes `grokBuildId` (declaration added in
  `server/virtual-grok-og-identity.d.ts`).
- `scripts/build-id.mjs`: the git fallback now returns the same
  12-character prefix as the GITHUB_SHA path, so local and Workers
  builds stamp identically to Pages.
- Tests: 143/143 across grok-pwa-plugin, build-id, crash-watchdog,
  nosw-hatch and build-meta-plugin suites (new pins for the injector,
  snapshotBuildId and the 12-char fallback). `tsc --noEmit` clean.
  Workers `vite build` green, and the built server bundle was checked:
  it contains the hatch + watchdog wiring with `grokBuildId` baked
  from build-meta.json.

## Next step

Owner review with one extra check this branch could not do locally:
after deploy, fetch the workers.dev shell and confirm both markers
are present in the served HTML (the sandbox cannot execute the
deployed Worker). The repo's Playwright e2e targets the Pages
artifact, so the SSR path has no e2e coverage — a preview-deploy
smoke check before merge is the prudent gate.

## Open questions

- None for this branch. Whether the prompt-style service-worker
  update policy should change stays the owner's standing decision
  (deliberately not touched here).

## Ruled out

- Baking the build id via resolveBuildId() in the plugin: its
  timestamp fallback could diverge from the id in build-meta.json;
  snapshotBuildId reads the same baked file the Pages watchdog uses.

## Graph

- None.
