/**
 * Bundled open-source credits for the /credits page (WI-15).
 *
 * One entry per direct dependency in package.json — the set the build
 * actually bundles. Each licence identifier was copied from the installed
 * package's own package.json "license" field in node_modules at
 * implementation time, never from memory; where that field is an SPDX
 * expression it is reproduced verbatim. src/lib/credits.test.ts guards
 * this list against package.json, so a dependency added without a credit
 * fails the test suite instead of shipping uncredited.
 */
export interface BundledCredit {
  name: string;
  packageName: string;
  license: string;
}

export const BUNDLED_CREDITS: BundledCredit[] = [
  { name: "PGlite", packageName: "@electric-sql/pglite", license: "Apache-2.0" },
  { name: "FormKit AutoAnimate", packageName: "@formkit/auto-animate", license: "MIT" },
  { name: "Radix UI Slot", packageName: "@radix-ui/react-slot", license: "MIT" },
  { name: "Tailwind CSS Vite Plugin", packageName: "@tailwindcss/vite", license: "MIT" },
  { name: "TanStack React Router", packageName: "@tanstack/react-router", license: "MIT" },
  { name: "TanStack React Start", packageName: "@tanstack/react-start", license: "MIT" },
  { name: "TanStack Router Plugin", packageName: "@tanstack/router-plugin", license: "MIT" },
  { name: "Vite React Plugin", packageName: "@vitejs/plugin-react", license: "MIT" },
  { name: "WebGPU Types", packageName: "@webgpu/types", license: "BSD-3-Clause" },
  { name: "Better Auth", packageName: "better-auth", license: "MIT" },
  { name: "Class Variance Authority", packageName: "class-variance-authority", license: "Apache-2.0" },
  { name: "clsx", packageName: "clsx", license: "MIT" },
  { name: "D3 Geo", packageName: "d3-geo", license: "ISC" },
  { name: "Earcut", packageName: "earcut", license: "ISC" },
  { name: "jose", packageName: "jose", license: "MIT" },
  { name: "Kysely", packageName: "kysely", license: "MIT" },
  { name: "Lightning CSS", packageName: "lightningcss", license: "MPL-2.0" },
  { name: "Lucide", packageName: "lucide-react", license: "ISC" },
  { name: "MapLibre GL", packageName: "maplibre-gl", license: "BSD-3-Clause" },
  { name: "Nitro", packageName: "nitro", license: "MIT" },
  { name: "pg", packageName: "pg", license: "MIT" },
  { name: "React", packageName: "react", license: "MIT" },
  { name: "React DOM", packageName: "react-dom", license: "MIT" },
  { name: "Tailwind Merge", packageName: "tailwind-merge", license: "MIT" },
  { name: "Tailwind CSS", packageName: "tailwindcss", license: "MIT" },
  { name: "Three.js", packageName: "three", license: "MIT" },
  { name: "TopoJSON Client", packageName: "topojson-client", license: "ISC" },
  { name: "TypeScript", packageName: "typescript", license: "Apache-2.0" },
  { name: "US Atlas", packageName: "us-atlas", license: "ISC" },
  { name: "Vite", packageName: "vite", license: "MIT" },
  { name: "World Atlas", packageName: "world-atlas", license: "ISC" },
  { name: "Zod", packageName: "zod", license: "MIT" },
];
