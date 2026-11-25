/**
 * Step 6 (TD-06.7) — overlay queue source pin.
 *
 * The first-visit / tutorial / invite / celebration / cleared overlay
 * state lives in use-overlay-queue.tsx, not in game-app.tsx. GameApp
 * calls the hook and mounts the queue. This file pins that wiring
 * in the repo's source-pin style.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const queueSource = readFileSync(join(here, "use-overlay-queue.tsx"), "utf8");
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");

describe("Step 6: overlay queue lives in use-overlay-queue", () => {
  it("exports useOverlayQueue owning the overlay state", () => {
    assert.ok(queueSource.includes("export function useOverlayQueue("));
    assert.ok(queueSource.includes("const [tutorial, setTutorial] = useState<TutorialBeat | null>(null);"));
    assert.ok(queueSource.includes("const [celebration, setCelebration] = useState<CelebrationSpec | null>("));
    assert.ok(queueSource.includes("const [cleared, setCleared] = useState<ClearedInfo | null>(null);"));
    assert.ok(queueSource.includes("const [firstVisitModalOpen, setFirstVisitModalOpen] = useState(false);"));
  });

  it("game-app.tsx calls the hook and no longer defines the pieces", () => {
    assert.ok(gameAppSource.includes("useOverlayQueue(mapMode)"));
    assert.ok(!gameAppSource.includes("const [tutorial, setTutorial] = useState<TutorialBeat | null>(null);"));
    assert.ok(!gameAppSource.includes("const [celebration, setCelebration] = useState<CelebrationSpec | null>("));
    assert.ok(!gameAppSource.includes("const [cleared, setCleared] = useState<ClearedInfo | null>(null);"));
  });
});
