import { formatDistance } from "../game/geo.ts";

export type MapPoint = { lon: number; lat: number };

export type VariationLine = {
  coordinates: [[number, number], [number, number]];
  midpoint: [number, number];
  label: string;
};

function halfway(start: number, end: number): number {
  return Number(((start + end) / 2).toFixed(6));
}

/** The miss MapTap draws: a straight line from the pin to the real spot. */
export function variationLine(pin: MapPoint, spot: MapPoint, kilometers: number): VariationLine {
  return {
    coordinates: [
      [pin.lon, pin.lat],
      [spot.lon, spot.lat],
    ],
    midpoint: [halfway(pin.lon, spot.lon), halfway(pin.lat, spot.lat)],
    label: formatDistance(kilometers),
  };
}
