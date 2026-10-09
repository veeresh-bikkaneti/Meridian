/**
 * age-profile/types.ts — the age-profile domain vocabulary.
 *
 * Per Phase 1 §1 (band definitions), §2 (rung mapping contract), §4
 * (lifecycle state machine). This module is pure types only: no runtime
 * behavior, no storage, no clock — import freely anywhere.
 */

/** Parent-set age bands. Coarse ids only — never a birthdate, never PII. */
export type AgeBandId = "5-7" | "8-10" | "11-13";

/**
 * Fact-ladder rungs in difficulty order (contract with
 * scripts/card-compose.mjs: the `kind` field of the ladder `fact`).
 */
export type LadderRung = "hook" | "wikitext" | "eb1911" | "wikidata";

/** Where the story-card text actually came from for one card. */
export type StoryRung = LadderRung | "history" | "blurb-only";

/** Game loops the band system can gate (Phase 1 §1). */
export type LoopId =
  | "quiz"
  | "terrain-detective"
  | "passport-stamps"
  | "geodetective"
  | "capital-quest"
  | "expedition-trails"
  | "duel";

/** Read-aloud behavior for story cards (Phase 1 §3d, Phase 2 §4). */
export type AudioMode = "auto" | "button" | "off";

/** Profile lifecycle states (Phase 1 §4). */
export type ProfileStatus = "unset" | "active" | "pending-change";

export interface BandDifficulty {
  /** Multiplier applied to the pin-hit radius (clamps applied AFTER). */
  toleranceMultiplier: number;
  /** GeoDetective starting clues; null when the loop is locked for the band. */
  startingClues: number | null;
  /** GeoDetective guess cap; null when the loop is locked for the band. */
  guessCap: number | null;
  /** Quiz round questions; the endless run ignores this (see difficulty.ts). */
  quizQuestions: number;
  /** Terrain Detective images per round. */
  terrainImages: number;
  /** Capital Quest questions; null when locked. */
  capitalQuestions: number | null;
  /**
   * Pins per run for round-structured loops. DATA-ONLY design target (see
   * difficulty.ts): the shipped main run is endless by design and does
   * NOT consume this — retuning the table never changes game structure.
   */
  pinsPerRun: number;
  /** Duel seconds per turn; null when locked (timers only at 11-13). */
  duelSecondsPerTurn: number | null;
}

export interface AgeBand {
  id: AgeBandId;
  /** Parent-facing short name ("Little Explorer"). Never shown to the child. */
  label: string;
  ageMin: number;
  ageMax: number;
  /** Parent-facing description, <=140 chars, verbatim from Phase 1 §1. */
  description: string;
  /** Kid-voice "what changes" line for the picker card. */
  whatChanges: string;
  /** Highest ladder rung the band may see (Phase 1 §2). */
  rungCeiling: LadderRung;
  audioMode: AudioMode;
  /** Loops available to this band, in suggested reveal order. */
  loops: LoopId[];
  difficulty: BandDifficulty;
  /** Map label density (Phase 1 §1). */
  mapLabels: "major" | "standard" | "full";
  /** Distance feedback style (Phase 1 §3d). */
  distanceDisplay: "warmer-colder" | "rounded" | "exact";
}

/**
 * The persisted profile (Phase 1 §4). localStorage key
 * `meridian.ageProfile.v1`, schemaVersion 1. No PII — the band id is the
 * only content, plus lifecycle bookkeeping.
 */
export interface AgeProfile {
  status: ProfileStatus;
  /** Null only when status is "unset". */
  band: AgeBandId | null;
  /** ISO-8601 write time. */
  updatedAt: string;
  /** Anti-flail counter + parent visibility. */
  changeCount: number;
  /** Set only while status is "pending-change". */
  pendingBand: AgeBandId | null;
  schemaVersion: 1;
}

/** Inputs to the rung mapper (Phase 1 §2). `blurb` is always present. */
export interface PlaceFacts {
  ladder: Partial<Record<LadderRung, { text: string; source: string }>>;
  history?: string;
  blurb: string;
}

/** The rung mapper's output (Phase 1 §2). */
export interface MappedStory {
  text: string;
  rung: StoryRung;
  /** True for 5-7: the story card should auto-play read-aloud. */
  autoplayAudio: boolean;
}

/** Typed payload of the `ageprofile:changed` event. */
export interface AgeProfileChangedEvent {
  type: "ageprofile:changed";
  /** What happened: first set / staged change applied / explicit reset. */
  kind: "set" | "change" | "reset";
  /** The effective band AFTER this event; null only on reset. */
  band: AgeBandId | null;
  /** The effective band BEFORE this event; null when previously unset. */
  previousBand: AgeBandId | null;
  /** True when the change was staged mid-run (pending-change boundary). */
  midSession: boolean;
}
