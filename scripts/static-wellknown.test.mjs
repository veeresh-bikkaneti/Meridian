/**
 * Static discovery files (review R7, 2026-10-21):
 *   public/.well-known/security.txt  (RFC 9116)
 *   public/robots.txt
 *   public/sitemap.xml
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const SITE = "https://meridian.knowledgetest.workers.dev";

function fields(text) {
  const out = new Map();
  for (const line of text.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const m = /^([A-Za-z-]+):\s*(.+)$/.exec(line);
    assert.ok(m, `malformed security.txt line: ${line}`);
    out.set(m[1].toLowerCase(), [...(out.get(m[1].toLowerCase()) ?? []), m[2].trim()]);
  }
  return out;
}

test("security.txt: contacts are the /contact page and the GitHub advisory page (https, no email)", () => {
  const f = fields(read("public/.well-known/security.txt"));
  assert.deepEqual(f.get("contact"), [
    `${SITE}/contact`,
    "https://github.com/veeresh-bikkaneti/Meridian/security/advisories/new",
  ]);
  assert.doesNotMatch(read("public/.well-known/security.txt"), /mailto:|@[a-z0-9-]+\.[a-z]/i);
  assert.deepEqual(f.get("canonical"), [`${SITE}/.well-known/security.txt`]);
});

test("security.txt: exactly one Expires, in the future and at most a year out", () => {
  const f = fields(read("public/.well-known/security.txt"));
  const expires = f.get("expires");
  assert.equal(expires?.length, 1, "RFC 9116 requires exactly one Expires");
  const at = Date.parse(expires[0]);
  assert.ok(Number.isFinite(at), "Expires must be an ISO 8601 date-time");
  assert.ok(at > Date.now(), "security.txt has EXPIRED: set a new Expires (≤ 1 year out)");
  assert.ok(
    at - Date.now() <= 366 * 86_400_000,
    "Expires should be less than a year away (RFC 9116 §2.5.5)",
  );
});

test("security.txt: Expires is at least 60 days away", () => {
  const f = fields(read("public/.well-known/security.txt"));
  const expires = f.get("expires");
  assert.equal(expires?.length, 1, "RFC 9116 requires exactly one Expires");
  const at = Date.parse(expires[0]);
  const left = at - Date.now();
  const days = Math.floor(left / 86_400_000);
  assert.ok(
    left >= 60 * 86_400_000,
    `security.txt Expires is under 60 days away (${days} days): renew it`,
  );
});

test("robots.txt allows crawling and points at the sitemap", () => {
  const text = read("public/robots.txt");
  assert.match(text, /^User-agent: \*$/m);
  assert.match(text, /^Allow: \/$/m);
  assert.doesNotMatch(text, /^Disallow: \/\s*$/m);
  assert.match(text, new RegExp(`^Sitemap: ${SITE}/sitemap.xml$`, "m"));
});

/**
 * Page routes that are deliberately noindex. They must NOT appear
 * in the sitemap — listing a URL there while its page says noindex
 * would contradict the noindex. Every other page route MUST be in
 * the sitemap. The map held only /board once; /kanban joined it on
 * 2026-11-23 (item 10 — the internal build board, ruled hidden),
 * and the owner ruled on 2026-11-15 that the board is a discovery
 * surface for parents — it IS listed in the sitemap and does NOT
 * serve noindex (asserted explicitly below; supersedes board v2
 * step 15). Board v3 also deleted /board/issues — it had no data
 * source once the board stopped reading public GitHub, and a
 * deleted route must never appear in the sitemap (the route scan
 * below only yields routes that exist, and every sitemap entry is
 * checked against the scan in "sitemap entries are real routes").
 */
const NOINDEX_ROUTES = new Map([
  // /kanban (item 10, owner rulings 2026-11-23): the internal build
  // board is noindex and unlisted — the opposite ruling from /board's.
  ["/kanban", "../src/routes/kanban.tsx"],
]);

/** Recursively list page routes (.tsx pages only; api/*.ts are server routes). */
function pageRoutes(dirUrl, prefix = "") {
  const out = [];
  for (const name of readdirSync(dirUrl)) {
    if (statSync(new URL(name, dirUrl)).isDirectory()) {
      out.push(...pageRoutes(new URL(`${name}/`, dirUrl), `${prefix}${name}/`));
      continue;
    }
    if (!name.endsWith(".tsx") || name.startsWith("__")) continue;
    const base = `${prefix}${name.replace(/\.tsx$/, "")}`;
    // File-routing path for a page: dots and slashes both separate
    // segments, index → its directory, and a segment ending in "_" is
    // pathless (board_.issues.tsx → /board/issues).
    const segments = base.split(/[/.]/).filter(Boolean);
    const path =
      segments[segments.length - 1] === "index"
        ? `/${segments.slice(0, -1).join("/")}`
        : `/${segments.map((s) => s.replace(/_$/, "")).join("/")}`;
    out.push(path === "" ? "/" : path.replace(/\/$/, "") || "/");
  }
  return out;
}

test("sitemap.xml lists every public page route", () => {
  const xml = read("public/sitemap.xml");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const pages = pageRoutes(new URL("../src/routes/", import.meta.url));
  assert.ok(pages.length > 0, "route scan found no pages — the scan itself is broken");
  for (const p of pages) {
    if (NOINDEX_ROUTES.has(p)) {
      assert.ok(
        !locs.includes(`${SITE}${p}`),
        `noindex route ${p} must not be listed in the sitemap`,
      );
    } else {
      assert.ok(locs.includes(`${SITE}${p}`), `sitemap is missing ${p}`);
    }
  }
  for (const l of locs) assert.ok(l.startsWith(`${SITE}/`), `sitemap URL off-site: ${l}`);
});

test("every sitemap-excluded route really is noindex", () => {
  for (const [path, file] of NOINDEX_ROUTES) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(
      source,
      /name:\s*"robots",\s*content:\s*"noindex"/,
      `${path} is excluded from the sitemap but its route does not declare noindex`,
    );
  }
});

test("the board is indexed: listed in the sitemap and serving no noindex (owner ruling, 2026-11-15)", () => {
  const xml = read("public/sitemap.xml");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.includes(`${SITE}/board`), "sitemap is missing /board");
  assert.ok(
    !locs.some((l) => l.includes("issues")),
    "a deleted route (/board/issues) must not be listed",
  );
  const source = read("src/routes/board.tsx");
  assert.doesNotMatch(
    source,
    /name:\s*"robots",\s*content:\s*"noindex"/,
    "/board must not declare noindex — the owner ruled it discoverable",
  );
});

test("sitemap entries are real routes", () => {
  const xml = read("public/sitemap.xml");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const pages = pageRoutes(new URL("../src/routes/", import.meta.url));
  for (const l of locs) {
    const p = l.slice(SITE.length) || "/";
    assert.ok(pages.includes(p), `sitemap lists ${p}, which is not a page route`);
  }
});
