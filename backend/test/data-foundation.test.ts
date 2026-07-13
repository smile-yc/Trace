import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-data-foundation-"));
process.env.DATA_DIR = dataDir;
process.env.DB_PATH = path.join(dataDir, "report.sqlite");

const database = await import("../src/database.ts");

function recordInput(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-07-13",
    title: "版本快照记录",
    content: "",
    category: "其他",
    businessCategory: "传统业务",
    workType: "工程调试",
    abilityDimension: "工程技术,项目管理与推进",
    projectName: "",
    productSystem: "Trace",
    subtask: "接口开发",
    quantity: 2,
    coefficient: 3,
    timeHours: 4,
    tags: "",
    ...overrides
  };
}

test("new records snapshot manual coefficient provenance and evenly allocate abilities", () => {
  const record = database.insertRecord(recordInput());

  assert.equal(record.workload, 6);
  assert.equal(record.coefficientSource, "manual");
  assert.equal(record.coefficientStandardId, null);
  assert.equal(record.coefficientStandardVersionId, null);
  assert.equal(record.workloadFormulaVersion, "quantity_x_coefficient_v1");
  assert.deepEqual(record.abilityAllocations.map((item: { percentage: number }) => item.percentage), [50, 50]);
  assert.deepEqual(
    record.abilityAllocations.map((item: { allocatedWorkload: number }) => item.allocatedWorkload),
    [3, 3]
  );
});

test("manual ability allocation must total exactly 100 percent", () => {
  assert.throws(
    () => database.insertRecord(recordInput({
      abilityAllocations: [
        { abilityId: "engineering", abilityName: "工程技术", percentage: 70 },
        { abilityId: "management", abilityName: "项目管理与推进", percentage: 20 }
      ]
    })),
    /ABILITY_ALLOCATION_INVALID/
  );
});

test("new records snapshot a matched standard and later standard edits leave history unchanged", () => {
  const version = database.getActiveWorkloadStandardVersion();
  assert.ok(version);
  const standard = database.insertWorkloadStandard({
    versionId: version.id,
    businessCategory: "传统业务",
    workType: "工程调试",
    productSystem: "Trace",
    subtask: "接口开发",
    unit: "项",
    coefficient: 3
  });
  const record = database.insertRecord(recordInput({ coefficientStandardId: standard.id }));

  database.updateWorkloadStandard(standard.id, { coefficient: 9 });
  const persisted = database.getRecord(record.id);

  assert.equal(record.coefficientSource, "standard_exact");
  assert.equal(record.coefficientStandardVersionId, version.id);
  assert.equal(record.workloadUnit, "项");
  assert.equal(persisted?.coefficient, 3);
  assert.equal(persisted?.workload, 6);
});

test("standard import preview distinguishes new duplicate conflict and invalid rows", () => {
  const version = database.getActiveWorkloadStandardVersion();
  assert.ok(version);
  database.insertWorkloadStandard({
    versionId: version.id,
    businessCategory: "三新业务",
    workType: "工程设计",
    coefficient: 1,
    unit: "项"
  });

  const preview = database.previewWorkloadStandardImport([
    { businessCategory: "三新业务", workType: "工程设计", coefficient: 1, unit: "项" },
    { businessCategory: "三新业务", workType: "工程设计", coefficient: 2, unit: "项" },
    { businessCategory: "三新业务", workType: "工程测试", coefficient: 2, unit: "项" },
    { businessCategory: "", workType: "工程测试", coefficient: 2, unit: "项" }
  ]);

  assert.deepEqual(preview.rows.map((row: { status: string }) => row.status), [
    "duplicate",
    "conflict",
    "new",
    "invalid"
  ]);
});

test("invalid import confirmation rolls back the newly created version", () => {
  const before = database.listWorkloadStandardVersions().length;

  assert.throws(
    () => database.confirmWorkloadStandardImport({
      name: "2026 导入版本",
      year: 2026,
      sourceName: "工作当量标准.xlsx",
      rows: [
        { businessCategory: "三新业务", workType: "工程测试", coefficient: 2, unit: "项" },
        { businessCategory: "", workType: "无效", coefficient: 1, unit: "项" }
      ]
    }),
    /WORKLOAD_STANDARD_IMPORT_INVALID/
  );

  assert.equal(database.listWorkloadStandardVersions().length, before);
});

test("Excel standard sheet parsing maps the supported header aliases", async () => {
  const { default: ExcelJS } = await import("exceljs");
  const { parseWorkloadStandardWorkbook } = await import("../src/core/workloadStandardImport.ts");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("工作当量标准");
  sheet.addRow(["业务分类", "工作类型", "产品", "子任务", "单位", "系数", "说明"]);
  sheet.addRow(["三新业务", "工程测试", "GM1000", "规约测试", "项", 1.5, "Excel 导入"]);

  const rows = await parseWorkloadStandardWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.deepEqual(rows, [{
    businessCategory: "三新业务",
    workType: "工程测试",
    productSystem: "GM1000",
    subtask: "规约测试",
    unit: "项",
    coefficient: 1.5,
    remark: "Excel 导入"
  }]);
});
