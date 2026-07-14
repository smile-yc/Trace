import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

test("legacy knowledge assets migrate once to reusable outcomes without copying links", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-outcome-migration-"));
  const dbPath = path.join(dataDir, "report.sqlite");
  const legacy = new DatabaseSync(dbPath);
  legacy.exec(`CREATE TABLE knowledge_assets (
    id TEXT PRIMARY KEY, type TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
    sourceRecordId TEXT NOT NULL DEFAULT '', projectName TEXT NOT NULL DEFAULT '', productSystem TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', link TEXT NOT NULL DEFAULT '',
    remark TEXT NOT NULL DEFAULT '', createTime INTEGER NOT NULL, updateTime INTEGER NOT NULL
  )`);
  legacy.prepare("INSERT INTO knowledge_assets VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "legacy-asset", "复盘", "旧知识资产", "保留摘要", "旧项目", "Trace", "复盘,模板", "published",
    "https://legacy.example", "保留备注", 100, 200
  );
  legacy.close();

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
  const outcome = verify.prepare("SELECT * FROM outcomes WHERE id = ?").get("legacy-asset") as Record<string, unknown>;
  assert.equal(outcome.type, "reusable_asset");
  assert.equal(outcome.status, "completed");
  assert.equal(outcome.title, "旧知识资产");
  assert.equal(outcome.completedWork, "保留摘要");
  assert.equal(outcome.startDate, "1970-01-01");
  assert.equal(outcome.completedDate, "1970-01-01");
  assert.equal(outcome.remark, "保留备注");
  assert.equal("link" in outcome, false);
  assert.equal(Number((verify.prepare("SELECT COUNT(*) AS count FROM outcomes").get() as { count: number }).count), 1);
  assert.equal(String((verify.prepare("SELECT link FROM knowledge_assets WHERE id = ?").get("legacy-asset") as { link: string }).link), "https://legacy.example");
  verify.close();
});
