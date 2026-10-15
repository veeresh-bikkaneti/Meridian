#!/usr/bin/env node
/**
 * bundle-report.mjs — size report for the built Pages artifact.
 *
 * Run after `npm run build:pages`:
 *
 *   node scripts/bundle-report.mjs            # human-readable report
 *   node scripts/bundle-report.mjs --json     # machine-readable (used by docs)
 *   node scripts/bundle-report.mjs --dir dist/client
 *
 * Prints, for every JS / CSS / JSON file under the artifact:
 *   raw bytes and gzip bytes (zlib level 9, the best case a host can do —
 *   GitHub Pages and Cloudflare pick their own levels, so treat the gzip
 *   column as a floor, not a promise).
 * then the totals, the 10 largest files, and what the shell page
 * (`_shell.html`) requests on first load.
 *
 * First-load analysis. `_shell.html` is read as TEXT and scanned with
 * regexes for <script src>, <link rel="stylesheet"> and
 * <link rel="modulepreload"> — nothing here shells out to grep, so a stray
 * NUL byte or odd encoding in the HTML cannot make the scan silently skip
 * lines. The entry set is then expanded through STATIC imports (the
 * `import x from "./y.js"` / `import "./y.js"` / `export … from "./y.js"`
 * forms). Dynamic `import("./y.js")` is deliberately NOT followed — those are
 * lazy chunks, not first-load cost. The static-import scan is a regex over
 * minified bundler output, so it is a heuristic; the Playwright script
 * (`scripts/perf-globe-easy.mjs`) records what a real browser actually
 * requested and is the authority when the two disagree.
 *
 * Report-only: no budgets, no exit-code failures on size.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, posix, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPORTED = new Set([".js", ".mjs", ".css", ".json"]);
const BASE = "/Meridian/";

function parseArgs(argv) {
  const args = { dir: join(REPO, "dist", "client"), json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--dir" && argv[i + 1]) args.dir = resolve(argv[++i]);
    else {
      console.error("usage: bundle-report.mjs [--dir <dist/client>] [--json]");
      process.exit(2);
    }
  }
  return args;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const gzipSize = (buf) => gzipSync(buf, { level: 9 }).length;

/** All reported assets: { path (posix, relative to dist), raw, gzip }. */
export function collectAssets(dir) {
  const assets = [];
  for (const file of walk(dir)) {
    if (!REPORTED.has(extname(file).toLowerCase())) continue;
    const buf = readFileSync(file);
    assets.push({
      path: relative(dir, file).split("\\").join("/"),
      raw: buf.length,
      gzip: gzipSize(buf),
    });
  }
  return assets.sort((a, b) => b.raw - a.raw);
}

/** Refs the shell page asks for, read as text. */
export function parseShell(html) {
  const refs = { scripts: [], stylesheets: [], modulepreloads: [] };
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/g) ?? []) {
    const attr = (name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    if (tag.startsWith("<script")) {
      const src = attr("src");
      if (src) refs.scripts.push(src);
    } else {
      const rel = attr("rel");
      const href = attr("href");
      if (!href) continue;
      if (rel === "stylesheet") refs.stylesheets.push(href);
      else if (rel === "modulepreload") refs.modulepreloads.push(href);
    }
  }
  return refs;
}

/** dist-relative path for a shell href like /Meridian/assets/x.js, or null if off-site. */
function toDistPath(href) {
  if (/^[a-z]+:\/\//i.test(href)) return null;
  return href.startsWith(BASE) ? href.slice(BASE.length) : href.replace(/^\//, "");
}

/** Static (non-dynamic) relative import specifiers of a bundled JS file. */
export function staticImports(source) {
  const specs = new Set();
  // import … from "x" | export … from "x" | import "x"  (not `import(`)
  const re = /(?:^|[;}\s])(?:import|export)\s*(?:[^'"()`;]*?\bfrom\s*|\s*)["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(source)) !== null) specs.add(m[1]);
  return [...specs].filter((s) => s.startsWith("./") || s.startsWith("../"));
}

/** Transitive static-import closure of the given dist paths. */
export function staticClosure(dir, roots) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length) {
    const p = queue.pop();
    if (seen.has(p) || !/\.m?js$/.test(p)) {
      if (!seen.has(p) && /\.css$/.test(p)) seen.add(p);
      continue;
    }
    seen.add(p);
    let src;
    try {
      src = readFileSync(join(dir, p), "utf8");
    } catch {
      continue;
    }
    for (const spec of staticImports(src)) {
      queue.push(posix.normalize(posix.join(posix.dirname(p), spec)));
    }
  }
  return [...seen];
}

const fmt = (n) => n.toLocaleString("en-US");
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const row = (a) => `${fmt(a.raw).padStart(12)} ${fmt(a.gzip).padStart(12)}  ${a.path}`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  const assets = collectAssets(args.dir);
  const bySize = new Map(assets.map((a) => [a.path, a]));
  const size = (p) => bySize.get(p) ?? (() => {
    const buf = readFileSync(join(args.dir, p));
    return { path: p, raw: buf.length, gzip: gzipSize(buf) };
  })();

  const totals = { raw: 0, gzip: 0 };
  const byExt = {};
  for (const a of assets) {
    totals.raw += a.raw;
    totals.gzip += a.gzip;
    const e = extname(a.path).toLowerCase();
    byExt[e] ??= { count: 0, raw: 0, gzip: 0 };
    byExt[e].count++;
    byExt[e].raw += a.raw;
    byExt[e].gzip += a.gzip;
  }

  const shellHtml = readFileSync(join(args.dir, "_shell.html"), "utf8");
  const refs = parseShell(shellHtml);
  const entryPaths = [
    ...new Set([...refs.scripts, ...refs.stylesheets, ...refs.modulepreloads].map(toDistPath).filter(Boolean)),
  ];
  const closure = staticClosure(args.dir, entryPaths);
  const sumOf = (paths) =>
    paths.reduce((s, p) => {
      const a = size(p);
      return { raw: s.raw + a.raw, gzip: s.gzip + a.gzip };
    }, { raw: 0, gzip: 0 });
  const isJs = (p) => /\.m?js$/.test(p);
  const isCss = (p) => /\.css$/.test(p);
  const shell = {
    shellHtmlBytes: Buffer.byteLength(shellHtml),
    refs,
    entryJs: entryPaths.filter(isJs).map(size),
    entryCss: entryPaths.filter(isCss).map(size),
    closureJs: closure.filter(isJs).map(size).sort((a, b) => b.raw - a.raw),
    closureCss: closure.filter(isCss).map(size),
  };
  shell.entryJsTotal = sumOf(shell.entryJs.map((a) => a.path));
  shell.entryCssTotal = sumOf(shell.entryCss.map((a) => a.path));
  shell.closureJsTotal = sumOf(shell.closureJs.map((a) => a.path));
  shell.closureCssTotal = sumOf(shell.closureCss.map((a) => a.path));

  const top10 = assets.slice(0, 10);

  if (args.json) {
    console.log(JSON.stringify({ dir: relative(REPO, args.dir), totals, byExt, top10, shell, assets }, null, 2));
    return;
  }

  console.log(`Bundle report for ${relative(REPO, args.dir) || args.dir}`);
  console.log(`(gzip = zlib level 9; ${assets.length} JS/CSS/JSON files)\n`);
  console.log(`${"raw bytes".padStart(12)} ${"gzip bytes".padStart(12)}  file`);
  for (const a of assets) console.log(row(a));
  console.log(`\n${"-".repeat(60)}`);
  console.log(row({ ...totals, path: "TOTAL" }));
  for (const [ext, t] of Object.entries(byExt).sort()) {
    console.log(`${fmt(t.raw).padStart(12)} ${fmt(t.gzip).padStart(12)}  ${ext} (${t.count} files)`);
  }
  console.log("\n10 largest files");
  top10.forEach((a, i) => console.log(`${String(i + 1).padStart(2)}. ${row(a)}`));

  console.log(`\nShell page (_shell.html, ${fmt(shell.shellHtmlBytes)} bytes) requests on first load`);
  for (const [label, list] of [
    ["script src", refs.scripts],
    ["stylesheet", refs.stylesheets],
    ["modulepreload", refs.modulepreloads],
  ]) {
    for (const href of list) console.log(`  ${label.padEnd(13)} ${href}`);
  }
  console.log("\nEntry (directly referenced by the shell)");
  for (const a of [...shell.entryJs, ...shell.entryCss]) console.log(row(a));
  console.log(
    `  entry JS  total: ${fmt(shell.entryJsTotal.raw)} raw / ${fmt(shell.entryJsTotal.gzip)} gzip (${kb(shell.entryJsTotal.gzip)})`,
  );
  console.log(
    `  entry CSS total: ${fmt(shell.entryCssTotal.raw)} raw / ${fmt(shell.entryCssTotal.gzip)} gzip (${kb(shell.entryCssTotal.gzip)})`,
  );
  console.log("\nEntry + static-import closure (heuristic regex scan; dynamic import() not followed)");
  for (const a of shell.closureJs) console.log(row(a));
  console.log(
    `  closure JS  total: ${fmt(shell.closureJsTotal.raw)} raw / ${fmt(shell.closureJsTotal.gzip)} gzip`,
  );
  console.log(
    `  closure CSS total: ${fmt(shell.closureCssTotal.raw)} raw / ${fmt(shell.closureCssTotal.gzip)} gzip`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
