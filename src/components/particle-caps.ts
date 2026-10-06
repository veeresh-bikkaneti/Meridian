/**
 * Confetti particle caps (spec §7.3).
 *
 * Pure module (no React, no DOM reads) so the tier logic is unit-testable
 * under the repo's node:test harness. The component reads the device env
 * and calls resolveParticleCap; tests inject env objects directly.
 */

export type ParticleCapEnv = {
  finePointer: boolean;
  narrowViewport: boolean;
  lowEnd: boolean;
  reducedMotion: boolean;
};

/**
 * Particle cap for the given device env:
 * 120 (fine pointer, deviceMemory ≥ 4) · 60 (coarse pointer or <768 px) ·
 * 30 (low-end) · 0 under reduced-motion.
 *
 * Precedence: reduced-motion wins over everything; low-end wins over the
 * coarse/narrow tier (a weak device gets the small cap even with a mouse).
 */
export function resolveParticleCap(env: ParticleCapEnv): number {
  if (env.reducedMotion) return 0;
  if (env.lowEnd) return 30;
  if (!env.finePointer || env.narrowViewport) return 60;
  return 120;
}
