# Growth Review Phase Two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add second-stage growth review capabilities: configurable focus scoring, warnings, monthly review text, milestones, knowledge assets, and richer yearly exports.

**Architecture:** Keep the current single-user SQLite + Express + React architecture. Add small backend tables for app settings, milestones, and knowledge assets; keep advanced analytics as pure frontend/backend helper functions so they are testable and reusable by pages and exporters.

**Tech Stack:** React + TypeScript + Vite frontend, Express + TypeScript backend, SQLite via `node:sqlite`, `node --test` for focused logic tests, existing `pnpm` scripts for typecheck/build.

## Global Constraints

- Keep this as an MVP second phase: no authentication, no file uploads, no AI summary service, no rich text editor.
- Preserve existing data using additive SQLite migrations only.
- Workload remains `quantity * coefficient`.
- Default focus weights are workload 50%, time 30%, record count 20%, but user can configure them.
- Default warning rules are ability no-record days 30 and target share deviation 10%.
- Knowledge assets are lightweight records with title, summary, status, link, and source record reference.

---

### Task 1: Test Growth Review Logic

**Files:**
- Modify: `frontend/test/dashboard.test.ts`
- Create: `frontend/test/growthReview.test.ts`

**Interfaces:**
- Produces expectations for configurable focus weights, warning generation, monthly review text, milestone progress, and knowledge asset summaries.

- [ ] Add tests for configurable focus weights.
- [ ] Add tests for ability no-record and target-share warnings.
- [ ] Add tests for monthly review text generated from records, milestones, and assets.
- [ ] Run `pnpm test` and confirm new tests fail before implementation.

### Task 2: Backend Settings, Milestones, And Knowledge Assets

**Files:**
- Modify: `backend/src/types.ts`
- Modify: `backend/src/database.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Produces `AppSettings`, `Milestone`, and `KnowledgeAsset` API types.
- Produces REST endpoints under `/api/settings`, `/api/milestones`, and `/api/knowledge-assets`.

- [ ] Add `app_settings`, `milestones`, and `knowledge_assets` tables.
- [ ] Seed default settings for focus weights and warning rules.
- [ ] Add CRUD helpers for milestones and knowledge assets.
- [ ] Add Express routes for list/create/update APIs.
- [ ] Include milestones and knowledge assets in export payloads.

### Task 3: Frontend APIs And Shared Growth Logic

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/lib/settingsApi.ts`
- Create: `frontend/src/lib/milestoneApi.ts`
- Create: `frontend/src/lib/knowledgeApi.ts`
- Create: `frontend/src/lib/growthReview.ts`
- Modify: `frontend/src/lib/analysis.ts`

**Interfaces:**
- Produces reusable functions `analyzeRecords(records, settings?)`, `buildGrowthWarnings`, `buildMonthlyReview`, `summarizeMilestones`, and `summarizeKnowledgeAssets`.

- [ ] Add frontend types for settings, milestones, knowledge assets, warnings, and monthly review.
- [ ] Add API clients for settings, milestones, and knowledge assets.
- [ ] Make focus ranking use configurable weights.
- [ ] Implement warning and review text helpers.

### Task 4: Settings, Growth Map, And Knowledge Pages

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Create: `frontend/src/pages/GrowthPage.tsx`
- Create: `frontend/src/pages/KnowledgePage.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Produces user-facing pages for milestone management and knowledge asset management.
- Adds settings controls for focus weights and warning thresholds.

- [ ] Add sidebar entries for growth map and knowledge assets.
- [ ] Add settings controls for focus weights and warning rules.
- [ ] Add growth map page with create/edit/enable milestone workflow and progress cards.
- [ ] Add knowledge asset page with create/edit/status/link workflow and filters.

### Task 5: Monthly, Yearly, And Export Enhancements

**Files:**
- Modify: `frontend/src/pages/MonthlyPage.tsx`
- Modify: `frontend/src/pages/YearlyPage.tsx`
- Modify: `backend/src/exporters/analysis.ts`
- Modify: `backend/src/exporters/excel.ts`
- Modify: `backend/src/exporters/word.ts`
- Modify: `backend/src/exporters/pdf.ts`

**Interfaces:**
- Monthly page shows review text and warnings.
- Yearly page shows milestone and knowledge summaries.
- Exports include focus weights, warnings, ability analysis, milestones, and knowledge assets.

- [ ] Show monthly review text and warning list.
- [ ] Show yearly milestone and knowledge asset summary.
- [ ] Add Excel sheets for milestones and knowledge assets.
- [ ] Add Word/PDF sections for growth review, warnings, milestones, and assets.

### Task 6: Documentation, Verification, Commit

**Files:**
- Modify: `README.md`
- Modify: `REQUIREMENTS.md`

**Interfaces:**
- Produces updated documentation and a clean commit.

- [ ] Update docs with second-stage capabilities.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm run typecheck`.
- [ ] Run `pnpm run build`.
- [ ] Commit as `feat: add growth review phase two`.
