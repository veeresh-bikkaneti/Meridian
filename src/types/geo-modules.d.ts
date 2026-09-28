declare module "topojson-client" {
  export function feature(topology: unknown, object: unknown): unknown;
  export function mesh(
    topology: unknown,
    object: unknown,
    filter?: (a: { id?: string }, b: { id?: string }) => boolean,
  ): unknown;
}

declare module "world-atlas/countries-110m.json" {
  const value: { objects: Record<string, unknown> };
  export default value;
}

declare module "world-atlas/countries-50m.json" {
  const value: { objects: Record<string, unknown> };
  export default value;
}

declare module "us-atlas/states-10m.json" {
  const value: {
    objects: {
      states: { geometries: Array<{ id: string }> };
    };
  };
  export default value;
}

declare module "us-atlas/counties-10m.json" {
  const value: { objects: Record<string, unknown> };
  export default value;
}
