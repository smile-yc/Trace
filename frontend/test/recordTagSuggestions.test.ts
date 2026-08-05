import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  appendRecordTag,
  getRecordTagSuggestions,
  parseRecordTags
} from "../src/lib/recordTagSuggestions.ts";
import type { WorkRecord } from "../src/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const recordFormSource = readFileSync(resolve(__dirname, "../src/components/RecordForm.tsx"), "utf8");
const dailyPageSource = readFileSync(resolve(__dirname, "../src/pages/DailyPage.tsx"), "utf8");
const stylesSource = readFileSync(resolve(__dirname, "../src/styles.css"), "utf8");

function record(id: string, projectId: string | null, tags: string, createTime: number): WorkRecord {
  return {
    id,
    date: "2026-08-05",
    title: id,
    content: "",
    category: "其他" as WorkRecord["category"],
    businessCategory: "",
    workType: "",
    abilityDimension: "",
    projectId,
    projectRelation: projectId ? "project" : "non_project",
    projectName: "",
    productSystem: "",
    subtask: "",
    quantity: null,
    coefficient: null,
    workload: null,
    timeHours: null,
    tags,
    workloadUnit: "",
    coefficientSource: "none",
    coefficientStandardId: null,
    coefficientStandardVersionId: null,
    workloadFormulaVersion: "quantity_x_coefficient_v1",
    abilityAllocations: [],
    createTime,
    updateTime: createTime
  };
}

test("record tag parsing supports common separators and removes duplicates", () => {
  assert.deepEqual(parseRecordTags("马东项目,辅助监控、DS10 辅助监控"), ["马东项目", "辅助监控", "DS10"]);
});

test("record tag suggestions prefer selected project history and exclude selected tags", () => {
  const suggestions = getRecordTagSuggestions([
    record("old-project", "p1", "辅助监控,DS10", 1),
    record("recent-general", null, "虚拟电厂,辅助监控", 5),
    record("other-project", "p2", "光伏,能管", 10)
  ], "p1", "DS10");

  assert.equal(suggestions[0].label, "辅助监控");
  assert.equal(suggestions[0].projectSpecific, true);
  assert.equal(suggestions.some((item) => item.label === "DS10"), false);
});

test("appending a record tag preserves free text and avoids duplicates", () => {
  assert.equal(appendRecordTag("马东项目,辅助监控", "DS10"), "马东项目,辅助监控,DS10");
  assert.equal(appendRecordTag("马东项目,辅助监控", "辅助监控"), "马东项目,辅助监控");
});

test("daily record form renders historical tag suggestion chips", () => {
  assert.match(dailyPageSource, /tagSuggestionRecords=\{records\}/);
  assert.match(recordFormSource, /tagSuggestionRecords/);
  assert.match(recordFormSource, /getRecordTagSuggestions/);
  assert.match(recordFormSource, /appendRecordTag/);
  assert.match(recordFormSource, /tag-suggestion-row/);
  assert.match(stylesSource, /\.tag-suggestion-row/);
  assert.match(stylesSource, /\.project-tag-suggestion/);
});
