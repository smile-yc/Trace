import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildRecordCopyTemplate,
  getInitialOptionFieldValue,
  getPostSubmitCoefficientValue
} from "../src/lib/recordFormState.ts";
import type { WorkRecord } from "../src/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const recordFormSource = readFileSync(resolve(__dirname, "../src/components/RecordForm.tsx"), "utf8");
const dailyPageSource = readFileSync(resolve(__dirname, "../src/pages/DailyPage.tsx"), "utf8");
const recordListSource = readFileSync(resolve(__dirname, "../src/components/RecordList.tsx"), "utf8");

test("new record form leaves configurable fields empty until config defaults load", () => {
  assert.equal(getInitialOptionFieldValue(undefined), "");
  assert.equal(getInitialOptionFieldValue("传统业务"), "传统业务");
  assert.match(
    recordFormSource,
    /useState<BusinessCategory>\([\s\S]*getInitialOptionFieldValue\(formSource\?\.businessCategory \?\? savedDraft\?\.businessCategory\)[\s\S]*\)/
  );
  assert.equal(
    recordFormSource.includes("useState(getInitialOptionFieldValue(formSource?.workType ?? savedDraft?.workType))"),
    true
  );
});

test("new record reset keeps matched standard coefficient for continuous entry", () => {
  assert.equal(
    getPostSubmitCoefficientValue({ coefficientTouched: false, matchedCoefficient: 1.5 }),
    1.5
  );
  assert.equal(getPostSubmitCoefficientValue({ coefficientTouched: true, matchedCoefficient: 1.5 }), null);
  assert.equal(getPostSubmitCoefficientValue({ coefficientTouched: false, matchedCoefficient: null }), null);
  assert.equal(recordFormSource.includes("getPostSubmitCoefficientValue({"), true);
  assert.equal(recordFormSource.includes("setCoefficientTouched(false)"), true);
});

test("record copy template keeps reusable work fields without record identity or standard provenance", () => {
  const source: WorkRecord = {
    id: "record-1",
    date: "2026-07-14",
    title: "联调复测",
    content: "完成复测并记录结论",
    category: "工程调试",
    businessCategory: "传统业务",
    workType: "工程调试",
    abilityDimension: "技术能力,项目管理能力",
    projectId: "project-1",
    projectRelation: "project",
    projectName: "示例项目",
    productSystem: "信号系统",
    subtask: "现场调试",
    quantity: 2,
    coefficient: 1.5,
    workload: 3,
    timeHours: 4,
    tags: "联调,复测",
    workloadUnit: "项",
    coefficientSource: "standard_exact",
    coefficientStandardId: "standard-1",
    coefficientStandardVersionId: "standard-version-1",
    workloadFormulaVersion: "quantity_x_coefficient_v1",
    abilityAllocations: [
      { abilityId: "ability-1", abilityName: "技术能力", percentage: 60, allocatedTimeHours: 2.4, allocatedWorkload: 1.8 },
      { abilityId: "ability-2", abilityName: "项目管理能力", percentage: 40, allocatedTimeHours: 1.6, allocatedWorkload: 1.2 }
    ],
    createTime: 1,
    updateTime: 2
  };

  const template = buildRecordCopyTemplate(source, "2026-07-15");

  assert.equal(template.date, "2026-07-15");
  assert.equal(template.title, source.title);
  assert.deepEqual(template.abilityAllocations, [
    { abilityId: "ability-1", abilityName: "技术能力", percentage: 60 },
    { abilityId: "ability-2", abilityName: "项目管理能力", percentage: 40 }
  ]);
  assert.notEqual(template.abilityAllocations, source.abilityAllocations);
  assert.equal("id" in template, false);
  assert.equal("createTime" in template, false);
  assert.equal("coefficientStandardId" in template, false);
});

test("daily records expose copy-to-today as a create workflow", () => {
  assert.equal(dailyPageSource.includes("buildRecordCopyTemplate(record, targetDate)"), true);
  assert.equal(dailyPageSource.includes("template={copySource?.template}"), true);
  assert.equal(dailyPageSource.includes("onCopy={handleCopy}"), true);
  assert.equal(recordListSource.includes("onCopy?: (record: WorkRecord) => void"), true);
  assert.equal(recordListSource.includes("title=\"复制为新记录\""), true);
});
