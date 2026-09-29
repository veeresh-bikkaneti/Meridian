import { PLACES, PLACES_BY_ID } from "./catalog.ts";
import { distanceKm } from "./geo.ts";
import type { Edition, HomeChoice, Place, RingId } from "./types.ts";

export function calendarDate(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function worldDateKey(now = new Date()): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return calendarDate(zone, now);
}

export function homeDateKey(now = new Date()): string {
  return calendarDate("America/Chicago", now);
}

export function dateKeyFor(edition: Edition, now = new Date()): string {
  return edition === "world" ? worldDateKey(now) : homeDateKey(now);
}

export function displayDate(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
}

export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(pool: Place[], rng: () => number, avoid: Place[] = [], minKm = 0): Place {
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  const separated = sorted.filter((place) =>
    avoid.every((other) => distanceKm(place.reveal, other.reveal) >= minKm),
  );
  const choices = separated.length > 0 ? separated : sorted;
  return choices[Math.floor(rng() * choices.length)]!;
}

function byDifficulty(ring: RingId, min: number, max: number): Place[] {
  const all = PLACES.filter((place) => place.ring === ring);
  const band = all.filter((place) => place.difficulty >= min && place.difficulty <= max);
  return band.length > 0 ? band : all;
}

export function buildPuzzle(edition: Edition, dateKey: string, home: HomeChoice): Place[] {
  const rng = mulberry32(hashString(`${edition}:${dateKey}:${home}`));
  if (edition === "world") {
    return [1, 2, 3, 4, 5].map((level) => pick(byDifficulty("world", level, level), rng));
  }
  if (home === "visitor") {
    return [
      pick(byDifficulty("nebraska", 1, 1), rng),
      pick(byDifficulty("nebraska", 2, 2), rng),
      pick(byDifficulty("nebraska", 3, 3), rng),
      pick(byDifficulty("nebraska", 4, 4), rng),
      pick(byDifficulty("usa", 1, 5), rng),
    ];
  }
  const first = pick(byDifficulty("lincoln", 1, 2), rng);
  const second = pick(byDifficulty("lincoln", 3, 5), rng, [first], 2);
  return [
    first,
    second,
    pick(byDifficulty("region", 1, 5), rng),
    pick(byDifficulty("nebraska", 1, 5), rng),
    pick(byDifficulty("usa", 1, 5), rng),
  ];
}

export function placesFromIds(ids: string[]): Place[] {
  return ids.map((id) => {
    const place = PLACES_BY_ID[id];
    if (!place) throw new Error(`Unknown place ${id}`);
    return place;
  });
}
