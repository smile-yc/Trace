import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-config-delete-"));
process.env.DATA_DIR = dataDir;
process.env.DB_PATH = path.join(dataDir, "report.sqlite");

const database = await import("../src/database.ts");

test("deleteConfigOption removes a config option", () => {
  const option = database.insertConfigOption({
    type: "productSystem",
    label: "可删除产品"
  });

  assert.ok(database.getConfigOption(option.id));
  assert.equal(database.deleteConfigOption(option.id), true);
  assert.equal(database.getConfigOption(option.id), null);
  assert.equal(database.deleteConfigOption(option.id), false);
});

test("deleteWorkloadStandard removes a workload standard", () => {
  const standard = database.insertWorkloadStandard({
    businessCategory: "传统业务",
    workType: "工程调试",
    productSystem: "可删除产品",
    subtask: "可删除细项",
    coefficient: 1.5
  });

  assert.ok(database.getWorkloadStandard(standard.id));
  assert.equal(database.deleteWorkloadStandard(standard.id), true);
  assert.equal(database.getWorkloadStandard(standard.id), null);
  assert.equal(database.deleteWorkloadStandard(standard.id), false);
});
