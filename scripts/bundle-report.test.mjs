import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectAssets, parseShell, staticClosure, staticImports } from "./bundle-report.mjs";

test("parseShell reads script, stylesheet and modulepreload refs as text (NUL-safe)", () => {
  const html =
    '<!doctype html><link rel="stylesheet" href="/Meridian/assets/a.css" data-precedence="default"/>' +
    '<link rel="modulepreload" href="/Meridian/assets/b.js"/>\0' +
    '<link rel="icon" href="/Meridian/favicon.svg"/>' +
    '<script>inline()</script><script type="module" async="" src="/Meridian/assets/c.js"></script>';
  assert.deepEqual(parseShell(html), {
    scripts: ["/Meridian/assets/c.js"],
    stylesheets: ["/Meridian/assets/a.css"],
    modulepreloads: ["/Meridian/assets/b.js"],
  });
});

test("staticImports follows static forms and skips dynamic import()", () => {
  const src =
    'import{a as b}from"./x.js";import"./side.js";export{c}from"./y.js";' +
    'const lazy=()=>import("./lazy.js");import d from"https://cdn.example/z.js";';
  assert.deepEqual(staticImports(src).sort(), ["./side.js", "./x.js", "./y.js"]);
});

test("collectAssets sizes JS/CSS/JSON only; staticClosure expands static imports", () => {
  const dir = mkdtempSync(join(tmpdir(), "bundle-report-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "entry.js"), 'import{a}from"./dep.js";export const e=()=>import("./lazy.js");');
  writeFileSync(join(dir, "assets", "dep.js"), "export const a=1;");
  writeFileSync(join(dir, "assets", "lazy.js"), "export const l=1;");
  writeFileSync(join(dir, "assets", "pic.png"), "not reported");
  const assets = collectAssets(dir);
  assert.deepEqual(assets.map((a) => a.path).sort(), ["assets/dep.js", "assets/entry.js", "assets/lazy.js"]);
  for (const a of assets) assert.ok(a.raw > 0 && a.gzip > 0);
  assert.deepEqual(staticClosure(dir, ["assets/entry.js"]).sort(), ["assets/dep.js", "assets/entry.js"]);
});
