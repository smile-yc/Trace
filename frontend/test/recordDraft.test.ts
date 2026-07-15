import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  clearRecordDraft,
  loadRecordDraft,
  saveRecordDraft,
  type RecordDraft,
  type StorageLike
} from "../src/lib/recordDraft.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(resolve(__dirname, "../src/components/RecordForm.tsx"), "utf8");

function memoryStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key)
  };
}

const draft: RecordDraft = {
  version: 2,
  date: "2026-07-11",
  title: "日报草稿",
  businessCategory: "业务",
  workType: "开发",
  abilityDimension: "分析",
  projectName: "Trace",
  projectId: "project-trace",
  projectRelation: "project",
  productSystem: "日报系统",
  subtask: "筛选",
  quantity: "2",
  coefficient: "1.5",
  workload: "3",
  timeHours: "2.5",
  tags: "功能",
  content: "实现草稿"
};

test("record draft round-trips through storage", () => {
  const storage = memoryStorage();
  saveRecordDraft(storage, draft);
  assert.deepEqual(loadRecordDraft(storage), draft);
});

test("record draft loader ignores malformed and incompatible data", () => {
  const storage = memoryStorage();
  storage.setItem("trace:daily-record-draft", "{");
  assert.equal(loadRecordDraft(storage), null);

  storage.setItem("trace:daily-record-draft", JSON.stringify({ ...draft, version: 3 }));
  assert.equal(loadRecordDraft(storage), null);

  storage.setItem("trace:daily-record-draft", JSON.stringify({ ...draft, title: 3 }));
  assert.equal(loadRecordDraft(storage), null);
});

test("version one drafts upgrade to an explicit unassigned project relation", () => {
  const storage = memoryStorage();
  const { projectId: _projectId, projectRelation: _projectRelation, ...versionTwoFields } = draft;
  const versionOneDraft = { ...versionTwoFields, version: 1 as const };

  storage.setItem("trace:daily-record-draft", JSON.stringify(versionOneDraft));

  assert.deepEqual(loadRecordDraft(storage), {
    ...versionOneDraft,
    version: 2,
    projectId: "",
    projectRelation: "unassigned"
  });
});

test("record draft can be cleared", () => {
  const storage = memoryStorage();
  saveRecordDraft(storage, draft);
  clearRecordDraft(storage);
  assert.equal(loadRecordDraft(storage), null);
});

test("new record form exposes manual draft actions and clears after submit", () => {
  assert.equal(formSource.includes("保存草稿"), true);
  assert.equal(formSource.includes("清除草稿"), true);
  assert.match(formSource, /savedDraft = !formSource[\s\S]*loadRecordDraft/);
  assert.match(formSource, /await onSubmit\([\s\S]*clearRecordDraft/);
  assert.match(formSource, /projectId: projectRelation === "project" \? selectedProjectId : null/);
  assert.match(formSource, /projectRelation/);
});
