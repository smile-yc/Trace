import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-legacy-migration-"));
const dbPath = path.join(dataDir, "report.sqlite");
const legacy = new DatabaseSync(dbPath);
legacy.exec(`CREATE TABLE records (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, title TEXT NOT NULL, content TEXT, category TEXT,
  businessCategory TEXT, workType TEXT, abilityDimension TEXT, projectName TEXT, productSystem TEXT,
  subtask TEXT, quantity REAL, coefficient REAL, workload REAL, timeHours REAL, tags TEXT, createTime INTEGER, updateTime INTEGER
); CREATE TABLE workload_standards (
  id TEXT PRIMARY KEY, businessCategory TEXT, workType TEXT, productSystem TEXT, subtask TEXT,
  coefficient REAL, remark TEXT, enabled INTEGER, createTime INTEGER, updateTime INTEGER
);`);
legacy.prepare("INSERT INTO records VALUES (?, ?, ?, '', '其他', '传统业务', '工程调试', '工程技术', '', '', '', 2, 3, 7, 4, '', 1, 1)")
  .run("legacy-record", "2026-01-01", "旧记录");
legacy.close();
process.env.DATA_DIR = dataDir;
process.env.DB_PATH = dbPath;

const database = await import("../src/database.ts");

test("legacy database migration preserves stored workload and is idempotent", () => {
  const record = database.getRecord("legacy-record");
  assert.equal(record?.workload, 7);
  assert.equal(record?.coefficientSource, "legacy");
  assert.equal(database.listWorkloadStandardVersions().length, 1);
  const verify = new DatabaseSync(dbPath);
  assert.equal(Number((verify.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number }).count), 2);
  verify.close();
});
