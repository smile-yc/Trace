import { API_BASE } from "../constants";
import type { WorkloadStandard, WorkloadStandardInput, WorkloadStandardUpdateInput } from "../types";

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

export async function fetchWorkloadStandards(): Promise<WorkloadStandard[]> {
  const response = await fetch(`${API_BASE}/api/workload-standards`);
  const data = await readJson<{ standards: WorkloadStandard[] }>(response);
  return data.standards;
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

export async function matchWorkloadStandard(input: {
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
  const response = await fetch(`${API_BASE}/api/workload-standards/match?${params.toString()}`);
  const data = await readJson<{ standard: WorkloadStandard | null }>(response);
  return data.standard;
}
