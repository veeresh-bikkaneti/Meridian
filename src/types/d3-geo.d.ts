declare module "d3-geo" {
  export type LonLat = [number, number];

  export interface GeoProjection {
    (point: LonLat): [number, number] | null;
    invert?(point: [number, number]): LonLat | null;
    scale(): number;
    scale(value: number): this;
    translate(): [number, number];
    translate(point: [number, number]): this;
    rotate(): [number, number, number];
    rotate(angles: [number, number, number]): this;
    clipAngle(angle: number): this;
    precision(value: number): this;
    fitExtent(extent: [[number, number], [number, number]], object: unknown): this;
  }

  export function geoArea(object: unknown): number;
  export function geoContains(object: unknown, point: LonLat): boolean;
  export function geoOrthographic(): GeoProjection;
  export function geoMercator(): GeoProjection;
  export function geoAlbersUsa(): GeoProjection;
  export function geoGraticule10(): unknown;
  export function geoInterpolate(a: LonLat, b: LonLat): (t: number) => LonLat;
  export function geoPath(
    projection: GeoProjection,
    context?: CanvasRenderingContext2D | null,
  ): (object: unknown) => string | null;
}
