/**
 * Regression guards for the 2026-10-24 launch-audit accessibility fixes
 * (axe-confirmed findings F1–F3). Source-level, in the idiom of
 * security-headers.test.ts / bounded-text.test.ts: the unit suite has no
 * DOM, so these read the shipped source and assert the contracts axe
 * checks in a browser — contrast computed from the real theme tokens in
 * styles.css, list semantics in the contact error block, and
 * Label-in-Name (WCAG 2.5.3) on the grandpa donation ask.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const contact = readFileSync(new URL("./routes/contact.tsx", import.meta.url), "utf8");
const grandpa = readFileSync(new URL("./components/grandpa-coffee-run.tsx", import.meta.url), "utf8");

/** Body of the CSS block whose selector starts with `marker`. */
function blockBody(text: string, marker: string): string {
  const at = text.indexOf(marker);
  assert.notEqual(at, -1, `selector not found: ${marker}`);
  const open = text.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced block: ${marker}`);
}

function token(block: string, name: string): string {
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(m, `token ${name} missing from theme block`);
  return m[1];
}

function luminance(hex: string): number {
  const parts = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const darkBase = blockBody(css, ":root {");
const darkNight = blockBody(css, ':root[data-theme="night"]');
const lightMedia = blockBody(css, ':root:not([data-theme="night"])');
const lightPaper = blockBody(css, ':root[data-theme="paper"]');
const SURFACES = ["--bg", "--surface", "--surface-2"] as const;

describe("F1 — contact error colour passes WCAG 1.4.3 (≥4.5:1) in both themes", () => {
  it("defines a theme-aware --error token in every theme block", () => {
    for (const block of [darkBase, darkNight, lightMedia, lightPaper]) token(block, "--error");
  });

  it("the paired theme blocks agree on --error (the file duplicates tokens across pairs)", () => {
    assert.equal(token(darkBase, "--error"), token(darkNight, "--error"));
    assert.equal(token(lightMedia, "--error"), token(lightPaper, "--error"));
  });

  it("dark --error passes ≥4.5:1 on every dark surface", () => {
    for (const block of [darkBase, darkNight]) {
      const err = token(block, "--error");
      for (const s of SURFACES) {
        const r = contrast(err, token(block, s));
        assert.ok(r >= 4.5, `--error ${err} on ${s} ${token(block, s)} is ${r.toFixed(2)}:1 (< 4.5)`);
      }
    }
  });

  it("light --error passes ≥4.5:1 on every light surface", () => {
    for (const block of [lightMedia, lightPaper]) {
      const err = token(block, "--error");
      for (const s of SURFACES) {
        const r = contrast(err, token(block, s));
        assert.ok(r >= 4.5, `--error ${err} on ${s} ${token(block, s)} is ${r.toFixed(2)}:1 (< 4.5)`);
      }
    }
  });

  it("exposes --error to Tailwind via @theme inline (the --gold-ink pattern)", () => {
    assert.ok(css.includes("--color-error: var(--error);"), "--color-error mapping missing");
  });

  it("contact.tsx renders problems in text-error, not text-red-700", () => {
    assert.ok(!contact.includes("text-red-700"), "text-red-700 still present in contact.tsx");
    assert.ok(contact.includes("text-error"), "text-error not used in contact.tsx");
  });
});

describe("F2 — contact error list keeps list semantics AND the alert announcement", () => {
  it("the problems <ul> carries no role (role=\"alert\" on a <ul> strips its list role)", () => {
    assert.ok(!/<ul[^>]*\srole=/.test(contact), "a <ul> in contact.tsx still carries a role");
  });

  it("a role=\"alert\" wrapper announces the problems list", () => {
    const flat = contact.replace(/\s+/g, " ");
    assert.ok(
      flat.includes('<div role="alert"> <ul className="text-error">'),
      "expected <div role=\"alert\"> wrapping the problems <ul>",
    );
  });
});

describe("F3 — grandpa bubble ask: accessible name contains the visible text (WCAG 2.5.3)", () => {
  const at = grandpa.indexOf('data-testid="grandpa-bubble-ask"');
  const tag = grandpa.slice(at, at + 700);
  const m = tag.match(/aria-label="([^"]+)"/);

  it("the ask button has an aria-label", () => {
    assert.notEqual(at, -1, "grandpa-bubble-ask button not found");
    assert.ok(m, "aria-label not found on the ask button");
  });

  it("the name contains both visible text lines, verbatim and in order", () => {
    const label = m![1];
    const line1 = "Grown-ups — buy me a coffee?";
    const line2 = "Your support keeps Meridian free for kids";
    assert.ok(label.includes(line1), `name lacks visible line 1: ${label}`);
    assert.ok(label.includes(line2), `name lacks visible line 2: ${label}`);
    assert.ok(label.indexOf(line1) < label.indexOf(line2), "visible lines out of order in the name");
  });
});
