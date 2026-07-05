import { API_BASE } from "../constants";
import type { ExportFormat, ExportOptions, WorkRecord } from "../types";
import { downloadBlob, sanitizeFileName } from "./download";

const contentType = "application/json";

export async function exportOffice(
  format: ExportFormat,
  title: string,
  records: WorkRecord[],
  options: ExportOptions = {}
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/export/${format}`, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: JSON.stringify({ title, records, scope: options.scope })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "导出失败");
  }

  const blob = await response.blob();
  downloadBlob(blob, `${sanitizeFileName(title)}.${format}`);
}
