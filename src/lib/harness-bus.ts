/**
 * Slot the test harness fills before the app boots.
 *
 * Shipped pages never install the slot, so every reader below is a no-op
 * and the shortcut strings live only in tests/harness/seams.ts. The e2e
 * server installs `globalThis.mh` with an init script; unit tests that
 * need a shortcut call the same installer, or set one field on the slot.
 */

export type ScreenPoint = { x: number; y: number };

export type MapHandles = {
  spotScreen: () => ScreenPoint | null;
  project: (lon: number, lat: number) => ScreenPoint | null;
  boundaryBand: () => { layers: string[] } | null;
};

export type ProbeFields = {
  bonds?: number;
  calls?: number;
  tris?: number;
  px?: number;
  py?: number;
  slug?: string;
};

type HarnessApi = {
  loopPuzzle?: (search: string) => number | null;
  i?: (search: string, fallback: number) => number;
  c?: (search: string) => string | null;
  attachMap?: (el: object, handles: MapHandles) => void;
  attachLoopMap?: (el: object, map: unknown) => void;
  writeProbe?: (el: object, fields: ProbeFields) => void;
  journalMovie?: () => string | null | undefined;
  journalTranscript?: () => unknown;
  s?: () => Promise<boolean>;
};

function api(): HarnessApi | null {
  const slot = (globalThis as { mh?: HarnessApi }).mh;
  return slot ?? null;
}

export function harnessLoopPuzzle(search: string): number | null {
  const read = api()?.loopPuzzle;
  return read ? read(search) : null;
}

export function harnessIdleMs(search: string, fallback: number): number {
  const read = api()?.i;
  return read ? read(search, fallback) : fallback;
}

export function harnessCelebrationVariant(search: string): string | null {
  const read = api()?.c;
  return read ? read(search) : null;
}

export function harnessAttachMap(el: object, handles: MapHandles): void {
  api()?.attachMap?.(el, handles);
}

export function harnessAttachLoopMap(el: object, map: unknown): void {
  api()?.attachLoopMap?.(el, map);
}

export function harnessWriteProbe(el: object, fields: ProbeFields): void {
  api()?.writeProbe?.(el, fields);
}

export function harnessJournalMovie(): string | null | undefined {
  const read = api()?.journalMovie;
  return read ? read() : undefined;
}

export function harnessJournalTranscript(): unknown {
  const read = api()?.journalTranscript;
  return read ? read() : undefined;
}

export function harnessStaleBuildProbe(): (() => Promise<boolean>) | undefined {
  return api()?.s;
}
