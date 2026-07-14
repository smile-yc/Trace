import { API_BASE } from "../constants";
import type { Milestone, MilestoneInput, MilestoneUpdateInput } from "../types";

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

export async function fetchMilestones(): Promise<Milestone[]> {
  const response = await fetch(`${API_BASE}/api/milestones`);
  const data = await readJson<{ milestones: Milestone[] }>(response);
  return data.milestones;
}

export async function createMilestone(input: MilestoneInput): Promise<Milestone> {
  const response = await fetch(`${API_BASE}/api/milestones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ milestone: Milestone }>(response);
  return data.milestone;
}

export async function updateMilestoneApi(id: string, input: MilestoneUpdateInput): Promise<Milestone> {
  const response = await fetch(`${API_BASE}/api/milestones/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ milestone: Milestone }>(response);
  return data.milestone;
}

export async function correctMilestoneProgress(id: string, value: number, reason: string): Promise<Milestone> {
  const response = await fetch(`${API_BASE}/api/milestones/${encodeURIComponent(id)}/correction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value, reason })
  });
  const data = await readJson<{ milestone: Milestone }>(response);
  return data.milestone;
}

export async function toggleMilestoneStage(id: string, stageId: string, completed: boolean): Promise<Milestone> {
  const response = await fetch(`${API_BASE}/api/milestones/${encodeURIComponent(id)}/stages/${encodeURIComponent(stageId)}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed })
  });
  const data = await readJson<{ milestone: Milestone }>(response);
  return data.milestone;
}
