import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const LEDGER_CREATE = /create table if not exists _migrations/i;
const EXPECTED_APPLIED = ["0001_widgets.sql", "0002_widgets_note.sql"];

const WIDGETS_SQL = "create table widgets (id integer primary key);";
const NOTE_SQL = "alter table widgets add column note text;";
const BAD_SQL =
  "create table should_not_stick (id integer); select * from relation_that_is_not_there;";

function goodFiles() {
  return [
    { name: "0002_widgets_note.sql", sql: NOTE_SQL },
    { name: "0001_widgets.sql", sql: WIDGETS_SQL },
  ];
}

function rollbackFiles() {
  return [
    { name: "0001_widgets.sql", sql: WIDGETS_SQL },
    { name: "0002_bad.sql", sql: BAD_SQL },
  ];
}

function buildTransaction(db) {
  return async (run) => {
    await db.exec("BEGIN");
    try {
      await run({
        exec: (sql) => db.exec(sql),
        query: (sql, params) => db.query(sql, params),
      });
      await db.exec("COMMIT");
    } catch (err) {
      await db.exec("ROLLBACK");
      throw err;
    }
  };
}

function pgliteTransaction(db) {
  return (run) =>
    db.transaction(async (tx) =>
      run({
        exec: (sql) => tx.exec(sql),
        query: (sql, params) => tx.query(sql, params),
      }),
    );
}

const adapters = [
  ["build", buildTransaction],
  ["pglite", pgliteTransaction],
];

async function loadRunner() {
  return import("./migration-runner.mjs");
}

async function openDb(ledgerSql) {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  if (db.waitReady) await db.waitReady;
  await db.exec(ledgerSql);
  return db;
}

async function closeDb(db) {
  if (db && typeof db.close === "function") await db.close();
}

async function appliedNames(db) {
  const result = await db.query("select name from _migrations order by name");
  return result.rows.map((row) => row.name);
}

async function publicColumns(db) {
  const result = await db.query(
    `select table_name, column_name, data_type, is_nullable
     from information_schema.columns
     where table_schema = 'public'
     order by table_name, column_name`,
  );
  return result.rows.map((row) => ({
    table_name: row.table_name,
    column_name: row.column_name,
    data_type: row.data_type,
    is_nullable: row.is_nullable,
  }));
}

async function publicTables(db) {
  const result = await db.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

test("migrate.mjs and db.ts delegate to applyPendingMigrations without creating the ledger", () => {
  const sources = [
    ["scripts/migrate.mjs", readFileSync(join(root, "scripts/migrate.mjs"), "utf8")],
    ["src/lib/db.ts", readFileSync(join(root, "src/lib/db.ts"), "utf8")],
  ];
  for (const [label, src] of sources) {
    assert.match(src, /\bapplyPendingMigrations\b/, label);
    assert.doesNotMatch(src, LEDGER_CREATE, label);
  }
});

test("build and pglite adapters apply the same widget schema", async () => {
  const { applyPendingMigrations, MIGRATIONS_LEDGER_SQL } = await loadRunner();
  const opened = [];
  try {
    const catalogs = [];
    for (const [, transactionFor] of adapters) {
      const db = await openDb(MIGRATIONS_LEDGER_SQL);
      opened.push(db);
      const appliedNow = await applyPendingMigrations({
        files: goodFiles(),
        applied: await appliedNames(db),
        transaction: transactionFor(db),
      });
      assert.deepEqual(appliedNow, EXPECTED_APPLIED);
      const names = await appliedNames(db);
      assert.deepEqual(names, EXPECTED_APPLIED);
      const columns = await publicColumns(db);
      assert.ok(
        columns.some((column) => column.table_name === "widgets" && column.column_name === "note"),
      );
      catalogs.push(columns);
    }
    assert.deepEqual(catalogs[0], catalogs[1]);
  } finally {
    for (const db of opened) await closeDb(db);
  }
});

test("a failing file rolls back and keeps the earlier migration", async () => {
  const { applyPendingMigrations, MIGRATIONS_LEDGER_SQL } = await loadRunner();
  const opened = [];
  try {
    for (const [, transactionFor] of adapters) {
      const db = await openDb(MIGRATIONS_LEDGER_SQL);
      opened.push(db);
      await assert.rejects(() =>
        applyPendingMigrations({
          files: rollbackFiles(),
          applied: [],
          transaction: transactionFor(db),
        }),
      );
      assert.deepEqual(await appliedNames(db), ["0001_widgets.sql"]);
      assert.deepEqual(await publicTables(db), ["_migrations", "widgets"]);
      const columns = await publicColumns(db);
      assert.deepEqual(
        columns.filter((column) => column.table_name === "widgets").map((column) => column.column_name),
        ["id"],
      );
      assert.equal(
        columns.some((column) => column.table_name === "relation_that_is_not_there"),
        false,
      );
    }
  } finally {
    for (const db of opened) await closeDb(db);
  }
});

test("a second pass applies nothing and does not duplicate rows", async () => {
  const { applyPendingMigrations, MIGRATIONS_LEDGER_SQL } = await loadRunner();
  const opened = [];
  try {
    for (const [, transactionFor] of adapters) {
      const db = await openDb(MIGRATIONS_LEDGER_SQL);
      opened.push(db);
      const transaction = transactionFor(db);
      await applyPendingMigrations({
        files: goodFiles(),
        applied: await appliedNames(db),
        transaction,
      });
      const beforeColumns = await publicColumns(db);
      const again = await applyPendingMigrations({
        files: goodFiles(),
        applied: await appliedNames(db),
        transaction,
      });
      assert.deepEqual(again, []);
      assert.deepEqual(await appliedNames(db), EXPECTED_APPLIED);
      assert.deepEqual(await publicColumns(db), beforeColumns);
      const ledger = await db.query("select count(*)::int as n from _migrations");
      assert.equal(Number(ledger.rows[0].n), EXPECTED_APPLIED.length);
      const widgets = await db.query(
        `select count(*)::int as n from information_schema.tables
         where table_schema = 'public' and table_name = 'widgets'`,
      );
      assert.equal(Number(widgets.rows[0].n), 1);
    }
  } finally {
    for (const db of opened) await closeDb(db);
  }
});

test("migrate exits 0 when DATABASE_URL is empty", () => {
  const result = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout ?? "", /DATABASE_URL not set/);
});
