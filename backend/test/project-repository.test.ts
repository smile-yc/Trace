import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-project-repository-"));
const dbPath = path.join(dataDir, "report.sqlite");
process.env.DATA_DIR = dataDir;
process.env.DB_PATH = dbPath;

const database = await import("../src/database.ts");

function recordInput(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-07-14",
    title: "项目关联记录",
    content: "",
    category: "其他",
    businessCategory: "传统业务",
    workType: "工程调试",
    abilityDimension: "工程技术",
    productSystem: "Trace",
    subtask: "项目实体化",
    quantity: 1,
    coefficient: 1,
    timeHours: 2,
    tags: "",
    ...overrides
  } as any;
}

test("project repository searches aliases and retains old names after rename", () => {
  const project = database.insertProject({
    name: "Trace",
    shortName: "TR",
    personalRole: "负责人",
    aliases: ["工作复盘系统"]
  });

  assert.equal(database.listProjects({ query: "复盘" })[0]?.id, project.id);
  assert.equal(database.listProjects({ query: "TR" })[0]?.id, project.id);

  const renamed = database.updateProject(project.id, { name: "Trace 个人工作系统" });
  assert.equal(renamed?.name, "Trace 个人工作系统");
  assert.deepEqual(renamed?.aliases.slice().sort(), ["Trace", "工作复盘系统"].sort());
  assert.equal(database.listProjects({ query: "Trace" })[0]?.id, project.id);
});

test("project repository rejects identity and date conflicts", () => {
  assert.throws(() => database.insertProject({ name: "Trace" }), /PROJECT_ALIAS_CONFLICT/);
  assert.throws(
    () => database.insertProject({ name: "日期错误", startDate: "2026-07-20", endDate: "2026-07-19" }),
    /PROJECT_INVALID_DATE_RANGE/
  );

  const other = database.insertProject({ name: "另一个项目" });
  assert.throws(() => database.updateProject(other.id, { shortName: "TR" }), /PROJECT_ALIAS_CONFLICT/);
});

test("project repository archives, filters and reactivates projects", () => {
  const project = database.insertProject({ name: "归档项目", status: "planned" });
  const archived = database.archiveProject(project.id);

  assert.equal(archived?.status, "archived");
  assert.ok(archived?.archiveTime);
  assert.equal(database.listProjects().some((item) => item.id === project.id), false);
  assert.equal(database.listProjects({ query: "归档项目" })[0]?.id, project.id);
  assert.equal(database.reactivateProject(project.id)?.status, "active");

  const direct = new DatabaseSync(dbPath);
  direct.prepare("UPDATE projects SET status = 'archived', mergedIntoProjectId = ? WHERE id = ?")
    .run(database.listProjects()[0].id, project.id);
  direct.close();
  assert.throws(() => database.reactivateProject(project.id), /PROJECT_NOT_SELECTABLE/);
});

test("records snapshot linked projects and require an explicit relation", () => {
  const project = database.insertProject({ name: "快照项目" });
  const linked = database.insertRecord(recordInput({ projectId: project.id, projectRelation: "project" }));

  assert.equal(linked.projectId, project.id);
  assert.equal(linked.projectRelation, "project");
  assert.equal(linked.projectName, "快照项目");

  database.updateProject(project.id, { name: "快照项目新名称" });
  assert.equal(database.getRecord(linked.id)?.projectName, "快照项目");

  const nonProject = database.insertRecord(recordInput({ projectId: null, projectRelation: "non_project" }));
  assert.equal(nonProject.projectId, null);
  assert.equal(nonProject.projectRelation, "non_project");
  assert.equal(nonProject.projectName, "");

  assert.throws(
    () => database.insertRecord(recordInput({ projectId: null, projectRelation: "project" })),
    /PROJECT_RELATION_INVALID/
  );
  assert.throws(
    () => database.insertRecord(recordInput({ projectId: null, projectRelation: "unassigned" })),
    /PROJECT_RELATION_INVALID/
  );
});

test("project summaries aggregate original metrics and merges preserve name snapshots", () => {
  const source = database.insertProject({ name: "合并来源", shortName: "来源", aliases: ["旧来源"] });
  const target = database.insertProject({ name: "合并目标" });
  const sourceRecordA = database.insertRecord(recordInput({
    title: "来源 A",
    date: "2026-07-12",
    projectId: source.id,
    projectRelation: "project",
    workType: "工程调试",
    businessCategory: "传统业务",
    productSystem: "Trace",
    quantity: 2,
    coefficient: 2,
    timeHours: 3
  }));
  database.insertRecord(recordInput({
    title: "来源 B",
    date: "2026-07-13",
    projectId: source.id,
    projectRelation: "project",
    workType: "问题处理",
    businessCategory: "三新业务",
    productSystem: "GM1000",
    quantity: 2,
    coefficient: 2,
    timeHours: 2
  }));
  database.insertRecord(recordInput({
    title: "目标记录",
    date: "2026-07-14",
    projectId: target.id,
    projectRelation: "project",
    quantity: 1,
    coefficient: 1,
    timeHours: 1
  }));

  const summary = database.getProjectSummary(source.id);
  assert.equal(summary?.recordCount, 2);
  assert.equal(summary?.activeDays, 2);
  assert.equal(summary?.timeHours, 5);
  assert.equal(summary?.workload, 8);
  assert.deepEqual(summary?.records.map((record) => record.title), ["来源 B", "来源 A"]);

  const preview = database.getProjectMergePreview(source.id, target.id);
  assert.equal(preview?.recordCount, 2);
  assert.equal(preview?.timeHours, 5);
  assert.equal(preview?.workload, 8);

  const mergedTarget = database.mergeProjects(source.id, target.id);
  assert.equal(database.getProject(source.id)?.mergedIntoProjectId, target.id);
  assert.equal(database.getProject(source.id)?.status, "archived");
  assert.equal(database.listRecords().filter((record) => record.projectId === target.id).length, 3);
  assert.equal(database.getRecord(sourceRecordA.id)?.projectName, "合并来源");
  assert.ok(mergedTarget.aliases.includes("合并来源"));
  assert.ok(mergedTarget.aliases.includes("来源"));
  assert.ok(mergedTarget.aliases.includes("旧来源"));
});

test("project merge rolls back when transferred aliases conflict", () => {
  const source = database.insertProject({ name: "回滚来源" });
  const target = database.insertProject({ name: "回滚目标" });
  const third = database.insertProject({ name: "占用名称" });
  const record = database.insertRecord(recordInput({ projectId: source.id, projectRelation: "project" }));
  const direct = new DatabaseSync(dbPath);
  direct.prepare(`INSERT INTO project_aliases (id, projectId, alias, normalizedAlias, createTime)
    VALUES ('forced-conflict', ?, ?, ?, 1)`).run(source.id, third.name, third.name);
  direct.close();

  assert.throws(() => database.mergeProjects(source.id, target.id), /PROJECT_ALIAS_CONFLICT/);
  assert.equal(database.getRecord(record.id)?.projectId, source.id);
  assert.equal(database.getProject(source.id)?.mergedIntoProjectId, null);
});
