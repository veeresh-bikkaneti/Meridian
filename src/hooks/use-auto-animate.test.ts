import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { AutoAnimateOptions } from "@formkit/auto-animate";
import {
  useAutoAnimate,
  AUTO_ANIMATE_DEFAULTS,
  type AutoAnimateFn,
} from "./use-auto-animate.ts";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// The hook's `animate` parameter is dependency injection for tests: the
// fake below records enable/destroy calls without needing a DOM or the
// real Web Animations API.
interface FakeCall {
  el: unknown;
  options: unknown;
}
function makeAnimate() {
  const calls: FakeCall[] = [];
  const destroyed: unknown[] = [];
  const animate = ((el: unknown, options: unknown) => {
    calls.push({ el, options });
    return {
      destroy: () => {
        destroyed.push(el);
      },
    };
  }) as unknown as AutoAnimateFn;
  return { calls, destroyed, animate };
}

type ChangeListener = (e: { matches: boolean }) => void;
interface FakeMql {
  matches: boolean;
  __setMatches: (next: boolean) => void;
}

// Minimal window: matchMedia for the reduced-motion query, timers for any
// debounced children. Installed per-test so each test controls the query.
function installWindow(reduce: boolean): FakeMql {
  const listeners = new Set<ChangeListener>();
  const mql: FakeMql = {
    matches: reduce,
    __setMatches(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next }));
    },
  };
  (globalThis as Record<string, unknown>).window = {
    matchMedia: () => ({
      matches: mql.matches,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: (type: string, cb: ChangeListener) => {
        if (type === "change") listeners.add(cb);
      },
      removeEventListener: (type: string, cb: ChangeListener) => {
        if (type === "change") listeners.delete(cb);
      },
    }),
    setTimeout: (fn: (...args: unknown[]) => void, ms?: number) =>
      setTimeout(fn, ms),
    clearTimeout: (id: unknown) => clearTimeout(id as never),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return mql;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

function Probe({
  animate,
  options,
  attachRef = true,
}: {
  animate: AutoAnimateFn;
  options?: Partial<AutoAnimateOptions>;
  attachRef?: boolean;
}) {
  const ref = useAutoAnimate<HTMLDivElement>(options, animate);
  return createElement(
    "div",
    { ref: attachRef ? ref : undefined, "data-testid": "probe" },
    createElement("span", null, "kid content"),
  );
}

// react-test-renderer only attaches host refs via createNodeMock — the mock
// stands in for the DOM node, keyed by data-testid so tests can assert
// exactly which container the animator received.
function renderProbe(
  props: {
    animate: AutoAnimateFn;
    options?: Partial<AutoAnimateOptions>;
    attachRef?: boolean;
  },
  mocks = new Map<string, object>(),
) {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(createElement(Probe, props), {
      createNodeMock: (el: ReactElement) => {
        const propsOf = el.props as Record<string, unknown>;
        const key =
          (propsOf["data-testid"] as string | undefined) ?? `anon-${mocks.size}`;
        const mock = { __mock: key };
        mocks.set(key, mock);
        return mock;
      },
    });
  });
  return { renderer: renderer!, mocks };
}

describe("useAutoAnimate", () => {
  beforeEach(() => {
    installWindow(false);
  });

  it("enables auto-animate on the container with the 200ms ease-out defaults", () => {
    const { calls, animate } = makeAnimate();
    const { renderer, mocks } = renderProbe({ animate });
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]!.el,
      mocks.get("probe"),
      "animate called with the container the ref attached to",
    );
    assert.deepEqual(calls[0]!.options, AUTO_ANIMATE_DEFAULTS);
    assert.deepEqual(calls[0]!.options, { duration: 200, easing: "ease-out" });
    assert.ok(renderer.root.findByProps({ "data-testid": "probe" }));
  });

  it("passes custom options through to the animator", () => {
    const { calls, animate } = makeAnimate();
    renderProbe({ animate, options: { duration: 150 } });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.options, { duration: 150 });
  });

  it("never calls animate under prefers-reduced-motion — content renders instantly and stays usable", () => {
    installWindow(true);
    const { calls, animate } = makeAnimate();
    const { renderer } = renderProbe({ animate });
    assert.equal(calls.length, 0, "zero animation under reduced motion");
    // Content is still there and usable: the kid loses nothing.
    const span = renderer.root.findByType("span");
    assert.equal(span.children.join(""), "kid content");
    assert.ok(renderer.root.findByProps({ "data-testid": "probe" }));
  });

  it("a mid-session toggle to reduced motion destroys the animation and does not re-enable", () => {
    const mql = installWindow(false);
    const { calls, destroyed, animate } = makeAnimate();
    renderProbe({ animate });
    assert.equal(calls.length, 1);
    act(() => {
      mql.__setMatches(true);
    });
    assert.equal(destroyed.length, 1, "controls destroyed when reduce flips on");
    assert.equal(calls.length, 1, "never re-enabled while reduced");
  });

  it("toggling back off reduced motion re-enables the animation", () => {
    const mql = installWindow(false);
    const { calls, animate } = makeAnimate();
    renderProbe({ animate });
    act(() => {
      mql.__setMatches(true);
    });
    act(() => {
      mql.__setMatches(false);
    });
    assert.equal(calls.length, 2, "re-enabled after the setting flips back");
  });

  it("destroys the animation on unmount (no leaked observers)", () => {
    const { calls, destroyed, animate } = makeAnimate();
    const { renderer } = renderProbe({ animate });
    assert.equal(calls.length, 1);
    act(() => {
      renderer.unmount();
    });
    assert.equal(destroyed.length, 1);
  });

  it("does nothing (and does not crash) when the ref never attaches", () => {
    const { calls, animate } = makeAnimate();
    const { renderer } = renderProbe({ animate, attachRef: false });
    assert.equal(calls.length, 0);
    assert.ok(renderer.root.findByProps({ "data-testid": "probe" }));
  });

  it("returns a stable ref callback across re-renders", () => {
    const { animate } = makeAnimate();
    const seen: unknown[] = [];
    function Capture({ animateFn }: { animateFn: AutoAnimateFn }) {
      const ref = useAutoAnimate<HTMLDivElement>(undefined, animateFn);
      seen.push(ref);
      return createElement("div", { ref });
    }
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(createElement(Capture, { animateFn: animate }), {
        createNodeMock: () => ({}),
      });
    });
    act(() => {
      renderer!.update(createElement(Capture, { animateFn: animate }));
    });
    assert.ok(seen.length >= 2);
    assert.ok(
      seen.every((r) => r === seen[0]),
      "ref identity stable — no effect churn",
    );
  });
});
