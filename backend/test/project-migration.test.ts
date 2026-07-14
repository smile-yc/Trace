import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function initializeDatabase(dataDirectory: string, databasePath: string): void {
  execFileSync(process.execPath, [
    "--experimental-strip-types",
    "--experimental-specifier-resolution=node",
    "-e",
    "import('./backend/src/database.ts')"
  ], {
    cwd: path.resolve(process.cwd()),
    env: { ...process.env, DATA_DIR: dataDirectory, DB_PATH: databasePath },
    stdio: "pipe"
  });
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-project-migration-"));
const dbPath = path.join(dataDir, "report.sqlite");
const legacy = new DatabaseSync(dbPath);

legacy.exec(`
  CREATE TABLE records (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '其他',
    businessCategory TEXT NOT NULL DEFAULT '其他',
    workType TEXT NOT NULL DEFAULT '其他项',
    abilityDimension TEXT NOT NULL DEFAULT '',
    projectName TEXT NOT NULL DEFAULT '',
    productSystem TEXT NOT NULL DEFAULT '',
    subtask TEXT NOT NULL DEFAULT '',
    quantity REAL DEFAULT NULL,
    coefficient REAL DEFAULT NULL,
    workload REAL DEFAULT NULL,
    timeHours REAL DEFAULT NULL,
    tags TEXT NOT NULL DEFAULT '',
    createTime INTEGER NOT NULL,
    updateTime INTEGER NOT NULL
  );
`);

const insert = legacy.prepare(`INSERT INTO records
  (id, date, title, projectName, workload, timeHours, createTime, updateTime)
  VALUES (?, '2026-07-14', ?, ?, ?, ?, ?, ?)`);

[
  ["r1", "Trace A", "Trace", 1, 1],
  ["r2", "Trace B", " Trace ", 2, 2],
  ["r3", "Lower", "trace", 3, 3],
  ["r4", "Double space", "Trace  项目", 4, 4],
  ["r5", "Single space", "Trace 项目", 5, 5],
  ["r6", "No project", "", 6, 6]
].forEach(([id, title, projectName, workload, timeHours], index) => {
  insert.run(id, title, projectName, workload, timeHours, index + 1, index + 1);
});

const before = legacy.prepare("SELECT COUNT(*) AS count, SUM(workload) AS workload FROM records").get() as {
  count: number;
  workload: number;
};
legacy.close();

test("project migration conservatively backfills legacy names and stays idempotent", () => {
  initializeDatabase(dataDir, dbPath);
  initializeDatabase(dataDir, dbPath);
  const migrated = new DatabaseSync(dbPath);
  const projects = migrated.prepare("SELECT name FROM projects ORDER BY name").all() as Array<{ name: string }>;
  const linkedTraceRecords = Number((migrated.prepare(`SELECT COUNT(*) AS count
    FROM records WHERE projectId = (SELECT id FROM projects WHERE normalizedName = 'Trace')`).get() as { count: number }).count);
  const unassignedCount = Number((migrated.prepare("SELECT COUNT(*) AS count FROM records WHERE projectRelation = 'unassigned'").get() as { count: number }).count);
  const after = migrated.prepare("SELECT COUNT(*) AS count, SUM(workload) AS workload FROM records").get() as {
    count: number;
    workload: number;
  };
  const migrationCount = Number((migrated.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 2026071401").get() as { count: number }).count);

  assert.deepEqual(projects.map((project) => project.name), ["Trace", "Trace  项目", "Trace 项目", "trace"]);
  assert.equal(linkedTraceRecords, 2);
  assert.equal(unassignedCount, 1);
  assert.deepEqual(after, before);
  assert.equal(migrationCount, 1);
  migrated.close();
});

test("empty database initialization is idempotent", () => {
  const emptyDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-empty-project-migration-"));
  const emptyDbPath = path.join(emptyDataDir, "report.sqlite");

  initializeDatabase(emptyDataDir, emptyDbPath);
  initializeDatabase(emptyDataDir, emptyDbPath);

  const database = new DatabaseSync(emptyDbPath);
  const migrationCount = Number((database.prepare(
    "SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 2026071401"
  ).get() as { count: number }).count);
  const projectCount = Number((database.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number }).count);
  const aliasCount = Number((database.prepare("SELECT COUNT(*) AS count FROM project_aliases").get() as { count: number }).count);

  assert.equal(migrationCount, 1);
  assert.equal(projectCount, 0);
  assert.equal(aliasCount, 0);
  database.close();
});

test("failed project migration rolls back schema, data and migration marker", () => {
  const failureDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-failed-project-migration-"));
  const failureDbPath = path.join(failureDataDir, "report.sqlite");
  const database = new DatabaseSync(failureDbPath);
  database.exec(`
    CREATE TABLE records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '其他',
      businessCategory TEXT NOT NULL DEFAULT '其他',
      workType TEXT NOT NULL DEFAULT '其他项',
      abilityDimension TEXT NOT NULL DEFAULT '',
      projectName TEXT NOT NULL DEFAULT '',
      projectId TEXT DEFAULT NULL,
      projectRelation TEXT NOT NULL DEFAULT 'unassigned',
      productSystem TEXT NOT NULL DEFAULT '',
      subtask TEXT NOT NULL DEFAULT '',
      quantity REAL DEFAULT NULL,
      coefficient REAL DEFAULT NULL,
      workload REAL DEFAULT NULL,
      timeHours REAL DEFAULT NULL,
      tags TEXT NOT NULL DEFAULT '',
      createTime INTEGER NOT NULL,
      updateTime INTEGER NOT NULL
    );
    INSERT INTO records (id, date, title, projectName, createTime, updateTime)
    VALUES ('blocked-record', '2026-07-14', '阻断迁移', '阻断项目', 1, 1);
    CREATE TRIGGER block_project_backfill
    BEFORE UPDATE OF projectRelation ON records
    WHEN NEW.projectRelation = 'project'
    BEGIN
      SELECT RAISE(ABORT, 'forced project migration failure');
    END;
  `);
  database.close();

  assert.throws(() => initializeDatabase(failureDataDir, failureDbPath));

  const verify = new DatabaseSync(failureDbPath);
  const projectTableCount = Number((verify.prepare(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('projects', 'project_aliases')"
  ).get() as { count: number }).count);
  const migrationCount = Number((verify.prepare(
    "SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 2026071401"
  ).get() as { count: number }).count);

  assert.equal(projectTableCount, 0);
  assert.equal(migrationCount, 0);
  verify.close();
});
