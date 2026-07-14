import type { ProjectStatus } from "../types.js";

export function normalizeProjectIdentity(value: string): string {
  return value.trim();
}

export function assertProjectDateRange(startDate = "", endDate = ""): void {
  if (startDate && endDate && endDate < startDate) {
    throw new Error("PROJECT_INVALID_DATE_RANGE");
  }
}

export function isProjectSelectable(project: {
  status: ProjectStatus;
  mergedIntoProjectId: string | null;
}): boolean {
  return project.mergedIntoProjectId === null;
}
