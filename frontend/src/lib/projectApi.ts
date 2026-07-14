import { API_BASE } from "../constants";
import type {
  Project,
  ProjectInput,
  ProjectMergePreview,
  ProjectStatus,
  ProjectSummary,
  ProjectUpdateInput
} from "../types";

export interface ProjectFilter {
  query?: string;
  statuses?: ProjectStatus[];
  includeArchived?: boolean;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "请求失败";
    try {
      const body = await response.json();
      message = body.message || message;
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function projectUrl(id: string, suffix = ""): string {
  return `${API_BASE}/api/projects/${encodeURIComponent(id)}${suffix}`;
}

export async function fetchProjects(filter: ProjectFilter = {}): Promise<Project[]> {
  const params = new URLSearchParams();
  if (filter.query?.trim()) params.set("query", filter.query.trim());
  if (filter.statuses?.length) params.set("statuses", filter.statuses.join(","));
  if (filter.includeArchived) params.set("includeArchived", "true");
  const query = params.size ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE}/api/projects${query}`);
  const data = await readJson<{ projects: Project[] }>(response);
  return data.projects;
}

export async function fetchProject(id: string): Promise<Project> {
  const response = await fetch(projectUrl(id));
  const data = await readJson<{ project: Project }>(response);
  return data.project;
}

export async function fetchProjectSummary(id: string): Promise<ProjectSummary> {
  const response = await fetch(projectUrl(id, "/summary"));
  const data = await readJson<{ summary: ProjectSummary }>(response);
  return data.summary;
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const response = await fetch(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ project: Project }>(response);
  return data.project;
}

export async function updateProject(id: string, input: ProjectUpdateInput): Promise<Project> {
  const response = await fetch(projectUrl(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ project: Project }>(response);
  return data.project;
}

export async function archiveProject(id: string): Promise<Project> {
  const response = await fetch(projectUrl(id, "/archive"), { method: "POST" });
  const data = await readJson<{ project: Project }>(response);
  return data.project;
}

export async function reactivateProject(id: string): Promise<Project> {
  const response = await fetch(projectUrl(id, "/reactivate"), { method: "POST" });
  const data = await readJson<{ project: Project }>(response);
  return data.project;
}

export async function fetchProjectMergePreview(sourceId: string, targetId: string): Promise<ProjectMergePreview> {
  const response = await fetch(`${projectUrl(sourceId, "/merge-preview")}?targetId=${encodeURIComponent(targetId)}`);
  const data = await readJson<{ preview: ProjectMergePreview }>(response);
  return data.preview;
}

export async function mergeProjects(sourceId: string, targetId: string): Promise<Project> {
  const response = await fetch(projectUrl(sourceId, "/merge"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId })
  });
  const data = await readJson<{ project: Project }>(response);
  return data.project;
}
