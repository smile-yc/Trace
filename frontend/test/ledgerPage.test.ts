import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSource(path: string): string {
  try {
    return readFileSync(resolve(__dirname, path), "utf8");
  } catch {
    return "";
  }
}

test("ledger page exposes long-term filters, quality actions and scoped batch workflows", () => {
  const page = readSource("../src/pages/AllRecordsPage.tsx");

  for (const text of [
    "当前周", "指定周", "指定月", "指定年", "自定义日期",
    "关键词", "项目", "业务分类", "工作类型", "产品", "子任务", "能力",
    "系数来源", "成果状态", "标签", "数据质量", "手动系数",
    "缺少项目", "缺少能力", "缺少工时", "缺少系数", "缺少工作内容",
    "疑似重复分类", "疑似重复项目", "选择当前范围", "提炼为成果", "生成报告"
  ]) {
    assert.ok(page.includes(text), `ledger page is missing ${text}`);
  }

  for (const symbol of [
    "filterLedgerRecords", "summarizeLedger", "analyzeLedgerQuality",
    "reconcileLedgerSelection", "buildLedgerOutcomeSeed", "fetchProjects", "fetchOutcomes", "LedgerRecordList"
  ]) {
    assert.ok(page.includes(symbol), `ledger page is missing ${symbol}`);
  }

  assert.match(page, /selectedRecords\.length \? selectedRecords : visibleRecords/);
  assert.match(page, /onCreateOutcome\(buildLedgerOutcomeSeed\(selectedRecords\)\)/);
  assert.match(page, /setFilters\(.*qualityCode/s);
});

test("compact ledger list supports selection, expansion, edit and impact-aware deletion", () => {
  const component = readSource("../src/components/LedgerRecordList.tsx");

  for (const text of ["aria-label=\"选择记录", "展开详情", "能力分配", "系数来源", "标准版本", "更新时间", "onEdit", "onDelete"]) {
    assert.ok(component.includes(text), `ledger list is missing ${text}`);
  }
  assert.match(component, /ledger-record-row/);
  assert.match(component, /selectedIds\.has\(record\.id\)/);
  assert.match(component, /expandedIds\.has\(record\.id\)/);
});

test("record deletion asks the impact endpoint before confirmation", () => {
  const api = readSource("../src/lib/recordImpactApi.ts");
  const app = readSource("../src/App.tsx");

  assert.match(api, /export async function fetchRecordDeleteImpact/);
  assert.match(api, /\/api\/records\/\$\{encodeURIComponent\(id\)\}\/impact/);
  assert.match(app, /await fetchRecordDeleteImpact\(record\.id\)/);
  assert.match(app, /formatRecordDeleteImpact\(impact\)/);
  assert.match(app, /window\.confirm/);
});

test("ledger relation indexes refresh whenever the retained page becomes active again", () => {
  const page = readSource("../src/pages/AllRecordsPage.tsx");
  const pagePackage = readSource("../src/navigation/corePagePackage.tsx");
  const context = readSource("../src/navigation/appPageContext.ts");
  const app = readSource("../src/App.tsx");

  assert.match(context, /activePageId: string/);
  assert.match(app, /activePageId: activePage\.id/);
  assert.match(pagePackage, /active=\{context\.activePageId === "all"\}/);
  assert.match(page, /active: boolean/);
  assert.match(page, /if \(!active\) return/);
  assert.match(page, /\}, \[active, records\.length\]\)/);
});
