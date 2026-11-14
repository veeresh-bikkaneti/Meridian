/**
 * Journals subject module (Stream D, PR D1) — contract I1.
 *
 * Discovered by src/subjects/registry.ts from this folder. Released
 * progressively (owner rule, Nov 13): D1 ships the Lincoln Memorial,
 * three engineering and geography rows, and their 10-18 stretch items.
 * No clip movie is rendered yet, so each case shows the clip's caption
 * text as its lead. Narration is text only: the voice channel is not on
 * main.
 */
import type { SubjectModule } from "../registry.ts";
import { journalUnits } from "./items.ts";

const journalsModule: SubjectModule = {
  id: "journals",
  title: "Journals",
  groups: ["7-10", "10-18", "18+"],
  released: true,
  units: journalUnits(),
  load: () => import("./JournalsCase"),
};

export default journalsModule;
