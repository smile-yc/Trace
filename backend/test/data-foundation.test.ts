import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";

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
    projectId: null,
    projectRelation: "non_project",
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

test("growth goals group milestones and preserve manual correction history", () => {
  const goal = database.insertGrowthGoal({
    title: "Build technical leadership",
    scope: "career",
    status: "active",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    abilityId: "engineering",
    abilityName: "Engineering"
  });
  const milestone = database.insertMilestone({
    goalId: goal.id,
    name: "Resolve important problems",
    metricType: "quantity",
    metricSource: "problem_count",
    targetValue: 2,
    startDate: "2026-01-01",
    deadline: "2026-12-31"
  });

  const corrected = database.correctMilestone(milestone.id, 1.5, "Include one cross-team intervention");

  assert.equal(database.listGrowthGoals()[0]?.title, goal.title);
  assert.equal(corrected?.currentValue, 1.5);
  assert.equal(corrected?.overrideReason, "Include one cross-team intervention");
  assert.equal(database.listMilestoneCorrections(milestone.id).length, 1);
});

test("milestone progress derives input and quantity evidence from source records", () => {
  const project = database.insertProject({ name: "Growth evidence project", status: "active" });
  const record = database.insertRecord(recordInput({
    date: "2026-07-10",
    projectId: project.id,
    projectRelation: "project",
    abilityDimension: "Engineering,Communication",
    abilityAllocations: [
      { abilityId: "engineering", abilityName: "Engineering", percentage: 75 },
      { abilityId: "communication", abilityName: "Communication", percentage: 25 }
    ],
    timeHours: 8,
    workload: 12
  }));
  database.insertOutcome({
    type: "problem_resolution",
    status: "completed",
    title: "Solved a recurring production issue",
    projectId: project.id,
    updateDate: "2026-07-10",
    completedDate: "2026-07-10",
    recordIds: [record.id],
    abilities: [{ abilityId: "engineering", abilityName: "Engineering" }]
  });
  const inputMilestone = database.insertMilestone({
    name: "Engineering investment",
    metricType: "input",
    metricSource: "time_hours",
    abilityId: "engineering",
    abilityName: "Engineering",
    targetValue: 12,
    startDate: "2026-07-01",
    deadline: "2026-07-31"
  });
  const resultMilestone = database.insertMilestone({
    name: "Problem results",
    metricType: "quantity",
    metricSource: "problem_count",
    targetValue: 2,
    startDate: "2026-07-01",
    deadline: "2026-07-31"
  });

  const inputProgress = database.getMilestoneProgress(inputMilestone.id);
  const resultProgress = database.getMilestoneProgress(resultMilestone.id);

  assert.equal(inputProgress?.calculatedValue, 6);
  assert.equal(inputProgress?.progress, 50);
  assert.ok(inputProgress?.evidence.some((item: { kind: string }) => item.kind === "record"));
  assert.equal(resultProgress?.calculatedValue, 1);
  assert.ok(resultProgress?.evidence.some((item: { kind: string }) => item.kind === "outcome"));
});

test("stage milestones calculate progress from completed steps", () => {
  const milestone = database.insertMilestone({
    name: "Complete leadership practice",
    metricType: "stage",
    metricSource: "manual_stage",
    stages: [
      { label: "Lead planning", completed: true },
      { label: "Lead delivery", completed: false }
    ]
  });

  const progress = database.getMilestoneProgress(milestone.id);

  assert.equal(progress?.targetValue, 2);
  assert.equal(progress?.calculatedValue, 1);
  assert.equal(progress?.progress, 50);
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
    "conflict",
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

test("record rejects a supplied standard that does not match its classification", () => {
  const version = database.getActiveWorkloadStandardVersion();
  assert.ok(version);
  const standard = database.insertWorkloadStandard({
    versionId: version.id,
    businessCategory: "三新业务",
    workType: "工程测试",
    coefficient: 5,
    unit: "项"
  });

  assert.throws(
    () => database.insertRecord(recordInput({ coefficient: 5, coefficientStandardId: standard.id })),
    /WORKLOAD_STANDARD_MISMATCH/
  );
});

test("duplicate ability IDs reject atomically without persisting a record", () => {
  const before = database.listRecords().length;
  assert.throws(
    () => database.insertRecord(recordInput({
      abilityAllocations: [
        { abilityId: "engineering", abilityName: "工程技术", percentage: 50 },
        { abilityId: "engineering", abilityName: "工程技术", percentage: 50 }
      ]
    })),
    /ABILITY_ALLOCATION_INVALID/
  );
  assert.equal(database.listRecords().length, before);
});

test("record updates refresh provenance and replace ability allocations atomically", () => {
  const version = database.getActiveWorkloadStandardVersion();
  assert.ok(version);
  const standard = database.insertWorkloadStandard({
    versionId: version.id,
    businessCategory: "传统业务",
    workType: "工程调试",
    productSystem: "Trace",
    subtask: "更新快照",
    coefficient: 4,
    unit: "次"
  });
  const record = database.insertRecord(recordInput({ subtask: "旧任务" }));
  const updated = database.updateRecord(record.id, recordInput({
    subtask: "更新快照",
    coefficient: 4,
    coefficientStandardId: standard.id,
    abilityAllocations: [{ abilityId: "management", abilityName: "项目管理与推进", percentage: 100 }]
  }));

  assert.equal(updated?.coefficientSource, "standard_exact");
  assert.equal(updated?.workloadUnit, "次");
  assert.equal(updated?.coefficientStandardId, standard.id);
  assert.deepEqual(updated?.abilityAllocations.map((item: { abilityId: string }) => item.abilityId), ["management"]);
});

test("Excel parsing preserves blank and non-finite coefficients for row-level preview errors", async () => {
  const { default: ExcelJS } = await import("exceljs");
  const { parseWorkloadStandardWorkbook } = await import("../src/core/workloadStandardImport.ts");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("工作当量标准");
  sheet.addRow(["业务分类", "工作类型", "系数"]);
  sheet.addRow(["三新业务", "工程测试", ""]);
  sheet.addRow(["三新业务", "工程设计", "Infinity"]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const rows = await parseWorkloadStandardWorkbook(buffer);
  const preview = database.previewWorkloadStandardImport(rows);
  assert.deepEqual(preview.rows.map((row: { status: string; rowNumber: number }) => ({ status: row.status, rowNumber: row.rowNumber })), [
    { status: "invalid", rowNumber: 1 },
    { status: "invalid", rowNumber: 2 }
  ]);
});

test("import preview marks repeated keys inside the same workbook as conflicts", () => {
  const preview = database.previewWorkloadStandardImport([
    { businessCategory: "三新业务", workType: "现场支持", coefficient: 1, unit: "项" },
    { businessCategory: "三新业务", workType: "现场支持", coefficient: 2, unit: "项" }
  ]);
  assert.deepEqual(preview.rows.map((row: { status: string }) => row.status), ["conflict", "conflict"]);
});

test("import confirmation rejects duplicate file keys even with use-imported decisions", () => {
  const before = database.listWorkloadStandardVersions().length;
  assert.throws(
    () => database.confirmWorkloadStandardImport({
      name: "重复键导入版本",
      rows: [
        { businessCategory: "三新业务", workType: "现场质量检查", coefficient: 1, unit: "项" },
        { businessCategory: "三新业务", workType: "现场质量检查", coefficient: 2, unit: "项" }
      ],
      conflictResolutions: { "1": "use_imported", "2": "use_imported" }
    }),
    /WORKLOAD_STANDARD_IMPORT_DUPLICATE_KEYS/
  );
  assert.equal(database.listWorkloadStandardVersions().length, before);
});

test("HTTP matching accepts versionId and returns both transition response shapes", async (t) => {
  const httpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-match-http-"));
  const port = 4300 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: path.resolve(process.cwd(), "backend"),
    env: { ...process.env, PORT: String(port), DATA_DIR: httpDataDir, DB_PATH: path.join(httpDataDir, "report.sqlite") },
    stdio: "ignore"
  });
  t.after(() => child.kill());
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true);
  const version = await (await fetch(`http://127.0.0.1:${port}/api/workload-standard-versions`)).json() as { versions: Array<{ id: string }> };
  const created = await fetch(`http://127.0.0.1:${port}/api/workload-standards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versionId: version.versions[0].id, businessCategory: "三新业务", workType: "工程测试", coefficient: 3 })
  });
  assert.equal(created.status, 201);
  const response = await fetch(`http://127.0.0.1:${port}/api/workload-standards/match?versionId=${encodeURIComponent(version.versions[0].id)}&businessCategory=三新业务&workType=工程测试`);
  const body = await response.json() as { standard?: { coefficient: number }; match?: { standard: { coefficient: number } } };
  assert.equal(body.standard?.coefficient, 3);
  assert.equal(body.match?.standard.coefficient, 3);
});
