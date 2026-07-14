import type { Project } from "../types";
import type { SearchOption } from "../components/ui/searchOptions";

export interface ProjectSearchOption extends SearchOption {
  project: Project;
}

export function toProjectSearchOptions(projects: ReadonlyArray<Project>): ProjectSearchOption[] {
  return projects.map((project) => ({
    value: project.id,
    label: project.name,
    keywords: [project.shortName, ...project.aliases].filter(Boolean),
    hiddenUntilSearch: project.status === "completed" || project.status === "archived",
    disabled: project.mergedIntoProjectId !== null,
    project
  }));
}
