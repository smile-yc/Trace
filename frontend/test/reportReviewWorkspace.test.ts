import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildAnnualOutputPackage } from "../src/lib/annualOutput.ts";
import type { Outcome, WorkRecord } from "../src/types.ts";

function source(path: string): string {
  return readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
}

test("weekly monthly and yearly reports share the persisted review workspace", () => {
  const workspace = source("components/ReportReviewWorkspace.tsx");
  assert.match(workspace, /保存草稿/);
  assert.match(workspace, /确认定稿/);
  assert.match(workspace, /清空手工内容/);
  assert.match(workspace, /buildReportInsights/);
  assert.match(workspace, /关联当量/);
  assert.doesNotMatch(workspace, /每项约/);
  for (const page of ["WeeklyPage.tsx", "MonthlyPage.tsx", "YearlyPage.tsx"]) {
    assert.match(source(`pages/${page}`), /ReportReviewWorkspace/);
  }
});

test("yearly adjustment is preview-only and passed explicitly to export", () => {
  const yearly = source("pages/YearlyPage.tsx");
  assert.match(yearly, /workloadAdjustmentPercent/);
  assert.match(yearly, /原始工作当量/);
  assert.match(yearly, /不会修改日报、项目、成果或数据库/);
  assert.doesNotMatch(yearly, /record\.workload\s*=/);
});

test("annual output package uses linked in-year records once and exposes evidence gaps", () => {
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
  ] as Outcome[];

  const result = buildAnnualOutputPackage(records, outcomes, 85);

  assert.equal(result.metrics.rawWorkload, 15);
  assert.equal(result.metrics.adjustedWorkload, 12.75);
  assert.equal(result.metrics.linkedRecordCount, 2);
  assert.equal(result.metrics.linkedWorkload, 10);
  assert.deepEqual(result.outcomeCounts, { deliverable: 1, problemResolution: 1, stageProgress: 0, reusableAsset: 0 });
  assert.deepEqual(result.projects.map((item) => [item.name, item.workload, item.outcomeCount]), [["Alpha", 10, 2], ["Beta", 5, 0]]);
  assert.equal(result.gaps.missingSourceCount, 0);
  assert.equal(result.gaps.missingReportSummaryCount, 1);
  assert.equal(result.gaps.missingValueImpactCount, 1);
  assert.equal(result.gaps.missingContributionCount, 1);
});
