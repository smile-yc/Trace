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
