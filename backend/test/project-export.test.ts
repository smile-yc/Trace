import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { analyzeExport } from "../src/exporters/analysis.ts";
import { buildAnnualOutputPackage } from "../src/exporters/annualOutput.ts";
import type { WorkRecord } from "../src/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readExporter(file: string): string {
  return readFileSync(resolve(__dirname, `../src/exporters/${file}`), "utf8");
}

test("Excel raw records export project identity, relation label and immutable name snapshot", () => {
  const source = readExporter("excel.ts");

  assert.match(source, /\{ header: "项目ID", key: "projectId", width: 24 \}/);
  assert.match(source, /\{ header: "项目关联状态", key: "projectRelation", width: 16 \}/);
  assert.match(source, /\{ header: "项目名称快照", key: "projectName", width: 24 \}/);
  assert.match(source, /project:\s*"项目事项"/);
  assert.match(source, /non_project:\s*"非项目事项"/);
  assert.match(source, /unassigned:\s*"历史未关联"/);
  assert.match(source, /projectId: record\.projectId/);
  assert.match(source, /projectRelation: projectRelationLabels\[record\.projectRelation\]/);
  assert.match(source, /projectName: record\.projectName/);
  assert.match(source, /workloadAdjustmentPercent/);
  assert.match(source, /createReportReviewSheet/);
  assert.match(source, /record\.workload/);
});

test("Word and PDF reports keep snapshot and original totals", () => {
  for (const file of ["word.ts", "pdf.ts"]) {
    const source = readExporter(file);
    assert.match(source, /record\.projectName/);
    assert.match(source, /analysis\.totalWorkload/);
    assert.match(source, /analysis\.totalTimeHours/);
    assert.match(source, /workloadAdjustmentPercent/);
    assert.match(source, /payload\.reportReview/);
    assert.match(source, /record\.workload/);
  }
});

test("all export formats include unified outcomes without legacy links", () => {
  const excel = readExporter("excel.ts");
  assert.match(excel, /addWorksheet\("成果清单"/);
  assert.match(excel, /outcome\.recordCount/);
  assert.match(excel, /outcome\.workload/);
  assert.equal(excel.includes("asset.link"), false);
  for (const file of ["word.ts", "pdf.ts"]) {
    const source = readExporter(file);
    assert.match(source, /payload\.outcomes/);
    assert.match(source, /outcome\.reportSummary/);
  }
});

test("export ability summary uses allocated metrics without duplicating record totals", () => {
  const record = {
    id: "record",
    date: "2026-07-01",
    title: "record",
    abilityDimension: "工程技术,知识沉淀",
    workload: 10,
    timeHours: 5,
    abilityAllocations: [
      { abilityId: "engineering", abilityName: "工程技术", percentage: 70, allocatedWorkload: 7, allocatedTimeHours: 3.5 },
      { abilityId: "knowledge", abilityName: "知识沉淀", percentage: 30, allocatedWorkload: 3, allocatedTimeHours: 1.5 }
    ]
  } as WorkRecord;

  const analysis = analyzeExport([record]);

  assert.deepEqual(
    analysis.abilitySummary.map((item) => [item.label, item.workload, item.timeHours, item.ratio]),
    [
      ["工程技术", 7, 3.5, 70],
      ["知识沉淀", 3, 1.5, 30]
    ]
  );
});

test("Excel exports ability allocation metrics without a duplicated quantity column", () => {
  const excel = readExporter("excel.ts");

  assert.match(excel, /function createAbilityDistributionSheet/);
  assert.match(excel, /分配后当量/);
  assert.match(excel, /分配后时间/);
  assert.match(excel, /投入占比/);
});

test("annual export package deduplicates shared source records and keeps gaps factual", () => {
  const records = [
    { id: "r1", projectName: "Alpha", workload: 8, timeHours: 6 },
    { id: "r2", projectName: "Alpha", workload: 2, timeHours: 4 },
    { id: "r3", projectName: "Beta", workload: 5, timeHours: 3 }
  ] as WorkRecord[];
  const outcomes = [
    {
      id: "o1", type: "deliverable", status: "completed", title: "交付成果", projectName: "Alpha",
      completedDate: "2026-06-30", recordIds: ["r1", "outside"], reportSummary: "完成交付",
      valueImpact: "支撑验收", contribution: "负责方案与实施"
    },
    {
      id: "o2", type: "problem_resolution", status: "stage_result", title: "问题解决", projectName: "Alpha",
      updateDate: "2026-08-01", recordIds: ["r1", "r2"], reportSummary: "",
      valueImpact: "", contribution: ""
    }
  ] as Parameters<typeof buildAnnualOutputPackage>[1];

  const result = buildAnnualOutputPackage(records, outcomes, 85);

  assert.equal(result.metrics.linkedRecordCount, 2);
  assert.equal(result.metrics.linkedWorkload, 10);
  assert.equal(result.metrics.adjustedWorkload, 12.75);
  assert.equal(result.gaps.missingReportSummaryCount, 1);
  assert.doesNotMatch(result.reminders.join(" "), /价值低|效率低|投入不合理/);
});

test("annual Word PDF and Excel exports expose a dedicated evidence-backed outcome package", () => {
  const excel = readExporter("excel.ts");
  assert.match(excel, /createAnnualOutputSheet/);
  assert.match(excel, /年度成果包/);
  for (const file of ["word.ts", "pdf.ts"]) {
    const source = readExporter(file);
    assert.match(source, /buildAnnualOutputPackage/);
    assert.match(source, /年度成果包/);
    assert.match(source, /linkedRecordCount/);
    assert.match(source, /reportableOutcomes/);
  }
});
