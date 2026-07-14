# Excel Import And Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Stage 6 by making Trace able to import yearly workload standards from Excel, create complete backup packages, preview restore impact, and archive years without deleting source data.

**Architecture:** Keep workload-standard parsing in `backend/src/core/workloadStandardImport.ts`. Add backup and archive logic as focused backend modules, expose small API routes, then add compact Settings entry points. Existing annual exports keep original and temporary adjusted workload separated.

**Tech Stack:** React/Vite, Express, SQLite, ExcelJS, Node built-in `fs`, `path`, `zlib`, `node:test`.

## Global Constraints

- Do not push to GitHub in this stage.
- Traditional business workload is not discounted automatically.
- Yearly workload adjustment is export-preview only and must not write records.
- Failed Excel import must not create a partial standard version.
- Restore preview must show impact before any overwrite.
- Year archive must not delete records or outcomes.

---

### Task 1: Excel Standard Import Hardening

**Files:**
- Modify: `backend/src/core/workloadStandardImport.ts`
- Test: `backend/test/data-foundation.test.ts`

**Interfaces:**
- Produces `parseWorkloadStandardWorkbook(buffer): Promise<ParsedWorkloadStandardRow[]>` that accepts real workbook sheet/header variants and row offsets.

- [x] Write parser tests for sheet-name aliases, skipped title rows, percentage coefficients, and row-level invalid values.
- [x] Run targeted tests and verify GREEN because existing implementation already covers this behavior.

### Task 2: Backup Package And Restore Preview

**Files:**
- Create: `backend/src/core/backup.ts`
- Modify: `backend/src/database.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/test/backup.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `createBackupPackage(): Buffer`, `previewRestorePackage(buffer): RestorePreview`, `restoreBackupPackage(buffer): RestoreResult`.
- API: `GET /api/backup`, `POST /api/backup/preview`, `POST /api/backup/restore`.

- [ ] Write failing tests for backup manifest, restore preview counts, and restore replacement.
- [ ] Run targeted tests and verify RED.
- [ ] Implement backup module and API routes.
- [ ] Run targeted tests and verify GREEN.

### Task 3: Year Archive Without Deletion

**Files:**
- Create: `backend/src/core/yearArchive.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/test/year-archive.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `previewYearArchive(year): YearArchivePreview`, `createYearArchive(year): YearArchiveResult`.
- API: `GET /api/year-archives/:year/preview`, `POST /api/year-archives/:year`.

- [ ] Write failing tests proving archive files are created and database records remain.
- [ ] Run targeted tests and verify RED.
- [ ] Implement year archive module and API routes.
- [ ] Run targeted tests and verify GREEN.

### Task 4: Settings Entry Points And Final Verification

**Files:**
- Modify: `frontend/src/lib/workloadApi.ts`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `README.md`, `PROJECT_ARCHITECTURE.md`, `REQUIREMENTS.md`

**Interfaces:**
- Settings page can upload standards, download backup, preview restore, restore after confirmation, and create a year archive.

- [ ] Add focused frontend API helpers and Settings controls.
- [ ] Run `pnpm run test`.
- [ ] Run `pnpm run build`.
- [ ] Smoke test backup and import endpoints.
