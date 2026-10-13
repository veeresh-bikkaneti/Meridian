# Step 0 — ARCH-REVIEWER diff review: 62895ea (tier split) + 192b2d8 (deps removal)

Reviewer: Opus, read-only. Date: 2026-10-13. Verdict: **BLOCK** (one correctness finding; fix folded into `docs/ops/specs/ws-0-globe-tier-flag.md`).

1. **(BLOCK)** Changing the learning path in Globe renders one commit with the old band's places and that commit writes a place the player never saw into the new band's no-repeat history.
   `game-app.tsx` checks `if (run)` (~:1578) before `if (starting)` (~:1696), so `Play` stays mounted while `openRun` awaits; `commit(next)` re-renders `Play` with the new run while `places` still holds the old tiers; `PlayLoaded` (no key) runs `resolveRunPool(oldPlaces, newPoolIds)` (a partial pool, or the whole stale catalog when the overlap is empty, `pool.ts:21`), builds a dealer on the new band's seen store and `markDealtThrough(run.index)` records a wrong place before `Play`'s effect clears `places`. It also mounts/destroys a SatelliteMap. The comment "the null reset above keeps it fail-closed" is wrong for that commit.
   Fix: render `PlayLoaded` only with places loaded for the current `{edition, regionId, choice}` (key check during render); add a Globe Easy→Medium promotion E2E asserting the Medium seen store holds exactly the dealt ids.
   *Orchestrator verified the render order in the source.*
2. Playwright gate missing from `artifacts/gates-consolidate.log`; no browser coverage of the tier-split loading (existing promotion specs use Vermont). → run the suite; add the Globe promotion spec.
3. (nit) Every band change remounts the game screen for every region, not only Globe. → load key includes `choice` only for `globe`.
4. (nit) Offline: a player who only played Easy has only t1+t2 cached; switching to Medium/Hard offline fails safely with a start error. → accept and document, or warm neighbouring tiers.
5. (nit) `scripts/migrate-notable-to-history.mjs:111` rewrites `chunks/globe.json` without `writeGlobeTiers()`; the prebuild gate then fails loudly. → add the call.
6. (info, pre-existing) `/`-base build prints `_shell.html not found post-build` for nosw-hatch and crash-watchdog; not confirmed against the parent commit.

Checked clean: tier merge reproduces canonical order for all 59,423 ids (Easy 11,388 / Medium 44,213 / Hard 30,629 each equal the legacy `filterByTier` order); Vite stub present in client and server bundles and fail-closed; other `placesFor` callers (tutorial, review decks, resume, replay, country/state/Cold Trail/loop) unaffected; fail-closed on tier load failure; dependency removal: lockfile root matches `package.json`, none of the 34 packages imported anywhere. Not independently verified by the reviewer: byte-identical dist before/after (verified by the orchestrator earlier with SHA-256 over 534 client + 91 server files, `_shell.html`/`build-meta.json` excluded).
