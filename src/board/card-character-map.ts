import type { SnapshotStory } from "./board-data";

/**
 * Card characters: every story card carries one small character that
 * symbolizes WHAT THE STORY IS ABOUT — its theme — never its owner.
 * The mapping is a pure function of the story's lane + title, matched
 * case-insensitively against ordered keyword rules; the FIRST rule
 * that hits wins, so the order below is part of the behaviour (and is
 * locked by card-characters.test.ts):
 *
 *  - voice before place ("88 place names with no Holmes voice" is a
 *    microphone, not a compass),
 *  - clue before fix ("Held-finger jitter fix on the clue berth" is
 *    a compass),
 *  - fix before infra ("Cloudflare deploy fix" is a wrench).
 *
 * The set covers the board's standing themes. Two characters beyond
 * the original nine were added because a whole lane lands on them
 * (3+ stories each): a flask for the Physics and Chemistry lane and
 * a globe for the Social studies and GK lane — without them those
 * lanes would all fall through to the generic magnifier. The camera
 * rule keys on film / trailer / demo only: the Journals lane's
 * "Journal clips (Stage B video files)" stays a book, because the
 * journal rule is about what the work IS, and "video files" there
 * names a file format, not a film.
 *
 * The mapping is total: anything unmatched falls back to the
 * magnifying glass (the generic detective tool — deliberately NOT
 * Holmes or Watson; their art never appears on the board).
 */
export type CardCharacterId =
  | "mic"
  | "compass"
  | "abacus"
  | "wrench"
  | "eye"
  | "camera"
  | "gear"
  | "book"
  | "flask"
  | "globe"
  | "magnifier";

export const CARD_CHARACTER_IDS: readonly CardCharacterId[] = [
  "mic",
  "compass",
  "abacus",
  "wrench",
  "eye",
  "camera",
  "gear",
  "book",
  "flask",
  "globe",
  "magnifier",
];

const RULES: readonly { id: CardCharacterId; keywords: readonly string[] }[] = [
  { id: "mic", keywords: ["voice", "narration", "audio", "speech", "kokoro"] },
  { id: "compass", keywords: ["map", "geo", "place", "region", "clue"] },
  { id: "abacus", keywords: ["math", "number", "count"] },
  { id: "wrench", keywords: ["crash", "bug", "fix", "watchdog", "error"] },
  { id: "eye", keywords: ["accessibility", "a11y", "screen reader", "zoom"] },
  { id: "camera", keywords: ["film", "trailer", "demo"] },
  { id: "gear", keywords: ["board", "infra", "worker", "deploy", "cloudflare", "security"] },
  { id: "book", keywords: ["story", "journal", "book", "lesson", "reading"] },
  { id: "flask", keywords: ["physics", "chemistry", "science"] },
  { id: "globe", keywords: ["social", "history", "civics", "humanities", "general knowledge"] },
  { id: "magnifier", keywords: ["game", "play", "detective", "case"] },
];

export const FALLBACK_CHARACTER: CardCharacterId = "magnifier";

export function characterForStory(
  story: Pick<SnapshotStory, "lane" | "title">,
): CardCharacterId {
  const text = `${story.lane} ${story.title}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) return rule.id;
  }
  return FALLBACK_CHARACTER;
}

/** Per-character story counts over a story list, zero-filled. */
export function countCharacters(
  stories: readonly Pick<SnapshotStory, "lane" | "title">[],
): Record<CardCharacterId, number> {
  const counts = Object.fromEntries(
    CARD_CHARACTER_IDS.map((id) => [id, 0]),
  ) as Record<CardCharacterId, number>;
  for (const story of stories) counts[characterForStory(story)] += 1;
  return counts;
}
