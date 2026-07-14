import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

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

process.env.DATA_DIR = dataDir;
process.env.DB_PATH = dbPath;
await import("../src/database.ts");

test("project migration conservatively backfills legacy names and stays idempotent", () => {
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
