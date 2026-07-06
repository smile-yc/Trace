# Ability Multi-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a work record select multiple ability dimensions while keeping the existing `abilityDimension` string field compatible.

**Architecture:** Store selected abilities as a normalized comma-separated string in `abilityDimension`. Add parsing helpers so analysis, warning, review, display, and export treat each selected ability as its own dimension.

**Tech Stack:** React, TypeScript, Express, SQLite, Node test runner.

## Global Constraints

- Do not change the SQLite column shape for this feature.
- Preserve existing single-value records.
- Use TDD for analytics behavior before UI changes.
- Keep current deletion-button worktree changes intact.

---

### Task 1: Multi-Ability Analytics

**Files:**
- Create: `frontend/src/lib/abilityDimensions.ts`
- Modify: `frontend/src/lib/analysis.ts`
- Modify: `frontend/src/lib/growthReview.ts`
- Test: `frontend/test/dashboard.test.ts`
- Test: `frontend/test/growthReview.test.ts`

**Interfaces:**
- Produces: `parseAbilityDimensions(value: string): string[]`
- Produces: `formatAbilityDimensions(values: string[]): string`

- [ ] Write failing tests for comma-separated ability distribution and warning matching.
- [ ] Run `pnpm test` and confirm the new tests fail.
- [ ] Implement parsing and multi-label grouping.
- [ ] Run `pnpm test` and confirm tests pass.

### Task 2: Record Form Multi-Select UI

**Files:**
- Modify: `frontend/src/components/RecordForm.tsx`
- Modify: `frontend/src/components/RecordList.tsx`
- Modify: `frontend/src/components/SummaryGroups.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `parseAbilityDimensions`
- Consumes: `formatAbilityDimensions`

- [ ] Replace the ability single combo with selectable ability chips and a custom ability input.
- [ ] Save selected abilities through existing `abilityDimension` field.
- [ ] Display selected abilities as separate chips in record lists and grouped summaries.
- [ ] Keep custom ability persistence through existing config-option draft logic.

### Task 3: Export Summary Compatibility

**Files:**
- Modify: `backend/src/exporters/analysis.ts`

**Interfaces:**
- Produces: multi-label ability summary for Word, PDF, and Excel exports.

- [ ] Split ability labels in export summaries.
- [ ] Run `pnpm run typecheck`.
- [ ] Run `pnpm run build`.

### Task 4: Verification

- [ ] Run `pnpm test`.
- [ ] Run `pnpm run typecheck`.
- [ ] Run `pnpm run build`.
- [ ] Run `git diff --check`.
