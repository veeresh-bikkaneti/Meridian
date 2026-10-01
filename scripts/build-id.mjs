/**
 * Build identity for deploy-awareness. A tab left open across a GitHub Pages
 * deploy keeps running the old bundle, whose content-hashed chunk URLs no
 * longer exist on the server — every region then fails with a chunk 404.
 * The staleness check compares the ID baked into this bundle against a fresh
 * `build-meta.json` so the app can offer a refresh instead of a dead end.
 *
 * Precedence: GITHUB_SHA (CI) → `git rev-parse --short HEAD` → timestamp.
 * The timestamp fallback guarantees two local builds never share an ID.
 */
import { execFileSync } from "node:child_process";

export function resolveBuildId(env = process.env) {
  const sha = env.GITHUB_SHA;
  if (typeof sha === "string" && sha.length >= 12) return sha.slice(0, 12);
  try {
    const out = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {
    // Not a git checkout (or git missing) — fall through to the timestamp.
  }
  return `local-${Date.now().toString(36)}`;
}
