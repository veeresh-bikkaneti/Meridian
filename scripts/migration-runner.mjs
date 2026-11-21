import { pendingMigrations } from "./migration-plan.mjs";

export const MIGRATIONS_LEDGER_SQL =
  "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())";

/**
 * Apply pending SQL files in name order. The caller owns the connection and
 * the ledger table. `transaction` must run `run` atomically: commit on
 * success, roll back on throw. `run.exec` runs a whole file. `run.query`
 * runs one parameterized statement.
 * @param {{ files: Array<{ name: string, sql: string }>, applied: Iterable<string>, transaction: (run: (db: { exec: (sql: string) => Promise<unknown>, query: (sql: string, params?: unknown[]) => Promise<unknown> }) => Promise<void>) => Promise<void> }} opts
 * @returns {Promise<string[]>} names applied this pass, in apply order
 */
export async function applyPendingMigrations({ files, applied, transaction }) {
  const pending = pendingMigrations(files.map((file) => file.name), applied);
  const sqlByName = new Map(files.map((file) => [file.name, file.sql]));
  const appliedNow = [];
  for (const { name } of pending) {
    const sql = sqlByName.get(name);
    if (sql == null) throw new Error(`missing migration text for ${name}`);
    try {
      await transaction(async ({ exec, query }) => {
        await exec(sql);
        await query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw Object.assign(error, { migrationName: name });
    }
    appliedNow.push(name);
  }
  return appliedNow;
}
