import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(__dirname, "../src/styles.css"), "utf8");
const reportDashboard = readFileSync(resolve(__dirname, "../src/components/ReportDashboard.tsx"), "utf8");

test("combo toggle styles do not leak into menu option buttons", () => {
  assert.equal(styles.includes(".combo-input-wrap button {"), false);
  assert.equal(styles.includes(".combo-input-wrap > button {"), true);
});

test("dashboard ledger palette and shell tokens are present", () => {
  assert.equal(styles.includes("--bg: #f5f7fb;"), true);
  assert.equal(styles.includes("--ink: #0b1026;"), true);
  assert.equal(styles.includes("--navy: #101638;"), true);
  assert.equal(styles.includes("--purple: #6f4ed8;"), true);
  assert.equal(styles.includes("--cyan: #20b8c5;"), true);
  assert.equal(styles.includes("--orange: #f2764b;"), true);
  assert.equal(styles.includes("--green: #4ca66a;"), true);
  assert.equal(styles.includes(".app-shell {"), true);
  assert.equal(styles.includes("width: min(1480px, calc(100vw - 48px));"), true);
});

test("report dashboard uses distinct proportion visualizations", () => {
  assert.equal(reportDashboard.includes("function BusinessCategoryDonut"), true);
  assert.equal(reportDashboard.includes("function AbilityRadarChart"), true);
  assert.equal(reportDashboard.includes("function WorkTypeProfileChart"), true);
  assert.equal(styles.includes(".business-donut-card"), true);
  assert.equal(styles.includes(".ability-radar-plot"), true);
  assert.equal(styles.includes(".worktype-donut-chart"), true);
});

test("report dashboard proportion cards expose refined detail layouts", () => {
  assert.equal(styles.includes(".business-insight-card"), true);
  assert.equal(reportDashboard.includes("business-legend-meta"), true);
  assert.equal(styles.includes(".ability-focus-card"), true);
  assert.equal(styles.includes(".ability-radar-list"), true);
  assert.equal(styles.includes(".worktype-type-cards"), true);
  assert.equal(styles.includes(".worktype-metric-list"), true);
});

test("report dashboard follows BI visual requirements", () => {
  assert.equal(reportDashboard.includes("visibleItems = items.slice(0, maxVisibleItems)"), true);
  assert.equal(reportDashboard.includes("Top ${visibleItems.length}"), true);
  assert.equal(styles.includes("border-radius: 16px;"), true);
  assert.match(styles, /\.business-insight-card \{[\s\S]*var\(--navy\);/);
  assert.equal(styles.includes(".business-legend-meta"), true);
});

test("report dashboard dense proportion cards stay bounded and readable", () => {
  assert.match(styles, /\.ability-radar-layout \{[\s\S]*grid-template-columns: minmax\(210px, 0.72fr\) minmax\(320px, 1fr\) minmax\(280px, 0.96fr\);/);
  assert.match(styles, /\.worktype-profile-main \{[\s\S]*grid-template-columns: minmax\(220px, 0.82fr\) minmax\(280px, 1fr\);/);
  assert.equal(styles.includes(".dashboard-grid.mixed"), true);
  assert.equal(styles.includes("writing-mode: vertical-rl"), false);
  assert.equal(styles.includes("transform: rotate(180deg)"), false);
  assert.equal(styles.includes(".heading-icon"), true);
  assert.equal(styles.includes(".matrix-axis-footer"), true);
  assert.equal(styles.includes(".worktype-metric-scroll"), true);
});

test("report dashboard includes business ability relation insight matrix", () => {
  assert.equal(reportDashboard.includes("function BusinessAbilityMatrix"), true);
  assert.equal(reportDashboard.includes("businessAbilityRelations"), true);
  assert.equal(styles.includes(".business-ability-card"), true);
  assert.equal(styles.includes(".business-ability-matrix"), true);
  assert.equal(styles.includes(".relation-bubble"), true);
});
