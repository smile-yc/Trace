import { gzipSync, gunzipSync } from "node:zlib";
import {
  createDatabaseSnapshot,
  getDatabaseTableCounts,
  listBackupTableNames,
  restoreDatabaseSnapshot,
  type BackupTableName,
  type DatabaseSnapshot
} from "../database.js";

export interface BackupManifest {
  app: "Trace";
  formatVersion: 1;
  createdAt: string;
  tableCount: number;
}

export interface BackupPackage {
  manifest: BackupManifest;
  snapshot: DatabaseSnapshot;
}

export interface RestorePreviewTable {
  name: BackupTableName;
  currentRows: number;
  incomingRows: number;
  action: "replace";
}

export interface RestorePreview {
  manifest: BackupManifest;
  currentCounts: Record<BackupTableName, number>;
  incomingCounts: Record<BackupTableName, number>;
  tables: RestorePreviewTable[];
}

export interface RestoreResult {
  restoredTables: BackupTableName[];
  restoredCounts: Record<BackupTableName, number>;
}

function encodePackage(pkg: BackupPackage): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(pkg), "utf8"));
}

function decodePackage(buffer: Buffer): BackupPackage {
  try {
    const parsed = JSON.parse(gunzipSync(buffer).toString("utf8")) as BackupPackage;
    if (parsed.manifest?.app !== "Trace" || parsed.manifest.formatVersion !== 1 || parsed.snapshot?.schemaVersion !== 1) {
      throw new Error("BACKUP_INVALID");
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message === "BACKUP_INVALID") throw error;
    throw new Error("BACKUP_INVALID");
  }
}

export function createBackupPackage(): Buffer {
  const snapshot = createDatabaseSnapshot();
  return encodePackage({
    manifest: {
      app: "Trace",
      formatVersion: 1,
      createdAt: snapshot.createdAt,
      tableCount: snapshot.tables.length
    },
    snapshot
  });
}

export function previewRestorePackage(buffer: Buffer): RestorePreview {
  const pkg = decodePackage(buffer);
  const currentCounts = getDatabaseTableCounts();
  const incomingCounts = Object.fromEntries(
    pkg.snapshot.tables.map((table) => [table.name, table.rows.length])
  ) as Record<BackupTableName, number>;
  const tableNames = listBackupTableNames();

  return {
    manifest: pkg.manifest,
    currentCounts,
    incomingCounts,
    tables: tableNames.map((name) => ({
      name,
      currentRows: currentCounts[name],
      incomingRows: incomingCounts[name] ?? 0,
      action: "replace"
    }))
  };
}

export function restoreBackupPackage(buffer: Buffer): RestoreResult {
  const pkg = decodePackage(buffer);
  const restoredTables = restoreDatabaseSnapshot(pkg.snapshot);
  return {
    restoredTables,
    restoredCounts: getDatabaseTableCounts()
  };
}
