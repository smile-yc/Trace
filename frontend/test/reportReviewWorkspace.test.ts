import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
