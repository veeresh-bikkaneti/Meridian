import { isHit } from "./radius.ts";

export type Edition = "state" | "country" | "globe";
export type RunPhase = "aim" | "story" | "done";
export type Run = {
  edition: Edition;
  regionId: string;
  regionName: string;
  dateKey: string;
  index: number;
  hits: number;
  phase: RunPhase;
};

export function startRun(input: {
  edition: Edition;
  regionId: string;
  regionName: string;
  dateKey: string;
}): Run {
  return {
    edition: input.edition,
    regionId: input.regionId,
    regionName: input.regionName,
    dateKey: input.dateKey,
    index: 0,
    hits: 0,
    phase: "aim",
  };
}

/** A hit pauses on the story. A miss ends the run. Pins outside aim do nothing. */
export function dropPin(run: Run, distanceKm: number, radiusKm: number): Run {
  if (run.phase !== "aim") return run;
  if (!isHit(distanceKm, radiusKm)) return { ...run, phase: "done" };
  return { ...run, hits: run.hits + 1, phase: "story" };
}

/** Advance only after a story. The next index at or past the list ends the run. */
export function continueRun(run: Run, length: number): Run {
  if (run.phase !== "story") return run;
  const index = run.index + 1;
  return { ...run, index, phase: index >= length ? "done" : "aim" };
}

export function resumeRun(
  saved: Run | null,
  today: { edition: Edition; regionId: string; regionName: string; dateKey: string },
): Run {
  if (
    saved &&
    saved.phase !== "done" &&
    saved.edition === today.edition &&
    saved.regionId === today.regionId &&
    saved.dateKey === today.dateKey
  ) {
    return saved;
  }
  return startRun(today);
}
