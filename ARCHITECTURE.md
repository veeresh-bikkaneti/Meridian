# ARCHITECTURE.md — Meridian

How the code is layered, in plain words. If you are adding a file, read this
first (AGENTS.md cold start, item 7). The machine-readable copy of this map —
the one the lint actually reads — is `eslint/layer-rule.mjs` (lands in PR
0.2). That file is the one source of truth; this page explains it.

## The one rule

Imports point **down** only. A file may import from its own layer or any
layer below it, never from a layer above it. A feature screen never imports
another feature screen. When two screens need the same code, the shared code
moves **down** a layer — it is never copied sideways.

## Layers, lowest first

### 1. Content

- Owns: `src/game/data/**`, and `src/subjects/**/items.ts` and `answers.ts`.
- Data only: places, questions, answers. No logic, no imports from any
  higher layer.

### 2. Domain and stores

- Owns: `src/game/**/*.ts` that is not a screen, and the pure helpers in
  `src/lib/**`.
- Pure game logic and state: dealing, scoring, stores, helpers.
- No React, no browser globals (no `fetch`, storage, or `Audio` here).

### 3. Platform ports

- Owns: `src/platform/**` — **this folder does not exist yet**; Phase 1
  creates it.
- This is the only layer allowed to touch the browser: `fetch`,
  `localStorage`, `sessionStorage`, and `Audio`. Everything else calls a
  port here instead of touching the browser directly.

### 4. Shared UI components

- Owns: `src/components/ui/**` and `src/hooks/**`.
- Presentational building blocks (buttons, pills, the shell parts).
  No I/O: a shared component never fetches, stores, or plays sound itself.

### 5. Feature screens

- Owns: everything else under `src/components/**`, plus
  `src/game/**/*.tsx`, `src/subjects/**/*.tsx`, `src/board/**`,
  `src/map/**`, and `src/scenes/**`.
- The screens a player sees. A screen uses shared components and calls
  ports; it never imports another screen.

### 6. Shell and routes

- Owns: `src/routes/**`, `src/router.tsx`, and the shell parts inside
  `src/components/ui/`: `site-header`, `site-footer`, `page-column`,
  `page-shell`, and `shell-registry`.
- The frame every page sits in, and the routing that picks the screen.

## Out of scope until Phase 5

Server code — `src/server.ts`, `src/start.ts`, `workers/`, and `server/` —
is not in this layer map yet. Phase 5 covers it. Do not move server files
to satisfy these rules before then.

## Why layer 3 exists: today's browser I/O, counted

Right now, browser I/O sits in files all over `src/`. Measured on main
`dfb15d5b` (2026-11-19):

- 18 non-test files call `fetch(` [tested,
  `grep -rlE "fetch\s*\(" src --include=*.ts --include=*.tsx | grep -v .test. | wc -l`]
- 44 non-test files touch `localStorage` or `sessionStorage` [tested,
  `grep -rlE "localStorage|sessionStorage" src --include=*.ts --include=*.tsx | grep -v .test. | wc -l`]
- 8 non-test files call `new Audio(` [tested,
  `grep -rlE "new Audio\s*\(" src --include=*.ts --include=*.tsx | grep -v .test. | wc -l`]

Phase 1 moves these calls behind ports in `src/platform/**`. Until then,
do not add a new direct call outside a port-shaped helper.

## Known exceptions (listed, not hidden)

The map describes where code should live; some of today's files sit in a
folder that belongs to another layer. Known cases:

- `src/game/loop/LoopScreen.tsx` and `src/game/coldtrail/TrailScreen.tsx`
  are feature screens (layer 5) living inside the domain folder
  (`src/game/**`, layer 2).
- `src/lib/error-component.tsx` is a React component (`.tsx`) inside the
  pure-helpers folder (`src/lib/**`, layer 2).
- `src/components/ui/first-visit-queue.tsx` is a shared UI component
  (layer 4) that reads and writes `localStorage` directly — I/O that
  belongs in layer 3 once the ports exist.

Leave these where they are unless your slice is the one moving them.

## How to add a screen

1. **Story first.** Build a mockup from the real shared components (a
   Storybook story, once PR 0.4 lands it) and get Veeresh's approval
   before writing the screen. No mockup, no UI code.
2. **Adopt the shell.** Use the layer 6 shell parts (`page-shell`,
   `page-column`, the header and footer) instead of building a new frame.
3. **Use shared components.** Build the screen from layer 4 components
   and hooks; if a piece is missing, add it to layer 4, not to the screen.
4. **I/O through a port.** Data, storage, and sound go through a layer 3
   port. A screen never calls `fetch`, storage, or `new Audio(` itself.
5. Put the screen in layer 5, and check its imports point down only.
