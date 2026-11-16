/**
 * Build identity for deploy-awareness. A tab left open across a GitHub Pages
 * deploy keeps running the old bundle, whose content-hashed chunk URLs no
 * longer exist on the server — every region then fails with a chunk 404.
 * The staleness check compares the ID baked into this bundle against a fresh
 * `build-meta.json` so the app can offer a refresh instead of a dead end.
 *
 * Precedence: GITHUB_SHA (CI) → `git rev-parse HEAD` → timestamp.
 * Both commit paths return the same 12-character prefix, so a build
 * reports one identical stamp on every deploy target (QA/UI-UX
 * council, 2026-11-16: the Workers build's git fallback produced a
 * 7-character id where the Pages build reported 12).
 * The timestamp fallback guarantees two local builds never share an ID.
 */
import { execFileSync } from "node:child_process";

export function resolveBuildId(env = process.env) {
  const sha = env.GITHUB_SHA;
  if (typeof sha === "string" && sha.length >= 12) return sha.slice(0, 12);
  try {
    const out = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out.length >= 12) return out.slice(0, 12);
  } catch {
    // Not a git checkout (or git missing) — fall through to the timestamp.
  }
  return `local-${Date.now().toString(36)}`;
}
