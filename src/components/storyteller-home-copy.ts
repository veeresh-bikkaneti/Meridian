/**
 * Storyteller home handoff (H1) — kid-facing copy pack.
 *
 * Companion to ~/workspace/specs/storyteller-copy.md. Sections 0–3 are
 * lift-verbatim from that pack. Locked lines are byte-identical — DO NOT
 * EDIT. Devs must never invent kid copy (spec §9 Devex).
 *
 * Voice rules: first-person, short, warm, curious. Never lectures, never
 * shames, never reveals answers. No visible name ("historian feel").
 */

/** §0 — locked greeting line 1 (byte-identical). */
export const GREET_01 =
  "Ah, my young explorer! The map is whispering secrets today. Shall we hear its story together?";

/**
 * §1 — daily greeting rotation. greet-01 is locked; greet-02…06 are the
 * design-agreed lines from the copy pack (verbatim). Text-first; mp3s land
 * later with the TruthTeller voice.
 */
export const GREETINGS: readonly string[] = [
  GREET_01,
  "New day, new tales hiding in the hills. Shall we go find one?",
  "Psst… the rivers told me a secret this morning. Want to hear it?",
  "Somewhere out there, a mountain is keeping a story warm. Let's go find it.",
  "The winds brought rumors from faraway cities today. Curious?",
  "Every dot on this map has a tale. Which one shall we wake up first?",
];

/** §0 — locked post-tour return line (byte-identical). Text-only, no mp3. */
export const TOUR_RETURN_LINE =
  "Welcome back, explorer! Grandpa showed you around — now, where shall our story go next?";

/** Loops with a locked send-off line (§0, byte-identical). */
export type StorytellerLoopKey =
  | "terrain"
  | "quiz"
  | "passport"
  | "geodetective"
  | "capital"
  | "expedition"
  | "duel";

/**
 * §0 — the 7 locked send-off lines (byte-identical). One line each:
 * curiosity, never lecture. Shown ≤2.5s while the loop loads; navigation
 * never waits for them (copy G3).
 */
export const SENDOFFS: Record<StorytellerLoopKey, string> = {
  terrain: "Boots on! Let's read the land like a detective. 🥾",
  quiz: "Quick-fire questions, brave explorer — show me what you know!",
  passport: "Your passport is hungry for new stamps! ✈️",
  geodetective: "A mystery is afoot… lean in close. 🔍",
  capital: "Capitals and clever guesses — off we go!",
  expedition: "Pack a snack — this trail is a long one. 🎒",
  duel: "A friendly duel! May the sharpest compass win. 🧭",
};

/**
 * §2 — poke idle lines (verbatim). Tap the figure → rotating lines, 5 max
 * then repeat. No audio on poke. Taps closer than 600ms are ignored (kid
 * mashing ≠ 5 lines at once).
 */
export const POKE_LINES: readonly string[] = [
  "Heh! That tickles my beard.",
  "Careful, explorer — I'm older than these mountains.",
  "Poke all you like. I've survived worse… have I told you about Troy? 😌",
  "Hmm? Did the map just move, or was that you?",
  "Alright, alright — pick a place and I'll tell you its tale.",
];

/** §3 — falling-laurel-leaf caption (verbatim). Static sprig under reduced-motion. */
export const LEAF_LINE = "A leaf for luck. 🍃";

/** §3 — scroll-tap hello caption (verbatim): kid taps the scroll twice. */
export const SCROLL_TAP_LINE = "tap tap… is this thing on? 👀";

/** Catchphrase "Shh… listen." — reserved for mystery beats (GeoDetective
 *  handoff, hook moments). NEVER in greetings or poke lines, so it is
 *  deliberately NOT exported for home use. */

/** Day-of-year (1-based) in local time — the greeting rotation index. */
export function dayOfYear(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/** Greeting line index: day-of-year mod 6 (copy §1). */
export function greetingIndexForDate(date: Date = new Date()): number {
  return dayOfYear(date) % GREETINGS.length;
}

/** Local "YYYY-MM-DD" day key for the once-per-day greeting gate. */
export function localDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type HomeGreetingMode = "tour-return" | "greeting" | "silent";

/**
 * G2 — check order on every home mount. Tour return wins, exactly once;
 * then first-visit-today greets; otherwise the figure sits silent (no nagging).
 */
export function decideHomeMode(args: {
  tourReturnDue: boolean;
  greetedToday: boolean;
}): HomeGreetingMode {
  if (args.tourReturnDue) return "tour-return";
  if (!args.greetedToday) return "greeting";
  return "silent";
}
