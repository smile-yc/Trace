import type { WorkRecord } from "../types";

export function buildJsonBackup(records: WorkRecord[]): string {
  return JSON.stringify(
    {
      version: 2,
      storage: "sqlite",
      exportedAt: new Date().toISOString(),
      total: records.length,
      records
    },
    null,
    2
  );
}
