import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";

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
test("legacy database migration preserves stored workload across two independent initializations", () => {
  const environment = { ...process.env, DATA_DIR: dataDir, DB_PATH: dbPath };
  const initialize = () => execFileSync(process.execPath, [
    "--experimental-strip-types",
    "--experimental-specifier-resolution=node",
    "-e",
    "import('./backend/src/database.ts')"
  ], { cwd: path.resolve(process.cwd()), env: environment });
  initialize();
  initialize();
  const verify = new DatabaseSync(dbPath);
  const record = verify.prepare("SELECT workload, coefficientSource FROM records WHERE id = ?").get("legacy-record") as {
    workload: number;
    coefficientSource: string;
  };
  assert.equal(record.workload, 7);
  assert.equal(record.coefficientSource, "legacy");
  assert.equal(Number((verify.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number }).count), 5);
  assert.equal(Number((verify.prepare("SELECT COUNT(*) AS count FROM growth_goals").get() as { count: number }).count), 0);
  assert.equal(Number((verify.prepare("SELECT COUNT(*) AS count FROM workload_standard_versions").get() as { count: number }).count), 1);
  assert.equal(String((verify.prepare("SELECT projectRelation FROM records WHERE id = ?").get("legacy-record") as { projectRelation: string }).projectRelation), "unassigned");
  verify.close();
});
