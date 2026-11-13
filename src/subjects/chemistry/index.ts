/**
 * Chemistry subject module (contract I1) — first live slice.
 *
 * Discovered by src/subjects/registry.ts from this folder. It is
 * `released: true`: a playable slice exists for every age band, so it
 * ships (owner rule, Nov 13: release progressively; educator review
 * runs alongside, after release). Reached through the "Why Do We
 * Learn This?" Home card and the subject picker. three.js is not used
 * by this module; if a later wave adds a scene it goes inside load()
 * only.
 */
import type { SubjectModule } from "../registry.ts";
import { chemistryUnits } from "./items.ts";

const chemistryModule: SubjectModule = {
  id: "chemistry",
  title: "Chemistry",
  groups: ["7-10", "10-18", "18+"],
  released: true,
  units: chemistryUnits(),
  load: () => import("./ChemistryCase"),
};

export default chemistryModule;
