# Analysis Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing work report system from basic workload tracking to a first-stage analysis foundation with ability dimensions, time investment, and focus scoring.

**Architecture:** Extend the existing SQLite `records` and `config_options` model instead of introducing a new subsystem. Reuse the current React form, settings page, dashboard, and exporter patterns so historical records remain readable and new analytics are derived from the same record list.

**Tech Stack:** React + TypeScript + Vite frontend, Express + TypeScript backend, SQLite via `node:sqlite`, `node --test` for focused unit tests, existing `pnpm` scripts for typecheck/test.

## Global Constraints

- Keep changes scoped to the first analysis foundation slice: ability dimension, time hours, focus scoring, and export visibility.
- Preserve existing records through additive database migrations only.
- Keep disabled config options visible for historical records but unavailable as normal new-record choices.
- Use the current formula `workload = quantity * coefficient`; do not change workload semantics.
- Do not implement milestones, knowledge assets, authentication, or AI summaries in this slice.

---

### Task 1: Add Failing Tests For New Analysis Semantics

**Files:**
- Modify: `frontend/test/configOptionDrafts.test.ts`
- Create: `frontend/test/dashboard.test.ts`

**Interfaces:**
- Consumes: existing `configOptionDrafts` helpers and `analyzeRecords`.
- Produces: test expectations for `abilityDimension`, `timeHours`, ability distribution, and focus scores.

- [ ] Add a config draft test proving custom `abilityDimension` values default to persistence.
- [ ] Add dashboard tests for time totals, ability distribution, and weighted focus ranking.
- [ ] Run `pnpm test` and confirm the new tests fail before implementation.

### Task 2: Extend Backend Data Model And APIs

**Files:**
- Modify: `backend/src/types.ts`
- Modify: `backend/src/database.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Produces `WorkRecord.abilityDimension: string` and `WorkRecord.timeHours: number | null`.
- Produces `ConfigOptionType` including `"abilityDimension"`.

- [ ] Add additive SQLite columns `abilityDimension TEXT NOT NULL DEFAULT ''` and `timeHours REAL DEFAULT NULL`.
- [ ] Seed default ability dimensions in `config_options`.
- [ ] Accept and return both fields through record CRUD and export schemas.
- [ ] Include `abilityDimension` in the config option API enum.

### Task 3: Extend Frontend Types, Defaults, And Form

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/constants.ts`
- Modify: `frontend/src/components/RecordForm.tsx`
- Modify: `frontend/src/components/EditRecordModal.tsx`
- Modify: `frontend/src/components/RecordList.tsx`
- Modify: `frontend/src/components/SummaryGroups.tsx`

**Interfaces:**
- Consumes backend fields from Task 2.
- Produces UI entry and display for ability dimension and time hours.

- [ ] Add frontend type fields and default constants for ability dimensions.
- [ ] Add ability dimension to configurable option fields.
- [ ] Add time hours numeric input with decimal support.
- [ ] Preserve and submit the new fields when creating/editing records.
- [ ] Display ability/time metadata in record lists and summaries.

### Task 4: Extend Settings And Dashboard Analytics

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/lib/dashboard.ts`
- Modify: `frontend/src/components/ReportDashboard.tsx`

**Interfaces:**
- Produces dashboard analysis fields: `totalTimeHours`, `abilityDistribution`, and `focusRankings`.

- [ ] Add ability dimension to settings configuration groups.
- [ ] Calculate total time hours and ability distribution.
- [ ] Calculate focus ranking using workload 50%, time 30%, record count 20%.
- [ ] Add visible dashboard cards/sections for invested time, ability distribution, and focus ranking.

### Task 5: Extend Export Outputs

**Files:**
- Modify: `backend/src/exporters/analysis.ts`
- Modify: `backend/src/exporters/excel.ts`
- Modify: `backend/src/exporters/word.ts`
- Modify: `backend/src/exporters/pdf.ts`

**Interfaces:**
- Consumes new record fields and export analysis.
- Produces exported visibility for ability dimension and invested time.

- [ ] Add total time and ability summary to export analysis.
- [ ] Add ability dimension and invested time columns to Excel raw details.
- [ ] Add ability dimension summary sheet.
- [ ] Add time and ability summary lines to Word/PDF exports.

### Task 6: Update Documentation And Verify

**Files:**
- Modify: `README.md`
- Modify: `REQUIREMENTS.md` if implementation status needs updating.

**Interfaces:**
- Produces updated user-facing explanation of new first-stage analytics.

- [ ] Update README feature list and data model.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm run typecheck`.
- [ ] Inspect `git diff --stat` and summarize changed scope.
