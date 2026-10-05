export type Colors = {
  water: string;
  lake: string;
  land: string;
  park: string;
  road: string;
  highway: string;
  roadCase: string;
  river: string;
  border: string;
  coast: string;
  lit: string;
  pin: string;
  answer: string;
  arc: string;
  cross: string;
  /** Region highlight gold — matches the satellite-map highlight (region-highlight.ts). */
  highlight: string;
};

export function readColors(): Colors {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    water: pick("--map-water", "#10262e"),
    lake: pick("--map-lake", "#1c5160"),
    land: pick("--map-land", "#3c4a3c"),
    park: pick("--map-park", "#2c5a40"),
    road: pick("--map-road", "#ddd6c8"),
    highway: pick("--map-highway", "#f3efe4"),
    roadCase: pick("--map-road-case", "#241f1a"),
    river: pick("--map-river", "#3c8496"),
    border: pick("--map-border", "#24302c"),
    coast: pick("--map-coast", "#0c1816"),
    lit: pick("--map-lit", "#6e9084"),
    pin: pick("--map-pin", "#f4f1ea"),
    answer: pick("--map-answer", "#f2c14e"), // legend: "gold is the true spot" — region-highlight gold
    arc: pick("--map-arc", "#f4f1ea"),
    cross: pick("--map-cross", "#d7ddd9"),
    highlight: pick("--map-highlight", "#f2c14e"),
  };
}

export function parseRgb(color: string): [number, number, number] | null {
  const hex = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  const match = hex.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function rgb([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export function mix(a: string, b: string, t: number) {
  const pa = parseRgb(a);
  const pb = parseRgb(b);
  if (!pa || !pb) return t > 0.5 ? b : a;
  const u = Math.max(0, Math.min(1, t));
  return rgb(pa.map((channel, index) => channel + (pb[index] - channel) * u) as [number, number, number]);
}

export function tone(id: string, base: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  const shift = (hash % 9) - 4;
  const channels = parseRgb(base);
  if (!channels) return base;
  return rgb(channels.map((channel, index) => Math.max(0, Math.min(255, channel + (index === 2 ? -shift : shift)))) as [
    number,
    number,
    number,
  ]);
}

export function rgbUnit(color: string): [number, number, number] {
  const channels = parseRgb(color) ?? [60, 74, 60];
  return [channels[0] / 255, channels[1] / 255, channels[2] / 255];
}
