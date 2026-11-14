// Fails if scene.js's copied poses drift from the game's pose table.
//   node --experimental-strip-types scripts/why-learn-film/check-poses-sync.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const game = await import("../../src/game/loop/detective/pair3d-poses.ts");
const src = readFileSync(new URL("./scene.js", import.meta.url), "utf8");
const block = src.match(/export const POSES = (\{[\s\S]*?\n\});/);
assert.ok(block, "POSES block not found in scene.js");
const POSES = Function(`return (${block[1]})`)();

const table = { holmes: game.HOLMES_POSES_3D, watson: game.WATSON_POSES_3D };
let n = 0;
for (const who of Object.keys(POSES)) {
  for (const [name, p] of Object.entries(POSES[who])) {
    const g = table[who][name];
    assert.ok(g, `${who} ${name} missing from pair3d-poses.ts`);
    const { anim: _anim, ...rest } = g;
    assert.deepEqual(p, rest, `${who} ${name} differs from pair3d-poses.ts`);
    n++;
  }
}
console.log(`ok: ${n} poses match pair3d-poses.ts`);
