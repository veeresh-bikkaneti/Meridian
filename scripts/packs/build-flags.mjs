/**
 * Flag registry builder (Capitals & Flags, Flagstaff gate).
 *
 * The curation record (scripts/packs/capitals/flags/registry.json) is
 * the human-owned source of truth: one entry per licence-verified flag
 * with its source page, licence, attribution, story line and the
 * SHA-256 of the shipped SVG. This script verifies every entry against
 * the actual file in src/assets/flags/ and generates the runtime
 * metadata module (src/assets/flags/registry.generated.ts) the flag
 * resolver reads. Fail closed: any mismatch writes nothing.
 *
 * A land with no verified flag is NOT an entry here — it is listed in
 * the record's `flagless` map with its reason, so "flagless" is an
 * audited state, never a silent gap. Flags are never manufactured:
 * every file traces to a Wikimedia Commons file page whose licence was
 * verified per-file (see docs/flags-curation.md).
 *
 * CLI: node scripts/packs/build-flags.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(SCRIPTS_DIR));

export const FLAG_REGISTRY_PATH = join(
  ROOT,
  "scripts/packs/capitals/flags/registry.json",
);
export const FLAG_ASSETS_DIR = join(ROOT, "src/assets/flags");
export const FLAG_GENERATED_PATH = join(FLAG_ASSETS_DIR, "registry.generated.ts");

/** Per-file hard cap from the design budget (10 KB). */
export const FLAG_FILE_MAX_BYTES = 10_240;
/** Whole-registry budget ceiling (design estimate ≈110–330 KB total). */
export const FLAG_TOTAL_MAX_BYTES = 400_000;

const ACCEPTED_LICENCES = [
  /^public domain/i,
  /^cc0/i,
  /^cc[- ]by([^-]|$)/i,
  /^cc[- ]by-sa/i,
  // The design's named fallback set (lipis/flag-icons) is MIT; its
  // licence notice ships in src/assets/flags/NOTICE.md.
  /^mit/i,
];

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * SVG sanity + aspect (Flagstaff gate): a real standalone SVG with a
 * viewBox, no script, no external references, and a viewBox ratio
 * matching the flag's official aspect (the aspect the curation record
 * captured from the source). Ratio tolerance 3%.
 */
export function inspectSvg(text) {
  const problems = [];
  if (!/^\s*(<\?xml[^>]*>\s*)?(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/.test(text)) {
    problems.push("file does not start with an <svg> element");
  }
  if (/<script/i.test(text)) problems.push("contains a <script> element");
  if (/(href|xlink:href)\s*=\s*["']https?:/i.test(text)) {
    problems.push("references an external URL");
  }
  // Aspect from the viewBox when present; many Commons flags carry
  // only width/height on the root element — that canvas ratio is the
  // same measurement, so fall back to it.
  const viewBox = /viewBox\s*=\s*["']\s*(-?[\d.]+)[ ,]+(-?[\d.]+)[ ,]+(-?[\d.]+)[ ,]+(-?[\d.]+)\s*["']/.exec(text);
  if (viewBox) {
    const width = Number(viewBox[3]);
    const height = Number(viewBox[4]);
    if (!(width > 0) || !(height > 0)) {
      problems.push("viewBox has non-positive dimensions");
      return { problems, aspect: null };
    }
    return { problems, aspect: width / height };
  }
  const svgTag = /<svg[^>]*>/.exec(text)?.[0] ?? "";
  const w = /width\s*=\s*["']([\d.]+)["']/.exec(svgTag);
  const h = /height\s*=\s*["']([\d.]+)["']/.exec(svgTag);
  if (w && h && Number(w[1]) > 0 && Number(h[1]) > 0) {
    return { problems, aspect: Number(w[1]) / Number(h[1]) };
  }
  problems.push("has neither a numeric viewBox nor width/height");
  return { problems, aspect: null };
}

/**
 * Validate the curation record against the files on disk.
 * @returns {{ok: boolean, problems: string[], totalBytes: number,
 *   registry: object|null}}
 */
export function validateFlagRegistry({
  registryPath = FLAG_REGISTRY_PATH,
  assetsDir = FLAG_ASSETS_DIR,
} = {}) {
  const problems = [];
  if (!existsSync(registryPath)) {
    return { ok: false, problems: [`registry missing at ${registryPath}`], totalBytes: 0, registry: null };
  }
  const registry = JSON.parse(readFileSync(registryPath, "utf8"));
  const flags = registry.flags ?? {};
  let totalBytes = 0;
  for (const [flagKey, entry] of Object.entries(flags)) {
    const at = `flags.${flagKey}`;
    if (!/^[a-z]{2}(-[a-z]{2})?$/.test(flagKey)) problems.push(`${at}: malformed flagKey`);
    for (const field of ["land", "file", "sourcePage", "filePath", "license", "licenseUrl", "attribution", "story", "storySource", "altText"]) {
      if (typeof entry[field] !== "string" || entry[field].length === 0) {
        problems.push(`${at}: missing ${field}`);
      }
    }
    if (typeof entry.license === "string" && !ACCEPTED_LICENCES.some((re) => re.test(entry.license))) {
      problems.push(`${at}: licence ${JSON.stringify(entry.license)} is not PD/CC0/CC-BY/CC-BY-SA`);
    }
    const filePath = join(assetsDir, `${flagKey}.svg`);
    if (!existsSync(filePath)) {
      problems.push(`${at}: asset missing at src/assets/flags/${flagKey}.svg`);
      continue;
    }
    const bytes = readFileSync(filePath);
    totalBytes += bytes.length;
    if (bytes.length !== entry.bytes) {
      problems.push(`${at}: byte count drift — record says ${entry.bytes}, file is ${bytes.length}`);
    }
    if (bytes.length > FLAG_FILE_MAX_BYTES) {
      problems.push(`${at}: ${bytes.length} bytes exceeds the ${FLAG_FILE_MAX_BYTES}-byte per-file cap`);
    }
    const digest = sha256Hex(bytes);
    if (digest !== entry.sha256) {
      problems.push(`${at}: sha256 drift — record ${entry.sha256}, file ${digest}`);
    }
    const { problems: svgProblems, aspect } = inspectSvg(bytes.toString("utf8"));
    for (const p of svgProblems) problems.push(`${at}: ${p}`);
    if (aspect !== null && typeof entry.aspect === "number") {
      if (Math.abs(aspect - entry.aspect) / entry.aspect > 0.03) {
        problems.push(`${at}: viewBox aspect ${aspect.toFixed(3)} does not match the official aspect ${entry.aspect}`);
      }
    }
  }
  if (totalBytes > FLAG_TOTAL_MAX_BYTES) {
    problems.push(`total flag bytes ${totalBytes} exceeds the ${FLAG_TOTAL_MAX_BYTES}-byte budget`);
  }
  return { ok: problems.length === 0, problems, totalBytes, registry };
}

/** The generated runtime metadata module's text (deterministic). */
export function renderFlagModule(registry) {
  const entries = Object.entries(registry.flags ?? {}).sort(([a], [b]) =>
    a < b ? -1 : 1,
  );
  const body = entries
    .map(([flagKey, entry]) => {
      const record = {
        land: entry.land,
        story: entry.story,
        altText: entry.altText,
        license: entry.license,
        attribution: entry.attribution,
        sourceUrl: entry.filePath,
      };
      return `  ${JSON.stringify(flagKey)}: ${JSON.stringify(record, null, 2).replace(/\n/g, "\n  ")},`;
    })
    .join("\n");
  return `/**
 * GENERATED by scripts/packs/build-flags.mjs from
 * scripts/packs/capitals/flags/registry.json — do not edit by hand.
 * One entry per licence-verified flag; a land absent here is flagless.
 */
export interface FlagEntry {
  /** The land's name as printed on screen beside the flag. */
  land: string;
  /** One sourced flag-story line for the reveal card. */
  story: string;
  /** Kid-safe visual description of the flag (the img alt text). */
  altText: string;
  /** The source file's licence, verbatim from its Commons file page. */
  license: string;
  /** Attribution string captured from the Commons file page. */
  attribution: string;
  /** The Commons file page the SVG was sourced from. */
  sourceUrl: string;
}

export const FLAG_ENTRIES: Record<string, FlagEntry> = {
${body}
};
`;
}

function main() {
  const { ok, problems, totalBytes, registry } = validateFlagRegistry();
  if (!ok) {
    console.error("build-flags: registry validation FAILED");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  writeFileSync(FLAG_GENERATED_PATH, renderFlagModule(registry));
  console.log(
    `build-flags: ${Object.keys(registry.flags).length} flags, ${totalBytes} bytes total -> ${FLAG_GENERATED_PATH}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
