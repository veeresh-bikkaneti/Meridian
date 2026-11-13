/**
 * Math subject module (contract I1) — wave 1.
 *
 * Discovered by src/subjects/registry.ts from this folder. It stays
 * `released: false`: the registry lists released subjects only, and the
 * flag stays off for kids until a named human educator signs the gate
 * rubric and the owner says go (docs/scaling/contracts.md). The case
 * flow is reached only through the why-learn Home card behind the
 * scalePlay flag (`?scale=1`). three.js is not used by this module; if a
 * later wave adds a scene it goes inside load() only.
 */
import type { SubjectModule } from "../registry.ts";
import { mathUnits } from "./items.ts";

const mathModule: SubjectModule = {
  id: "math",
  title: "Math",
  groups: ["7-10", "10-18", "18+"],
  released: false,
  units: mathUnits(),
  load: () => import("./MathCase"),
};

export default mathModule;
