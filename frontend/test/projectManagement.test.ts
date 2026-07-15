import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildProjectClosureSnapshot } from "../src/lib/projectClosure.ts";
import type { Project, ProjectSummary } from "../src/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSource(path: string): string {
  try {
    return readFileSync(resolve(__dirname, path), "utf8");
  } catch {
    return "";
  }
}

async function importSource<T>(path: string): Promise<Partial<T>> {
  try {
    return (await import(pathToFileURL(resolve(__dirname, path)).href)) as T;
  } catch {
    return {};
  }
}

const activeProject = {
  id: "project-active",
  name: "牵引系统专项",
  normalizedName: "牵引系统专项",
  shortName: "牵引",
  status: "active" as const,
  startDate: "2026-01-01",
  endDate: "",
  personalRole: "负责人",
  goal: "",
  description: "",
  completionSummary: "",
  aliases: ["GM1000"],
  mergedIntoProjectId: null,
  archiveTime: null,
  createTime: 1,
  updateTime: 1
};

const completedProject = {
  ...activeProject,
  id: "project-completed",
  name: "历史交付项目",
  normalizedName: "历史交付项目",
  shortName: "交付",
  status: "completed" as const,
  aliases: ["旧交付"]
};

const archivedProject = {
  ...activeProject,
  id: "project-archived",
  name: "历史归档项目",
  normalizedName: "历史归档项目",
  shortName: "归档",
  status: "archived" as const,
  aliases: ["历史"]
};

test("project options hide completed and archived rows until search", async () => {
  type PresentationModule = {
    toProjectSearchOptions: (projects: ReadonlyArray<typeof activeProject>) => ReadonlyArray<{
      value: string;
      label: string;
      keywords?: ReadonlyArray<string>;
      hiddenUntilSearch?: boolean;
    }>;
  };
  type SearchModule = {
    filterSearchOptions: <T extends { value: string; label: string; keywords?: ReadonlyArray<string>; hiddenUntilSearch?: boolean }>(
      options: ReadonlyArray<T>,
      query: string
    ) => ReadonlyArray<T>;
  };

  const presentation = await importSource<PresentationModule>("../src/lib/projectPresentation.ts");
  const search = await importSource<SearchModule>("../src/components/ui/searchOptions.ts");

  assert.equal(typeof presentation.toProjectSearchOptions, "function");
  assert.equal(typeof search.filterSearchOptions, "function");
  const options = presentation.toProjectSearchOptions!([activeProject, completedProject, archivedProject]);

  assert.deepEqual(search.filterSearchOptions!(options, "").map((item) => item.value), [activeProject.id]);
  assert.deepEqual(search.filterSearchOptions!(options, "历史").map((item) => item.value), [
    completedProject.id,
    archivedProject.id
  ]);
  assert.deepEqual(search.filterSearchOptions!(options, "GM1000").map((item) => item.value), [activeProject.id]);
});

test("project API module exposes every project lifecycle endpoint", () => {
  const source = readSource("../src/lib/projectApi.ts");

  for (const functionName of [
    "fetchProjects",
    "fetchProject",
    "fetchProjectSummary",
    "createProject",
    "updateProject",
    "archiveProject",
    "reactivateProject",
    "fetchProjectMergePreview",
    "mergeProjects"
  ]) {
    assert.match(source, new RegExp(`export async function ${functionName}\\b`));
  }

  for (const endpoint of [
    "/api/projects",
    "/summary",
    "/archive",
    "/reactivate",
    "/merge-preview",
    "/merge"
  ]) {
    assert.ok(source.includes(endpoint), `missing project endpoint ${endpoint}`);
  }
});

test("record form uses an explicit searchable project relation", () => {
  const fieldSource = readSource("../src/components/ProjectSelectField.tsx");
  const editorSource = readSource("../src/components/ProjectEditor.tsx");
  const formSource = readSource("../src/components/RecordForm.tsx");

  assert.match(fieldSource, /项目事项/);
  assert.match(fieldSource, /非项目事项/);
  assert.match(fieldSource, /<SearchSelect/);
  assert.match(fieldSource, /新建项目/);
  assert.match(editorSource, /status: "active"/);
  assert.match(editorSource, /项目名称/);
  assert.match(formSource, /fetchProjects/);
  assert.match(formSource, /ProjectSelectField/);
  assert.match(formSource, /projectRelation === "unassigned"/);
  assert.match(formSource, /projectId: projectRelation === "project" \? selectedProjectId : null/);
  assert.equal(formSource.includes("setProjectName"), false);
});

test("project management workspace exposes filters, lifecycle actions and detail evidence", () => {
  const pageSource = readSource("../src/pages/ProjectsPage.tsx");
  const mergeSource = readSource("../src/components/ProjectMergeDialog.tsx");
  const pagePackageSource = readSource("../src/navigation/corePagePackage.tsx");
  const navigationSource = readSource("../src/navigation/traceNavigation.ts");

  assert.match(pagePackageSource, /id: "projects"/);
  assert.match(navigationSource, /id: "projects"[\s\S]*pageId: "projects"/);
  assert.equal(
    navigationSource.includes('id: "projects", label: "项目管理", group: "工作", icon: FolderKanban, disabled: true'),
    false
  );

  for (const text of [
    "项目",
    "状态",
    "个人角色",
    "工时",
    "原始工作当量",
    "最近活跃",
    "当前重点",
    "关键词",
    "新建项目",
    "编辑",
    "归档",
    "恢复",
    "合并",
    "记录数",
    "活跃天数",
    "业务分类",
    "产品系统",
    "能力投入",
    "工作时间线",
    "尚无关联成果"
  ]) {
    assert.ok(pageSource.includes(text), `project page is missing ${text}`);
  }

  for (const apiName of [
    "fetchProjects",
    "fetchProjectSummary",
    "createProject",
    "updateProject",
    "archiveProject",
    "reactivateProject"
  ]) {
    assert.ok(pageSource.includes(apiName), `project page is missing ${apiName}`);
  }

  assert.match(pageSource, /\["planned", "active", "paused"\]/);
  assert.match(pageSource, /setSelectedProject\(null\);\s*setEditorProject\(selectedProject\)/);
  assert.match(pageSource, /setSelectedProject\(null\);\s*setMergeSourceId\(selectedProject\.id\)/);
  assert.match(mergeSource, /fetchProjectMergePreview/);
  assert.match(mergeSource, /mergeProjects/);
  assert.match(
    mergeSource,
    /合并后，来源项目的工作记录将关联到目标项目，历史项目名称快照保持不变。确认继续吗？/
  );
});

test("project closure snapshot keeps project totals and reports evidence gaps without judging value", () => {
  const project = { ...activeProject, endDate: "", completionSummary: "" } as Project;
  const summary = {
    recordCount: 2,
    activeDays: 2,
    timeHours: 10,
    workload: 12,
    records: [{ id: "r1" }, { id: "r2" }],
    outcomes: [
      {
        id: "o1", type: "deliverable", status: "completed", title: "交付成果", recordIds: ["r1"],
        reportSummary: "完成交付", valueImpact: "支撑验收", contribution: "负责实施"
      },
      {
        id: "o2", type: "problem_resolution", status: "stage_result", title: "问题解决", recordIds: ["outside"],
        reportSummary: "", valueImpact: "", contribution: ""
      }
    ],
    currentFocus: [], businessCategories: [], products: [], abilities: [], lastActiveDate: "2026-07-01"
  } as ProjectSummary;

  const snapshot = buildProjectClosureSnapshot(project, summary);

  assert.deepEqual(snapshot.metrics, { recordCount: 2, activeDays: 2, timeHours: 10, workload: 12, outcomeCount: 2, reportableOutcomeCount: 2 });
  assert.equal(snapshot.gaps.missingEndDate, true);
  assert.equal(snapshot.gaps.missingCompletionSummary, true);
  assert.equal(snapshot.gaps.missingSourceCount, 1);
  assert.equal(snapshot.gaps.missingReportSummaryCount, 1);
  assert.equal(snapshot.gaps.missingValueImpactCount, 1);
  assert.equal(snapshot.gaps.missingContributionCount, 1);
  assert.doesNotMatch(snapshot.reminders.join(" "), /价值低|效率低|投入不合理/);
});

test("project page exposes an explicit closure flow backed by existing project fields", () => {
  const pageSource = readSource("../src/pages/ProjectsPage.tsx");
  assert.match(pageSource, /项目结项/);
  assert.match(pageSource, /结项总结/);
  assert.match(pageSource, /completionSummary/);
  assert.match(pageSource, /status: "completed"/);
  assert.match(pageSource, /buildProjectClosureSnapshot/);
  assert.match(readSource("../src/components/ProjectEditor.tsx"), /label="结项总结"/);
});
