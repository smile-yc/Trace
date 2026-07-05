export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadText(content: string, fileName: string, type = "application/json"): void {
  downloadBlob(new Blob([content], { type: `${type};charset=utf-8` }), fileName);
}

export function sanitizeFileName(value: string): string {
  return (value.trim() || "工作报告").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}
