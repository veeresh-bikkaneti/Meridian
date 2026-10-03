import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { registerServiceWorker, unregisterServiceWorker } from "./pwa.ts";

/**
 * Focused lifecycle tests for the PWA update policy:
 * - a waiting worker is detected (immediately or via updatefound)
 * - the update prompt resolves exactly once (no duplicate prompts)
 * - nothing reloads on its own — reload happens only after applyUpdate +
 *   the new worker takes control, exactly once
 * - dispose() stops polling and removes every listener
 *
 * import.meta.env is undefined under node --test, so the PROD path is
 * reached through the documented testEnv seam.
 */

type Listener = (ev?: { target?: unknown }) => void;

function makeWorker() {
  const listeners = new Map<string, Listener[]>();
  return {
    state: "installing",
    posted: [] as unknown[],
    addEventListener(type: string, fn: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners.set(type, (listeners.get(type) ?? []).filter((l) => l !== fn));
    },
    fire(type: string) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    listenerCount(type: string) {
      return (listeners.get(type) ?? []).length;
    },
    postMessage(msg: unknown) {
      this.posted.push(msg);
    },
  };
}

function makeRegistration() {
  const listeners = new Map<string, Listener[]>();
  return {
    waiting: null as ReturnType<typeof makeWorker> | null,
    installing: null as ReturnType<typeof makeWorker> | null,
    updateCalls: 0,
    addEventListener(type: string, fn: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    fire(type: string) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    async update() {
      this.updateCalls++;
    },
  };
}

const PROD = { PROD: true, BASE_URL: "/Meridian/" };

/**
 * Start registration and yield until the module's post-register setup has
 * run (track + updatefound listener attach). Usage:
 *   const reg = startRegistration(dom);
 *   await reg.settled;   // module is now listening
 *   ...fire updatefound / statechange...
 *   const result = await reg.promise;
 */
function startRegistration(dom: ReturnType<typeof installDom>) {
  const promise = registerServiceWorker(PROD);
  const settled = new Promise<void>((r) => setImmediate(r));
  return { promise, settled };
}

// Node 21+ ships a getter-only globalThis.navigator: plain assignment
// throws, so override it with defineProperty and restore afterwards.
const ORIG_NAVIGATOR_DESC = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
    enumerable: ORIG_NAVIGATOR_DESC?.enumerable ?? false,
  });
}

function installDom(opts: {
  serviceWorker?: boolean;
  controller?: boolean;
  registerImpl?: () => Promise<unknown>;
  getRegistrationImpl?: () => Promise<unknown>;
} = {}) {
  const {
    serviceWorker = true,
    controller = true,
    registerImpl,
    getRegistrationImpl,
  } = opts;
  const intervals = new Map<number, () => void>();
  let nextId = 1;
  const cleared: number[] = [];
  let reloads = 0;
  const docListeners = new Map<string, Listener[]>();
  const swListeners = new Map<string, Listener[]>();
  let registerUrl = "";
  let registerScope = "";
  let registerCalls = 0;
  let getRegistrationCalls = 0;

  const fakeWindow = {
    setInterval(fn: () => void) {
      const id = nextId++;
      intervals.set(id, fn);
      return id;
    },
    clearInterval(id: number) {
      cleared.push(id);
      intervals.delete(id);
    },
    location: {
      reload() {
        reloads++;
      },
    },
  };
  const fakeDocument = {
    visibilityState: "visible",
    addEventListener(type: string, fn: Listener) {
      docListeners.set(type, [...(docListeners.get(type) ?? []), fn]);
    },
    removeEventListener(type: string, fn: Listener) {
      docListeners.set(type, (docListeners.get(type) ?? []).filter((l) => l !== fn));
    },
    fire(type: string) {
      for (const fn of docListeners.get(type) ?? []) fn();
    },
    listenerCount(type: string) {
      return (docListeners.get(type) ?? []).length;
    },
  };
  const swContainer = {
    controller: controller ? {} : null,
    async register(url: string, opts2: { scope: string }) {
      registerCalls++;
      registerUrl = url;
      registerScope = opts2.scope;
      if (registerImpl) return registerImpl();
      return registration;
    },
    async getRegistration() {
      getRegistrationCalls++;
      if (getRegistrationImpl) return getRegistrationImpl();
      return null;
    },
    addEventListener(type: string, fn: Listener) {
      swListeners.set(type, [...(swListeners.get(type) ?? []), fn]);
    },
    removeEventListener(type: string, fn: Listener) {
      swListeners.set(type, (swListeners.get(type) ?? []).filter((l) => l !== fn));
    },
    fire(type: string) {
      for (const fn of swListeners.get(type) ?? []) fn();
    },
    listenerCount(type: string) {
      return (swListeners.get(type) ?? []).length;
    },
  };
  const registration = makeRegistration();

  (globalThis as Record<string, unknown>).window = fakeWindow;
  (globalThis as Record<string, unknown>).document = fakeDocument;
  setNavigator(serviceWorker ? { serviceWorker: swContainer } : {});

  return {
    intervals,
    cleared,
    get reloads() {
      return reloads;
    },
    doc: fakeDocument,
    sw: swContainer,
    registration,
    get registerUrl() {
      return registerUrl;
    },
    get registerScope() {
      return registerScope;
    },
    get registerCalls() {
      return registerCalls;
    },
    get getRegistrationCalls() {
      return getRegistrationCalls;
    },
  };
}

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.document;
  if (ORIG_NAVIGATOR_DESC) {
    Object.defineProperty(globalThis, "navigator", ORIG_NAVIGATOR_DESC);
  } else {
    delete g.navigator;
  }
});

describe("registerServiceWorker — skip paths", () => {
  it("returns null outside production (import.meta.env is undefined under node)", async () => {
    installDom();
    assert.equal(await registerServiceWorker(), null);
  });

  it("returns null when service workers are unavailable", async () => {
    installDom({ serviceWorker: false });
    assert.equal(await registerServiceWorker(PROD), null);
  });

  it("returns null when registration throws — never breaks the app", async () => {
    installDom({
      registerImpl: () => Promise.reject(new Error("denied")),
    });
    assert.equal(await registerServiceWorker(PROD), null);
  });

  it("registers sw.js under BASE_URL with the matching scope", async () => {
    const dom = installDom();
    const reg = startRegistration(dom);
    // No waiting worker yet: the promise stays pending until one appears.
    assert.equal(dom.registerCalls, 1);
    assert.equal(dom.registerUrl, "/Meridian/sw.js");
    assert.equal(dom.registerScope, "/Meridian/");
    await reg.settled;
    // Settle the pending promise via the updatefound path so the test can exit.
    const w = makeWorker();
    w.state = "installed";
    dom.registration.installing = w;
    dom.registration.fire("updatefound");
    await reg.promise.then((r) => r?.handle.dispose());
  });
});

describe("registerServiceWorker — waiting-worker detection", () => {
  it("resolves immediately when a waiting worker is already installed", async () => {
    const dom = installDom();
    const w = makeWorker();
    w.state = "installed";
    // Install the waiting worker before registration resolves.
    const origRegister = dom.sw.register;
    (dom.sw as Record<string, unknown>).register = async (url: string, o: { scope: string }) => {
      const reg = await (origRegister as typeof origRegister).call(dom.sw, url, o);
      (reg as ReturnType<typeof makeRegistration>).waiting = w;
      return reg;
    };
    const result = await registerServiceWorker(PROD);
    assert.ok(result);
    assert.equal(result.waiting, w);
    result.handle.dispose();
  });

  it("detects a waiting worker via updatefound and notifies exactly once", async () => {
    const dom = installDom();
    let resolutions = 0;
    const reg = startRegistration(dom);
    const p = reg.promise.then((r) => {
      resolutions++;
      return r;
    });
    await reg.settled;
    const w = makeWorker();
    dom.registration.installing = w;
    dom.registration.fire("updatefound");
    w.state = "installed";
    w.fire("statechange");
    const result = await p;
    assert.ok(result);
    assert.equal(result.waiting, w);
    assert.equal(resolutions, 1);
    // Duplicate statechange events do not re-notify.
    w.fire("statechange");
    w.fire("statechange");
    await new Promise((r) => setImmediate(r));
    assert.equal(resolutions, 1);
    result.handle.dispose();
  });

  it("a waiting worker alone never reloads the page", async () => {
    const dom = installDom();
    const w = makeWorker();
    w.state = "installed";
    const origRegister = dom.sw.register;
    (dom.sw as Record<string, unknown>).register = async (url: string, o: { scope: string }) => {
      const reg = await (origRegister as typeof origRegister).call(dom.sw, url, o);
      (reg as ReturnType<typeof makeRegistration>).waiting = w;
      return reg;
    };
    const result = await registerServiceWorker(PROD);
    assert.ok(result);
    await new Promise((r) => setImmediate(r));
    assert.equal(dom.reloads, 0);
    result.handle.dispose();
  });
});

describe("registerServiceWorker — applyUpdate", () => {
  it("posts SKIP_WAITING and reloads exactly once when the new worker takes control", async () => {
    const dom = installDom();
    const w = makeWorker();
    w.state = "installed";
    const origRegister = dom.sw.register;
    (dom.sw as Record<string, unknown>).register = async (url: string, o: { scope: string }) => {
      const reg = await (origRegister as typeof origRegister).call(dom.sw, url, o);
      (reg as ReturnType<typeof makeRegistration>).waiting = w;
      return reg;
    };
    const result = await registerServiceWorker(PROD);
    assert.ok(result);
    result.handle.applyUpdate();
    assert.deepEqual(w.posted, [{ type: "SKIP_WAITING" }]);
    assert.equal(dom.reloads, 0);
    // The new worker takes control…
    dom.sw.fire("controllerchange");
    dom.sw.fire("controllerchange");
    assert.equal(dom.reloads, 1);
    result.handle.dispose();
  });

  it("does not reload on controllerchange before the player requests an update", async () => {
    // First-install claim (null -> worker) and another tab's activation both
    // fire controllerchange — neither may bounce this page.
    const dom = installDom();
    const w = makeWorker();
    w.state = "installed";
    const origRegister = dom.sw.register;
    (dom.sw as Record<string, unknown>).register = async (url: string, o: { scope: string }) => {
      const reg = await (origRegister as typeof origRegister).call(dom.sw, url, o);
      (reg as ReturnType<typeof makeRegistration>).waiting = w;
      return reg;
    };
    const result = await registerServiceWorker(PROD);
    assert.ok(result);
    // No applyUpdate call: the player has not chosen anything.
    dom.sw.fire("controllerchange");
    dom.sw.fire("controllerchange");
    assert.equal(dom.reloads, 0);
    result.handle.dispose();
  });

  it("applyUpdate is safe to call twice — the worker is only nudged", async () => {
    const dom = installDom();
    const w = makeWorker();
    w.state = "installed";
    const origRegister = dom.sw.register;
    (dom.sw as Record<string, unknown>).register = async (url: string, o: { scope: string }) => {
      const reg = await (origRegister as typeof origRegister).call(dom.sw, url, o);
      (reg as ReturnType<typeof makeRegistration>).waiting = w;
      return reg;
    };
    const result = await registerServiceWorker(PROD);
    assert.ok(result);
    result.handle.applyUpdate();
    result.handle.applyUpdate();
    assert.deepEqual(w.posted, [{ type: "SKIP_WAITING" }, { type: "SKIP_WAITING" }]);
    assert.equal(dom.reloads, 0);
    result.handle.dispose();
  });
});

describe("registerServiceWorker — dispose", () => {
  it("stops polling and removes every listener; late events are ignored", async () => {
    const dom = installDom();
    const w = makeWorker();
    w.state = "installed";
    const origRegister = dom.sw.register;
    (dom.sw as Record<string, unknown>).register = async (url: string, o: { scope: string }) => {
      const reg = await (origRegister as typeof origRegister).call(dom.sw, url, o);
      (reg as ReturnType<typeof makeRegistration>).waiting = w;
      return reg;
    };
    const result = await registerServiceWorker(PROD);
    assert.ok(result);
    assert.equal(dom.intervals.size, 1);
    assert.equal(dom.doc.listenerCount("visibilitychange"), 1);
    assert.equal(dom.sw.listenerCount("controllerchange"), 1);

    result.handle.dispose();
    assert.equal(dom.intervals.size, 0);
    assert.equal(dom.cleared.length, 1);
    assert.equal(dom.doc.listenerCount("visibilitychange"), 0);
    assert.equal(dom.sw.listenerCount("controllerchange"), 0);

    // Late controllerchange after dispose does not reload.
    dom.sw.fire("controllerchange");
    assert.equal(dom.reloads, 0);
  });

  it("visibility polling is throttled and stops after dispose", async () => {
    const dom = installDom();
    const reg = startRegistration(dom);
    const p = reg.promise;
    await reg.settled;
    const w = makeWorker();
    w.state = "installed";
    dom.registration.installing = w;
    dom.registration.fire("updatefound");
    w.fire("statechange");
    const result = await p;
    assert.ok(result);
    const before = dom.registration.updateCalls;
    dom.doc.fire("visibilitychange");
    dom.doc.fire("visibilitychange");
    assert.equal(dom.registration.updateCalls, before + 1);
    result.handle.dispose();
    dom.doc.fire("visibilitychange");
    assert.equal(dom.registration.updateCalls, before + 1);
  });
});

describe("registerServiceWorker — polling", () => {
  it("the hourly interval triggers registration.update()", async () => {
    const dom = installDom();
    const reg = startRegistration(dom);
    const p = reg.promise;
    await reg.settled;
    const w = makeWorker();
    w.state = "installed";
    dom.registration.installing = w;
    dom.registration.fire("updatefound");
    w.fire("statechange");
    const result = await p;
    assert.ok(result);
    assert.equal(dom.intervals.size, 1);
    const [tick] = [...dom.intervals.values()];
    const before = dom.registration.updateCalls;
    tick();
    assert.equal(dom.registration.updateCalls, before + 1);
    result.handle.dispose();
  });
});

describe("unregisterServiceWorker — kill-switch cleanup", () => {
  it("returns false when no registration exists", async () => {
    const dom = installDom();
    assert.equal(await unregisterServiceWorker(PROD), false);
    assert.equal(dom.getRegistrationCalls, 1);
  });

  it("unregisters a live registration and never reloads the page", async () => {
    let unregistered = 0;
    const reg = {
      async unregister() {
        unregistered++;
        return true;
      },
    };
    const dom = installDom({ getRegistrationImpl: async () => reg });
    assert.equal(await unregisterServiceWorker(PROD), true);
    assert.equal(unregistered, 1);
    // The kill-switch never bounces the page: the current document keeps
    // its controller until the next navigation.
    assert.equal(dom.reloads, 0);
  });

  it("returns false outside production", async () => {
    const dom = installDom({
      getRegistrationImpl: async () => ({ unregister: async () => true }),
    });
    assert.equal(await unregisterServiceWorker(), false);
    assert.equal(dom.getRegistrationCalls, 0);
  });

  it("returns false when service workers are unavailable", async () => {
    installDom({ serviceWorker: false });
    assert.equal(await unregisterServiceWorker(PROD), false);
  });

  it("returns false when getRegistration throws — never breaks the app", async () => {
    installDom({
      getRegistrationImpl: async () => {
        throw new Error("denied");
      },
    });
    assert.equal(await unregisterServiceWorker(PROD), false);
  });

  it("returns false when unregister throws — never breaks the app", async () => {
    installDom({
      getRegistrationImpl: async () => ({
        async unregister() {
          throw new Error("gone");
        },
      }),
    });
    assert.equal(await unregisterServiceWorker(PROD), false);
  });

  it("returns false without a window (SSR)", async () => {
    const g = globalThis as Record<string, unknown>;
    delete g.window;
    assert.equal(await unregisterServiceWorker(PROD), false);
  });
});
