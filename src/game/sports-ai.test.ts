import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSportsSentence,
  parseAiJson,
  validateAiTeams,
  withSportsLine,
  geonameIdOf,
  queryAiTeams,
  readCachedTeams,
  writeCachedTeams,
  cityLabelForPlace,
  type PromptSession,
} from "./sports-ai.ts";

const fakeSession = (reply: string | Error): PromptSession => ({
  prompt: async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  },
  destroy: () => {},
});

test("buildSportsSentence formats 1, 2, and 3+ teams", () => {
  assert.equal(
    buildSportsSentence([{ team: "Green Bay Packers", league: "NFL" }]),
    "Home of the Green Bay Packers (NFL).",
  );
  assert.equal(
    buildSportsSentence([
      { team: "Chicago Cubs", league: "MLB" },
      { team: "Chicago Bulls", league: "NBA" },
    ]),
    "Home of the Chicago Cubs (MLB) and Chicago Bulls (NBA).",
  );
  assert.equal(
    buildSportsSentence([
      { team: "New York Giants", league: "NFL" },
      { team: "New York Yankees", league: "MLB" },
      { team: "New York Knicks", league: "NBA" },
    ]),
    "Home of the New York Giants (NFL), New York Yankees (MLB), and New York Knicks (NBA).",
  );
});

test("parseAiJson tolerates code fences and rejects garbage", () => {
  assert.deepEqual(parseAiJson('[{"team":"X","league":"NFL"}]'), [{ team: "X", league: "NFL" }]);
  assert.deepEqual(parseAiJson('```json\n[{"team":"X","league":"NFL"}]\n```'), [
    { team: "X", league: "NFL" },
  ]);
  assert.equal(parseAiJson("The teams are the Packers"), null);
  assert.equal(parseAiJson(""), null);
});

test("validateAiTeams keeps only roster teams in known leagues", () => {
  const valid = validateAiTeams([
    { team: "New York Yankees", league: "MLB" },
    { team: "Green Bay Packers", league: "NFL" },
  ]);
  assert.deepEqual(valid, [
    { team: "Green Bay Packers", league: "NFL" },
    { team: "New York Yankees", league: "MLB" },
  ]);

  // Unknown team names are dropped (hallucination guard).
  assert.deepEqual(validateAiTeams([{ team: "Springfield Atoms", league: "NFL" }]), []);
  // Unknown leagues are dropped.
  assert.deepEqual(validateAiTeams([{ team: "Green Bay Packers", league: "XFL" }]), []);
  // Non-arrays and malformed entries fail closed.
  assert.deepEqual(validateAiTeams(null), []);
  assert.deepEqual(validateAiTeams("nope"), []);
  assert.deepEqual(validateAiTeams([{ team: "Green Bay Packers" }]), []);
  assert.deepEqual(validateAiTeams([{ team: "", league: "NFL" }]), []);
  // Case-insensitive roster match, deduped.
  assert.deepEqual(
    validateAiTeams([
      { team: "green bay packers", league: "NFL" },
      { team: "Green Bay Packers", league: "NFL" },
    ]),
    [{ team: "green bay packers", league: "NFL" }],
  );
});

test("validateAiTeams sorts NFL first, then MLB, NBA, NHL, MLS", () => {
  const out = validateAiTeams([
    { team: "New York City FC", league: "MLS" },
    { team: "New York Yankees", league: "MLB" },
    { team: "New York Giants", league: "NFL" },
  ]);
  assert.deepEqual(
    out.map((t) => t.league),
    ["NFL", "MLB", "MLS"],
  );
});

test("withSportsLine replaces the baked sentence or appends one", () => {
  const story =
    "Green Bay is a county seat in eastern Wisconsin, United States (population ~105,207). It sits at ~180 m elevation. Home of the Green Bay Packers (NFL).";
  const replaced = withSportsLine(story, [{ team: "Green Bay Packers", league: "NFL" }]);
  assert.equal(story, replaced); // identical input → identical output
  const changed = withSportsLine(story, [
    { team: "Green Bay Packers", league: "NFL" },
    { team: "Milwaukee Bucks", league: "NBA" },
  ]);
  assert.ok(changed.endsWith("Home of the Green Bay Packers (NFL) and Milwaukee Bucks (NBA)."));
  assert.ok(!changed.includes("(NFL). Home"), "old sentence must be replaced, not duplicated");

  const noSports = "Brandon is a town in eastern South Dakota, United States (population ~9,856).";
  assert.equal(
    withSportsLine(noSports, [{ team: "Green Bay Packers", league: "NFL" }]),
    `${noSports} Home of the Green Bay Packers (NFL).`,
  );
});

test("geonameIdOf parses chunk ids", () => {
  assert.equal(geonameIdOf("gn-5254962"), "5254962");
  assert.equal(geonameIdOf("nope"), null);
  assert.equal(geonameIdOf(""), null);
});

test("queryAiTeams returns validated teams from a model reply", async () => {
  const teams = await queryAiTeams("Green Bay, Wisconsin", async () =>
    fakeSession('[{"team": "Green Bay Packers", "league": "NFL"}]'),
  );
  assert.deepEqual(teams, [{ team: "Green Bay Packers", league: "NFL" }]);
});

test("queryAiTeams returns null on garbage, errors, or empty answers", async () => {
  assert.equal(
    await queryAiTeams("Nowhere", async () => fakeSession("I don't know")),
    null,
  );
  assert.equal(
    await queryAiTeams("Nowhere", async () => fakeSession('[{"team":"Fakersons","league":"NFL"}]')),
    null,
  );
  assert.equal(
    await queryAiTeams("Nowhere", async () => fakeSession(new Error("boom"))),
    null,
  );
  assert.equal(
    await queryAiTeams("Nowhere", async () => {
      throw new Error("no model");
    }),
    null,
  );
  // Model says "no teams" → null (curated line stands; empty is not proof).
  assert.equal(await queryAiTeams("Nowhere", async () => fakeSession("[]")), null);
});

test("sports cache is a safe no-op without localStorage (node)", () => {
  writeCachedTeams("123", [{ team: "Green Bay Packers", league: "NFL" }]);
  assert.equal(readCachedTeams("123"), null);
});

test("cityLabelForPlace prettifies the region", () => {
  assert.equal(
    cityLabelForPlace({ name: "Green Bay", regionId: "wisconsin" }),
    "Green Bay, Wisconsin",
  );
  assert.equal(
    cityLabelForPlace({ name: "New York City", regionId: "new-york" }),
    "New York City, New York",
  );
  assert.equal(cityLabelForPlace({ name: "Paris", regionId: "globe" }), "Paris");
});
