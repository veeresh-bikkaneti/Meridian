#!/usr/bin/env node
/**
 * check-provenance.mjs: who wrote a change, and that it names no AI tool.
 *
 * Owner rules (AGENTS.md "Enforced rules"):
 *   1. Every commit on a branch is authored as
 *      `veeresh bikkaneti <57240576+veeresh-bikkaneti@users.noreply.github.com>`.
 *      Bot authors (name ending `[bot]`, or email ending
 *      `[bot]@users.noreply.github.com`) skip this identity check only;
 *      message and added-line checks still apply.
 *   2. No AI model or vendor name in a commit message (subject, body or
 *      trailers such as Co-Authored-By / *-Session).
 *   3. No AI model or vendor name in a line a branch ADDS. The repo already
 *      holds a few hundred older mentions (handbook history, platform file
 *      names), so only new lines fail; old ones are left to cleanup PRs.
 *
 * WHY THE NAMES ARE ENCODED: the blocklist is stored ROT13-encoded and
 * decoded at run time. Written plainly, this file would itself break rule 3
 * and every grep for the names would hit the checker. Decode one by hand
 * with `node -e 'console.log(process.argv[1].replace(/[a-z]/g,c=>String.fromCharCode((c.charCodeAt(0)-84)%26+97)))' <word>`.
 *
 * Usage:
 *   npm run check:provenance                    # origin/main..HEAD
 *   node scripts/check-provenance.mjs --range <base>..<head>
 * CI (pull_request) passes the PR's base and head SHAs through
 * PROVENANCE_RANGE. Exit 0 = pass, 1 = fail. Node stdlib + git only.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const OWNER_NAME = "veeresh bikkaneti";
export const OWNER_EMAIL = "57240576+veeresh-bikkaneti@users.noreply.github.com";
const FIX_IDENTITY = `git -c user.name="${OWNER_NAME}" -c user.email="${OWNER_EMAIL}" commit`;

const rot13 = (s) =>
  s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));

// ROT13: see the header. Ambiguous everyday words (a poem form, an animal,
// a wind, a space program, a book form, the UI pointer) are left out on
// purpose: this game teaches geography and history and uses them.
const ENCODED = ["pynhqr", "naguebcvp", "bcranv", "pungtcg", "tebx", "knv", "qrrcfrrx", "djra", "pbcvybg"];
const NAMES = ENCODED.map(rot13);
const GPT_N = `${rot13("tcg")}-?\\d`;

// A name only counts as a bare word: not inside an identifier or path such
// as a platform file name joined by - _ . or /. One person-name exception:
// the first name shared with painters and composers ("<Name> Monet") is
// allowed when a capitalised surname follows, unless that word is one of
// the vendor's product or model words (also ROT13).
const PRODUCT_WORDS = ["Pbqr", "Bchf", "Fbaarg", "Unvxh", "Vafgnag"].map((w) =>
  w.replace(/[A-Za-z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  }),
);
const BARE = (alt) => new RegExp(`(?<![\\w./-])(?:${alt})(?![\\w/-])`, "i");
const VENDOR_RE = BARE([...NAMES, GPT_N].join("|"));
const FIRST = NAMES[0];
const PERSON_NAME_OK = new RegExp(
  `(?<![\\w./-])[${FIRST[0].toUpperCase()}${FIRST[0]}]${FIRST.slice(1)}\\s+(?!(?:${PRODUCT_WORDS.join("|")})\\b)[A-Z][a-z]+`,
  "g",
);

/** The first vendor name in a line, or null. */
export function findVendorName(line) {
  const masked = String(line).replace(PERSON_NAME_OK, (m) => " ".repeat(m.length));
  const m = VENDOR_RE.exec(masked);
  return m ? m[0] : null;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

/** Commits in the range: sha, author, and full message. */
export function commitsIn(range) {
  const SEP = "\u001e";
  const out = git(["log", "--format=%H%x1f%an%x1f%ae%x1f%B" + SEP, range]);
  return out
    .split(SEP)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((rec) => {
      const [sha, name, email, body] = rec.split("\u001f");
      return { sha, name, email, body: body ?? "" };
    });
}

/** Lines the range adds, per file (three-dot: only what the branch adds). */
export function addedLines(range) {
  const [base, head] = range.split("..");
  const diff = git(["diff", "--unified=0", "--no-color", "--no-ext-diff", `${base}...${head}`, "--", ".", ":(exclude)package-lock.json"]);
  const out = [];
  let file = null;
  let lineNo = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      file = raw.slice(4).replace(/^b\//, "");
    } else if (raw.startsWith("@@")) {
      const m = /\+(\d+)/.exec(raw);
      lineNo = m ? Number(m[1]) : 0;
    } else if (raw.startsWith("+") && file && file !== "/dev/null") {
      out.push({ file, line: lineNo, text: raw.slice(1) });
      lineNo++;
    }
  }
  return out;
}

export function isBotAuthor(name, email) {
  return String(email).endsWith("[bot]@users.noreply.github.com") || String(name).endsWith("[bot]");
}

/** Identity and message checks for already-parsed commits. */
export function checkCommits(commits) {
  const failures = [];
  for (const c of commits) {
    const short = c.sha.slice(0, 8);
    if ((c.name !== OWNER_NAME || c.email !== OWNER_EMAIL) && !isBotAuthor(c.name, c.email)) {
      failures.push(
        `IDENTITY ${short} authored as "${c.name} <${c.email}>". Re-author it as the owner: ${FIX_IDENTITY} (new commit; never rewrite a pushed one without the owner's word)`,
      );
    }
    for (const line of c.body.split("\n")) {
      const coAuthor = /^co-authored-by:\s*(.*)$/i.exec(line.trim());
      if (coAuthor && !coAuthor[1].includes(OWNER_EMAIL)) {
        failures.push(
          `MESSAGE ${short} credits a co-author other than the owner: ${JSON.stringify(line.trim())}. Drop the trailer.`,
        );
        continue;
      }
      if (/^[\w-]+-session:\s*\S/i.test(line.trim())) {
        failures.push(
          `MESSAGE ${short} carries a tool session trailer: ${JSON.stringify(line.trim())}. Drop the trailer.`,
        );
        continue;
      }
      const hit = findVendorName(line);
      if (hit) {
        failures.push(
          `MESSAGE ${short} names an AI tool ("${hit}") in: ${JSON.stringify(line.trim())}. Drop the trailer or reword the message.`,
        );
      }
    }
  }
  return failures;
}

export function checkRange(range) {
  const failures = checkCommits(commitsIn(range));
  for (const a of addedLines(range)) {
    if (a.file === "scripts/check-provenance.mjs") continue; // the checker's own decode notes
    const hit = findVendorName(a.text);
    if (hit) {
      failures.push(
        `FILE ${a.file}:${a.line} adds an AI tool name ("${hit}"). Name the role instead (builder, reviewer, helper), never the tool.`,
      );
    }
  }
  return failures;
}

function parseRange(argv) {
  const i = argv.indexOf("--range");
  if (i !== -1 && argv[i + 1]) return argv[i + 1];
  if (process.env.PROVENANCE_RANGE) return process.env.PROVENANCE_RANGE;
  return "origin/main..HEAD";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const range = parseRange(process.argv.slice(2));
  let failures;
  try {
    failures = checkRange(range);
  } catch (err) {
    console.error(`check-provenance: cannot read ${range}: ${err.message}`);
    process.exit(1);
  }
  for (const f of failures) console.log(f);
  if (failures.length) {
    console.error(`check-provenance: FAILED (${failures.length}) for ${range}`);
    process.exit(1);
  }
  console.log(`check-provenance: PASSED for ${range}`);
}
