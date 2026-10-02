import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  contentWords,
  checkLength,
  checkBanned,
  checkContentWords,
  checkScopeWords,
  checkNamedAfterInversion,
  checkHedging,
  checkDateBinding,
  findYears,
  validateStory,
  buildStoryPrompt,
  normalizeAiReply,
  queryAiStory,
  readCachedStory,
  writeCachedStory,
  storyCacheKey,
  shouldFireAiStory,
  withStoryLine,
  useAiStory,
  AI_STORY_BADGE,
  type PromptSession,
  type StoryPlace,
} from "./story-ai.ts";

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

test("buildStoryPrompt grounds Nano in the extract when one is given", () => {
  const prompt = buildStoryPrompt({
    label: "Springfield, Illinois",
    extract: "Springfield was founded in 1821 by John Campbell.",
  });
  assert.ok(prompt.includes("Springfield, Illinois"));
  assert.ok(prompt.includes("Use ONLY facts from this Wikipedia extract"));
  assert.ok(prompt.includes("Springfield was founded in 1821 by John Campbell."));
  assert.ok(!prompt.includes("EMPTY"), "extract path must not invite empty replies");
  // The four principles + few-shots are in the prompt.
  assert.ok(prompt.includes("History first, modern identity second"));
  assert.ok(prompt.includes("If a kid could not retell it, the sentence fails"));
  assert.ok(prompt.includes("George Washington"));
  assert.ok(prompt.includes("Romulus and Remus"));
});

test("buildStoryPrompt forbids guessing when no extract exists", () => {
  for (const extract of [null, undefined, ""]) {
    const prompt = buildStoryPrompt({ label: "Nowhereville, Texas", extract });
    assert.ok(prompt.includes("Nowhereville, Texas"));
    assert.ok(prompt.includes("EMPTY"), "no-extract path must demand empty-on-unsure");
    assert.ok(prompt.includes("Guessing is worse than silence"));
    assert.ok(!prompt.includes("Use ONLY facts from this Wikipedia extract"));
  }
});

test("buildStoryPrompt caps a long extract", () => {
  const prompt = buildStoryPrompt({ label: "X", extract: "a".repeat(5000) });
  assert.ok(prompt.length < 5000, "the full 5000-char extract must not be embedded");
  assert.ok(prompt.includes("a".repeat(100)), "a capped slice is still embedded");
});

// ---------------------------------------------------------------------------
// Validator port — one adversarial case per check
// ---------------------------------------------------------------------------

test("checkLength enforces 20..240 chars and terminal punctuation", () => {
  assert.deepEqual(checkLength("Too short."), ["too-short"]);
  assert.deepEqual(checkLength("x".repeat(241) + "."), ["too-long"]);
  assert.deepEqual(checkLength("This sentence has no terminal punctuation"), [
    "no-terminal-punctuation",
  ]);
  assert.deepEqual(
    checkLength("Legend says twin brothers founded Rome after a fierce argument."),
    [],
  );
});

test("checkBanned rejects coords, elevation, population, and measurements", () => {
  assert.ok(checkBanned("It lies at 12°30′N latitude.")[0].startsWith("banned-pattern"));
  assert.ok(
    checkBanned("The town sits 2,500 feet above sea level.")[0].startsWith("banned-pattern"),
  );
  assert.ok(
    checkBanned("It has a population of 50,000 people.")[0].startsWith("banned-pattern"),
  );
  assert.ok(checkBanned("The bridge spans 10 km.")[0].startsWith("banned-pattern"));
  assert.deepEqual(
    checkBanned("Legend says twin brothers founded Rome after a fierce argument."),
    [],
  );
});

test("checkContentWords flags words absent from the source", () => {
  const source = "Rome is a city in Italy. Legend says twin brothers founded Rome.";
  assert.deepEqual(
    checkContentWords("Legend says twin brothers founded Rome on Mars.", source),
    ["fabricated words: mars"],
  );
  assert.deepEqual(
    checkContentWords("Legend says twin brothers founded Rome.", source),
    [],
  );
});

test("checkScopeWords flags a smuggled 'not' that flips the meaning", () => {
  const source = "The town was named after explorer Lewis.";
  assert.deepEqual(
    checkScopeWords("The town was not named after explorer Lewis.", source),
    ["smuggled-scope-word: not"],
  );
  // Dropping a scope word the source had is harmless.
  assert.deepEqual(
    checkScopeWords("The town was named after explorer Lewis.", "The town was not named after anybody."),
    [],
  );
});

test("checkNamedAfterInversion catches the person-as-subject flip", () => {
  // The adversarial review's blocking case: passes word-presence checks,
  // inverts the relation.
  assert.deepEqual(
    checkNamedAfterInversion(
      "Explorer Lewis named the town after himself.",
      "explorer Lewis",
    ),
    ["named-after-inversion"],
  );
  // Passive voice keeps the person as the object — no violation.
  assert.deepEqual(
    checkNamedAfterInversion("The town was named after explorer Lewis.", "explorer Lewis"),
    [],
  );
  // No person known → no check.
  assert.deepEqual(checkNamedAfterInversion("Explorer Lewis named the town.", ""), []);
});

test("checkHedging treats a dropped 'probably' as fabrication", () => {
  const source = "The city was probably founded in 1640 by traders.";
  assert.deepEqual(checkHedging(source, "The city was founded in 1640 by traders."), [
    "dropped-hedge",
  ]);
  assert.deepEqual(
    checkHedging(source, "The city was probably founded in 1640 by traders."),
    [],
  );
  // Unhedged sources impose nothing.
  assert.deepEqual(
    checkHedging("The city was founded in 1640.", "The city was founded in 1640."),
    [],
  );
});

test("checkDateBinding keeps the year on its predicate class", () => {
  const source = "The town was first mentioned in 1234 in old records.";
  // "mentioned in 1234" (attestation) must never become "founded in 1234".
  assert.deepEqual(
    checkDateBinding(source, "The town was founded in 1234 by settlers.", 1234),
    ["date-predicate-drift"],
  );
  // Same class passes.
  assert.deepEqual(
    checkDateBinding(source, "Records first mentioned the town in 1234.", 1234),
    [],
  );
  // Dropping the year entirely fails.
  assert.deepEqual(
    checkDateBinding(source, "The town was founded by settlers.", 1234),
    ["dropped-year"],
  );
  // No year → no constraint.
  assert.deepEqual(checkDateBinding(source, "Anything.", null), []);
});

test("findYears picks out four-digit years", () => {
  assert.deepEqual(findYears("Founded in 1634, rebuilt after the fire of 1871."), [
    "1634",
    "1871",
  ]);
  assert.deepEqual(findYears("No years here."), []);
});

test("validateStory accepts a grounded story against its extract", () => {
  const extract =
    "Green Bay was founded in 1634 by Jean Nicolet, a French explorer. " +
    "The city is named for the bay's green color.";
  const story = "French explorer Jean Nicolet founded Green Bay in 1634.";
  assert.deepEqual(validateStory(story, extract), []);
});

test("validateStory fails closed on any single violation (extract path)", () => {
  const extract = "Green Bay was founded in 1634 by Jean Nicolet, a French explorer.";
  // Fabricated word.
  assert.ok(
    validateStory("Jean Nicolet founded Green Bay in 1634 and built a spaceship.", extract)
      .length > 0,
  );
  // Date drift: "mentioned" source vs "founded" story (all words grounded).
  assert.deepEqual(
    validateStory(
      "Traders founded Green Bay in 1634.",
      "Green Bay was first mentioned in 1634 by traders, and the settlement was founded in 1650.",
    ),
    ["date-predicate-drift"],
  );
});

test("validateStory without an extract runs only source-free checks", () => {
  // Any scope-flipping word is ungrounded without a source.
  assert.deepEqual(validateStory("The city was not built in a day."), [
    "smuggled-scope-word: not",
  ]);
  // Length and banned patterns still apply.
  assert.deepEqual(validateStory("Too short."), ["too-short"]);
  assert.ok(
    validateStory("The city sits 300 m above sea level and is lovely.")[0].startsWith(
      "banned-pattern",
    ),
  );
  // A clean, grounded-in-nothing story passes the source-free checks.
  assert.deepEqual(
    validateStory("Legend says twin brothers founded Rome after a fierce argument."),
    [],
  );
});

// ---------------------------------------------------------------------------
// Reply normalization + query
// ---------------------------------------------------------------------------

const NICOLET_EXTRACT =
  "Green Bay was founded in 1634 by Jean Nicolet, a French explorer. " +
  "The city is named for the bay's green color.";
const NICOLET_STORY = "French explorer Jean Nicolet founded Green Bay in 1634.";

test("normalizeAiReply strips fences and quotes", () => {
  assert.equal(normalizeAiReply("```\nHello world, this is a story.\n```"), "Hello world, this is a story.");
  assert.equal(normalizeAiReply('"Hello world, this is a story."'), "Hello world, this is a story.");
  assert.equal(normalizeAiReply("   "), "");
});

const fakeSession = (reply: string | Error | Promise<string>): PromptSession => ({
  prompt: async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  },
  destroy: () => {},
});

test("queryAiStory returns a validated story from a model reply", async () => {
  const story = await queryAiStory("Green Bay, Wisconsin", NICOLET_EXTRACT, {
    openSession: async () => fakeSession(NICOLET_STORY),
  });
  assert.equal(story, NICOLET_STORY);
});

test("queryAiStory returns null on invalid, empty, or errored replies", async () => {
  const open = (reply: string | Error | Promise<string>) => async () => fakeSession(reply);
  // Fabricated word ("spaceship") fails the extract grounding.
  assert.equal(
    await queryAiStory("Green Bay, Wisconsin", NICOLET_EXTRACT, {
      openSession: open("Jean Nicolet founded Green Bay in 1634 and built a spaceship."),
    }),
    null,
  );
  // Empty reply = "nothing to say".
  assert.equal(
    await queryAiStory("X", null, { openSession: open("   ") }),
    null,
  );
  // Session errors never throw.
  assert.equal(
    await queryAiStory("X", null, { openSession: open(new Error("boom")) }),
    null,
  );
  assert.equal(
    await queryAiStory("X", null, {
      openSession: async () => {
        throw new Error("no model");
      },
    }),
    null,
  );
});

test("queryAiStory honors an already-aborted signal without opening a session", async () => {
  const controller = new AbortController();
  controller.abort();
  let opened = false;
  const story = await queryAiStory("X", null, {
    openSession: async () => {
      opened = true;
      return fakeSession(NICOLET_STORY);
    },
    signal: controller.signal,
  });
  assert.equal(story, null);
  assert.equal(opened, false, "no session should open after abort");
});

test("queryAiStory aborts a hung prompt on place change", async () => {
  const controller = new AbortController();
  let settled: ((v: string) => void) | null = null;
  const hung = new Promise<string>((resolve) => {
    settled = resolve;
  });
  const pending = queryAiStory("X", null, {
    openSession: async () => fakeSession(hung),
    signal: controller.signal,
  });
  controller.abort(); // place changed while Nano was thinking
  assert.equal(await pending, null);
  settled!(NICOLET_STORY); // late reply must not resurrect the story
});

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

function installMemoryStorage(): Map<string, string> {
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
  return map;
}

function uninstallMemoryStorage(): void {
  delete (globalThis as Record<string, unknown>).localStorage;
}

test("storyCacheKey namespaces by GeoNames id, falling back to the raw id", () => {
  assert.equal(storyCacheKey("gn-5254962"), "meridian.ai-story.v1.5254962");
  assert.ok(storyCacheKey("gn-5254962").startsWith("meridian.ai-story.v1."));
  assert.equal(storyCacheKey("starter-1"), "meridian.ai-story.v1.starter-1");
});

test("story cache round-trips stories and caches empty outcomes", () => {
  const map = installMemoryStorage();
  try {
    assert.equal(readCachedStory("gn-1"), null, "miss → null");
    writeCachedStory("gn-1", NICOLET_STORY);
    assert.equal(readCachedStory("gn-1"), NICOLET_STORY);
    // Empty = "Nano checked, nothing usable" — distinct from a miss, so we
    // never re-prompt the place.
    writeCachedStory("gn-2", "");
    assert.equal(readCachedStory("gn-2"), "", "cached empty must read back as empty");
    // Corrupt entries fail closed.
    map.set(storyCacheKey("gn-3"), "not-json{{{");
    assert.equal(readCachedStory("gn-3"), null);
    // Expired entries are evicted.
    map.set(
      storyCacheKey("gn-4"),
      JSON.stringify({ story: NICOLET_STORY, at: Date.now() - 181 * 24 * 60 * 60 * 1000 }),
    );
    assert.equal(readCachedStory("gn-4"), null);
    assert.ok(!map.has(storyCacheKey("gn-4")), "expired entry is removed");
  } finally {
    uninstallMemoryStorage();
  }
});

test("story cache is a safe no-op without localStorage (node)", () => {
  writeCachedStory("123", NICOLET_STORY);
  assert.equal(readCachedStory("123"), null);
});

// ---------------------------------------------------------------------------
// Firing condition + hook
// ---------------------------------------------------------------------------

test("shouldFireAiStory fires only for blurb-only generated places", () => {
  const base: StoryPlace = { id: "gn-1", name: "X", regionId: "globe" };
  assert.equal(shouldFireAiStory(null), false);
  assert.equal(shouldFireAiStory({ ...base, id: "" }), false);
  assert.equal(shouldFireAiStory({ ...base, fact: "A real fact." }), false);
  assert.equal(shouldFireAiStory({ ...base, fact: null }), true);
  assert.equal(shouldFireAiStory(base), true, "missing fact counts as no fact");
  assert.equal(shouldFireAiStory({ ...base, fact: "" }), true, "empty fact counts as no fact");
  assert.equal(
    shouldFireAiStory({ ...base, history: "A history hook." }),
    false,
    "history hook present → skip",
  );
  assert.equal(
    shouldFireAiStory({ ...base, history: "" }),
    true,
    "empty history counts as no enrichment",
  );
  assert.equal(
    shouldFireAiStory({ ...base, id: "alabama-vulcan" }),
    false,
    "curated (non-gn-) place → skip",
  );
  assert.equal(
    shouldFireAiStory({ ...base, curated: true }),
    false,
    "explicit curated flag → skip even with gn- id",
  );
});

function Probe({ place }: { place: StoryPlace | null }) {
  const story = useAiStory(place);
  return createElement("span", null, story === null ? "none" : story);
}

test("useAiStory returns null immediately — the card never waits on Nano", () => {
  // renderToString never runs effects: this is exactly the first paint the
  // user sees, generic blurb already on screen, Nano still thinking (or absent).
  const noFact = renderToString(
    createElement(Probe, {
      place: { id: "gn-5254962", name: "Green Bay", regionId: "wisconsin", fact: null },
    }),
  );
  assert.ok(noFact.includes(">none<"), "no-fact place renders null on first paint");
  const withFact = renderToString(
    createElement(Probe, {
      place: { id: "gn-5254962", name: "Green Bay", regionId: "wisconsin", fact: "A fact." },
    }),
  );
  assert.ok(withFact.includes(">none<"), "build-time fact present → null, Nano stays asleep");
});

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

test("withStoryLine appends the AI story or leaves the base untouched", () => {
  const base = "Green Bay is a city in Wisconsin.";
  assert.equal(withStoryLine(base, NICOLET_STORY), `${base} ${NICOLET_STORY}`);
  assert.equal(withStoryLine(base, null), base);
  assert.equal(withStoryLine("", NICOLET_STORY), NICOLET_STORY);
});

test("card upgrade path: blurb-only place → validated AI story → separate live element + badge", async () => {
  // This mirrors exactly what ResultCard does:
  //   const aiStory = useAiStory(place);   // hook (Probe-tested above)
  //   const withSports = withSportsLine(baseStory, aiSports);  // base text
  //   <span aria-live="polite">{aiStory ? <> {aiStory}<AiStoryBadge /></> : null}</span>
  // The AI sentence is NEVER baked into the base string: it renders as its
  // own announced element so screen readers hear only the new sentence, and
  // the badge sits adjacent to the sentence it labels (never the sports line).
  const blurbOnly: StoryPlace = { id: "gn-5254962", name: "Green Bay", regionId: "wisconsin" };
  assert.equal(shouldFireAiStory(blurbOnly), true, "blurb-only generated place fires");

  // Mocked Nano session returns the validated story (extract-grounded).
  const aiStory = await queryAiStory("Green Bay, Wisconsin", NICOLET_EXTRACT, {
    openSession: async () => fakeSession(NICOLET_STORY),
  });
  assert.equal(aiStory, NICOLET_STORY);

  // Card composition: base text paints instantly; the AI sentence arrives
  // as a separate unit. Badge visibility rule: badge renders iff aiStory.
  const baseStory = "Green Bay is a city in northeastern Wisconsin, the United States.";
  const showBadge = aiStory !== null;
  assert.equal(showBadge, true, "badge shows when the AI story arrives");
  assert.equal(baseStory.includes(NICOLET_STORY), false, "base text never contains the AI sentence");
  assert.equal(withStoryLine(baseStory, null), baseStory, "null AI story leaves the base untouched");
});

test("card upgrade path: enriched place never reaches Nano", () => {
  const withHistory: StoryPlace = {
    id: "gn-1",
    name: "X",
    regionId: "globe",
    history: "A history hook.",
  };
  const withFact: StoryPlace = { id: "gn-2", name: "Y", regionId: "globe", fact: "A fact." };
  const curated: StoryPlace = { id: "alabama-vulcan", name: "Vulcan Park", regionId: "alabama" };
  for (const place of [withHistory, withFact, curated]) {
    assert.equal(shouldFireAiStory(place), false, `${place.id} must not fire Nano`);
  }
});

test("AI_STORY_BADGE carries the disclosure copy", () => {
  assert.equal(AI_STORY_BADGE.label, "AI");
  assert.equal(AI_STORY_BADGE.title, "Written with on-device AI");
});

test("contentWords matches the build-time definition", () => {
  assert.deepEqual(contentWords("The Town of Foobar 12345!"), ["town", "foobar", "12345"]);
});
