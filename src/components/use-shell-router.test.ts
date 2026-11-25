/**
 * Step 10 (TD-06.7) — shell router + boot source pin.
 *
 * `ready` / `setReady`, the derived `inAppScreen`, the hash / history
 * writer and listeners, and the boot effect that restores a saved run
 * (or a friend-challenge link) live in use-shell-router.ts, not in
 * game-app.tsx. GameApp calls the hook. Every boot exit still calls
 * `setReady(true)`; `applyHashScreen` and `hashSeededRef` live in the
 * hook; the hash writer stays singular there. This file pins that
 * wiring in the repo's source-pin style.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const routerSource = readFileSync(join(here, "use-shell-router.ts"), "utf8");
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");

describe("Step 10: shell router + boot live in use-shell-router", () => {
  it("exports useShellRouter owning ready / inAppScreen / hash / boot", () => {
    assert.ok(routerSource.includes("export function useShellRouter("));
    assert.ok(routerSource.includes("const [ready, setReady] = useState(false);"));
    assert.ok(routerSource.includes("const inAppScreen = !ready"));
    assert.ok(routerSource.includes("const hashSeededRef = useRef(false);"));
    assert.ok(routerSource.includes("const applyHashScreen = useCallback((screen: string) => {"));
    assert.ok(routerSource.includes("function bootSavedRun()"));
  });

  it("every boot exit still calls setReady(true)", () => {
    const exits = routerSource.match(/setReady\(true\);/g) ?? [];
    assert.ok(exits.length >= 12, `expected >= 12 setReady(true) exits, got ${exits.length}`);
  });

  it("the hash writer stays singular and popstate drives the screen", () => {
    assert.ok(routerSource.includes('window.history.replaceState(null, "", hash);'));
    assert.ok(routerSource.includes('window.history.pushState(null, "", hash);'));
    assert.ok(routerSource.includes('window.addEventListener("popstate", onPopState);'));
    assert.ok(routerSource.includes("screenForHash(window.location.hash)"));
  });

  it("game-app.tsx calls the hook and no longer defines the pieces", () => {
    assert.ok(gameAppSource.includes("useShellRouter({"));
    assert.ok(gameAppSource.includes("const { ready, inAppScreen } = useShellRouter({"));
    assert.ok(!gameAppSource.includes("const [ready, setReady] = useState(false);"));
    assert.ok(!gameAppSource.includes("function bootSavedRun()"));
    assert.ok(!gameAppSource.includes("const applyHashScreen = useCallback("));
    assert.ok(!gameAppSource.includes("const hashSeededRef = useRef(false);"));
  });
});
