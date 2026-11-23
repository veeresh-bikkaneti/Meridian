/**
 * The three baseline gauges: how many lint-architecture rows are
 * left before each baseline reaches its target of zero. Ported from
 * the approved Option A mockup: an SVG ring that sweeps once on
 * mount (double-rAF, then a CSS transition does the moving), the
 * current count large, and how much has cleared since the board's
 * starting count underneath. The ring is decoration for the number
 * beside it — the count is real text, so Calm mode and
 * prefers-reduced-motion (kanban.css kills the transition) lose
 * nothing.
 */
import { useEffect, useRef, useState } from "react";
import type { Gauges as GaugeValues } from "./kanban-data";

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

interface GaugeDef {
  key: keyof GaugeValues;
  name: string;
}

const GAUGE_DEFS: GaugeDef[] = [
  { key: "noRawIo", name: "noRawIo" },
  { key: "noUpwardImport", name: "noUpwardImport" },
  { key: "shellBan", name: "shell-ban" },
];

function Gauge({ def, now }: { def: GaugeDef; now: number }) {
  /* The snapshot's count is both the current count and the board's
   * starting count: nothing has cleared relative to the snapshot. */
  const start = now;
  const cleared = Math.max(0, start - now);
  const frac = start > 0 ? cleared / start : 0;
  const targetOffset = RING_C * (1 - frac);
  const [offset, setOffset] = useState(RING_C);
  const ringRef = useRef<SVGCircleElement | null>(null);

  /* The mock's sweep: paint the ring empty, then on the second
   * frame set the real offset and let the CSS transition carry it. */
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setOffset(targetOffset));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [targetOffset]);

  return (
    <div className="kb-gauge">
      <svg className="kb-ring" viewBox="0 0 64 64" aria-hidden="true">
        <circle className="kb-ring-bg" cx="32" cy="32" r={RING_R} />
        <circle
          ref={ringRef}
          className="kb-ring-fg"
          cx="32"
          cy="32"
          r={RING_R}
          strokeDasharray={RING_C}
          strokeDashoffset={offset}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div>
        <div className="kb-gauge-name">{def.name}</div>
        <b className="kb-gauge-now">{now}</b>{" "}
        <span className="kb-gauge-sub">rows left, target 0</span>
        <div className="kb-gauge-sub">
          {cleared} cleared since {start}
        </div>
      </div>
    </div>
  );
}

export function Gauges({ gauges }: { gauges: GaugeValues }) {
  return (
    <div className="kb-gauges">
      {GAUGE_DEFS.map((def) => (
        <Gauge key={def.key} def={def} now={gauges[def.key]} />
      ))}
    </div>
  );
}
