import { API_BASE } from "../constants";
import type {
  WorkloadStandard,
  WorkloadStandardInput,
  WorkloadStandardMatch,
  WorkloadStandardUpdateInput,
  WorkloadStandardVersion
} from "../types";

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

async function readEmpty(response: Response): Promise<void> {
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
}

export async function fetchWorkloadStandards(versionId?: string): Promise<WorkloadStandard[]> {
  const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : "";
  const response = await fetch(`${API_BASE}/api/workload-standards${query}`);
  const data = await readJson<{ standards: WorkloadStandard[] }>(response);
  return data.standards;
}

export async function fetchWorkloadStandardVersions(): Promise<WorkloadStandardVersion[]> {
  const response = await fetch(`${API_BASE}/api/workload-standard-versions`);
  return (await readJson<{ versions: WorkloadStandardVersion[] }>(response)).versions;
}

export async function createWorkloadStandardVersion(input: {
  name: string;
  year?: number | null;
  sourceType?: "manual" | "excel";
  sourceName?: string;
}): Promise<WorkloadStandardVersion> {
  const response = await fetch(`${API_BASE}/api/workload-standard-versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return (await readJson<{ version: WorkloadStandardVersion }>(response)).version;
}

export async function activateWorkloadStandardVersion(id: string): Promise<WorkloadStandardVersion> {
  const response = await fetch(`${API_BASE}/api/workload-standard-versions/${encodeURIComponent(id)}/activate`, { method: "POST" });
  return (await readJson<{ version: WorkloadStandardVersion }>(response)).version;
}

export async function createWorkloadStandard(input: WorkloadStandardInput): Promise<WorkloadStandard> {
  const response = await fetch(`${API_BASE}/api/workload-standards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ standard: WorkloadStandard }>(response);
  return data.standard;
}

export async function updateWorkloadStandardApi(
  id: string,
  input: WorkloadStandardUpdateInput
): Promise<WorkloadStandard> {
  const response = await fetch(`${API_BASE}/api/workload-standards/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ standard: WorkloadStandard }>(response);
  return data.standard;
}

export async function deleteWorkloadStandardApi(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/workload-standards/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  await readEmpty(response);
}

export async function matchWorkloadStandard(input: {
  versionId?: string;
  businessCategory: string;
  workType: string;
  productSystem?: string;
  subtask?: string;
}): Promise<WorkloadStandard | null> {
  const params = new URLSearchParams({
    businessCategory: input.businessCategory,
    workType: input.workType,
    productSystem: input.productSystem ?? "",
    subtask: input.subtask ?? ""
  });
  if (input.versionId) params.set("versionId", input.versionId);
  const response = await fetch(`${API_BASE}/api/workload-standards/match?${params.toString()}`);
  const data = await readJson<{ standard?: WorkloadStandard | null; match?: WorkloadStandardMatch | null }>(response);
  return data.match?.standard ?? data.standard ?? null;
}

export async function matchWorkloadStandardWithProvenance(input: {
  versionId?: string;
  businessCategory: string;
  workType: string;
  productSystem?: string;
  subtask?: string;
}): Promise<WorkloadStandardMatch | null> {
  const params = new URLSearchParams({
    businessCategory: input.businessCategory,
    workType: input.workType,
    productSystem: input.productSystem ?? "",
    subtask: input.subtask ?? ""
  });
  if (input.versionId) params.set("versionId", input.versionId);
  const response = await fetch(`${API_BASE}/api/workload-standards/match?${params.toString()}`);
  return (await readJson<{ standard?: WorkloadStandard | null; match?: WorkloadStandardMatch | null }>(response)).match ?? null;
}
