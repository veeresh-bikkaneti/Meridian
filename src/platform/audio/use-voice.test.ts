import { currentVoiceOwner } from "../../../tests/harness/module-seams.ts";
import assert from "node:assert/strict";
import test, { afterEach, describe } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  stopAllVoices,
} from "../../game/audio/voice-channel.ts";
import { createFakeVoicePort } from "./fake-voice.ts";
import {
  createVoiceController,
  useVoice,
  type VoiceController,
} from "./use-voice.ts";
import type { CreateVoiceOptions } from "./voice.ts";

/**
 * Controller tests drive createVoiceController with the fake port;
 * the hook itself is probed through react-dom/server like
 * use-prefers-reduced-motion.test.ts (effects do not run in SSR,
 * so unmount/dispose is covered on the controller, not the hook).
 */

afterEach(() => stopAllVoices());

function opts(owner: string): CreateVoiceOptions {
  return { owner, userInitiated: true };
}

describe("createVoiceController", () => {
  test("play() returns true and delegates to the port (creates and plays a handle)", () => {
    const { port, handles } = createFakeVoicePort();
    const controller = createVoiceController(port);
    assert.equal(controller.play("line.mp3", opts("clue-scene")), true);
    assert.equal(handles.length, 1);
    assert.equal(handles[0]!.src, "line.mp3");
    assert.equal(handles[0]!.playCalls, 1);
    assert.equal(currentVoiceOwner(), "clue-scene");
    controller.dispose();
  });

  test("play() returns false when the port refuses (gated off)", () => {
    const { port, handles } = createFakeVoicePort({
      soundEnabled: () => false,
    });
    const controller = createVoiceController(port);
    assert.equal(controller.play("line.mp3", opts("clue-scene")), false);
    assert.equal(handles.length, 0);
    assert.equal(currentVoiceOwner(), null);
    controller.dispose();
  });

  test("a second play() stops the previous handle first (state aborted)", () => {
    const { port, handles } = createFakeVoicePort();
    const controller = createVoiceController(port);
    assert.equal(controller.play("one.mp3", opts("first")), true);
    assert.equal(controller.play("two.mp3", opts("second")), true);
    assert.equal(handles.length, 2);
    assert.equal(handles[0]!.state, "aborted");
    assert.equal(handles[1]!.playCalls, 1);
    assert.equal(currentVoiceOwner(), "second");
    controller.dispose();
  });

  test("stop() with no handle is safe", () => {
    const { port } = createFakeVoicePort();
    const controller = createVoiceController(port);
    assert.doesNotThrow(() => controller.stop());
    assert.doesNotThrow(() => controller.stop());
    controller.dispose();
  });

  test("stop() stops the live handle and releases the channel", () => {
    const { port, handles } = createFakeVoicePort();
    const controller = createVoiceController(port);
    controller.play("line.mp3", opts("clue-scene"));
    controller.stop();
    assert.equal(handles[0]!.state, "aborted");
    assert.equal(currentVoiceOwner(), null);
    controller.dispose();
  });

  test("currentTime() is 0 with no handle and proxies the live handle otherwise", () => {
    const { port, handles } = createFakeVoicePort();
    const controller = createVoiceController(port);
    assert.equal(controller.currentTime(), 0);
    controller.play("line.mp3", opts("clue-scene"));
    assert.equal(controller.currentTime(), 0);
    handles[0]!.simulateTimeUpdate(7.5);
    assert.equal(controller.currentTime(), 7.5);
    controller.dispose();
  });

  test("dispose() stops the live handle", () => {
    const { port, handles } = createFakeVoicePort();
    const controller = createVoiceController(port);
    controller.play("line.mp3", opts("clue-scene"));
    controller.dispose();
    assert.equal(handles[0]!.state, "aborted");
    assert.equal(currentVoiceOwner(), null);
    assert.doesNotThrow(() => controller.dispose());
  });
});

let probeApi: VoiceController | null = null;

/** Reset through a helper: a direct `probeApi = null` in the test
 * narrows the variable to null at the assertions below, and the
 * assignment inside Probe (during render) is invisible to that
 * narrowing, so the assertions would not typecheck. */
function resetProbe(): void {
  probeApi = null;
}

function Probe() {
  const voice = useVoice();
  probeApi = voice;
  return createElement(
    "span",
    null,
    `${typeof voice.play}/${typeof voice.stop}`,
  );
}

describe("useVoice hook (SSR probe)", () => {
  test("renders without throwing and exposes play/stop functions", () => {
    resetProbe();
    let markup = "";
    assert.doesNotThrow(() => {
      markup = renderToStaticMarkup(createElement(Probe));
    });
    assert.match(markup, /function\/function/);
    assert.equal(typeof probeApi?.play, "function");
    assert.equal(typeof probeApi?.stop, "function");
  });
});
