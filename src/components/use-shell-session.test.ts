/**
 * Step 5 (TD-06.7) — shell session source pin.
 *
 * The session store, idle watchdog, and discarded-run notice live in
 * use-shell-session.ts, not in game-app.tsx. GameApp calls the hook
 * and renders from what it returns. This file pins that wiring in
 * the repo's source-pin style.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const shellSource = readFileSync(join(here, "use-shell-session.ts"), "utf8");
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");

describe("Step 5: session / idle / discarded live in use-shell-session", () => {
  it("exports useSessionState and useShellSession", () => {
    assert.ok(shellSource.includes("export function useSessionState()"));
    assert.ok(shellSource.includes("export function useShellSession("));
  });

  it("the hook owns the idle watchdog and the kill", () => {
    assert.ok(shellSource.includes("const killIdleSession = useCallback("));
    assert.ok(shellSource.includes("const ensureSession = useCallback("));
    assert.ok(shellSource.includes("window.setInterval(check, 5000)"));
    assert.ok(shellSource.includes("setDiscardedNotice({ reason: \"inactivity\""));
  });

  it("game-app.tsx calls the hook and no longer defines the pieces", () => {
    assert.ok(gameAppSource.includes("useShellSession({"));
    assert.ok(!gameAppSource.includes("function useSessionState()"));
    assert.ok(!gameAppSource.includes("const killIdleSession = useCallback("));
    assert.ok(!gameAppSource.includes("const ensureSession = useCallback("));
    assert.ok(!gameAppSource.includes("window.setInterval(check, 5000)"));
  });
});
