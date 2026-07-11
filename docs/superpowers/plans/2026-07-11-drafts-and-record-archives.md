# Drafts and Record Archives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual daily-report drafts, date-filtered knowledge record linking, and composable week/month/year archive filtering.

**Architecture:** Put persistence and filtering rules in small pure-library modules, then keep React pages responsible for state, controls, and notifications. No backend schema or API changes are required.

**Tech Stack:** React 18, TypeScript 5.7, browser localStorage, Node test runner, Vite.

## Global Constraints

- Manual draft persistence only; typing must not write to storage.
- Unfiltered and untagged all-records view defaults to the current Monday-through-Sunday week.
- Knowledge record options default to the latest 15 records; date-filtered results are unlimited.
- Existing unrelated `.gitignore` changes must not be staged.

---

### Task 1: Daily report draft persistence

**Files:**
- Create: `frontend/src/lib/recordDraft.ts`
- Create: `frontend/test/recordDraft.test.ts`
- Modify: `frontend/src/components/RecordForm.tsx`
- Modify: `frontend/src/pages/DailyPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `RecordDraft`, `loadRecordDraft(storage)`, `saveRecordDraft(storage, draft)`, `clearRecordDraft(storage)`.
- Produces: optional `onNotify(message)` support on `DailyPage` and draft actions on new `RecordForm` instances.

- [ ] Write `recordDraft.test.ts` first with an in-memory `Storage` double and assertions that valid drafts round-trip, malformed JSON returns `null`, invalid shapes return `null`, and clear removes the fixed storage key.
- [ ] Add the new test path to the root `test` script and run `pnpm run test`; expect failure because `frontend/src/lib/recordDraft.ts` does not exist.
- [ ] Implement `RecordDraft` with string form values and safe storage helpers. Parsing must verify the object, version, and required string fields before returning a draft.
- [ ] Run `pnpm run test`; expect the draft tests and existing suite to pass.
- [ ] Extend `RecordForm` so new forms initialize from a loaded draft, “保存草稿” serializes current controlled values only when clicked, “清除草稿” removes storage and resets the form, and successful creation clears the saved draft. Editing forms must not load or mutate new-record drafts.
- [ ] Pass notification handling from `App` through `DailyPage` to `RecordForm`, and add source assertions verifying draft actions are wired only for new records.
- [ ] Run `pnpm run test`; expect all tests to pass.

### Task 2: Knowledge linked-record date filters

**Files:**
- Create: `frontend/src/lib/recordFilters.ts`
- Create: `frontend/test/recordFilters.test.ts`
- Modify: `frontend/src/pages/KnowledgePage.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `filterKnowledgeRecordOptions(records, { startDate, endDate, defaultLimit })`.
- Consumes: `WorkRecord` and `YYYY-MM-DD` local date keys.

- [ ] Write failing tests for default descending order and 15-item limit, start-only filtering, end-only filtering, inclusive two-sided filtering, unlimited filtered results, and an invalid reversed range returning an empty array.
- [ ] Add the test path to the root test script and run `pnpm run test`; expect failure because `filterKnowledgeRecordOptions` is missing.
- [ ] Implement the pure filter with `date` then `createTime` descending ordering and a limit only when both date bounds are empty.
- [ ] Run `pnpm run test`; expect the filter tests to pass.
- [ ] Replace `newestRecords` in `KnowledgePage` with start/end date state and the tested helper; render two date inputs before the linked-report select and a disabled “无匹配日报” option when empty.
- [ ] Add source-level assertions for the date controls and empty state, then run `pnpm run test`; expect all tests to pass.

### Task 3: All-record archive and tag composition

**Files:**
- Modify: `frontend/src/lib/recordFilters.ts`
- Modify: `frontend/test/recordFilters.test.ts`
- Modify: `frontend/src/pages/AllRecordsPage.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Produces: `ArchiveMode = "week" | "month" | "year" | null`, `getArchiveRange(mode, value)`, and `filterArchivedRecords(records, { mode, period, selectedTag, today })`.
- Consumes: existing `getWeekRange`, `getMonthRange`, `getYearRange`, `inRange`, and `splitTags` helpers.

- [ ] Write failing tests for current-week default, explicit week/month/year ranges, tag-only history, combined archive and tag filtering, and reset-state behavior.
- [ ] Run `pnpm run test`; expect failures because archive helpers are missing.
- [ ] Implement archive range conversion and filtering. When both archive mode and tag are absent, apply `getWeekRange(today)`; when only a tag is present, do not apply a date range.
- [ ] Run `pnpm run test`; expect archive tests to pass.
- [ ] Add archive-mode and period state to `AllRecordsPage`, render `week`, `month`, or year controls, combine them with tag selection, and add one clear-all action that restores the implicit current-week view. Keep report generation bound to `visibleRecords`.
- [ ] Add compact responsive styles for the filter controls and source assertions for the controls and report scope.
- [ ] Run `pnpm run test`; expect all tests to pass.

### Task 4: Full verification and synchronization

**Files:**
- Modify only files from Tasks 1-3 plus this plan.

**Interfaces:**
- Consumes: complete test suite and production build.
- Produces: one reviewed feature commit pushed to `origin/main`.

- [ ] Run `pnpm run test`; require exit code 0 and zero failures.
- [ ] Run `pnpm run build`; require exit code 0.
- [ ] Run `git diff --check`, inspect `git status -sb`, and confirm `.gitignore` remains unstaged.
- [ ] Stage only the plan, feature source, styles, tests, and `package.json`; commit with `feat: add drafts and record archive filters`.
- [ ] Pull/rebase only if needed, then push `main` to `origin` without force.
- [ ] Verify `git status -sb` shows only the pre-existing `.gitignore` modification and that local `main` matches `origin/main`.
