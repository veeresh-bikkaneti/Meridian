// src/scenes/predict-see/types.ts
export type MotionTier = "full" | "lite" | "flat";
export type PredictSeeScene = {
  id: string;
  prompt: string;                 // the question the child predicts
  choices: string[];              // tap targets, no drag needed
  rule: { cause: string; effect: string; source: string };
  mount: (el: HTMLElement, tier: MotionTier) => Promise<{ play: (choice: number) => Promise<void>; dispose: () => void }>;
};
