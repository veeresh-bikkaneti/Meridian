/**
 * Shell registry test (PR 3 Step 5): every route and screen renders
 * the one shell — PageShell / SiteHeader, with ErrorScreen as the
 * failure-branch member of the family — or is named in the registry
 * as the one sanctioned exception (the in-run HUD) or on the
 * shrink-only baseline. The test fails if:
 * - a registered shell screen stops rendering its shell or footer;
 * - the header-exception, footer-exception or baseline lists grow
 *   or change (they are frozen in shell-registry.ts);
 * - a file renders a <main> without any registry entry (a new
 *   shell-less screen), or a route file has no registry entry.
 *
 * Negative control (recorded in the branch status file): a fake
 * shell-less screen file added under src/ turned this test red on
 * the completeness check; the in-test controls below prove the same
 * for a mutated registry, so the guard cannot silently go soft.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { SHELL_REGISTRY, validateRegistry, type ShellRegistryEntry } from "./shell-registry.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");
const sourceOf = (rel: string) => (existsSync(join(repoRoot, rel)) ? read(rel) : null);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
    const rel = `${dir}/${name.name}`;
    if (name.isDirectory()) walk(rel, out);
    else if (name.name.endsWith(".tsx") && !name.name.endsWith(".test.tsx")) out.push(rel);
  }
  return out;
}

const allTsx = walk("src");
const mainFiles = allTsx.filter((f) => /<main[\s>]/.test(read(f)));

describe("shell registry (PR 3 Step 5)", () => {
  it("every registered screen renders its shell; exceptions and baseline match the frozen lists", () => {
    assert.deepEqual(validateRegistry(SHELL_REGISTRY, sourceOf, mainFiles), []);
  });

  it("every route file is registered", () => {
    const registered = new Set(SHELL_REGISTRY.map((e) => e.file));
    const routes = walk("src/routes");
    for (const route of routes) {
      // index.tsx renders GameApp; its screens are registered
      // against game-app.tsx. The grown-ups routes render InfoPage,
      // the registered PageShell host.
      if (route === "src/routes/index.tsx") continue;
      if (registered.has(route)) continue;
      assert.ok(read(route).includes("info-page"), `${route} has no registry entry and does not render the registered InfoPage`);
    }
    assert.ok(SHELL_REGISTRY.some((e) => e.id === "home"), "the index route's home screen is registered");
  });

  it("the in-run HUD is the sole header exception; no footer exceptions remain", () => {
    assert.deepEqual(
      SHELL_REGISTRY.filter((e) => e.header === "exception").map((e) => e.id),
      ["in-run-hud"],
    );
    assert.deepEqual(
      SHELL_REGISTRY.filter((e) => e.footer === "exception").map((e) => e.id),
      [],
    );
  });

  // Footer standardization (2026-11-18): Grandpa's coffee-run band
  // is part of the one SiteFooter. Only site-footer.tsx may import
  // the scene — a page importing it directly would be a per-page
  // copy of the footer composition, which is what this lane kills.
  it("only SiteFooter imports the Grandpa scene, and it renders it", () => {
    // Static `from` imports and dynamic `import()` both count:
    // SiteFooter lazy-loads the scene (entry-budget rule), and a
    // page lazy-loading it directly would bypass the one-footer
    // composition just the same.
    const importers = allTsx.filter((f) => /(?:from\s+|import\s*\(\s*)["'][^"']*grandpa-coffee-run(?:\.tsx)?["']/.test(read(f)));
    assert.deepEqual(importers, ["src/components/ui/site-footer.tsx"]);
    assert.ok(read("src/components/ui/site-footer.tsx").includes("<GrandpaCoffeeRun"), "SiteFooter renders the scene");
  });

  // Negative controls: the validator must bite on a shell-less
  // screen, on a grown exception list, and on an unregistered file.
  it("negative control: a fake shell-less screen fails validation", () => {
    const fake: ShellRegistryEntry = {
      id: "fake-screen",
      file: "src/components/game-app.tsx",
      header: "SiteHeader",
      needle: "<NoSuchShell",
      footer: "none",
    };
    const problems = validateRegistry([...SHELL_REGISTRY, fake], sourceOf, mainFiles);
    assert.ok(problems.some((p) => p.includes("fake-screen")), problems.join("; "));
  });

  it("negative control: growing the exception or baseline list fails validation", () => {
    const grown: ShellRegistryEntry = {
      id: "sneaky-exception",
      file: "src/components/game-app.tsx",
      header: "exception",
      footer: "none",
      reason: "trying to skip the shell",
    };
    const problems = validateRegistry([...SHELL_REGISTRY, grown], sourceOf, mainFiles);
    assert.ok(problems.some((p) => p.includes("header exceptions")), problems.join("; "));
  });

  it("negative control: reviving a footer exception fails validation", () => {
    const revived: ShellRegistryEntry = {
      id: "sneaky-footer-exception",
      file: "src/components/game-app.tsx",
      header: "SiteHeader",
      needle: "<SiteHeader",
      footer: "exception",
      reason: "trying to make the footer conditional again",
    };
    const problems = validateRegistry([...SHELL_REGISTRY, revived], sourceOf, mainFiles);
    assert.ok(problems.some((p) => p.includes("footer exceptions")), problems.join("; "));
  });

  it("negative control: an unregistered <main> file fails validation", () => {
    const problems = validateRegistry(SHELL_REGISTRY, sourceOf, [...mainFiles, "src/components/unregistered.tsx"]);
    assert.ok(problems.some((p) => p.includes("unregistered.tsx")), problems.join("; "));
  });

  it("the registry file list is relative to the repo root (sanity)", () => {
    for (const e of SHELL_REGISTRY) {
      assert.ok(!relative(repoRoot, join(repoRoot, e.file)).startsWith(".."), e.file);
    }
  });
});
