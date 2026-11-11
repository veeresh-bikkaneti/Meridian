/**
 * detective-flank.test.ts — pins for Agent STAGE (Holmes's frozen
 * flank + the Listen first-tap cure):
 *
 * - the flank geometry (watson-walk.ts): row vs strip by the
 *   MEASURED card left, Holmes's row x, and the row card margins —
 *   the council's §2 numbers reproduced as arithmetic, against the
 *   live baselines (390 card x20 w232; 768 card x20 w610; 1280 card
 *   x276 w610; Watson station x258 / x636 / x892).
 * - the Listen cure (detective-audio.ts): the first tap in tap
 *   mode plays the held clue sequence. Regression test: before the
 *   cure the gesture listener armed only inside playClip, so the
 *   first tap parked in waitForGesture and nothing played until a
 *   second tap; the cure arms the listener at player creation.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createDetectiveSpeech,
  type DetectiveManifest,
} from "./detective-audio.ts";
import {
  FLANK_CARD_GAP_PX,
  FLANK_PAGE_PAD_PX,
  FLANK_ROW_CARD_MARGIN_LEFT_PX,
  FLANK_ROW_CARD_MARGIN_RIGHT_PX,
  FLANK_ROW_MIN_CARD_LEFT_PX,
  GUTTER_CARD_GAP_PX,
  GUTTER_EDGE_CLEAR_PX,
  GUTTER_W_PX,
  HOLMES_FIGURE_W_PX,
  flankHolmesX,
  flankModeForCardLeft,
} from "./watson-walk.ts";

describe("flank geometry (STAGE)", () => {
  test("the row needs cardLeft >= 88: 12 edge + 70 Holmes + 6 card gap", () => {
    assert.equal(GUTTER_EDGE_CLEAR_PX, 12);
    assert.equal(HOLMES_FIGURE_W_PX, 70);
    assert.equal(FLANK_CARD_GAP_PX, 6);
    assert.equal(FLANK_CARD_GAP_PX, GUTTER_CARD_GAP_PX);
    assert.equal(FLANK_ROW_MIN_CARD_LEFT_PX, 88);
    assert.equal(
      FLANK_ROW_MIN_CARD_LEFT_PX,
      GUTTER_EDGE_CLEAR_PX + HOLMES_FIGURE_W_PX + FLANK_CARD_GAP_PX,
    );
  });

  test("1280 (measured cardLeft 276): row, Holmes x194, gap 12, card unchanged", () => {
    assert.equal(flankModeForCardLeft(276), "row");
    assert.equal(flankHolmesX(276), 194);
    // Holmes 194–264, card 276–886: 12 px of clear air, card 610.
    assert.equal(276 - (194 + HOLMES_FIGURE_W_PX), 12);
  });

  test("768 (measured cardLeft 88 with the row margins): row, Holmes x12, gap 6", () => {
    assert.equal(flankModeForCardLeft(88), "row");
    assert.equal(flankHolmesX(88), 12);
    // Holmes 12–82, card 88–650: 6 px of clear air — the law's
    // minimum — and the 12 px edge clear holds exactly.
    assert.equal(88 - (12 + HOLMES_FIGURE_W_PX), 6);
    assert.equal(flankHolmesX(88), GUTTER_EDGE_CLEAR_PX);
  });

  test("390 (measured cardLeft 20): strip — the row cannot fit", () => {
    assert.equal(flankModeForCardLeft(20), "strip");
  });

  test("the boundary is the card left, not the viewport: 769–900 strip, 904 row", () => {
    // 800 px viewport: column centred 728 → cardLeft 36 → strip.
    assert.equal(flankModeForCardLeft(36), "strip");
    // 900 px viewport: cardLeft 86 → still strip (86 < 88).
    assert.equal(flankModeForCardLeft(86), "strip");
    // 904 px viewport: cardLeft 88 → row, Holmes at the edge.
    assert.equal(flankModeForCardLeft(88), "row");
    assert.equal(flankHolmesX(88), 12);
  });

  test("row card margins derive: 68 left, 98 right; card 562 at 768", () => {
    assert.equal(FLANK_PAGE_PAD_PX, 20);
    assert.equal(FLANK_ROW_CARD_MARGIN_LEFT_PX, 68);
    assert.equal(
      FLANK_ROW_CARD_MARGIN_LEFT_PX,
      FLANK_ROW_MIN_CARD_LEFT_PX - FLANK_PAGE_PAD_PX,
    );
    assert.equal(FLANK_ROW_CARD_MARGIN_RIGHT_PX, 98);
    assert.equal(
      FLANK_ROW_CARD_MARGIN_RIGHT_PX,
      GUTTER_W_PX - FLANK_PAGE_PAD_PX,
    );
    // 768 − 40 (page padding) − 68 − 98 = 562, the council's number.
    assert.equal(
      768 - 2 * FLANK_PAGE_PAD_PX - FLANK_ROW_CARD_MARGIN_LEFT_PX -
        FLANK_ROW_CARD_MARGIN_RIGHT_PX,
      562,
    );
  });

  test("strip releases the gutter: card 350 at 390 (full content width)", () => {
    // 390 − 40 (page padding) − 0 margins = 350.
    assert.equal(390 - 2 * FLANK_PAGE_PAD_PX, 350);
  });
});

/* ------------------------------------------------------------------ */
/* Listen first-tap cure (STAGE step 6): the DEFAULT clip player's   */
/* gesture listener must be armed at player creation, not lazily    */
/* inside the first playClip — in tap mode nothing ever calls      */
/* playClip before the kid taps Listen, so a lazy listener means   */
/* the first tap only arms it and nothing plays. The stub below is */
/* the detective-audio.test.ts pattern (stubbed window + Audio).    */
/* ------------------------------------------------------------------ */

const FLANK_MANIFEST: DetectiveManifest = {
  v: 1,
  voices: { holmes: "avocado_v2:atlas", watson: "avocado_v2:pb1_music_02" },
  fixed: {
    "ack-1": { file: "fixed/ack-1.mp3", voice: "avocado_v2:atlas" },
  },
  cases: {
    "387": {
      clues: [
        { file: "case-387/clue-1.mp3", voice: "avocado_v2:pb1_music_02" },
        { file: "case-387/clue-2.mp3", voice: "avocado_v2:pb1_music_02" },
        null,
        null,
        null,
      ],
      answer: { file: "case-387/answer.mp3", voice: "avocado_v2:atlas" },
    },
  },
  names: {},
};

const tick = () => new Promise((r) => setTimeout(r, 5));

function stubBrowserAudio(playedUrls: string[]): () => void {
  const listeners = new Map<string, () => void>();
  class FakeAudio {
    private handlers = new Map<string, () => void>();
    url: string;
    constructor(url: string) {
      this.url = url;
    }
    addEventListener(type: string, fn: () => void) {
      this.handlers.set(type, fn);
    }
    play() {
      playedUrls.push(this.url);
      queueMicrotask(() => this.handlers.get("ended")?.());
      return Promise.resolve();
    }
    pause() {}
  }
  const g = globalThis as Record<string, unknown>;
  g.window = {
    addEventListener: (type: string, fn: () => void) => {
      listeners.set(type, fn);
    },
    removeEventListener: (type: string) => {
      listeners.delete(type);
    },
  };
  g.Audio = FakeAudio;
  return () => {
    listeners.get("pointerdown")?.();
  };
}

function unplugBrowserAudio(): void {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.Audio;
}

describe("Listen first-tap cure (STAGE step 6)", () => {
  test("the FIRST tap in tap mode plays the held clue sequence", async () => {
    const playedUrls: string[] = [];
    const fireGesture = stubBrowserAudio(playedUrls);
    try {
      const player = createDetectiveSpeech({
        caseIndex: 387,
        speechMode: "tap",
        loadManifest: async () => FLANK_MANIFEST,
        isSoundOn: () => true,
        canAutoPlay: () => false,
      });
      // The clue read arrives in tap mode: held, never played.
      player.enqueue({ kind: "clue", clueIndex: 1 });
      await tick();
      await tick();
      assert.deepEqual(playedUrls, []);
      assert.equal(player.heldRefs().length, 1);
      // THE FIRST TAP: the pointerdown (the tap's way down) then
      // the click's playHeldSequence. Before the cure the listener
      // armed only inside playClip, so this tap parked in
      // waitForGesture and nothing played until a SECOND tap.
      // (Not awaited: pre-cure the replay parks forever — the
      // assertion below is the verdict, not the await.)
      fireGesture();
      void player.playHeldSequence();
      await tick();
      await tick();
      await tick();
      assert.deepEqual(playedUrls, [
        "/audio/detective/case-387/clue-1.mp3",
      ]);
      player.dispose();
    } finally {
      unplugBrowserAudio();
    }
  });

  test("without any gesture the held sequence still waits (no auto-play)", async () => {
    const playedUrls: string[] = [];
    stubBrowserAudio(playedUrls);
    try {
      const player = createDetectiveSpeech({
        caseIndex: 387,
        speechMode: "tap",
        loadManifest: async () => FLANK_MANIFEST,
        isSoundOn: () => true,
        canAutoPlay: () => false,
      });
      player.enqueue({ kind: "clue", clueIndex: 1 });
      await tick();
      await tick();
      // No gesture, no Listen tap: nothing plays — the cure arms
      // the listener, it does not start playback. (Not awaited:
      // the replay parks in waitForGesture until a gesture lands;
      // dispose below releases the player.)
      void player.playHeldSequence();
      await tick();
      await tick();
      assert.deepEqual(playedUrls, []);
      player.dispose();
    } finally {
      unplugBrowserAudio();
    }
  });
});
