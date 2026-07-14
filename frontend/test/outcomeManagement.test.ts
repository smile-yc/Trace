import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { filterOutcomesByRange, prefillOutcomeFromRecords } from "../src/lib/outcomes.ts";
import type { Outcome, WorkRecord } from "../src/types.ts";

const record = (overrides: Partial<WorkRecord> = {}): WorkRecord => ({
  id: "record-1", date: "2026-07-14", title: "完成联调", content: "", category: "其他",
  businessCategory: "传统业务", workType: "工程调试", abilityDimension: "工程技术",
  projectId: "project-1", projectRelation: "project", projectName: "Trace", productSystem: "Trace",
  subtask: "联调", quantity: 1, coefficient: 2, workload: 2, timeHours: 3, tags: "联调,关键",
  workloadUnit: "项", coefficientSource: "manual", coefficientStandardId: null,
  coefficientStandardVersionId: null, workloadFormulaVersion: "quantity_x_coefficient_v1",
  abilityAllocations: [{ abilityId: "engineering", abilityName: "工程技术", percentage: 100, allocatedTimeHours: 3, allocatedWorkload: 2 }],
  createTime: 1, updateTime: 1, ...overrides
});

const outcome = (overrides: Partial<Outcome> = {}): Outcome => ({
  id: "outcome-1", type: "deliverable", status: "completed", title: "交付", projectId: "project-1",
  projectName: "Trace", startDate: "2026-07-01", updateDate: "2026-07-10", completedDate: "2026-07-14",
  backgroundGoal: "", completedWork: "", valueImpact: "", personalRole: "", contribution: "",
  reportSummary: "", productSystem: "Trace", tags: "", remark: "", archived: false, archiveTime: null,
  recordIds: [], records: [], abilities: [], milestoneIds: [], milestones: [], recordCount: 0, timeHours: 0, workload: 0,
  statusHistory: [], createTime: 1, updateTime: 1, ...overrides
});

test("record selections prefill outcome evidence without double counting metadata", () => {
  const seed = prefillOutcomeFromRecords([
    record(),
    record({ id: "record-2", date: "2026-07-15", tags: "关键,复盘" })
  ]);
  assert.deepEqual(seed.recordIds, ["record-1", "record-2"]);
  assert.equal(seed.projectId, "project-1");
  assert.equal(seed.productSystem, "Trace");
  assert.equal(seed.startDate, "2026-07-14");
  assert.equal(seed.updateDate, "2026-07-15");
  assert.equal(seed.tags, "联调,关键,复盘");
  assert.deepEqual(seed.abilities, [{ abilityId: "engineering", abilityName: "工程技术" }]);
});

test("period outcome filtering uses completion, update then start date", () => {
  assert.deepEqual(filterOutcomesByRange([
    outcome(),
    outcome({ id: "outside", completedDate: "", updateDate: "2026-08-01" })
  ], "2026-07-01", "2026-07-31").map((item) => item.id), ["outcome-1"]);
});

test("outcome workspace and all source pages expose create-outcome actions", () => {
  const files = [
    "src/pages/KnowledgePage.tsx",
    "src/pages/DailyPage.tsx",
    "src/pages/AllRecordsPage.tsx",
    "src/pages/ProjectsPage.tsx"
  ].map((file) => fs.readFileSync(path.resolve(process.cwd(), "frontend", file), "utf8"));
  assert.match(files[0], /成果管理/);
  assert.match(files[0], /createOutcome/);
  files.slice(1).forEach((source) => assert.match(source, /onCreateOutcome/));
});
