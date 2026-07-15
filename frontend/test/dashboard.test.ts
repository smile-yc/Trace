import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRecords, filterDashboardSourceRecords } from "../src/lib/analysis.ts";
import type { WorkRecord } from "../src/types.ts";

const baseRecord: WorkRecord = {
  id: "record",
  date: "2026-07-01",
  title: "record",
  content: "",
  category: "其他",
  businessCategory: "传统业务",
  workType: "工程调试",
  abilityDimension: "",
  projectName: "",
  productSystem: "",
  subtask: "",
  quantity: null,
  coefficient: null,
  workload: null,
  timeHours: null,
  tags: "",
  workloadUnit: "",
  coefficientSource: "none",
  coefficientStandardId: null,
  coefficientStandardVersionId: null,
  workloadFormulaVersion: "quantity_x_coefficient_v1",
  abilityAllocations: [],
  createTime: 1,
  updateTime: 1
};

test("analyzeRecords includes time totals and ability distribution", () => {
  const analysis = analyzeRecords([
    {
      ...baseRecord,
      id: "a",
      projectName: "Alpha",
      abilityDimension: "工程技术",
      workload: 6,
      timeHours: 2
    },
    {
      ...baseRecord,
      id: "b",
      projectName: "Beta",
      abilityDimension: "售前支撑",
      workload: 2,
      timeHours: 8
    },
    {
      ...baseRecord,
      id: "c",
      projectName: "Alpha",
      abilityDimension: "工程技术",
      workload: null,
      timeHours: null
    }
  ] as any);

  assert.equal(analysis.totalTimeHours, 10);
  assert.deepEqual(analysis.abilityDistribution.map((item) => item.label), ["工程技术", "售前支撑"]);
  assert.equal(analysis.abilityDistribution[0].count, 2);
  assert.equal(analysis.abilityDistribution[0].timeHours, 2);
});

test("analyzeRecords splits comma separated ability dimensions", () => {
  const analysis = analyzeRecords([
    {
      ...baseRecord,
      id: "a",
      abilityDimension: "工程技术,知识沉淀",
      workload: 6,
      timeHours: 2
    },
    {
      ...baseRecord,
      id: "b",
      abilityDimension: "知识沉淀",
      workload: 2,
      timeHours: 1
    }
  ] as any);

  assert.deepEqual(
    analysis.abilityDistribution.map((item) => [item.label, item.count, item.workload, item.timeHours]),
    [
      ["知识沉淀", 2, 5, 2],
      ["工程技术", 1, 3, 1]
    ]
  );
  assert.equal(analysis.abilityDistribution.reduce((sum, item) => sum + item.ratio, 0), 100);
});

test("analyzeRecords uses stored ability allocation percentages without duplicating input", () => {
  const analysis = analyzeRecords([
    {
      ...baseRecord,
      id: "allocated",
      businessCategory: "三新业务",
      abilityDimension: "工程技术,知识沉淀",
      workload: 10,
      timeHours: 5,
      abilityAllocations: [
        { abilityId: "engineering", abilityName: "工程技术", percentage: 70, allocatedWorkload: 7, allocatedTimeHours: 3.5 },
        { abilityId: "knowledge", abilityName: "知识沉淀", percentage: 30, allocatedWorkload: 3, allocatedTimeHours: 1.5 }
      ]
    }
  ]);

  assert.deepEqual(
    analysis.abilityDistribution.map((item) => [item.label, item.workload, item.timeHours, item.ratio]),
    [
      ["工程技术", 7, 3.5, 70],
      ["知识沉淀", 3, 1.5, 30]
    ]
  );
});

test("analyzeRecords builds business ability relation matrix", () => {
  const analysis = analyzeRecords([
    {
      ...baseRecord,
      id: "a",
      businessCategory: "三新业务",
      abilityDimension: "工程技术,项目管理与推进",
      workload: 10,
      timeHours: 4
    },
    {
      ...baseRecord,
      id: "b",
      businessCategory: "传统业务",
      abilityDimension: "工程技术",
      workload: 2,
      timeHours: 1
    },
    {
      ...baseRecord,
      id: "c",
      businessCategory: "三新业务",
      abilityDimension: "",
      workload: 4,
      timeHours: 2
    }
  ] as any);

  assert.deepEqual(
    analysis.businessAbilityRelations.map((item) => [item.businessLabel, item.abilityLabel, item.count, item.workload, item.businessShare]),
    [
      ["三新业务", "工程技术", 1, 5, 36],
      ["三新业务", "项目管理与推进", 1, 5, 36],
      ["三新业务", "未填写能力", 1, 4, 29],
      ["传统业务", "工程技术", 1, 2, 100]
    ]
  );
});

test("analyzeRecords ranks focus by weighted workload time and count shares", () => {
  const analysis = analyzeRecords([
    {
      ...baseRecord,
      id: "a1",
      projectName: "Alpha",
      workload: 6,
      timeHours: 2
    },
    {
      ...baseRecord,
      id: "a2",
      projectName: "Alpha",
      workload: null,
      timeHours: null
    },
    {
      ...baseRecord,
      id: "b1",
      projectName: "Beta",
      workload: 2,
      timeHours: 8
    }
  ] as any);

  assert.deepEqual(
    analysis.focusRankings.map((item) => [item.label, item.score]),
    [
      ["Alpha", 56.83],
      ["Beta", 43.17]
    ]
  );
});

test("analyzeRecords accepts configurable focus scoring weights", () => {
  const analysis = analyzeRecords(
    [
      {
        ...baseRecord,
        id: "a1",
        projectName: "Alpha",
        workload: 6,
        timeHours: 2
      },
      {
        ...baseRecord,
        id: "a2",
        projectName: "Alpha",
        workload: null,
        timeHours: null
      },
      {
        ...baseRecord,
        id: "b1",
        projectName: "Beta",
        workload: 2,
        timeHours: 8
      }
    ] as any,
    {
      focusScoreWeights: {
        workload: 0,
        timeHours: 100,
        recordCount: 0
      }
    }
  );

  assert.deepEqual(
    analysis.focusRankings.map((item) => [item.label, item.score]),
    [
      ["Beta", 80],
      ["Alpha", 20]
    ]
  );
});

test("dashboard source filters return exact records without duplicate ability evidence", () => {
  const records = [
    {
      ...baseRecord,
      id: "a",
      date: "2026-07-02",
      businessCategory: "三新业务",
      projectName: "Alpha",
      abilityDimension: "工程技术,项目管理与推进",
      abilityAllocations: [
        { abilityId: "engineering", abilityName: "工程技术", percentage: 60, allocatedWorkload: 3, allocatedTimeHours: 1.2 },
        { abilityId: "management", abilityName: "项目管理与推进", percentage: 40, allocatedWorkload: 2, allocatedTimeHours: 0.8 }
      ]
    },
    {
      ...baseRecord,
      id: "b",
      date: "2026-07-09",
      businessCategory: "传统业务",
      projectName: "Beta",
      abilityDimension: "工程技术"
    }
  ] as WorkRecord[];

  assert.deepEqual(
    filterDashboardSourceRecords(records, { kind: "business", value: "三新业务" }).map((record) => record.id),
    ["a"]
  );
  assert.deepEqual(
    filterDashboardSourceRecords(records, { kind: "ability", value: "工程技术" }).map((record) => record.id),
    ["b", "a"]
  );
  assert.deepEqual(
    filterDashboardSourceRecords(records, { kind: "businessAbility", business: "三新业务", ability: "工程技术" }).map((record) => record.id),
    ["a"]
  );
});

test("dashboard source filters align project and trend selections with displayed groups", () => {
  const records = [
    { ...baseRecord, id: "a", date: "2026-07-02", projectId: "alpha", projectRelation: "project", projectName: "Alpha" },
    { ...baseRecord, id: "b", date: "2026-07-09", projectId: "alpha", projectRelation: "project", projectName: "Alpha" },
    { ...baseRecord, id: "c", date: "2026-08-01", projectId: null, projectRelation: "non_project", projectName: "" }
  ] as WorkRecord[];

  assert.deepEqual(
    filterDashboardSourceRecords(records, { kind: "project", value: "Alpha" }).map((record) => record.id),
    ["b", "a"]
  );
  assert.deepEqual(
    filterDashboardSourceRecords(records, { kind: "trend", value: "2026-07-W2" }).map((record) => record.id),
    ["b"]
  );
  assert.deepEqual(
    filterDashboardSourceRecords(records, { kind: "trend", value: "2026-07" }).map((record) => record.id),
    ["b", "a"]
  );
  assert.deepEqual(
    filterDashboardSourceRecords(records, { kind: "trend", value: "2026-08-01" }).map((record) => record.id),
    ["c"]
  );
  assert.deepEqual(
    filterDashboardSourceRecords(records, { kind: "projectRecords" }).map((record) => record.id),
    ["b", "a"]
  );
  assert.equal(analyzeRecords(records).projectCount, 1);
  assert.equal(analyzeRecords(records).projectSummaries.some((project) => project.projectName === "非项目事项"), true);
});
