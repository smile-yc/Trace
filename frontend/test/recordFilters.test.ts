import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { filterArchivedRecords, filterKnowledgeRecordOptions } from "../src/lib/recordFilters.ts";
import type { WorkRecord } from "../src/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const knowledgeSource = readFileSync(resolve(__dirname, "../src/pages/KnowledgePage.tsx"), "utf8");
const allRecordsSource = readFileSync(resolve(__dirname, "../src/pages/AllRecordsPage.tsx"), "utf8");

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
