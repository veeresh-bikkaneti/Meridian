import { hashString, mulberry32 } from "./daily.ts";

export function orderPlaces<T extends { id: string }>(
  places: T[],
  dateKey: string,
  edition: "state" | "country" | "globe",
  regionId: string,
): T[] {
  const ordered = [...places].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  const random = mulberry32(hashString(`${dateKey}|${edition}|${regionId}`));
  for (let index = ordered.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = ordered[index];
    ordered[index] = ordered[swapIndex];
    ordered[swapIndex] = current;
  }
  return ordered;
}

export function placeAt<T>(ordered: T[], index: number): T | null {
  if (index < 0 || index >= ordered.length) return null;
  return ordered[index] ?? null;
}
