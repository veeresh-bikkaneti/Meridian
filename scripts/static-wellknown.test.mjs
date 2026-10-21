/**
 * Static discovery files (review R7, 2026-10-21):
 *   public/.well-known/security.txt  (RFC 9116)
 *   public/robots.txt
 *   public/sitemap.xml
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";

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
  assert.ok(at - Date.now() <= 366 * 86_400_000, "Expires should be less than a year away (RFC 9116 §2.5.5)");
});

test("robots.txt allows crawling and points at the sitemap", () => {
  const text = read("public/robots.txt");
  assert.match(text, /^User-agent: \*$/m);
  assert.match(text, /^Allow: \/$/m);
  assert.doesNotMatch(text, /^Disallow: \/\s*$/m);
  assert.match(text, new RegExp(`^Sitemap: ${SITE}/sitemap.xml$`, "m"));
});

test("sitemap.xml lists every page route", () => {
  const xml = read("public/sitemap.xml");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const pages = readdirSync(new URL("../src/routes", import.meta.url))
    .filter((n) => n.endsWith(".tsx") && !n.startsWith("__"))
    .map((n) => (n === "index.tsx" ? "/" : `/${n.replace(/\.tsx$/, "")}`));
  for (const p of pages) assert.ok(locs.includes(`${SITE}${p}`), `sitemap is missing ${p}`);
  for (const l of locs) assert.ok(l.startsWith(`${SITE}/`), `sitemap URL off-site: ${l}`);
});
