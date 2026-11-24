/**
 * Test-only entry for shortcuts that must not ship in the pages bundle.
 *
 * `installBrowserSeams` is self-contained: the e2e server passes it to
 * Playwright's init-script hook, which stringifies the function and runs
 * it in the page before any app script. Keep every shortcut string inside
 * this function. Unit tests call the exported wrappers, which install into
 * a throwaway object so they do not touch the real global slot.
 */

type HarnessTarget = {
  mh?: {
    loopPuzzle?: (search: string) => number | null;
    i?: (search: string, fallback: number) => number;
    c?: (search: string) => string | null;
    attachMap?: (
      el: object,
      handles: {
        spotScreen: () => { x: number; y: number } | null;
        project: (lon: number, lat: number) => { x: number; y: number } | null;
        boundaryBand: () => { layers: string[] } | null;
      },
    ) => void;
    attachLoopMap?: (el: object, map: unknown) => void;
    writeProbe?: (
      el: { dataset?: Record<string, string> },
      fields: {
        bonds?: number;
        calls?: number;
        tris?: number;
        px?: number;
        py?: number;
        slug?: string;
      },
    ) => void;
  };
};

export function installBrowserSeams(target?: HarnessTarget): void {
  const root = target ?? (globalThis as HarnessTarget);

  function loopPuzzleFromSearch(search: string): number | null {
    let raw: string | null = null;
    try {
      raw = new URLSearchParams(search).get("loop-puzzle");
    } catch {
      return null;
    }
    if (!raw || !/^\d+$/.test(raw)) return null;
    const index = Number(raw);
    return Number.isSafeInteger(index) ? index : null;
  }

  function idleTimeoutFromSearch(search: string, fallback: number): number {
    const match = /[?&]idle-ms=(\d+)/.exec(search);
    if (!match) return fallback;
    const ms = Number(match[1]);
    return Number.isFinite(ms) && ms > 0 ? ms : fallback;
  }

  function celebrationVariantFromSearch(search: string): string | null {
    let raw: string | null = null;
    try {
      raw = new URLSearchParams(search).get("celebration");
    } catch {
      return null;
    }
    return raw ? raw : null;
  }

  root.mh = {
    loopPuzzle: loopPuzzleFromSearch,
    i: idleTimeoutFromSearch,
    c: celebrationVariantFromSearch,
    attachMap(el, handles) {
      const node = el as {
        __spotScreen?: typeof handles.spotScreen;
        __project?: typeof handles.project;
        __boundaryBand?: typeof handles.boundaryBand;
      };
      node.__spotScreen = handles.spotScreen;
      node.__project = handles.project;
      node.__boundaryBand = handles.boundaryBand;
    },
    attachLoopMap(el, map) {
      (el as { __loopMap?: unknown }).__loopMap = map;
    },
    writeProbe(el, fields) {
      const dataset = el.dataset;
      if (!dataset) return;
      if (fields.bonds != null) dataset.bondCount = String(fields.bonds);
      if (fields.calls != null) dataset.drawCalls = String(fields.calls);
      if (fields.tris != null) dataset.triangles = String(fields.tris);
      if (fields.px != null) dataset.probeX = String(fields.px);
      if (fields.py != null) dataset.probeY = String(fields.py);
      if (fields.slug != null) dataset.probeSlug = String(fields.slug);
    },
  };
}

function installed(): NonNullable<HarnessTarget["mh"]> {
  const box: HarnessTarget = {};
  installBrowserSeams(box);
  return box.mh!;
}

export function loopPuzzleFromSearch(search: string): number | null {
  return installed().loopPuzzle!(search);
}

export function idleTimeoutFromSearch(search: string, fallback: number): number {
  return installed().i!(search, fallback);
}

export function celebrationVariantFromSearch(search: string): string | null {
  return installed().c!(search);
}
