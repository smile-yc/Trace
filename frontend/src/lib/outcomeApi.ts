import { API_BASE } from "../constants";
import type { Outcome, OutcomeInput, OutcomeStatus, OutcomeSummary, OutcomeType, OutcomeUpdateInput } from "../types";

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { message?: string }).message || "成果请求失败");
  return data as T;
}

export async function fetchOutcomes(filter: {
  type?: OutcomeType;
  status?: OutcomeStatus;
  projectId?: string;
  abilityId?: string;
  year?: string;
  query?: string;
  includeArchived?: boolean;
} = {}): Promise<{ outcomes: Outcome[]; summary: OutcomeSummary }> {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== false) params.set(key, String(value));
  });
  const response = await fetch(`${API_BASE}/api/outcomes${params.size ? `?${params}` : ""}`);
  return readJson(response);
}

export async function createOutcome(input: OutcomeInput): Promise<Outcome> {
  const response = await fetch(`${API_BASE}/api/outcomes`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input)
  });
  return (await readJson<{ outcome: Outcome }>(response)).outcome;
}

export async function updateOutcomeApi(id: string, input: OutcomeUpdateInput): Promise<Outcome> {
  const response = await fetch(`${API_BASE}/api/outcomes/${encodeURIComponent(id)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input)
  });
  return (await readJson<{ outcome: Outcome }>(response)).outcome;
}

async function postAction(id: string, action: "archive" | "reactivate"): Promise<Outcome> {
  const response = await fetch(`${API_BASE}/api/outcomes/${encodeURIComponent(id)}/${action}`, { method: "POST" });
  return (await readJson<{ outcome: Outcome }>(response)).outcome;
}

export const archiveOutcome = (id: string) => postAction(id, "archive");
export const reactivateOutcome = (id: string) => postAction(id, "reactivate");
