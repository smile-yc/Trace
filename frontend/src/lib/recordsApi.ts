import { API_BASE } from "../constants";
import type { RecordInput, WorkRecord } from "../types";

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

export async function fetchRecords(): Promise<WorkRecord[]> {
  const response = await fetch(`${API_BASE}/api/records`);
  const data = await readJson<{ records: WorkRecord[] }>(response);
  return data.records;
}

export async function createRecordApi(input: RecordInput): Promise<WorkRecord> {
  const response = await fetch(`${API_BASE}/api/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ record: WorkRecord }>(response);
  return data.record;
}

export async function updateRecordApi(id: string, input: RecordInput): Promise<WorkRecord> {
  const response = await fetch(`${API_BASE}/api/records/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ record: WorkRecord }>(response);
  return data.record;
}

export async function deleteRecordApi(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/records/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error((await response.text()) || "删除失败");
  }
}

export async function clearRecordsApi(): Promise<void> {
  const response = await fetch(`${API_BASE}/api/records`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error((await response.text()) || "清空失败");
  }
}
