#!/usr/bin/env node
/**
 * Test-seam ratchet (TD-10.4): the inventory of test-only shortcuts in
 * shipped src/ lives in docs/branch-status/chore-td-10.4-test-seams.md;
 * this script is its machine half. Shrink-only, like the layer
 * baseline: it fails when
 *
 *   - a NEW seam-shaped hook appears in production src/ that neither
 *     BASELINE nor ALLOWLIST covers (a new seam must be added to the
 *     inventory deliberately, with a cure plan), or
 *   - a BASELINE seam's site stops matching (the seam was removed or
 *     moved — good, but the baseline must shrink in the same change,
 *     so the count only ever goes down on purpose).
 *
 * Detectors (production src/** only; *.test.ts / *.test.tsx skipped):
 *   - `ForTests` / `__reset*` export names,
 *   - `__lowercase` dunder tokens (element/window globals and kin),
 *   - URL params read through URLSearchParams (literal or const name)
 *     or a `[?&]name=` regex literal,
 *   - `element.dataset.<name> =` writes,
 *   - seam comments (`E2E seam`, `Test-only`, `Test seam`, ...),
 *     covered per file: a comment is fine in a file the inventory
 *     already lists a seam for, or in an allowlisted file.
 *
 * Known product hooks are NOT detectors and never fail the run: the
 * `?scale=1` flag turn-on and the board's `?feature` / `?story` URL
 * state are allowlisted below with their reasons, as are production
 * contracts that merely look seam-shaped (the crash watchdog's
 * `window.__meridian_ready`, the server DB singletons, the Nitro
 * `__env__` runtime). Test-only PROPS cannot be detected mechanically
 * (any optional prop could be one); the two inventoried prop seams
 * are pinned by their baseline sites, so removing one still fails
 * the vanish check, and review is the net for new ones.
 *
 * Usage:
 *   node scripts/check-test-seams.mjs [--root <dir>]
 *
 * Default root is the repo root (this script's parent directory).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* One entry per inventoried seam. `sites` are the places the hook
 * lives today (every site must still match, or the baseline is
 * stale); `covers` are the (file, pattern) pairs whose lines the
 * detectors may legitimately hit for this seam. */
export const BASELINE = [
  // -- URL params: runtime-reachable by any visitor ----------------
  {
    id: "url-loop-puzzle",
    sites: [
      { file: "src/game/loop/day.ts", pattern: /LOOP_PUZZLE_PARAM = "loop-puzzle"/ },
      { file: "src/game/loop/LoopScreen.tsx", pattern: /loopPuzzleFromSearch\(location\.search\)/ },
    ],
    covers: [
      { file: "src/game/loop/day.ts", pattern: /LOOP_PUZZLE_PARAM/ },
      { file: "src/game/loop/LoopScreen.tsx", pattern: /loopPuzzleFromSearch/ },
    ],
  },
  {
    id: "url-idle-ms",
    sites: [
      { file: "src/game/session.ts", pattern: /\[\?&]idle-ms=/ },
      { file: "src/components/game-app.tsx", pattern: /idleTimeoutFromSearch\(window\.location\.search\)/ },
    ],
    covers: [
      { file: "src/game/session.ts", pattern: /idle-ms/ },
      { file: "src/components/game-app.tsx", pattern: /idleTimeoutFromSearch/ },
    ],
  },
  {
    id: "url-celebration",
    sites: [
      { file: "src/components/celebration-copy.ts", pattern: /CELEBRATION_PARAM = "celebration"/ },
      { file: "src/components/game-app.tsx", pattern: /celebrationSeamSpec\(window\.location\.search\)/ },
    ],
    covers: [
      { file: "src/components/celebration-copy.ts", pattern: /CELEBRATION_PARAM/ },
      { file: "src/components/game-app.tsx", pattern: /celebrationSeamSpec/ },
    ],
  },
  // -- DOM / window contracts --------------------------------------
  {
    id: "dom-spot-screen",
    sites: [{ file: "src/map/satellite-map.tsx", pattern: /__spotScreen/ }],
    covers: [
      { file: "src/map/satellite-map.tsx", pattern: /__spotScreen/ },
      // LoopMap's seam comment names this hook as the one it mirrors.
      { file: "src/game/loop/LoopMap.tsx", pattern: /__spotScreen/ },
    ],
  },
  {
    id: "dom-project",
    sites: [{ file: "src/map/satellite-map.tsx", pattern: /__project/ }],
    covers: [{ file: "src/map/satellite-map.tsx", pattern: /__project/ }],
  },
  {
    id: "dom-boundary-band",
    sites: [{ file: "src/map/satellite-map.tsx", pattern: /__boundaryBand/ }],
    covers: [{ file: "src/map/satellite-map.tsx", pattern: /__boundaryBand/ }],
  },
  {
    id: "dom-loop-map",
    sites: [{ file: "src/game/loop/LoopMap.tsx", pattern: /__loopMap/ }],
    covers: [{ file: "src/game/loop/LoopMap.tsx", pattern: /__loopMap/ }],
  },
  {
    id: "dom-molecule-map-probes",
    sites: [
      {
        file: "src/board/molecule-map.tsx",
        pattern: /dataset\.(bondCount|drawCalls|triangles|probeX|probeY|probeSlug)/,
      },
    ],
    covers: [
      {
        file: "src/board/molecule-map.tsx",
        pattern: /dataset\.(bondCount|drawCalls|triangles|probeX|probeY|probeSlug)/,
      },
    ],
  },
  {
    id: "win-meridian-gpu",
    sites: [{ file: "src/map/present/webgpu-presenter.ts", pattern: /__meridianGpu/ }],
    covers: [{ file: "src/map/present/webgpu-presenter.ts", pattern: /__meridianGpu/ }],
  },
  // -- Test-only exports, client modules ---------------------------
  {
    id: "reset-read-aloud-pref-memory",
    sites: [{ file: "src/game/age-profile/read-aloud-pref.ts", pattern: /__resetReadAloudPrefMemory/ }],
    covers: [{ file: "src/game/age-profile/read-aloud-pref.ts", pattern: /__resetReadAloudPrefMemory/ }],
  },
  {
    id: "reset-age-profile-memory-fallback",
    sites: [{ file: "src/game/age-profile/store.ts", pattern: /__resetMemoryFallback/ }],
    covers: [{ file: "src/game/age-profile/store.ts", pattern: /__resetMemoryFallback/ }],
  },
  {
    id: "reset-detective-session-intro",
    sites: [{ file: "src/game/loop/detective/DetectiveHost.tsx", pattern: /__resetDetectiveSessionIntro/ }],
    covers: [{ file: "src/game/loop/detective/DetectiveHost.tsx", pattern: /__resetDetectiveSessionIntro/ }],
  },
  {
    id: "reset-detective-manifest-cache",
    sites: [{ file: "src/game/loop/detective/detective-audio.ts", pattern: /__resetDetectiveManifestCache/ }],
    covers: [{ file: "src/game/loop/detective/detective-audio.ts", pattern: /__resetDetectiveManifestCache/ }],
  },
  {
    id: "reset-passport-badge-memory",
    sites: [{ file: "src/game/passport/badges.ts", pattern: /__resetPassportBadgeMemory/ }],
    covers: [{ file: "src/game/passport/badges.ts", pattern: /__resetPassportBadgeMemory/ }],
  },
  {
    id: "reset-play-guards",
    sites: [{ file: "src/game/audio/play-guards.ts", pattern: /export function resetPlayGuards/ }],
    covers: [{ file: "src/game/audio/play-guards.ts", pattern: /resetPlayGuards/ }],
  },
  {
    id: "clear-chunk-cache-for-tests",
    sites: [{ file: "src/game/generated-places.ts", pattern: /clearChunkCacheForTests/ }],
    covers: [{ file: "src/game/generated-places.ts", pattern: /clearChunkCacheForTests/ }],
  },
  {
    id: "loaded-globe-tiers-for-tests",
    sites: [{ file: "src/game/generated-places.ts", pattern: /loadedGlobeTiersForTests/ }],
    covers: [{ file: "src/game/generated-places.ts", pattern: /loadedGlobeTiersForTests/ }],
  },
  {
    id: "recognized-country-count-for-tests",
    sites: [{ file: "src/game/place-name.ts", pattern: /recognizedCountryCountForTests/ }],
    covers: [{ file: "src/game/place-name.ts", pattern: /recognizedCountryCountForTests/ }],
  },
  {
    id: "territory-load-runs-for-tests",
    sites: [{ file: "src/game/territory.ts", pattern: /territoryLoadRunsForTests/ }],
    covers: [{ file: "src/game/territory.ts", pattern: /territoryLoadRunsForTests/ }],
  },
  {
    id: "territory-importer-for-tests",
    sites: [{ file: "src/game/territory.ts", pattern: /territoryImporterForTests/ }],
    covers: [{ file: "src/game/territory.ts", pattern: /territoryImporterForTests/ }],
  },
  {
    id: "territory-conversion-runs-for-tests",
    sites: [{ file: "src/game/territory.ts", pattern: /territoryConversionRunsForTests/ }],
    covers: [
      { file: "src/game/territory.ts", pattern: /territoryConversionRunsForTests/ },
      // reverse-geocode's counter comment cites this hook as precedent.
      { file: "src/game/reverse-geocode.ts", pattern: /territoryConversionRunsForTests/ },
    ],
  },
  {
    id: "admin1-load-runs-for-tests",
    sites: [{ file: "src/game/reverse-geocode.ts", pattern: /admin1LoadRunsForTests/ }],
    covers: [
      { file: "src/game/reverse-geocode.ts", pattern: /admin1LoadRunsForTests/ },
      // territory's counter comment cites this hook as precedent.
      { file: "src/game/territory.ts", pattern: /admin1LoadRunsForTests/ },
    ],
  },
  {
    id: "clear-loop-index-cache",
    sites: [{ file: "src/game/loop/evaluate.ts", pattern: /export function clearLoopIndexCache/ }],
    covers: [{ file: "src/game/loop/evaluate.ts", pattern: /clearLoopIndexCache/ }],
  },
  {
    id: "admin1-chunk-load-runs-for-tests",
    sites: [{ file: "src/game/reverse-geocode.ts", pattern: /admin1ChunkLoadRunsForTests/ }],
    covers: [{ file: "src/game/reverse-geocode.ts", pattern: /admin1ChunkLoadRunsForTests/ }],
  },
  {
    id: "clear-admin1-chunk-cache-for-tests",
    sites: [{ file: "src/game/reverse-geocode.ts", pattern: /clearAdmin1ChunkCacheForTests/ }],
    covers: [{ file: "src/game/reverse-geocode.ts", pattern: /clearAdmin1ChunkCacheForTests/ }],
  },
  {
    id: "reset-first-reveal-narration-for-tests",
    sites: [{ file: "src/components/storyteller-claim.ts", pattern: /resetFirstRevealNarrationForTests/ }],
    covers: [{ file: "src/components/storyteller-claim.ts", pattern: /resetFirstRevealNarrationForTests/ }],
  },
  {
    id: "reset-storyteller-session-for-tests",
    sites: [{ file: "src/components/storyteller-session.ts", pattern: /resetStorytellerSessionForTests/ }],
    covers: [{ file: "src/components/storyteller-session.ts", pattern: /resetStorytellerSessionForTests/ }],
  },
  {
    id: "reset-observability-for-tests",
    sites: [{ file: "src/lib/observability.ts", pattern: /resetObservabilityForTests/ }],
    covers: [{ file: "src/lib/observability.ts", pattern: /resetObservabilityForTests/ }],
  },
  {
    id: "current-voice-owner",
    sites: [{ file: "src/game/audio/voice-channel.ts", pattern: /export function currentVoiceOwner/ }],
    covers: [{ file: "src/game/audio/voice-channel.ts", pattern: /currentVoiceOwner/ }],
  },
  // -- Test-only props ----------------------------------------------
  {
    id: "journal-player-test-overrides",
    sites: [
      { file: "src/components/journal-player.tsx", pattern: /movieUrlOverride/ },
      { file: "src/components/journal-player.tsx", pattern: /transcriptOverride/ },
    ],
    covers: [
      { file: "src/components/journal-player.tsx", pattern: /movieUrlOverride|transcriptOverride/ },
    ],
  },
  {
    id: "map-error-boundary-probe-stale-build",
    sites: [{ file: "src/components/map-error-boundary.tsx", pattern: /probeStaleBuild/ }],
    covers: [{ file: "src/components/map-error-boundary.tsx", pattern: /probeStaleBuild/ }],
  },
  // -- Test-only exports, server modules ----------------------------
  {
    id: "shared-in-memory-limiter-for-tests",
    sites: [{ file: "src/lib/contact/rate-limiter.server.ts", pattern: /sharedInMemoryLimiterForTests/ }],
    covers: [
      { file: "src/lib/contact/rate-limiter.server.ts", pattern: /sharedInMemoryLimiterForTests/ },
      { file: "src/lib/contact/contact-handler.server.ts", pattern: /sharedInMemoryLimiterForTests/ },
      { file: "src/lib/feature-request/feature-request-handler.server.ts", pattern: /sharedInMemoryLimiterForTests/ },
    ],
  },
  {
    id: "reset-rate-limit-binding-lookup-for-tests",
    sites: [{ file: "src/lib/contact/rate-limiter.server.ts", pattern: /resetRateLimitBindingLookupForTests/ }],
    covers: [
      { file: "src/lib/contact/rate-limiter.server.ts", pattern: /resetRateLimitBindingLookupForTests/ },
      { file: "src/lib/contact/contact-handler.server.ts", pattern: /resetRateLimitBindingLookupForTests/ },
      { file: "src/lib/feature-request/feature-request-handler.server.ts", pattern: /resetRateLimitBindingLookupForTests/ },
    ],
  },
  {
    id: "reset-contact-state-for-tests",
    sites: [{ file: "src/lib/contact/contact-handler.server.ts", pattern: /resetContactStateForTests/ }],
    covers: [
      { file: "src/lib/contact/contact-handler.server.ts", pattern: /resetContactStateForTests/ },
      { file: "src/lib/feature-request/feature-request-handler.server.ts", pattern: /resetContactStateForTests/ },
    ],
  },
  {
    id: "reset-feature-request-state-for-tests",
    sites: [{ file: "src/lib/feature-request/feature-request-handler.server.ts", pattern: /resetFeatureRequestStateForTests/ }],
    covers: [
      { file: "src/lib/feature-request/feature-request-handler.server.ts", pattern: /resetFeatureRequestStateForTests/ },
    ],
  },
];

/* Seam-shaped, but production (or not a seam at all). Each entry
 * covers detector hits on matching lines of one file; the reason is
 * the evidence, also written up in the branch-status inventory. */
export const ALLOWLIST = [
  // Product flag turn-on: scalePlay ships dark; `?scale=1` is the
  // flags system's documented one-load opt-in, not a test hook.
  { file: "src/lib/flags.ts", pattern: /SCALE_PLAY_PARAM/, reason: "product flag URL turn-on (?scale=1)" },
  // The grown-ups board's shareable URL state, read and written by
  // the page itself.
  { file: "src/board/board-data.ts", pattern: /params\.get\("(feature|story)"\)/, reason: "board product URL state" },
  // Production crash watchdog (scripts/crash-watchdog.mjs) reads
  // this flag from the served shell; absence after ~28 s is the
  // boot-failure signal.
  { file: "src/components/game-app.tsx", pattern: /__meridian_ready/, reason: "production crash-watchdog signal" },
  // Server DB singletons on globalThis (hot-reload safe caching).
  { file: "src/lib/db.ts", pattern: /__(pg|pglite)/, reason: "server DB singletons" },
  // Nitro/Cloudflare runtime env object, read by server config.
  { file: "src/lib/contact/contact-handler.server.ts", pattern: /__env__/, reason: "Nitro runtime env" },
  { file: "src/lib/contact/rate-limiter.server.ts", pattern: /__env__/, reason: "Nitro runtime env" },
  { file: "src/lib/contact/runtime-config.server.ts", pattern: /__env__/, reason: "Nitro runtime env" },
  { file: "src/lib/feature-request/feature-request-handler.server.ts", pattern: /__env__/, reason: "Nitro runtime env" },
  // Router root file name, mentioned in comments/registry copy.
  { file: "src/components/ui/shell-registry.ts", pattern: /__root/, reason: "router root file name" },
  { file: "src/game/share.ts", pattern: /__root/, reason: "router root file name" },
  { file: "src/game/share-action.ts", pattern: /__root/, reason: "router root file name" },
  { file: "src/components/preview-host-bridge.tsx", pattern: /__root/, reason: "router root file name" },
  { file: "src/lib/flags.ts", pattern: /__root/, reason: "router root file name" },
  // Preview-host integration: the root key the embedded preview
  // chrome registers under, and its manifest path. Inert when the
  // app is not embedded; a host contract, not a test hook.
  { file: "src/lib/preview-host-bridge.ts", pattern: /__grokPreviewBridgeRoot/, reason: "preview host bridge root key" },
  { file: "src/routes/__root.tsx", pattern: /__grok/, reason: "preview platform manifest path" },
  // Auth gate sign-in path on the server.
  { file: "src/lib/app-data/client.server.ts", pattern: /__gate/, reason: "auth gate path" },
  // Provenance comments naming the captured fixture files.
  { file: "src/subjects/chemistry/items.ts", pattern: /__fixtures__/, reason: "fixture path in provenance comment" },
  { file: "src/subjects/general-knowledge/items.ts", pattern: /__fixtures__/, reason: "fixture path in provenance comment" },
  { file: "src/subjects/journals/items.ts", pattern: /__fixtures__/, reason: "fixture path in provenance comment" },
  { file: "src/subjects/physics/items.ts", pattern: /__fixtures__/, reason: "fixture path in provenance comment" },
  { file: "src/subjects/social-studies/items.ts", pattern: /__fixtures__/, reason: "fixture path in provenance comment" },
  // The generated router tree names the root route by its file name.
  { file: "src/routeTree.gen.ts", pattern: /__root/, reason: "generated router tree" },
  // dataset writes that are the component's own state, not a test
  // contract: the board cards' visibility registry, the header's
  // scrollspy marker, and the standard data-testid attribute.
  { file: "src/board/card-animations.tsx", pattern: /dataset\.v3Visible/, reason: "internal visibility registry" },
  { file: "src/components/ui/site-header.tsx", pattern: /dataset\.current/, reason: "scrollspy state marker" },
  { file: "src/board/molecule-map.tsx", pattern: /dataset\.testid/, reason: "data-testid attribute assignment" },
  // Seam comments in files whose subject is not a seam (covered at
  // file level for the comment detector only):
  { file: "src/components/ui/bounded-text.tsx", pattern: /.*/, reason: "DEV-only tripwire (import.meta.env.DEV guard); never ships" },
  { file: "src/components/ui/summary-celebration-line.ts", pattern: /.*/, reason: "dependency-injection design note, no test-only code" },
  { file: "src/components/journal-prefetch.ts", pattern: /.*/, reason: "fetch-design note; specs intercept the network, no hook" },
  { file: "src/components/grandpa-coffee-run.tsx", pattern: /.*/, reason: "data-tour-scroll is the tour's own attribute" },
  { file: "src/game/easy-curation.ts", pattern: /.*/, reason: "product logic exported so tests can reach it; not a hook" },
];

const COMMENT_PHRASES =
  /(E2E seam|E2E hook|E2E probe|E2E harness|E2E specs|Test-only|Test seam|Test hook|Exported for tests|For tests|for E2E)/;

function prodSourceFiles(root) {
  const srcDir = join(root, "src");
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (
        /\.tsx?$/.test(entry.name) &&
        !/\.test\.tsx?$/.test(entry.name)
      ) {
        out.push(relative(root, full));
      }
    }
  };
  if (existsSync(srcDir)) walk(srcDir);
  return out.sort();
}

function detectHits(root, files) {
  const hits = [];
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    const lines = text.split("\n");
    const constStrings = new Map();
    for (const m of text.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*"([^"]+)"/g)) {
      constStrings.set(m[1], m[2]);
    }
    const readsParams = text.includes("URLSearchParams");
    lines.forEach((lineText, i) => {
      const line = i + 1;
      const push = (kind, token) => hits.push({ file, line, lineText, kind, token });
      for (const m of lineText.matchAll(/\b([A-Za-z_$][\w$]*ForTests|__reset[A-Za-z]\w*)/g)) {
        push("test-only-name", m[1]);
      }
      for (const m of lineText.matchAll(/__[a-z][A-Za-z0-9_]*/g)) {
        push("dunder", m[0]);
      }
      if (readsParams) {
        for (const m of lineText.matchAll(/\.get\(\s*"([^"]+)"/g)) {
          push("url-param", m[1]);
        }
        for (const m of lineText.matchAll(/\.get\(\s*([A-Z][A-Z0-9_]*)\s*\)/g)) {
          const param = constStrings.get(m[1]);
          if (param) push("url-param", param);
        }
      }
      for (const m of lineText.matchAll(/\[\?&]([a-z][a-z0-9-]*)=/g)) {
        push("url-param", m[1]);
      }
      for (const m of lineText.matchAll(/\.dataset\.([A-Za-z]\w*)\s*=(?!=)/g)) {
        push("dataset-write", m[1]);
      }
      if (COMMENT_PHRASES.test(lineText)) push("seam-comment", lineText.trim());
    });
  }
  return hits;
}

function lineCovered(hit, entries) {
  return entries.some((entry) => {
    // Baseline entries carry `covers` pairs; allowlist entries carry
    // a single (file, pattern).
    const covers = entry.covers ?? [{ file: entry.file, pattern: entry.pattern }];
    return covers.some(
      (cover) => cover.file === hit.file && cover.pattern.test(hit.lineText),
    );
  });
}

function commentCovered(hit, baseline, allowlist) {
  if (lineCovered(hit, [...baseline, ...allowlist])) return true;
  // A seam comment is expected in a file the inventory lists a seam
  // for, and in allowlisted files whose subject is not a seam.
  if (baseline.some((entry) => entry.sites.some((site) => site.file === hit.file))) return true;
  return allowlist.some((entry) => entry.file === hit.file);
}

/**
 * Scan `root` and return the list of problems (empty = ratchet
 * holds). `baseline` / `allowlist` default to the real inventory;
 * tests pass their own.
 */
export function scanTestSeams(root, baseline = BASELINE, allowlist = ALLOWLIST) {
  const problems = [];
  const files = prodSourceFiles(root);
  const contents = new Map(
    files.map((file) => [file, readFileSync(join(root, file), "utf8")]),
  );

  // Vanish check: every inventoried site must still match.
  for (const entry of baseline) {
    for (const site of entry.sites) {
      const text = contents.get(site.file);
      if (text === undefined || !site.pattern.test(text)) {
        problems.push(
          `STALE baseline seam "${entry.id}": site ${site.file} no longer matches ${site.pattern} — the seam moved or was removed; shrink the baseline in scripts/check-test-seams.mjs and the inventory doc in the same change.`,
        );
      }
    }
  }

  // New-seam check: every detector hit must be covered.
  for (const hit of detectHits(root, files)) {
    const covered =
      hit.kind === "seam-comment"
        ? commentCovered(hit, baseline, allowlist)
        : lineCovered(hit, [...baseline, ...allowlist]);
    if (!covered) {
      problems.push(
        `UNLISTED seam (${hit.kind}: ${hit.token}) at ${hit.file}:${hit.line} — add it to the inventory (docs/branch-status/chore-td-10.4-test-seams.md) and to BASELINE in scripts/check-test-seams.mjs, or record why it is product in ALLOWLIST.`,
      );
    }
  }
  return problems;
}

export function main(argv = process.argv.slice(2)) {
  let root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const rootIdx = argv.indexOf("--root");
  if (rootIdx !== -1 && argv[rootIdx + 1]) root = argv[rootIdx + 1];
  const problems = scanTestSeams(root);
  if (problems.length > 0) {
    console.error(`check-test-seams: FAIL (${problems.length} problem(s))`);
    for (const problem of problems) console.error(`  - ${problem}`);
    return 1;
  }
  console.log(
    `check-test-seams: PASS — ${BASELINE.length} inventoried seams, no unlisted seam-shaped hooks in production src/.`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
