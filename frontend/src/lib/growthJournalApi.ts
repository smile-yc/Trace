import { API_BASE } from "../constants";
import type {
  CultivationReportDraft,
  CultivationReportInput,
  GrowthJournalActivityType,
  GrowthJournalEntry,
  GrowthJournalInput,
  GrowthJournalReportScope,
  GrowthJournalSourceContext,
  GrowthJournalUpdateInput
} from "../types";

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { message?: string }).message || "成长记录请求失败");
  return data as T;
}

export async function fetchGrowthJournalEntries(filter: {
  startDate?: string;
  endDate?: string;
  sourceContext?: GrowthJournalSourceContext | "";
  activityType?: GrowthJournalActivityType | "";
  abilityDimension?: string;
  reportScope?: GrowthJournalReportScope | "";
  query?: string;
} = {}): Promise<GrowthJournalEntry[]> {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  const response = await fetch(`${API_BASE}/api/growth-journal${params.size ? `?${params}` : ""}`);
  return (await readJson<{ entries: GrowthJournalEntry[] }>(response)).entries;
}

export async function createGrowthJournalEntry(input: GrowthJournalInput): Promise<GrowthJournalEntry> {
  const response = await fetch(`${API_BASE}/api/growth-journal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return (await readJson<{ entry: GrowthJournalEntry }>(response)).entry;
}

export async function updateGrowthJournalEntryApi(id: string, input: GrowthJournalUpdateInput): Promise<GrowthJournalEntry> {
  const response = await fetch(`${API_BASE}/api/growth-journal/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return (await readJson<{ entry: GrowthJournalEntry }>(response)).entry;
}

export async function deleteGrowthJournalEntryApi(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/growth-journal/${encodeURIComponent(id)}`, { method: "DELETE" });
  await readJson<{ ok: boolean }>(response);
}

export async function fetchCultivationReport(month: string): Promise<CultivationReportDraft | null> {
  const response = await fetch(`${API_BASE}/api/cultivation-reports/${encodeURIComponent(month)}`);
  return (await readJson<{ report: CultivationReportDraft | null }>(response)).report;
}

export async function saveCultivationReport(month: string, input: CultivationReportInput): Promise<CultivationReportDraft> {
  const response = await fetch(`${API_BASE}/api/cultivation-reports/${encodeURIComponent(month)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return (await readJson<{ report: CultivationReportDraft }>(response)).report;
}

export async function generateCultivationReportDraft(month: string): Promise<{
  report: CultivationReportDraft;
  draftText: string;
  previewOnly: boolean;
}> {
  const response = await fetch(`${API_BASE}/api/cultivation-reports/${encodeURIComponent(month)}/generate`, { method: "POST" });
  return readJson(response);
}
