# Report Detail Archives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Archive monthly raw details by week and yearly raw details by week or month without changing full-period report analytics.

**Architecture:** Add pure report-detail period helpers to the existing record filter module, then connect isolated archive state to MonthlyPage and YearlyPage. Only SummaryGroups receives filtered records; every report-level consumer retains the complete month or year record set.

**Tech Stack:** React 18, TypeScript 5.7, Node test runner, Vite.

## Global Constraints

- Monthly and yearly statistics, dashboards, reviews, exports, and generated reports keep their full-period scope.
- Current report periods default to the current week; historical month/year reports default to the week containing the first day.
- Year month mode defaults to the current month for the current year and January for historical years.
- Existing unrelated `.gitignore` changes remain unstaged.

---

### Task 1: Pure report-detail archive helpers

**Files:**
- Modify: `frontend/src/lib/recordFilters.ts`
- Modify: `frontend/test/recordFilters.test.ts`

**Interfaces:**
- Produces: `ReportDetailMode = "week" | "month"`, `getDefaultReportDetailPeriod(reportType, reportKey, mode, today)`, and `filterReportDetailRecords(records, reportRange, mode, period, fallbackPeriod)`.
- Consumes: `WorkRecord`, ISO week keys, month keys, and inclusive report ranges.

- [ ] Write failing tests for current-month current-week defaults, historical-month first-week defaults, current-year current-week/current-month defaults, historical-year first-week/January defaults, cross-boundary clipping, and empty-period fallback.
- [ ] Run `pnpm run test`; expect failure because report-detail helpers are missing.
- [ ] Implement default period selection, ISO week/month ranges, inclusive range intersection, descending date ordering, and fallback behavior.
- [ ] Run `pnpm run test`; expect all helper tests to pass.

### Task 2: Monthly raw-detail week archive

**Files:**
- Modify: `frontend/src/pages/MonthlyPage.tsx`
- Modify: `frontend/test/recordFilters.test.ts`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: Task 1 helpers and complete `monthlyRecords`.
- Produces: week archive state, filtered `detailRecords`, and date-grouped `detailGroups` used only by SummaryGroups.

- [ ] Add failing source assertions for a week input, default-period reset on month navigation, filtered detail count/range, and continued use of `monthlyRecords` by report generation and ExportPanel.
- [ ] Run `pnpm run test`; expect the monthly page assertions to fail.
- [ ] Implement week state derived from the selected month, reset it whenever month navigation changes the report date, and filter/clamp details to the month range.
- [ ] Render a compact week selector in the raw-detail panel and pass only filtered groups to SummaryGroups.
- [ ] Run `pnpm run test`; expect all monthly assertions to pass.

### Task 3: Yearly raw-detail week/month archive

**Files:**
- Modify: `frontend/src/pages/YearlyPage.tsx`
- Modify: `frontend/test/recordFilters.test.ts`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: Task 1 helpers and complete `yearlyRecords`.
- Produces: mode/period state and filtered date groups used only by SummaryGroups.

- [ ] Add failing source assertions for week/month mode controls, week and month inputs, year-navigation reset, filtered detail groups, and unchanged full-year report/export scope.
- [ ] Run `pnpm run test`; expect yearly page assertions to fail.
- [ ] Implement week/month archive state, current/historical defaults, year-boundary clipping, mode switching, and reset-to-week behavior when navigating years.
- [ ] Render compact archive controls and date-grouped filtered SummaryGroups output.
- [ ] Run `pnpm run test`; expect all tests to pass.

### Task 4: Verification and synchronization

**Files:**
- Modify only files listed in Tasks 1-3 plus this plan.

**Interfaces:**
- Produces: verified feature commit merged to local `main` and pushed to `origin/main`.

- [ ] Run `pnpm run test`; require zero failures.
- [ ] Run `pnpm run build`; require exit code 0.
- [ ] Run `git diff --check` and inspect the complete diff for report-scope regressions.
- [ ] Browser-test current and historical month/year defaults plus week/month switching.
- [ ] Stage only feature files and commit with `feat: archive monthly and yearly report details`.
- [ ] Fast-forward local `main`, rerun tests and build, push `origin/main`, and verify only the pre-existing `.gitignore` modification remains.
