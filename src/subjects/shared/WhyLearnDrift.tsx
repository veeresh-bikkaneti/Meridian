/**
 * WhyLearnDrift — the picker's background texture (2026-11-13
 * brief, feat/why-learn-montage): a few formulas and diagrams
 * from the card's own topics — a² + b² = c², F = ma, g, πr², a
 * labelled right triangle, an orbit ellipse — drifting very
 * slowly behind the page at about a tenth opacity.
 *
 * Texture only, by construction:
 * - aria-hidden and pointer-events: none (styles.css): nothing
 *   here can be focused, announced, or clicked through to.
 * - The motion is a CSS keyframe drift; under
 *   prefers-reduced-motion the animation is off (styles.css)
 *   and under the high-contrast palettes the whole layer is
 *   display: none, like the page's other art.
 * - The subject cards and text sit on their own solid surfaces
 *   above it (z-index in styles.css), fully visible and
 *   clickable exactly as before.
 */
export function WhyLearnDrift() {
  return (
    <div className="why-learn-drift" aria-hidden="true">
      <span className="wl-drift-item wl-drift-a">a² + b² = c²</span>
      <span className="wl-drift-item wl-drift-b">F = ma</span>
      <span className="wl-drift-item wl-drift-c">g = 9.8 m/s²</span>
      <span className="wl-drift-item wl-drift-d">πr²</span>
      <svg className="wl-drift-item wl-drift-e" width="76" height="60" viewBox="0 0 72 58" focusable="false">
        <path d="M8 50 L64 50 L64 14 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M56 50 h8 v-8" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <text x="30" y="46" fontSize="11" fill="currentColor" fontStyle="italic">a</text>
        <text x="57" y="34" fontSize="11" fill="currentColor" fontStyle="italic">b</text>
        <text x="24" y="24" fontSize="11" fill="currentColor" fontStyle="italic">c</text>
      </svg>
      <svg className="wl-drift-item wl-drift-f" width="100" height="62" viewBox="0 0 96 60" focusable="false">
        <ellipse cx="48" cy="30" rx="44" ry="17" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="34" cy="30" r="5" fill="currentColor" />
        <circle cx="84" cy="22" r="3.4" fill="currentColor" />
      </svg>
    </div>
  );
}
