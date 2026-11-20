#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every Vercel deploy — applying pending files
 * in ../migrations to DATABASE_URL. Each file is applied in one transaction and
 * recorded in a `_migrations` table, so it runs once and is safe to re-run.
 *
 * The read is non-recursive, so the opt-in auth schema under migrations/auth/
 * is not applied to an app that never asked for sign-in.
 *
 * No DATABASE_URL (local / preview builds) -> skip; the PGLite fallback applies
 * the same files at startup instead (see src/lib/db.ts).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";
import { applyPendingMigrations, MIGRATIONS_LEDGER_SQL } from "./migration-runner.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function main() {
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.log("[migrate] no migrations/ directory — nothing to do.");
    return;
  }
  // An app with no schema of its own must not pay for a database connection.
  if (pendingMigrations(entries, []).length === 0) {
    console.log("[migrate] no migrations — nothing to do.");
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(MIGRATIONS_LEDGER_SQL);
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map(
      (r) => r.name,
    );

    const files = [];
    for (const { name } of pendingMigrations(entries, applied)) {
      files.push({
        name,
        sql: await readFile(join(migrationsDir, name), "utf8"),
      });
    }

    let appliedNow;
    try {
      appliedNow = await applyPendingMigrations({
        files,
        applied,
        transaction: async (run) => {
          await client.query("BEGIN");
          try {
            await run({
              exec: (sql) => client.query(sql),
              query: (sql, params) => client.query(sql, params),
            });
            await client.query("COMMIT");
          } catch (err) {
            try {
              await client.query("ROLLBACK");
            } catch {
              // ROLLBACK fails when the connection died — keep the original error.
            }
            throw err;
          }
        },
      });
    } catch (err) {
      console.error(`[migrate] error applying ${err.migrationName}`);
      throw err;
    }
    for (const name of appliedNow) {
      console.log(`[migrate] applied ${name}`);
    }
    const count = appliedNow.length;
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  // pg errors carry the context needed to debug a bad SQL file.
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  process.exit(1);
});
