import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { z } from "zod";

import { createBrowserStoragePort } from "./browser-storage.ts";
import { createFakeStoragePort } from "./fake-storage.ts";
import type {
  StorageBackend,
  StorageEventSource,
  StorageKeyDef,
  StoragePort,
} from "./storage.ts";

/**
 * Contract tests for the Phase 1 storage port. One shared scenario
 * suite runs against both implementations: the browser port driven
 * by an injected Map backend and a manual event source, and the
 * in-memory fake port driven by its setRaw / emitCrossTab controls.
 * Both must behave the same: reads fail soft to the key's fallback,
 * writes never throw, and every change reaches that key's
 * subscribers exactly once.
 */

const GREETING: StorageKeyDef<string> = {
  key: "test.greeting",
  schema: z.string(),
  fallback: "hello",
};

const COUNT: StorageKeyDef<number> = {
  key: "test.count",
  schema: z.number(),
  fallback: 0,
};

const PROGRESS: StorageKeyDef<Record<string, string[]>> = {
  key: "test.progress",
  schema: z.record(z.string(), z.array(z.string())),
  fallback: {},
};

class MapBackend implements StorageBackend {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

class ManualEventSource implements StorageEventSource {
  private listeners = new Set<(key: string | null) => void>();

  addListener(cb: (key: string | null) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  listenerCount(): number {
    return this.listeners.size;
  }

  fire(key: string | null): void {
    for (const cb of [...this.listeners]) cb(key);
  }
}

const throwingBackend: StorageBackend = {
  getItem(): string | null {
    throw new Error("storage unavailable");
  },
  setItem(): void {
    throw new Error("storage unavailable");
  },
  removeItem(): void {
    throw new Error("storage unavailable");
  },
};

interface Harness {
  port: StoragePort;
  setRaw(key: string, raw: string): void;
  getRaw(key: string): string | null;
  emitCrossTab(key: string | null): void;
  sourceListenerCount(): number;
}

interface Driver {
  name: string;
  setup(): Harness;
  setupThrowingBackend(): Harness;
}

const browserDriver: Driver = {
  name: "browser storage port",
  setup() {
    const backend = new MapBackend();
    const source = new ManualEventSource();
    const port = createBrowserStoragePort({ backend, eventSource: source });
    return {
      port,
      setRaw: (key, raw) => backend.setItem(key, raw),
      getRaw: (key) => backend.getItem(key),
      emitCrossTab: (key) => source.fire(key),
      sourceListenerCount: () => source.listenerCount(),
    };
  },
  setupThrowingBackend() {
    const source = new ManualEventSource();
    const port = createBrowserStoragePort({
      backend: throwingBackend,
      eventSource: source,
    });
    return {
      port,
      setRaw: () => {},
      getRaw: () => null,
      emitCrossTab: (key) => source.fire(key),
      sourceListenerCount: () => source.listenerCount(),
    };
  },
};

const fakeDriver: Driver = {
  name: "fake storage port",
  setup() {
    const fake = createFakeStoragePort();
    return {
      port: fake.port,
      setRaw: fake.setRaw,
      getRaw: fake.getRaw,
      emitCrossTab: fake.emitCrossTab,
      sourceListenerCount: fake.sourceListenerCount,
    };
  },
  setupThrowingBackend() {
    const fake = createFakeStoragePort({ backend: throwingBackend });
    return {
      port: fake.port,
      setRaw: () => {},
      getRaw: () => null,
      emitCrossTab: fake.emitCrossTab,
      sourceListenerCount: fake.sourceListenerCount,
    };
  },
};

for (const driver of [browserDriver, fakeDriver]) {
  describe(driver.name, () => {
    test("an absent key reads back the key's fallback", () => {
      const { port } = driver.setup();
      assert.equal(port.getItem(GREETING), "hello");
      assert.equal(port.getItem(COUNT), 0);
      assert.deepEqual(port.getItem(PROGRESS), {});
    });

    test("mutating a returned fallback does not poison later reads", () => {
      const { port } = driver.setup();
      const first = port.getItem(PROGRESS);
      first.math = ["case-1"];
      assert.deepEqual(port.getItem(PROGRESS), {});
      assert.deepEqual(PROGRESS.fallback, {});
    });

    test("set/get round-trip, stored as JSON", () => {
      const harness = driver.setup();
      harness.port.setItem(GREETING, "hi");
      assert.equal(harness.port.getItem(GREETING), "hi");
      assert.equal(harness.getRaw(GREETING.key), '"hi"');
      harness.port.setItem(PROGRESS, { math: ["case-1", "case-2"] });
      assert.deepEqual(harness.port.getItem(PROGRESS), {
        math: ["case-1", "case-2"],
      });
    });

    test("corrupt raw JSON reads back the fallback", () => {
      const harness = driver.setup();
      harness.setRaw(GREETING.key, "{not json");
      assert.equal(harness.port.getItem(GREETING), "hello");
    });

    test("schema-invalid raw reads back the fallback", () => {
      const harness = driver.setup();
      harness.setRaw(GREETING.key, "42");
      assert.equal(harness.port.getItem(GREETING), "hello");
      harness.setRaw(PROGRESS.key, JSON.stringify({ math: "nope" }));
      assert.deepEqual(harness.port.getItem(PROGRESS), {});
    });

    test("set emits only to that key's subscribers", () => {
      const { port } = driver.setup();
      let greetingCalls = 0;
      let countCalls = 0;
      port.subscribe(GREETING.key, () => greetingCalls++);
      port.subscribe(COUNT.key, () => countCalls++);
      port.setItem(GREETING, "hi");
      assert.equal(greetingCalls, 1);
      assert.equal(countCalls, 0);
    });

    test("remove emits, and the key reads back the fallback", () => {
      const harness = driver.setup();
      harness.port.setItem(GREETING, "hi");
      let calls = 0;
      harness.port.subscribe(GREETING.key, () => calls++);
      harness.port.removeItem(GREETING);
      assert.equal(calls, 1);
      assert.equal(harness.port.getItem(GREETING), "hello");
      assert.equal(harness.getRaw(GREETING.key), null);
    });

    test("notifyChanged emits for that key only", () => {
      const { port } = driver.setup();
      let greetingCalls = 0;
      let countCalls = 0;
      port.subscribe(GREETING.key, () => greetingCalls++);
      port.subscribe(COUNT.key, () => countCalls++);
      port.notifyChanged(GREETING.key);
      assert.equal(greetingCalls, 1);
      assert.equal(countCalls, 0);
    });

    test("a cross-tab event emits for the matching key only; a null key emits for every subscribed key", () => {
      const harness = driver.setup();
      let greetingCalls = 0;
      let countCalls = 0;
      harness.port.subscribe(GREETING.key, () => greetingCalls++);
      harness.port.subscribe(COUNT.key, () => countCalls++);
      harness.emitCrossTab(GREETING.key);
      assert.equal(greetingCalls, 1);
      assert.equal(countCalls, 0);
      harness.emitCrossTab("test.unsubscribed");
      assert.equal(greetingCalls, 1);
      assert.equal(countCalls, 0);
      harness.emitCrossTab(null);
      assert.equal(greetingCalls, 2);
      assert.equal(countCalls, 1);
    });

    test("unsubscribe stops delivery", () => {
      const { port } = driver.setup();
      let calls = 0;
      const unsubscribe = port.subscribe(GREETING.key, () => calls++);
      unsubscribe();
      port.setItem(GREETING, "hi");
      port.notifyChanged(GREETING.key);
      assert.equal(calls, 0);
    });

    test("the event source attaches on the first subscriber and detaches on the last", () => {
      const harness = driver.setup();
      assert.equal(harness.sourceListenerCount(), 0);
      const unsubA = harness.port.subscribe(GREETING.key, () => {});
      assert.equal(harness.sourceListenerCount(), 1);
      const unsubB = harness.port.subscribe(COUNT.key, () => {});
      assert.equal(harness.sourceListenerCount(), 1);
      unsubA();
      unsubA(); // a second call must not detach someone else's source
      assert.equal(harness.sourceListenerCount(), 1);
      unsubB();
      assert.equal(harness.sourceListenerCount(), 0);
      const unsubC = harness.port.subscribe(GREETING.key, () => {});
      assert.equal(harness.sourceListenerCount(), 1);
      unsubC();
      assert.equal(harness.sourceListenerCount(), 0);
    });

    test("a throwing subscriber breaks neither other subscribers nor the write", () => {
      const harness = driver.setup();
      let calls = 0;
      harness.port.subscribe(GREETING.key, () => {
        throw new Error("listener blew up");
      });
      harness.port.subscribe(GREETING.key, () => calls++);
      assert.doesNotThrow(() => harness.port.setItem(GREETING, "hi"));
      assert.equal(calls, 1);
      assert.equal(harness.port.getItem(GREETING), "hi");
    });

    test("a backend that throws on every operation: reads fall back, writes never throw, same-tab emit still lands", () => {
      const harness = driver.setupThrowingBackend();
      assert.equal(harness.port.getItem(GREETING), "hello");
      let calls = 0;
      harness.port.subscribe(GREETING.key, () => calls++);
      assert.doesNotThrow(() => harness.port.setItem(GREETING, "hi"));
      assert.equal(calls, 1);
      assert.doesNotThrow(() => harness.port.removeItem(GREETING));
      assert.equal(calls, 2);
      assert.equal(harness.port.getItem(GREETING), "hello");
    });
  });
}

describe("browser storage port with no backend available (node)", () => {
  test("the default port fails soft: fallback reads, silent writes, working same-tab emit", () => {
    const port = createBrowserStoragePort();
    assert.equal(port.getItem(GREETING), "hello");
    let calls = 0;
    const unsubscribe = port.subscribe(GREETING.key, () => calls++);
    assert.doesNotThrow(() => port.setItem(GREETING, "hi"));
    assert.equal(calls, 1);
    // Nothing persisted anywhere, so the read still falls back.
    assert.equal(port.getItem(GREETING), "hello");
    assert.doesNotThrow(() => port.removeItem(GREETING));
    assert.equal(calls, 2);
    unsubscribe();
  });
});
