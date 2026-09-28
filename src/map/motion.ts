export function smoothstep(t: number) {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

/** Underdamped settle from 0 to 1. `seconds` is time since the motion started. */
export function spring01(seconds: number) {
  if (seconds <= 0) return 0;
  const stiffness = 180;
  const damping = 16;
  const omega = Math.sqrt(stiffness);
  const zeta = damping / (2 * omega);
  const decay = Math.exp(-zeta * omega * seconds);
  const wd = omega * Math.sqrt(Math.max(0.0001, 1 - zeta * zeta));
  return 1 - decay * (Math.cos(wd * seconds) + ((zeta * omega) / wd) * Math.sin(wd * seconds));
}
