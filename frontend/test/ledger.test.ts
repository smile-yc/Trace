import assert from "node:assert/strict";
import test from "node:test";
import type { Outcome, Project, WorkRecord } from "../src/types.ts";
import {
  analyzeLedgerQuality,
  filterLedgerRecords,
  findNormalizedDuplicateGroups,
  summarizeLedger,
  type LedgerFilters
} from "../src/lib/ledger.ts";

function record(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: "record-1",
    date: "2026-07-14",
    title: "完成 Trace 台账设计",
    content: "整理组合筛选与质量规则",
    category: "技术开发",
    businessCategory: "数字化业务",
    workType: "系统开发",
    abilityDimension: "产品设计",
    projectId: "project-1",
    projectRelation: "project",
    projectName: "Trace",
    productSystem: "内部工具",
    subtask: "需求设计",
    quantity: 1,
    coefficient: 2,
    workload: 2,
    timeHours: 3,
    tags: "重点,系统",
    workloadUnit: "项",
    coefficientSource: "standard_exact",
    coefficientStandardId: "standard-1",
    coefficientStandardVersionId: "version-1",
    workloadFormulaVersion: "quantity_x_coefficient_v1",
    abilityAllocations: [{ abilityId: "ability-1", abilityName: "产品设计", percentage: 100, allocatedTimeHours: 3, allocatedWorkload: 2 }],
    createTime: 1,
    updateTime: 2,
    ...overrides
  };
}

function outcome(overrides: Partial<Outcome> = {}): Outcome {
  return {
    id: "outcome-1",
    type: "deliverable",
    status: "completed",
    title: "台账升级",
    projectId: "project-1",
    projectName: "Trace",
    startDate: "2026-07-14",
    updateDate: "2026-07-14",
    completedDate: "2026-07-14",
    backgroundGoal: "",
    completedWork: "",
    valueImpact: "",
    personalRole: "",
    contribution: "",
    reportSummary: "",
    productSystem: "",
    tags: "",
    remark: "",
    archived: false,
    archiveTime: null,
    recordIds: ["record-1"],
    records: [],
    abilities: [],
    milestoneIds: [],
    milestones: [],
    recordCount: 1,
    timeHours: 3,
    workload: 2,
    statusHistory: [],
    createTime: 1,
    updateTime: 2,
    ...overrides
  };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Trace",
    normalizedName: "Trace",
    shortName: "",
    status: "active",
    startDate: "",
    endDate: "",
    personalRole: "",
    goal: "",
    description: "",
    completionSummary: "",
    aliases: [],
    mergedIntoProjectId: null,
    archiveTime: null,
    createTime: 1,
    updateTime: 2,
    ...overrides
  };
}

const baseFilters: LedgerFilters = {
  periodMode: "week",
  period: "2026-W29",
  startDate: "",
  endDate: "",
  query: "",
  projectId: "",
  projectRelation: "",
  businessCategory: "",
  workType: "",
  productSystem: "",
  subtask: "",
  ability: "",
  coefficientSource: "",
  outcomeStatus: "",
  tag: "",
  qualityCode: ""
};

test("filterLedgerRecords defaults to the selected week and supports custom inclusive dates", () => {
  const records = [
    record({ id: "monday", date: "2026-07-13" }),
    record({ id: "sunday", date: "2026-07-19" }),
    record({ id: "outside", date: "2026-07-20" })
  ];

  assert.deepEqual(filterLedgerRecords(records, [], baseFilters, "2026-07-14").map((item) => item.id), ["sunday", "monday"]);
  assert.deepEqual(filterLedgerRecords(records, [], {
    ...baseFilters,
    periodMode: "custom",
    startDate: "2026-07-19",
    endDate: "2026-07-20"
  }, "2026-07-14").map((item) => item.id), ["outside", "sunday"]);
  assert.deepEqual(filterLedgerRecords(records, [], {
    ...baseFilters,
    periodMode: "custom",
    startDate: "2026-07-20",
    endDate: "2026-07-19"
  }, "2026-07-14"), []);
});

test("filterLedgerRecords intersects work dimensions, provenance, tags and outcome status", () => {
  const matching = record({ id: "matching" });
  const other = record({
    id: "other",
    title: "例行维护",
    projectId: null,
    projectRelation: "non_project",
    projectName: "",
    businessCategory: "传统业务",
    workType: "运维",
    productSystem: "外部产品",
    subtask: "巡检",
    abilityDimension: "执行",
    abilityAllocations: [{ abilityId: "ability-2", abilityName: "执行", percentage: 100, allocatedTimeHours: 1, allocatedWorkload: 1 }],
    coefficientSource: "manual",
    tags: "日常"
  });
  const filters: LedgerFilters = {
    ...baseFilters,
    query: "质量规则",
    projectId: "project-1",
    projectRelation: "project",
    businessCategory: "数字化业务",
    workType: "系统开发",
    productSystem: "内部工具",
    subtask: "需求设计",
    ability: "产品设计",
    coefficientSource: "standard_exact",
    outcomeStatus: "completed",
    tag: "重点"
  };

  assert.deepEqual(filterLedgerRecords([matching, other], [outcome({ recordIds: ["matching"] })], filters, "2026-07-14").map((item) => item.id), ["matching"]);
  assert.deepEqual(filterLedgerRecords([matching, other], [], { ...baseFilters, outcomeStatus: "none" }, "2026-07-14").map((item) => item.id), ["matching", "other"]);
});

test("summarizeLedger deduplicates projects and outcomes in the visible record scope", () => {
  const records = [
    record({ id: "record-1", workload: 2, timeHours: 3 }),
    record({ id: "record-2", workload: 4, timeHours: 5 })
  ];
  const outcomes = [
    outcome({ id: "outcome-1", recordIds: ["record-1", "record-2"] }),
    outcome({ id: "outcome-2", recordIds: ["record-2"] })
  ];

  assert.deepEqual(summarizeLedger(records, outcomes), {
    recordCount: 2,
    timeHours: 8,
    workload: 6,
    projectCount: 1,
    outcomeCount: 2
  });
});

test("analyzeLedgerQuality reports deterministic missing fields and manual coefficient share", () => {
  const incomplete = record({
    id: "incomplete",
    content: "",
    projectId: null,
    projectRelation: "unassigned",
    projectName: "",
    timeHours: null,
    coefficient: null,
    coefficientSource: "none",
    abilityDimension: "",
    abilityAllocations: []
  });
  const manual = record({ id: "manual", coefficientSource: "manual" });
  const nonProject = record({ id: "non-project", projectId: null, projectRelation: "non_project", projectName: "" });

  const result = analyzeLedgerQuality([incomplete, manual, nonProject], []);

  assert.deepEqual(result.byRecordId.incomplete, ["missing_project", "missing_ability", "missing_time", "missing_coefficient", "missing_content"]);
  assert.equal(result.byRecordId["non-project"].includes("missing_project"), false);
  assert.equal(result.issueRecordCount, 1);
  assert.equal(result.manualCoefficientCount, 1);
  assert.equal(result.manualCoefficientPercent, 33.3);
});

test("normalized duplicate detection finds labels and active projects that differ only by separators", () => {
  assert.deepEqual(findNormalizedDuplicateGroups(["数字 化业务", "数字化业务", "传统业务"]), [["数字 化业务", "数字化业务"]]);

  const result = analyzeLedgerQuality(
    [record({ businessCategory: "数字 化业务" }), record({ id: "record-2", businessCategory: "数字化业务" })],
    [project({ id: "project-1", name: "Trace-2026" }), project({ id: "project-2", name: "Trace 2026" }), project({ id: "merged", name: "Trace_2026", mergedIntoProjectId: "project-1" })]
  );

  assert.deepEqual(result.duplicateCategories.businessCategory, [["数字 化业务", "数字化业务"]]);
  assert.deepEqual(result.duplicateProjects, [["Trace 2026", "Trace-2026"]]);
});
