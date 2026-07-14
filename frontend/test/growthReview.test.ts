import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGrowthWarnings,
  buildMonthlyReview,
  summarizeKnowledgeAssets,
  summarizeMilestones
} from "../src/lib/growthReview.ts";
import type { WorkRecord } from "../src/types.ts";

const baseRecord: WorkRecord = {
  id: "record",
  date: "2026-07-01",
  title: "record",
  content: "",
  category: "其他",
  businessCategory: "传统业务",
  workType: "工程调试",
  abilityDimension: "工程技术",
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

test("buildGrowthWarnings detects missing ability input and target share gaps", () => {
  const warnings = buildGrowthWarnings(
    [
      {
        ...baseRecord,
        id: "a",
        date: "2026-06-01",
        abilityDimension: "工程技术",
        workload: 10
      },
      {
        ...baseRecord,
        id: "b",
        date: "2026-07-01",
        abilityDimension: "售前支撑",
        workload: 90
      }
    ] as any,
    {
      warningRules: {
        abilityNoRecordDays: 20,
        targetShareDeviationPercent: 10
      },
      abilityTargets: {
        工程技术: 30,
        知识沉淀: 10
      }
    },
    "2026-07-06"
  );

  assert.ok(warnings.some((warning) => warning.type === "stale-ability" && warning.label === "工程技术"));
  assert.ok(warnings.some((warning) => warning.type === "missing-ability" && warning.label === "知识沉淀"));
  assert.ok(warnings.some((warning) => warning.type === "target-gap" && warning.label === "工程技术"));
});

test("buildGrowthWarnings matches targets inside multi ability records", () => {
  const warnings = buildGrowthWarnings(
    [
      {
        ...baseRecord,
        id: "a",
        date: "2026-07-01",
        abilityDimension: "工程技术,知识沉淀",
        workload: 10
      }
    ] as any,
    {
      warningRules: {
        abilityNoRecordDays: 20,
        targetShareDeviationPercent: 10
      },
      abilityTargets: {
        知识沉淀: 30
      }
    },
    "2026-07-06"
  );

  assert.equal(warnings.some((warning) => warning.type === "missing-ability" && warning.label === "知识沉淀"), false);
  assert.equal(warnings.some((warning) => warning.type === "stale-ability" && warning.label === "知识沉淀"), false);
});

test("buildGrowthWarnings does not warn when actual share exactly reaches target with zero deviation", () => {
  const warnings = buildGrowthWarnings(
    [
      {
        ...baseRecord,
        id: "a",
        date: "2026-07-01",
        abilityDimension: "工程技术",
        workload: 50
      },
      {
        ...baseRecord,
        id: "b",
        date: "2026-07-01",
        abilityDimension: "知识沉淀",
        workload: 50
      }
    ] as any,
    {
      warningRules: {
        abilityNoRecordDays: 20,
        targetShareDeviationPercent: 0
      },
      abilityTargets: {
        工程技术: 50
      }
    },
    "2026-07-06"
  );

  assert.equal(warnings.some((warning) => warning.type === "target-gap" && warning.label === "工程技术"), false);
});

test("buildMonthlyReview enriches monthly narrative with milestones and knowledge assets", () => {
  const review = buildMonthlyReview(
    [
      {
        ...baseRecord,
        id: "a",
        projectName: "Alpha",
        abilityDimension: "工程技术",
        workload: 6,
        timeHours: 4
      },
      {
        ...baseRecord,
        id: "b",
        projectName: "Beta",
        abilityDimension: "知识沉淀",
        workload: 2,
        timeHours: 1
      }
    ] as any,
    [
      {
        id: "m1",
        name: "完成PHM方案",
        description: "",
        category: "项目推进",
        targetType: "工作当量",
        targetValue: 10,
        currentValue: 8,
        deadline: "2026-07-31",
        enabled: true,
        sortOrder: 10,
        createTime: 1,
        updateTime: 1
      }
    ],
    [
      {
        id: "k1",
        type: "方案模板",
        title: "PHM方案模板",
        summary: "沉淀PHM售前方案结构。",
        sourceRecordId: "",
        projectName: "Alpha",
        productSystem: "PHM",
        tags: "PHM,售前",
        status: "published",
        link: "",
        remark: "",
        createTime: 1,
        updateTime: 1
      }
    ]
  );

  assert.match(review.text, /本月共记录 2 条/);
  assert.match(review.text, /Alpha/);
  assert.match(review.text, /完成PHM方案/);
  assert.match(review.text, /PHM方案模板/);
});

test("summaries expose milestone progress and knowledge asset counts", () => {
  const milestones = summarizeMilestones([
    {
      id: "m1",
      name: "能力建设",
      description: "",
      category: "能力成长",
      targetType: "小时",
      targetValue: 20,
      currentValue: 5,
      deadline: "",
      enabled: true,
      sortOrder: 10,
      createTime: 1,
      updateTime: 1
    }
  ]);

  const assets = summarizeKnowledgeAssets([
    {
      id: "k1",
      type: "复盘",
      title: "调试复盘",
      summary: "",
      sourceRecordId: "",
      projectName: "",
      productSystem: "",
      tags: "",
      status: "draft",
      link: "",
      remark: "",
      createTime: 1,
      updateTime: 1
    }
  ]);

  assert.equal(milestones[0].progress, 25);
  assert.equal(assets.total, 1);
  assert.equal(assets.byStatus.draft, 1);
});
