#!/usr/bin/env node
/**
 * Board v3 — 3D payload budget gate (spec §3).
 *
 * After `npm run build:pages`, measure what opening the molecular
 * map actually downloads: the lazy molecule-map chunk plus the
 * three.module chunk it statically imports. Budget: ≤ 180 KB gz
 * combined. (three.module is shared with the pre-existing home
 * globe / detective pair — it is counted here anyway, so the gate
 * stays honest even if that sharing ever changes.)
 *
 * Also prints the board route chunk for the record.
 * Exits 1 when the budget is exceeded or the chunks are missing.
 */
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const ASSETS = new URL("../../dist/client/assets/", import.meta.url);
const BUDGET_GZ = 180 * 1024;

const files = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));
const pick = (re) => files.find((f) => re.test(f));
const gz = (name) => gzipSync(readFileSync(new URL(name, ASSETS))).length;

const molecule = pick(/^molecule-map-.*\.js$/);
const three = pick(/^three\.module-.*\.js$/);
const board = pick(/^board-.*\.js$/);

if (!molecule || !three) {
  console.error(`BUDGET CHECK FAILED: chunks missing (molecule=${molecule}, three=${three})`);
  process.exit(1);
}

const moleculeGz = gz(molecule);
const threeGz = gz(three);
const total = moleculeGz + threeGz;
console.log(`molecule-map chunk: ${molecule} — ${moleculeGz} B gz`);
console.log(`three.module chunk: ${three} — ${threeGz} B gz`);
if (board) console.log(`board route chunk: ${board} — ${gz(board)} B gz (trail payload, for the record)`);
console.log(`3D module total: ${total} B gz of ${BUDGET_GZ} B budget`);
if (total > BUDGET_GZ) {
  console.error("BUDGET CHECK FAILED: 3D module exceeds +180 KB gz");
  process.exit(1);
}
console.log("BUDGET CHECK PASSED");
