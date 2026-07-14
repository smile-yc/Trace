import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-outcome-repository-"));
process.env.DATA_DIR = dataDir;
process.env.DB_PATH = path.join(dataDir, "report.sqlite");

const database = await import("../src/database.ts");

function createRecord(projectId: string, title: string, timeHours: number, quantity: number) {
  return database.insertRecord({
    date: "2026-07-14",
    title,
    content: `${title}内容`,
    category: "其他",
    businessCategory: "传统业务",
    workType: "工程调试",
    abilityDimension: "工程技术",
    projectId,
    projectRelation: "project",
    productSystem: "Trace",
    subtask: "成果关联",
    quantity,
    coefficient: 2,
    timeHours,
    tags: "关键"
  });
}

test("outcomes link multiple records, track status and deduplicate shared input", () => {
  const project = database.insertProject({ name: "成果项目" });
  const first = createRecord(project.id, "记录一", 3, 2);
  const second = createRecord(project.id, "记录二", 4, 3);
  const milestone = database.insertMilestone({ name: "阶段目标" });

  const outcome = database.insertOutcome({
    type: "problem_resolution",
    status: "in_progress",
    title: "解决关键问题",
    projectId: project.id,
    startDate: "2026-07-01",
    updateDate: "2026-07-14",
    backgroundGoal: "恢复稳定运行",
    completedWork: "定位并修复根因",
    valueImpact: "减少重复故障",
    personalRole: "负责人",
    contribution: "完成分析和验证",
    reportSummary: "完成关键故障闭环",
    productSystem: "Trace",
    tags: "关键,稳定性",
    recordIds: [first.id, second.id],
    abilities: [{ abilityId: "engineering", abilityName: "工程技术" }],
    milestoneIds: [milestone.id]
  });

  assert.equal(outcome.projectName, "成果项目");
  assert.equal(outcome.recordCount, 2);
  assert.equal(outcome.timeHours, 7);
  assert.equal(outcome.workload, 10);
  assert.deepEqual(outcome.recordIds, [first.id, second.id]);
  assert.deepEqual(outcome.records.map((record: { title: string }) => record.title), ["记录一", "记录二"]);
  assert.deepEqual(outcome.milestones.map((item: { name: string }) => item.name), ["阶段目标"]);
  assert.equal(outcome.statusHistory.length, 1);
  assert.equal(outcome.statusHistory[0].toStatus, "in_progress");

  const completed = database.updateOutcome(outcome.id, {
    status: "completed",
    completedDate: "2026-07-14",
    statusNote: "验证完成"
  });
  assert.equal(completed?.status, "completed");
  assert.equal(completed?.statusHistory.length, 2);
  assert.equal(completed?.statusHistory[1].note, "验证完成");

  database.insertOutcome({
    type: "reusable_asset",
    title: "故障排查清单",
    status: "stage_result",
    recordIds: [first.id]
  });
  const summary = database.summarizeOutcomes(database.listOutcomes());
  assert.equal(summary.outcomeCount, 2);
  assert.equal(summary.recordCount, 2);
  assert.equal(summary.timeHours, 7);
  assert.equal(summary.workload, 10);

  const projectSummary = database.getProjectSummary(project.id);
  assert.equal(projectSummary?.outcomes.length, 1);
  assert.equal(projectSummary?.outcomes[0].id, outcome.id);
});

test("project merges move outcome identity while retaining its name snapshot", () => {
  const source = database.insertProject({ name: "成果来源项目" });
  const target = database.insertProject({ name: "成果目标项目" });
  const outcome = database.insertOutcome({ type: "deliverable", title: "交付成果", projectId: source.id });

  database.mergeProjects(source.id, target.id);
  const merged = database.getOutcome(outcome.id);
  assert.equal(merged?.projectId, target.id);
  assert.equal(merged?.projectName, "成果来源项目");
});

test("outcome relation validation is atomic", () => {
  const before = database.listOutcomes().length;
  assert.throws(
    () => database.insertOutcome({ type: "deliverable", title: "无效成果", recordIds: ["missing-record"] }),
    /OUTCOME_RELATION_INVALID/
  );
  assert.equal(database.listOutcomes().length, before);
});
