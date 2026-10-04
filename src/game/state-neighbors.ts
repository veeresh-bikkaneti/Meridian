import { STATES } from "./regions.ts";

/**
 * US state adjacency for the Hard-cleared "where next?" suggestions.
 * Data only: regionId -> up to 2 neighboring state regionIds (by name in
 * the dialog, e.g. Nebraska -> Iowa, South Dakota).
 *
 * The pairs are verified by state-neighbors.test.ts: every key and every
 * neighbor is a real regionId from STATES (the menu's own id source, so
 * keys cannot drift from the chunks), pairs are symmetric, no state
 * neighbors itself, and no state lists more than 2.
 *
 * States with no land neighbors (Alaska, Hawaii) map to an empty list and
 * the dialog falls back to the parent-country / Globe suggestions — never
 * an empty or broken button. The same fallback covers any state missing
 * from this map.
 */
export const STATE_NEIGHBORS: Record<string, readonly string[]> = {
  alabama: ["georgia", "florida"],
  alaska: [],
  arizona: ["new-mexico", "california"],
  arkansas: ["missouri"],
  california: ["arizona", "oregon"],
  colorado: ["wyoming", "new-mexico"],
  connecticut: ["massachusetts", "rhode-island"],
  delaware: ["maryland", "new-jersey"],
  florida: ["alabama", "georgia"],
  georgia: ["alabama", "florida"],
  hawaii: [],
  idaho: ["washington", "montana"],
  illinois: ["wisconsin"],
  indiana: ["kentucky"],
  iowa: ["missouri", "minnesota"],
  kansas: ["oklahoma", "nebraska"],
  kentucky: ["tennessee", "indiana"],
  louisiana: ["mississippi", "texas"],
  maine: ["new-hampshire"],
  maryland: ["delaware"],
  massachusetts: ["new-york", "connecticut"],
  michigan: ["ohio"],
  minnesota: ["iowa", "wisconsin"],
  mississippi: ["tennessee", "louisiana"],
  missouri: ["arkansas", "iowa"],
  montana: ["wyoming", "idaho"],
  nebraska: ["kansas", "south-dakota"],
  nevada: ["utah"],
  "new-hampshire": ["vermont", "maine"],
  "new-jersey": ["pennsylvania", "delaware"],
  "new-mexico": ["colorado", "arizona"],
  "new-york": ["massachusetts"],
  "north-carolina": ["virginia", "south-carolina"],
  "north-dakota": ["south-dakota"],
  ohio: ["west-virginia", "michigan"],
  oklahoma: ["texas", "kansas"],
  oregon: ["california", "washington"],
  pennsylvania: ["new-jersey"],
  "rhode-island": ["connecticut"],
  "south-carolina": ["north-carolina"],
  "south-dakota": ["north-dakota", "nebraska"],
  tennessee: ["mississippi", "kentucky"],
  texas: ["louisiana", "oklahoma"],
  utah: ["nevada"],
  vermont: ["new-hampshire"],
  virginia: ["west-virginia", "north-carolina"],
  washington: ["oregon", "idaho"],
  "west-virginia": ["ohio", "virginia"],
  wisconsin: ["minnesota", "illinois"],
  wyoming: ["montana", "colorado"],
};

/**
 * regionId -> display name, derived from the menu's own STATES list so the
 * names behind the suggestion buttons cannot drift from the picker.
 */
export const STATE_NAMES: Record<string, string> = Object.fromEntries(
  STATES.map((state) => [state.id, state.name]),
);
