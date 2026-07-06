import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRecords } from "../src/lib/analysis.ts";

const baseRecord = {
  id: "record",
  date: "2026-07-01",
  title: "record",
  content: "",
  category: "其他",
  businessCategory: "传统业务",
  workType: "工程调试",
  projectName: "",
  productSystem: "",
  subtask: "",
  quantity: null,
  coefficient: null,
  workload: null,
  tags: "",
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
