import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  filterArchivedRecords,
  filterKnowledgeRecordOptions,
  filterReportDetailRecords,
  getDefaultReportDetailPeriod
} from "../src/lib/recordFilters.ts";
import type { WorkRecord } from "../src/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const knowledgeSource = readFileSync(resolve(__dirname, "../src/pages/KnowledgePage.tsx"), "utf8");
const allRecordsSource = readFileSync(resolve(__dirname, "../src/pages/AllRecordsPage.tsx"), "utf8");
const monthlySource = readFileSync(resolve(__dirname, "../src/pages/MonthlyPage.tsx"), "utf8");
const yearlySource = readFileSync(resolve(__dirname, "../src/pages/YearlyPage.tsx"), "utf8");

function record(id: string, date: string, tags = "", createTime = 1): WorkRecord {
  return {
    id, date, tags, createTime, updateTime: createTime, title: id, content: "", category: "其他",
    businessCategory: "", workType: "", abilityDimension: "", projectName: "", productSystem: "",
    subtask: "", quantity: null, coefficient: null, workload: null, timeHours: null
  } as WorkRecord;
}

test("knowledge options default to latest 15 records", () => {
  const records = Array.from({ length: 20 }, (_, index) =>
    record(String(index), `2026-07-${String(index + 1).padStart(2, "0")}`, "", index)
  );
  const result = filterKnowledgeRecordOptions(records, { startDate: "", endDate: "", defaultLimit: 15 });
  assert.equal(result.length, 15);
  assert.equal(result[0].id, "19");
  assert.equal(result.at(-1)?.id, "5");
});

test("knowledge options support inclusive single and double date bounds without a limit", () => {
  const records = [record("a", "2026-07-01"), record("b", "2026-07-10", "", 2), record("c", "2026-07-20")];
  assert.deepEqual(filterKnowledgeRecordOptions(records, { startDate: "2026-07-10", endDate: "", defaultLimit: 1 }).map(({ id }) => id), ["c", "b"]);
  assert.deepEqual(filterKnowledgeRecordOptions(records, { startDate: "", endDate: "2026-07-10", defaultLimit: 1 }).map(({ id }) => id), ["b", "a"]);
  assert.deepEqual(filterKnowledgeRecordOptions(records, { startDate: "2026-07-01", endDate: "2026-07-20", defaultLimit: 1 }).map(({ id }) => id), ["c", "b", "a"]);
  assert.deepEqual(filterKnowledgeRecordOptions(records, { startDate: "2026-07-20", endDate: "2026-07-01", defaultLimit: 15 }), []);
});

test("archive filtering defaults to current week and supports explicit periods", () => {
  const records = [record("june", "2026-06-30"), record("mon", "2026-07-06"), record("sat", "2026-07-11"), record("next", "2026-07-13")];
  assert.deepEqual(filterArchivedRecords(records, { mode: null, period: "", selectedTag: null, today: "2026-07-11" }).map(({ id }) => id), ["sat", "mon"]);
  assert.deepEqual(filterArchivedRecords(records, { mode: "week", period: "2026-W28", selectedTag: null, today: "2026-07-11" }).map(({ id }) => id), ["sat", "mon"]);
  assert.deepEqual(filterArchivedRecords(records, { mode: "month", period: "2026-06", selectedTag: null, today: "2026-07-11" }).map(({ id }) => id), ["june"]);
  assert.deepEqual(filterArchivedRecords(records, { mode: "year", period: "2026", selectedTag: null, today: "2026-07-11" }).length, 4);
  assert.deepEqual(filterArchivedRecords(records, { mode: "month", period: "", selectedTag: null, today: "2026-07-11" }).map(({ id }) => id), ["sat", "mon"]);
});

test("tag-only filtering includes history and composes with an archive", () => {
  const records = [record("old", "2025-01-01", "alpha"), record("match", "2026-07-08", "alpha,beta"), record("other", "2026-07-09", "beta")];
  assert.deepEqual(filterArchivedRecords(records, { mode: null, period: "", selectedTag: "alpha", today: "2026-07-11" }).map(({ id }) => id), ["match", "old"]);
  assert.deepEqual(filterArchivedRecords(records, { mode: "month", period: "2026-07", selectedTag: "alpha", today: "2026-07-11" }).map(({ id }) => id), ["match"]);
});

test("report detail defaults use current periods and historical period starts", () => {
  assert.equal(getDefaultReportDetailPeriod("month", "2026-07", "week", "2026-07-11"), "2026-W28");
  assert.equal(getDefaultReportDetailPeriod("month", "2026-06", "week", "2026-07-11"), "2026-W23");
  assert.equal(getDefaultReportDetailPeriod("year", "2026", "week", "2026-07-11"), "2026-W28");
  assert.equal(getDefaultReportDetailPeriod("year", "2025", "week", "2026-07-11"), "2025-W01");
  assert.equal(getDefaultReportDetailPeriod("year", "2026", "month", "2026-07-11"), "2026-07");
  assert.equal(getDefaultReportDetailPeriod("year", "2025", "month", "2026-07-11"), "2025-01");
});

test("report detail filtering clips periods to report boundaries and falls back from empty input", () => {
  const records = [
    record("before-month", "2026-05-31"),
    record("month-start", "2026-06-01"),
    record("month-week", "2026-06-07"),
    record("after-week", "2026-06-08"),
    record("year-start", "2025-01-01"),
    record("previous-year", "2024-12-30")
  ];
  assert.deepEqual(
    filterReportDetailRecords(records, { start: "2026-06-01", end: "2026-06-30" }, "week", "2026-W23", "2026-W23").map(({ id }) => id),
    ["month-week", "month-start"]
  );
  assert.deepEqual(
    filterReportDetailRecords(records, { start: "2025-01-01", end: "2025-12-31" }, "week", "2025-W01", "2025-W01").map(({ id }) => id),
    ["year-start"]
  );
  assert.deepEqual(
    filterReportDetailRecords(records, { start: "2026-06-01", end: "2026-06-30" }, "week", "", "2026-W23").map(({ id }) => id),
    ["month-week", "month-start"]
  );
});

test("knowledge page renders date bounds and an empty linked-record state", () => {
  assert.equal(knowledgeSource.includes('type="date"'), true);
  assert.equal(knowledgeSource.includes("开始日期"), true);
  assert.equal(knowledgeSource.includes("结束日期"), true);
  assert.equal(knowledgeSource.includes("无匹配日报"), true);
  assert.equal(knowledgeSource.includes("defaultLimit: 15"), true);
});

test("all records page exposes archive modes and filters report generation scope", () => {
  assert.equal(allRecordsSource.includes('type="week"'), true);
  assert.equal(allRecordsSource.includes('type="month"'), true);
  assert.equal(allRecordsSource.includes("按年"), true);
  assert.equal(allRecordsSource.includes("filterArchivedRecords"), true);
  assert.match(allRecordsSource, /onGenerateReport\(visibleRecords/);
});

test("monthly page archives only raw details by week", () => {
  assert.equal(monthlySource.includes('type="week"'), true);
  assert.equal(monthlySource.includes("filterReportDetailRecords"), true);
  assert.match(monthlySource, /SummaryGroups groups=\{detailGroups\}/);
  assert.match(monthlySource, /onGenerateReport\(monthlyRecords/);
  assert.match(monthlySource, /records=\{monthlyRecords\}[\s\S]*periodType="month"/);
});

test("yearly page archives only raw details by week or month", () => {
  assert.equal(yearlySource.includes('value="week"'), true);
  assert.equal(yearlySource.includes('value="month"'), true);
  assert.equal(yearlySource.includes('type="week"'), true);
  assert.equal(yearlySource.includes('type="month"'), true);
  assert.match(yearlySource, /SummaryGroups groups=\{detailGroups\}/);
  assert.match(yearlySource, /onGenerateReport\(yearlyRecords/);
  assert.match(yearlySource, /records=\{yearlyRecords\}[\s\S]*periodType="year"/);
});
