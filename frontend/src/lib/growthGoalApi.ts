import { API_BASE } from "../constants";
import type { GrowthGoal, GrowthGoalInput, GrowthGoalUpdateInput } from "../types";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message || "目标请求失败");
  }
  return response.json() as Promise<T>;
}

export async function fetchGrowthGoals(includeArchived = false): Promise<GrowthGoal[]> {
  const response = await fetch(`${API_BASE}/api/growth-goals?includeArchived=${includeArchived}`);
  return (await readJson<{ goals: GrowthGoal[] }>(response)).goals;
}

export async function createGrowthGoal(input: GrowthGoalInput): Promise<GrowthGoal> {
  const response = await fetch(`${API_BASE}/api/growth-goals`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input)
  });
  return (await readJson<{ goal: GrowthGoal }>(response)).goal;
}

export async function updateGrowthGoal(id: string, input: GrowthGoalUpdateInput): Promise<GrowthGoal> {
  const response = await fetch(`${API_BASE}/api/growth-goals/${encodeURIComponent(id)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input)
  });
  return (await readJson<{ goal: GrowthGoal }>(response)).goal;
}
