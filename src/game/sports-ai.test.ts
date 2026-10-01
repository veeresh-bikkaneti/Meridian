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

const GREEN_BAY_GID = "5254962";
const NYC_GID = "5128581";
const DC_GID = "4140963";
const ST_LOUIS_GID = "4407066";

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

test("validateAiTeams keeps only the queried city's teams in their official leagues", () => {
  const valid = validateAiTeams(
    [
      { team: "Green Bay Packers", league: "NFL" },
      { team: "New York Yankees", league: "MLB" },
    ],
    GREEN_BAY_GID,
  );
  assert.deepEqual(valid, [{ team: "Green Bay Packers", league: "NFL" }]);

  // Unknown team names are dropped (hallucination guard).
  assert.deepEqual(
    validateAiTeams([{ team: "Springfield Atoms", league: "NFL" }], GREEN_BAY_GID),
    [],
  );
  // Unknown leagues are dropped.
  assert.deepEqual(
    validateAiTeams([{ team: "Green Bay Packers", league: "XFL" }], GREEN_BAY_GID),
    [],
  );
  // Non-arrays and malformed entries fail closed.
  assert.deepEqual(validateAiTeams(null, GREEN_BAY_GID), []);
  assert.deepEqual(validateAiTeams("nope", GREEN_BAY_GID), []);
  assert.deepEqual(validateAiTeams([{ team: "Green Bay Packers" }], GREEN_BAY_GID), []);
  assert.deepEqual(validateAiTeams([{ team: "", league: "NFL" }], GREEN_BAY_GID), []);
  // Case-insensitive roster match, deduped.
  assert.deepEqual(
    validateAiTeams(
      [
        { team: "green bay packers", league: "NFL" },
        { team: "Green Bay Packers", league: "NFL" },
      ],
      GREEN_BAY_GID,
    ),
    [{ team: "green bay packers", league: "NFL" }],
  );
});

test("validateAiTeams rejects a real team from the wrong city", () => {
  // The review's blocking case: Yankees are real, but not Green Bay's.
  assert.deepEqual(
    validateAiTeams([{ team: "New York Yankees", league: "MLB" }], GREEN_BAY_GID),
    [],
  );
  assert.deepEqual(
    validateAiTeams([{ team: "Green Bay Packers", league: "NFL" }], NYC_GID),
    [],
  );
  // Unknown city ids fail closed — never validate against nothing.
  assert.deepEqual(
    validateAiTeams([{ team: "Green Bay Packers", league: "NFL" }], "99999999"),
    [],
  );
  assert.deepEqual(validateAiTeams([{ team: "Green Bay Packers", league: "NFL" }], null), []);
});

test("validateAiTeams rejects a right team with the wrong league", () => {
  assert.deepEqual(
    validateAiTeams([{ team: "Green Bay Packers", league: "MLB" }], GREEN_BAY_GID),
    [],
  );
  assert.deepEqual(
    validateAiTeams([{ team: "D.C. United", league: "NFL" }], DC_GID),
    [],
  );
});

test("validateAiTeams sorts NFL first, then MLB, NBA, NHL, MLS", () => {
  const out = validateAiTeams(
    [
      { team: "New York City FC", league: "MLS" },
      { team: "New York Yankees", league: "MLB" },
      { team: "New York Giants", league: "NFL" },
    ],
    NYC_GID,
  );
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

test("withSportsLine replaces sentences with periods in team names (D.C., St. Louis)", () => {
  // Real chunk blurbs: the old [^.] pattern could not span these periods and
  // appended a second sentence instead of replacing.
  const dcLead =
    "Washington is a capital in the District of Columbia, United States (population ~689,545). ";
  const dcSports = buildSportsSentence([
    { team: "Washington Commanders", league: "NFL" },
    { team: "Washington Nationals", league: "MLB" },
    { team: "Washington Wizards", league: "NBA" },
    { team: "Washington Capitals", league: "NHL" },
    { team: "D.C. United", league: "MLS" },
  ]);
  const dcStory = dcLead + dcSports;
  const dcReplaced = withSportsLine(dcStory, [{ team: "D.C. United", league: "MLS" }]);
  assert.ok(dcReplaced.endsWith("Home of the D.C. United (MLS)."));
  assert.equal(
    dcReplaced.match(/Home of the/g)?.length,
    1,
    "D.C. sentence must be replaced, not duplicated",
  );

  const stlLead = "St. Louis is a city in eastern Missouri, United States (population ~301,578). ";
  const stlSports = buildSportsSentence([
    { team: "St. Louis Cardinals", league: "MLB" },
    { team: "St. Louis Blues", league: "NHL" },
    { team: "St. Louis City SC", league: "MLS" },
  ]);
  const stlStory = stlLead + stlSports;
  const stlReplaced = withSportsLine(stlStory, [{ team: "St. Louis Blues", league: "NHL" }]);
  assert.ok(stlReplaced.endsWith("Home of the St. Louis Blues (NHL)."));
  assert.equal(
    stlReplaced.match(/Home of the/g)?.length,
    1,
    "St. Louis sentence must be replaced, not duplicated",
  );
  // Unrelated cities are untouched by the fix.
  assert.deepEqual(
    validateAiTeams([{ team: "D.C. United", league: "MLS" }], ST_LOUIS_GID),
    [],
  );
  assert.deepEqual(validateAiTeams([{ team: "D.C. United", league: "MLS" }], DC_GID), [
    { team: "D.C. United", league: "MLS" },
  ]);
});

test("withSportsLine never eats a trailing non-sports sentence or an earlier mention", () => {
  // Greedy-match regression: a mid-story "Home of the" followed by trailing
  // text must fail closed (append), never swallow the trailing sentence.
  const trailing =
    "Green Bay is a county seat in eastern Wisconsin. Home of the Green Bay Packers (NFL). It is nice.";
  assert.equal(
    withSportsLine(trailing, [{ team: "Green Bay Packers", league: "NFL" }]),
    `${trailing} Home of the Green Bay Packers (NFL).`,
  );
  // Two occurrences: replacement starts at the LAST "Home of the".
  const twice = "Home of the brave. Home of the Green Bay Packers (NFL).";
  assert.equal(
    withSportsLine(twice, [{ team: "Milwaukee Bucks", league: "NBA" }]),
    "Home of the brave. Home of the Milwaukee Bucks (NBA).",
  );
});

test("geonameIdOf parses chunk ids", () => {
  assert.equal(geonameIdOf("gn-5254962"), "5254962");
  assert.equal(geonameIdOf("nope"), null);
  assert.equal(geonameIdOf(""), null);
});

test("queryAiTeams returns validated teams from a model reply", async () => {
  const teams = await queryAiTeams("Green Bay, Wisconsin", GREEN_BAY_GID, async () =>
    fakeSession('[{"team": "Green Bay Packers", "league": "NFL"}]'),
  );
  assert.deepEqual(teams, [{ team: "Green Bay Packers", league: "NFL" }]);
});

test("queryAiTeams returns null on garbage, errors, or empty answers", async () => {
  assert.equal(
    await queryAiTeams("Nowhere", null, async () => fakeSession("I don't know")),
    null,
  );
  assert.equal(
    await queryAiTeams("Nowhere", null, async () => fakeSession('[{"team":"Fakersons","league":"NFL"}]')),
    null,
  );
  assert.equal(
    await queryAiTeams("Nowhere", null, async () => fakeSession(new Error("boom"))),
    null,
  );
  assert.equal(
    await queryAiTeams("Nowhere", null, async () => {
      throw new Error("no model");
    }),
    null,
  );
  // Model says "no teams" → null (curated line stands; empty is not proof).
  assert.equal(await queryAiTeams("Nowhere", null, async () => fakeSession("[]")), null);
});

test("queryAiTeams rejects a valid team for the wrong city", async () => {
  // Real team, real league — but Green Bay has no baseball team.
  assert.equal(
    await queryAiTeams("Green Bay, Wisconsin", GREEN_BAY_GID, async () =>
      fakeSession('[{"team": "New York Yankees", "league": "MLB"}]'),
    ),
    null,
  );
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

test("cityLabelForPlace prefers the whole-country origin over the re-tagged region", () => {
  // A Texas place folded into a whole-US run is dealt as united-states but
  // the AI query should still disambiguate at the state level.
  assert.equal(
    cityLabelForPlace({ name: "Houston", regionId: "united-states", originRegionId: "texas" }),
    "Houston, Texas",
  );
  assert.equal(
    cityLabelForPlace({ name: "Springfield", regionId: "united-states", originRegionId: "illinois" }),
    "Springfield, Illinois",
  );
});
