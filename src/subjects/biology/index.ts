/**
 * Biology subject module (contract I1) — 7th subject card.
 *
 * Discovered by src/subjects/registry.ts from this folder. It is
 * `released: true`: a playable slice exists for every age band, so it
 * ships (owner ruling 2026-11-26: promote Biology to its own card,
 * superseding the interim Living World strand decision of 2026-11-25).
 * Reached through the "Why Do We Learn This?" Home card and the subject
 * picker. three.js is not used by this module; if a later wave adds a
 * scene it goes inside load() only.
 */
import type { SubjectModule } from "../registry.ts";
import { biologyUnits } from "./items.ts";

const biologyModule: SubjectModule = {
  id: "biology",
  title: "Biology",
  groups: ["7-10", "10-18", "18+"],
  released: true,
  units: biologyUnits(),
  load: () => import("./BiologyCase"),
};

export default biologyModule;
