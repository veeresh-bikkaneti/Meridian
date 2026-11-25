/**
 * TD-06.17 lazy boundary — the journal dataset stays out of the entry.
 *
 * home-journal.data.ts (~14 KB gzip of note text) used to be statically
 * imported by home-journal.ts, so every first load paid for 106 notes
 * whose earliest need is the home Journal section. The dataset now
 * loads only through the dynamic `import()` inside home-journal.ts's
 * memoized loader (`loadJournalNotes`), in the same source-pin style as
 * territory-lazy-boundary.test.ts. The loader's runtime contract
 * (fail-closed sync readers, load-once, retry after failure) is
 * exercised by home-journal.test.ts / home-journal-wiring.test.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const homeJournalSource = readFileSync(join(here, "home-journal.ts"), "utf8");
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");

describe("TD-06.17 lazy boundary — no static journal-data import on the entry path", () => {
  it("home-journal.ts imports the dataset types only, never the values", () => {
    assert.ok(
      !/^import\s+(?!type\b)[^;]*from\s*"\.\/home-journal\.data\.ts"/m.test(homeJournalSource),
      "home-journal.ts must not statically import home-journal.data.ts values (they re-enter the entry)",
    );
    assert.ok(
      homeJournalSource.includes('import type { JournalNote, JournalSetData } from "./home-journal.data.ts";'),
      "the dataset types must come in through a type-only import (erased at build)",
    );
  });

  it("the dataset loads only through a dynamic import inside the memoized loader", () => {
    assert.ok(
      homeJournalSource.includes('import("./home-journal.data.ts")'),
      "the data must load via a dynamic import() inside home-journal.ts",
    );
    assert.ok(
      homeJournalSource.includes("export function loadJournalNotes("),
      "loadJournalNotes is the public entry point the home component kicks",
    );
    assert.ok(
      homeJournalSource.includes("if (!loadPromise)"),
      "the load must be guarded by the cached promise (load-once)",
    );
    assert.ok(
      homeJournalSource.includes("loadPromise = null;"),
      "a failed load must evict the cached promise so the next call retries",
    );
  });

  it("game-app never names the dataset module and kicks the loader on mount", () => {
    assert.ok(
      !gameAppSource.includes("home-journal.data"),
      "game-app.tsx must not import home-journal.data.ts in any form",
    );
    assert.ok(
      gameAppSource.includes("loadJournalNotes()"),
      "game-app must start the journal dataset load (the rotation effect)",
    );
  });
});
