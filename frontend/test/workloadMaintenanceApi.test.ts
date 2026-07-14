import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("workload API exposes import backup restore and year archive endpoints", () => {
  const source = readFileSync(resolve(__dirname, "../src/lib/workloadApi.ts"), "utf8");

  assert.match(source, /previewWorkloadStandardImport/);
  assert.match(source, /confirmWorkloadStandardImport/);
  assert.match(source, /downloadBackupPackage/);
  assert.match(source, /previewBackupRestore/);
  assert.match(source, /restoreBackupPackage/);
  assert.match(source, /previewYearArchive/);
  assert.match(source, /createYearArchive/);
});

test("settings page contains a data maintenance panel", () => {
  const source = readFileSync(resolve(__dirname, "../src/pages/SettingsPage.tsx"), "utf8");

  assert.match(source, /maintenance/);
  assert.match(source, /handlePreviewStandardImport/);
  assert.match(source, /handleCreateYearArchive/);
});

test("settings data maintenance is integrated into the primary tab group", () => {
  const source = readFileSync(resolve(__dirname, "../src/pages/SettingsPage.tsx"), "utf8");

  assert.equal((source.match(/className="settings-tabs"/g) ?? []).length, 1);
  assert.match(source, /activePanel === "maintenance"[\s\S]*setActivePanel\("maintenance"\)/);
});
