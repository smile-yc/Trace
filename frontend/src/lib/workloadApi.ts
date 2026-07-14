import { API_BASE } from "../constants";
import type {
  WorkloadStandard,
  WorkloadStandardInput,
  WorkloadStandardMatch,
  WorkloadStandardUpdateInput,
  WorkloadStandardVersion
} from "../types";

export interface WorkloadStandardImportRow {
  rowNumber: number;
  status: "new" | "duplicate" | "conflict" | "invalid";
  businessCategory: string;
  workType: string;
  productSystem: string;
  subtask: string;
  unit: string;
  coefficient: number | null;
  remark: string;
}

export interface WorkloadStandardImportPreview {
  baseVersionId: string | null;
  duplicateKeyRowNumbers: number[];
  rows: WorkloadStandardImportRow[];
}

export interface BackupRestorePreview {
  manifest: { app: "Trace"; formatVersion: number; createdAt: string; tableCount: number };
  currentCounts: Record<string, number>;
  incomingCounts: Record<string, number>;
  tables: Array<{ name: string; currentRows: number; incomingRows: number; action: "replace" }>;
}

export interface YearArchivePreview {
  year: number;
  recordCount: number;
  outcomeCount: number;
  reportReviewCount: number;
}

export interface YearArchiveResult extends YearArchivePreview {
  filePath: string;
  createdAt: string;
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("FILE_READ_FAILED"));
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.readAsDataURL(blob);
  });
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

export async function previewWorkloadStandardImport(file: File): Promise<WorkloadStandardImportPreview> {
  const response = await fetch(`${API_BASE}/api/import/workload-standards/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workbookBase64: await blobToBase64(file) })
  });
  return (await readJson<{ preview: WorkloadStandardImportPreview }>(response)).preview;
}

export async function confirmWorkloadStandardImport(input: {
  name: string;
  year?: number | null;
  sourceName?: string;
  rows: WorkloadStandardImportRow[];
  conflictResolutions?: Record<string, "keep_system" | "use_imported">;
}): Promise<WorkloadStandardVersion> {
  const response = await fetch(`${API_BASE}/api/import/workload-standards/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return (await readJson<{ version: WorkloadStandardVersion }>(response)).version;
}

export async function downloadBackupPackage(): Promise<Blob> {
  const response = await fetch(`${API_BASE}/api/backup`);
  if (!response.ok) throw new Error(await response.text());
  return response.blob();
}

export async function previewBackupRestore(file: File): Promise<BackupRestorePreview> {
  const response = await fetch(`${API_BASE}/api/backup/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ backupBase64: await blobToBase64(file) })
  });
  return (await readJson<{ preview: BackupRestorePreview }>(response)).preview;
}

export async function restoreBackupPackage(file: File): Promise<{ restoredTables: string[]; restoredCounts: Record<string, number> }> {
  const response = await fetch(`${API_BASE}/api/backup/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ backupBase64: await blobToBase64(file) })
  });
  return (await readJson<{ result: { restoredTables: string[]; restoredCounts: Record<string, number> } }>(response)).result;
}

export async function previewYearArchive(year: number): Promise<YearArchivePreview> {
  const response = await fetch(`${API_BASE}/api/year-archives/${encodeURIComponent(String(year))}/preview`);
  return (await readJson<{ preview: YearArchivePreview }>(response)).preview;
}

export async function createYearArchive(year: number): Promise<YearArchiveResult> {
  const response = await fetch(`${API_BASE}/api/year-archives/${encodeURIComponent(String(year))}`, { method: "POST" });
  return (await readJson<{ archive: YearArchiveResult }>(response)).archive;
}
