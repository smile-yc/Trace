import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("growth journal and cultivation pages are registered in navigation", () => {
  const navigation = read("src/navigation/traceNavigation.ts");
  const pages = read("src/navigation/corePagePackage.tsx");

  assert.match(navigation, /growth-journal/);
  assert.match(navigation, /cultivation-report/);
  assert.match(pages, /GrowthJournalPage/);
  assert.match(pages, /CultivationReportPage/);
});

test("daily page exposes separate formal work and growth entry paths", () => {
  const daily = read("src/pages/DailyPage.tsx");

  assert.match(daily, /record-mode-switch/);
  assert.match(daily, /formal-work/);
  assert.match(daily, /growth-entry/);
  assert.match(daily, /onOpenGrowthJournal/);
});

test("growth journal page keeps quick capture separate from enrichment", () => {
  const page = read("src/pages/GrowthJournalPage.tsx");

  assert.match(page, /growth-journal-quick-form/);
  assert.match(page, /growth-journal-list/);
  assert.match(page, /growth-journal-enrichment/);
  assert.match(page, /createGrowthJournalEntry/);
  assert.match(page, /返回今日工作台/);
  assert.match(page, /onNavigatePage\("daily"\)/);
  assert.doesNotMatch(page, /日常 5-7 分钟内完成/);
});

test("cultivation report page uses evidence, structure and preview regions", () => {
  const page = read("src/pages/CultivationReportPage.tsx");

  assert.match(page, /cultivation-workspace/);
  assert.match(page, /cultivation-evidence-column/);
  assert.match(page, /cultivation-structure-column/);
  assert.match(page, /cultivation-preview-column/);
  assert.match(page, /cultivation-month-filter/);
  assert.match(page, /shiftMonthKey\(month, -1\)/);
  assert.match(page, /筛选月份/);
  assert.match(page, /evidence-group-stack/);
  assert.match(page, /renderEvidenceGroup/);
  assert.match(page, /className="evidence-list"/);
  assert.match(page, /cultivation-evidence-item/);
  assert.match(page, /cultivation-section/);
  assert.match(page, /support-request-grid/);
  assert.match(page, /generateCultivationReportDraft/);
});

test("growth and cultivation styles define restrained Trace palette", () => {
  const styles = read("src/styles/growth-journal.css");

  assert.match(styles, /--growth-accent:\s*#16A34A/i);
  assert.match(styles, /--cultivation-primary:\s*#2563EB/i);
  assert.match(styles, /--cultivation-warning:\s*#F59E0B/i);
  assert.match(styles, /\.module-key-project-practice/);
  assert.match(styles, /\.module-technical-learning/);
  assert.match(styles, /\.cultivation-evidence-item/);
  assert.match(styles, /\.evidence-tone-work::before/);
  assert.match(styles, /\.cultivation-month-filter/);
  assert.match(styles, /\.evidence-group-stack/);
  assert.match(styles, /\.evidence-list/);
  assert.match(styles, /overflow-y:\s*auto/);
  assert.match(styles, /max-height:\s*240px/);
  assert.match(styles, /\.support-request-grid\s*\{/);
  assert.match(styles, /\.cultivation-section\s*\{/);
  assert.doesNotMatch(styles, /\.module-key-project-practice\s*\{[^}]*color:\s*#1D4ED8/is);
});
