/**
 * Math subject module (contract I1) — wave 1.
 *
 * Discovered by src/subjects/registry.ts from this folder. It is
 * `released: true`: a playable slice exists for every age band, so it
 * ships (owner rule, Nov 13: release progressively; educator review
 * runs alongside, after release). The case flow is reached through the
 * "Why Do We Learn This?" Home card and the subject picker — the card
 * is live for everyone, no ?scale=1 needed. three.js is not used by
 * this module; if a later wave adds a scene it goes inside load()
 * only.
 */
import type { SubjectModule } from "../registry.ts";
import { mathUnits } from "./items.ts";

const mathModule: SubjectModule = {
  id: "math",
  title: "Math",
  groups: ["7-10", "10-18", "18+"],
  released: true,
  units: mathUnits(),
  load: () => import("./MathCase"),
};

export default mathModule;
