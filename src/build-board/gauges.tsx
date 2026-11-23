/**
 * The three baseline gauges: how far each lint-architecture
 * baseline has cleared since its starting count, on the way to
 * its target of zero. Ported from the approved Option A mockup:
 * an SVG ring that sweeps once on mount (double-rAF, then a CSS
 * transition does the moving), the current count large, and the
 * progress since the start beside it ("129 · 25 cleared since
 * 154"). The ring fills with the cleared share (cleared / start)
 * and is decoration for the numbers beside it — the counts are
 * real text, so Calm mode and prefers-reduced-motion (kanban.css
 * kills the transition) lose nothing.
 *
 * Values come from the snapshot envelope's gaugeInfo
 * ({label, start, now, target} per gauge): `start` is fixed in
 * the curated file, `now` is refreshed per deploy by
 * scripts/board/publish-kanban.mjs.
 */
import { useEffect, useState } from "react";
import type { GaugeInfo, GaugeKey } from "./kanban-data";

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

const GAUGE_KEYS: GaugeKey[] = ["noRawIo", "noUpwardImport", "shellBan"];

function Gauge({ info, calm }: { info: GaugeInfo; calm: boolean }) {
  const cleared = Math.max(0, info.start - info.now);
  const frac = info.start > 0 ? cleared / info.start : 0;
  const targetOffset = RING_C * (1 - frac);
  /* Calm (and reduced motion, via CSS) shows the ring already at
   * its final offset: no sweep is started at all. */
  const [offset, setOffset] = useState(calm ? targetOffset : RING_C);

  /* The mock's sweep: paint the ring empty, then on the second
   * frame set the real offset and let the CSS transition carry it. */
  useEffect(() => {
    if (calm) {
      setOffset(targetOffset);
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setOffset(targetOffset));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [targetOffset, calm]);

  return (
    <div className="kb-gauge">
      <svg className="kb-ring" viewBox="0 0 64 64" aria-hidden="true">
        <circle className="kb-ring-bg" cx="32" cy="32" r={RING_R} />
        <circle
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
        <div className="kb-gauge-name">{info.label}</div>
        <b className="kb-gauge-now">{info.now}</b>{" "}
        <span className="kb-gauge-sub">
          · {cleared} cleared since {info.start}
        </span>
        <div className="kb-gauge-sub">target {info.target}</div>
      </div>
    </div>
  );
}

export function Gauges({
  gaugeInfo,
  calm,
}: {
  gaugeInfo: Record<GaugeKey, GaugeInfo>;
  calm: boolean;
}) {
  return (
    <div className="kb-gauges">
      {GAUGE_KEYS.map((key) => (
        <Gauge key={key} info={gaugeInfo[key]} calm={calm} />
      ))}
    </div>
  );
}
