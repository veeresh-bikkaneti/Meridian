/**
 * Shared case, v2 — typed-number answers and a follow-up question.
 *
 * Test-only fixtures: no shipped item changes. The number fixture
 * reuses the wave-1 multi-digit question (23 rows of 47 tiles) with a
 * follow-up, so the number card, the follow-up order, and the
 * unchanged choice path are all proven without touching any subject's
 * answers module. Rendering uses renderToString (node:test runs
 * without jsdom), following the read-aloud-button.test.ts precedent:
 * a .tsx transpile hook is registered so AnswerCard.tsx can load.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { register } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const HOOKS_SOURCE = [
  "import { fileURLToPath, pathToFileURL } from 'node:url';",
  "import { dirname, resolve as resolvePath } from 'node:path';",
  "const ROOT = " + JSON.stringify(REPO_ROOT) + ";",
  "const TS_URL = pathToFileURL(resolvePath(ROOT, 'node_modules/typescript/lib/typescript.js')).href;",
  "export async function load(url, context, nextLoad) {",
  "  if (url.endsWith('.tsx')) {",
  "    const { readFileSync } = await import('node:fs');",
  "    const ts = await import(TS_URL);",
  "    const out = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {",
  "      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },",
  "    });",
  "    return { format: 'module', source: out.outputText, shortCircuit: true };",
  "  }",
  "  return nextLoad(url, context);",
  "}",
].join("\n");

register("data:text/javascript," + encodeURIComponent(HOOKS_SOURCE));

const { AnswerCard } = (await import("./AnswerCard.tsx")) as typeof import("./AnswerCard.tsx");

import {
  advanceCasePhase,
  parseTypedNumber,
  type AnswerEntry,
} from "./answer.ts";

/** Test-only fixture: number entry with a choice follow-up. */
const NUMBER_ENTRY: AnswerEntry = {
  prompt: "A floor is tiled in 23 rows of 47 tiles. How many tiles in all?",
  choices: [],
  correct: "1,081",
  value: 1081,
  kind: "number",
  derivation: "23 rows × 47 tiles = 1,081 tiles.",
  followUp: {
    prompt: "How many tiles are in 10 rows?",
    choices: ["470", "47", "10"],
    correct: "470",
    value: 470,
    derivation: "10 rows × 47 tiles = 470 tiles.",
  },
};

/** Test-only fixture: plain choice entry, neither new field set. */
const CHOICE_ENTRY: AnswerEntry = {
  prompt: "Forty coins are counted in 5s. How many groups of 5 is that?",
  choices: ["6", "8", "10"],
  correct: "8",
  value: 8,
  derivation: "40 coins in 5s = 8 groups (8 × 5 = 40).",
};

const noop = () => {};

function renderCard(entry: AnswerEntry, picked: string | null) {
  return renderToString(
    createElement(AnswerCard, {
      prompt: entry.prompt,
      choices: entry.choices,
      picked,
      onPick: noop,
      testId: "fixture-answer-card",
      kind: entry.kind ?? "choice",
      onNumber: noop,
    }),
  );
}

test("parseTypedNumber accepts commas, spaces and decimals", () => {
  assert.equal(parseTypedNumber("1,081"), 1081);
  assert.equal(parseTypedNumber(" 56 "), 56);
  assert.equal(parseTypedNumber("1 081"), 1081);
  assert.equal(parseTypedNumber("13.5"), 13.5);
  assert.equal(parseTypedNumber("2,400"), 2400);
  assert.equal(parseTypedNumber("1,081.5"), 1081.5);
});

test("parseTypedNumber rejects anything that is not one number", () => {
  assert.equal(parseTypedNumber(""), null);
  assert.equal(parseTypedNumber("abc"), null);
  assert.equal(parseTypedNumber("1,2,3"), null);
  assert.equal(parseTypedNumber("12a"), null);
  assert.equal(parseTypedNumber("1.2.3"), null);
  assert.equal(parseTypedNumber("--5"), null);
});

test("parseTypedNumber accepts a leading or trailing decimal point", () => {
  assert.equal(parseTypedNumber(".5"), 0.5);
  assert.equal(parseTypedNumber("5."), 5);
  assert.equal(parseTypedNumber("-3.5"), -3.5);
  assert.equal(parseTypedNumber("1,081"), 1081);
  assert.equal(parseTypedNumber("3,5"), null);
});

test("typed number compares as a number: 1,081 is right, 1,071 is wrong", () => {
  assert.equal(parseTypedNumber("1,081"), NUMBER_ENTRY.value);
  assert.notEqual(parseTypedNumber("1,071"), NUMBER_ENTRY.value);
});

test("wrong then right: a wrong answer stays, a right one advances", () => {
  assert.equal(advanceCasePhase(NUMBER_ENTRY, "main", false), "main");
  assert.equal(advanceCasePhase(NUMBER_ENTRY, "main", true), "followUp");
  assert.equal(advanceCasePhase(NUMBER_ENTRY, "followUp", false), "followUp");
  assert.equal(advanceCasePhase(NUMBER_ENTRY, "followUp", true), "done");
});

test("follow-up order: main, then follow-up, then result — never a third question", () => {
  // No follow-up: a correct main answer goes straight to the result.
  assert.equal(advanceCasePhase(CHOICE_ENTRY, "main", true), "done");
  // One level only: even a follow-up that itself carries a follow-up
  // ends the case — the nested one is never asked.
  const nested: AnswerEntry = {
    ...NUMBER_ENTRY,
    followUp: {
      ...NUMBER_ENTRY.followUp!,
      followUp: {
        prompt: "Third question?",
        choices: ["yes"],
        correct: "yes",
        derivation: "Never asked.",
      },
    },
  };
  assert.equal(advanceCasePhase(nested, "followUp", true), "done");
});

test("number card renders one labelled input and a Check button, 44px, no choices", () => {
  const html = renderCard(NUMBER_ENTRY, null);
  assert.ok(html.includes('inputMode="text"') || html.includes('inputmode="text"'), "inputMode=text so the minus key is available");
  assert.ok(html.includes("pattern="), "pattern hints a number");
  assert.ok(html.includes("Use a point for decimals, like 3.5"), "decimal-point hint");
  assert.ok(html.includes(">Check<"), "Check button");
  assert.ok(html.includes("min-h-[44px]"), "44px tap targets");
  assert.ok(html.includes('for="fixture-answer-card-number"'), "input is labelled");
  assert.ok(!html.includes("aria-pressed"), "no choice buttons in number mode");
  assert.ok(!html.includes("Not quite"), "no wrong line before an attempt");
});

test("the question prompt is a focusable heading so a follow-up can take focus", () => {
  const html = renderCard(NUMBER_ENTRY, null);
  assert.ok(html.includes("<h2"), "prompt is a heading");
  assert.ok(
    html.includes('tabindex="-1"') || html.includes('tabIndex="-1"'),
    "heading can receive focus without joining the tab order",
  );
  assert.ok(html.includes('id="fixture-answer-card-prompt"'), "heading has an id to focus");
});

test("number card shows the same wrong-answer line after a mistyped answer", () => {
  const html = renderCard(NUMBER_ENTRY, "1,071");
  assert.ok(html.includes("Not quite"), "wrong line shows");
  assert.ok(html.includes("have another go"), "same kind wording as choice mode");
  assert.ok(html.includes('role="status"'), "wrong line is a live status");
});

test("choice entry with neither new field renders exactly as before", () => {
  const html = renderCard(CHOICE_ENTRY, null);
  assert.ok(!html.includes("<input"), "no input in choice mode");
  assert.ok(!html.includes(">Check<"), "no Check button in choice mode");
  for (const choice of ["6", "8", "10"]) {
    assert.ok(html.includes(`>${choice}<`), `choice ${choice} renders`);
  }
  assert.ok(html.includes('aria-pressed="false"'), "choices start unpressed");
  assert.ok(!html.includes("Not quite"), "no wrong line before a pick");
  // A wrong pick shows the kind line and marks the picked button.
  const wrong = renderCard(CHOICE_ENTRY, "6");
  assert.ok(wrong.includes("Not quite"), "wrong line shows after a wrong pick");
  assert.ok(wrong.includes('aria-pressed="true"'), "wrong pick stays marked");
});

test("follow-up card renders its own prompt and choices", () => {
  const followUp = NUMBER_ENTRY.followUp!;
  const html = renderCard(followUp, null);
  assert.ok(html.includes("How many tiles are in 10 rows?"), "follow-up prompt");
  for (const choice of ["470", "47", "10"]) {
    assert.ok(html.includes(`>${choice}<`), `follow-up choice ${choice} renders`);
  }
  assert.ok(!html.includes("<input"), "choice follow-up has no input");
});
