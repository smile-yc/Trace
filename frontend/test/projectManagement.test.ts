import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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
