import type { AgeGroup, MotionTier } from "@/subjects/registry.ts";

export type { AgeGroup, MotionTier };

export type SubjectId =
  | "math"
  | "physics"
  | "chemistry"
  | "social-studies"
  | "general-knowledge";

export interface SubjectMeta {
  id: SubjectId;
  title: string;
  tagline: string;
  icon: string;
  color: string;
}

export interface UnitItem {
  id: string;
  subjectId: SubjectId;
  group: AgeGroup;
  objective: string;
  standard: { code: string; source: string } | string | "UNVERIFIED";
  standardCode: string;
  why: string;
  buildsOn: string[];
  useElsewhere: string[];
}

export interface JournalPlace {
  lat: number;
  lon: number;
  name: string;
}

export interface JournalClip {
  id: string;
  journal: string;
  group: AgeGroup;
  objective: string;
  standard?: { code: string; source: string } | string;
  standardCode?: string;
  why: string;
  place: JournalPlace;
  file: string;
  captions?: string;
  retrieval?: {
    question: string;
    answer: string;
  };
  stretch?: {
    group: string;
    question: string;
    answer: string;
  };
}

export interface BridgeLink {
  fromSubject: SubjectId;
  toSubject: string;
  description: string;
}

export type PlayLabTab = "case-file" | "atlas-skills";

export interface AnswerCheckResult {
  correct: boolean;
  reason: string;
}

export interface InteractionChoice {
  label: string;
  value: string | number;
}

export interface InteractiveItemSpec {
  id: string;
  subjectId: SubjectId | "journal";
  title: string;
  prompt: string;
  choices: InteractionChoice[];
  correctValue: string | number;
  explanation: string;
  type: "multiple-choice" | "predict-see" | "journal-two-step";
  stepTwo?: {
    prompt: string;
    choices: InteractionChoice[];
    correctValue: string | number;
    explanation: string;
  };
}
