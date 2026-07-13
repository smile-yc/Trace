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
  assert.match(styles, /\.app-shell \{[\s\S]*width: 100%;[\s\S]*min-height: 100vh;[\s\S]*margin: 0;/);
});

test("global page chrome has no decorative outer background", () => {
  const bodyBlock = styles.match(/body \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(bodyBlock, /background: var\(--paper\);/);
  assert.equal(bodyBlock.includes("radial-gradient"), false);
  assert.equal(bodyBlock.includes("linear-gradient"), false);
  assert.match(styles, /\.app-shell \{[\s\S]*border: 0;[\s\S]*border-radius: 0;[\s\S]*box-shadow: none;/);
  assert.match(styles, /\.workspace \{[\s\S]*background: var\(--paper\);/);
});

test("report dashboard uses distinct proportion visualizations", () => {
  assert.equal(reportDashboard.includes("function BusinessCategoryDonut"), true);
  assert.equal(reportDashboard.includes("function AbilityRadarChart"), true);
  assert.equal(reportDashboard.includes("function WorkTypeProfileChart"), true);
  assert.equal(styles.includes(".business-donut-card"), true);
  assert.equal(styles.includes(".ability-radar-plot"), true);
  assert.equal(styles.includes(".segmented-donut-chart"), true);
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
  assert.equal(styles.includes("border-radius: 8px;"), true);
  assert.deepEqual(
    [...styles.matchAll(/border-radius:\s*(\d+)px/g)].map((match) => Number(match[1])).filter((radius) => radius > 8),
    []
  );
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
  assert.equal(styles.includes(".matrix-ability-label"), true);
  assert.equal(styles.includes(".worktype-metric-scroll"), true);
});

test("report dashboard includes business ability relation insight matrix", () => {
  assert.equal(reportDashboard.includes("function BusinessAbilityMatrix"), true);
  assert.equal(reportDashboard.includes("businessAbilityRelations"), true);
  assert.equal(styles.includes(".business-ability-card"), true);
  assert.equal(styles.includes(".business-ability-matrix"), true);
  assert.equal(styles.includes(".relation-bubble"), true);
});

test("dashboard rows use stable equal-height ranges with internal overflow", () => {
  assert.match(styles, /\.dashboard-row \{[\s\S]*--row-min-height:[\s\S]*align-items: stretch;/);
  assert.match(styles, /\.dashboard-row-three \{[\s\S]*--row-min-height: clamp\(/);
  assert.match(styles, /\.dashboard-row-ability \{[\s\S]*--row-min-height: clamp\(/);
  assert.match(styles, /\.dashboard-row-focus \{[\s\S]*--row-min-height: clamp\(/);
  assert.match(styles, /\.dashboard-row > \.dashboard-card \{[\s\S]*min-height: var\(--row-min-height\);[\s\S]*max-height: var\(--row-max-height\);[\s\S]*display: flex;/);
  assert.match(styles, /\.project-rank-list,[\s\S]*\.focus-rank-list \{[\s\S]*overflow-y: auto;/);
});

test("workload trend is workload bar plus time line without record count", () => {
  assert.equal(reportDashboard.includes("trend-bar-pair"), false);
  assert.equal(reportDashboard.includes("className=\"count\""), false);
  assert.equal(reportDashboard.includes("function getTrendTooltipPosition"), true);
  assert.equal(reportDashboard.includes("getBoundingClientRect"), true);
  assert.equal(reportDashboard.includes("trend-workload-bar"), true);
  assert.equal(reportDashboard.includes("trend-time-line"), true);
  assert.equal(reportDashboard.includes("trend-tooltip"), true);
  assert.equal(styles.includes(".trend-combo-chart"), true);
  assert.equal(styles.includes(".trend-legend .count"), false);
  assert.equal(styles.includes(".trend-bar-pair .count"), false);
});

test("ability dimension table uses the same aligned metric columns", () => {
  assert.equal(styles.includes("--ability-metric-columns: minmax(0, 1fr) minmax(72px, auto) minmax(58px, auto);"), true);
  assert.match(styles, /\.ability-radar-list-head,[\s\S]*\.ability-radar-row \{[\s\S]*grid-template-columns: var\(--ability-metric-columns\);/);
  assert.match(styles, /\.ability-radar-list-head span:nth-child\(2\),[\s\S]*\.ability-radar-list-head span:nth-child\(3\) \{[\s\S]*text-align: right;/);
});

test("business ability insight is a coordinate matrix with x and y axes", () => {
  assert.equal(reportDashboard.includes("business-ability-coordinate"), true);
  assert.equal(reportDashboard.includes("business-ability-axis-x"), true);
  assert.equal(reportDashboard.includes("business-ability-axis-y"), true);
  assert.equal(reportDashboard.includes("business-ability-gridline"), true);
  assert.equal(reportDashboard.includes("business-ability-matrix-scroll"), false);
  assert.equal(reportDashboard.includes("matrix-axis-footer"), false);
  assert.equal(reportDashboard.includes("matrix-ability-label"), true);
  assert.match(reportDashboard, /visibleAbilities\.map[\s\S]*matrix-ability-label/);
  assert.match(reportDashboard, /visibleBusinesses\.map[\s\S]*matrix-business-label/);
  assert.match(styles, /\.business-ability-card \{[\s\S]*--row-min-height: clamp\(/);
  assert.match(styles, /\.business-ability-matrix \{[\s\S]*grid-template-columns: minmax\(104px, 0.72fr\) repeat\(var\(--ability-count\), minmax\(86px, 1fr\)\);/);
  assert.equal(styles.includes(".business-ability-axis-x"), true);
  assert.equal(styles.includes(".business-ability-axis-y"), true);
});

test("business and work type proportions use segmented donut with leader labels", () => {
  assert.equal(reportDashboard.includes("function SegmentedDonutChart"), true);
  assert.equal(reportDashboard.includes("donut-segment-path"), true);
  assert.equal(reportDashboard.includes("donut-label-line"), true);
  assert.equal(reportDashboard.includes("donut-label-value"), true);
  assert.match(reportDashboard, /<SegmentedDonutChart[\s\S]*colors=\{businessColors\}/);
  assert.match(reportDashboard, /<SegmentedDonutChart[\s\S]*colors=\{workTypeColors\}/);
  assert.equal(styles.includes(".segmented-donut-chart"), true);
  assert.equal(styles.includes("stroke-linecap: round;"), true);
});

test("segmented donut external labels keep natural positions inside a padded chart viewport", () => {
  assert.equal(reportDashboard.includes('viewBox="0 -24 360 320"'), true);
  assert.equal(reportDashboard.includes("const lineEndY = clamp"), false);
  assert.equal(reportDashboard.includes("labelTextY: lineEnd.y - 4"), true);
  assert.equal(reportDashboard.includes("labelValueY: lineEnd.y + 18"), true);
  assert.equal(reportDashboard.includes('y={segment.labelTextY}'), true);
  assert.equal(reportDashboard.includes('y={segment.labelValueY}'), true);
});

test("report dashboard modules are grouped into four full-width rows", () => {
  assert.match(
    reportDashboard,
    /<div className="dashboard-row dashboard-row-three">[\s\S]*<BusinessCategoryDonut[\s\S]*<TrendChart[\s\S]*<ProjectRank/
  );
  assert.match(
    reportDashboard,
    /<div className="dashboard-row dashboard-row-two dashboard-row-ability">[\s\S]*<AbilityRadarChart[\s\S]*<BusinessAbilityMatrix/
  );
  assert.match(
    reportDashboard,
    /<div className="dashboard-row dashboard-row-two">[\s\S]*<WorkTypeProfileChart[\s\S]*<ProductMatrix/
  );
  assert.match(
    reportDashboard,
    /<div className="dashboard-row dashboard-row-two dashboard-row-focus">[\s\S]*<FocusRank[\s\S]*insight-card/
  );
  assert.match(styles, /\.dashboard-grid \{[\s\S]*grid-template-columns: 1fr;/);
  assert.match(styles, /\.dashboard-row-three \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(styles, /\.dashboard-row-two \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test("desktop sidebar stays fixed while workspace scrolls", () => {
  assert.match(styles, /\.app-shell \{[\s\S]*display: block;[\s\S]*overflow: visible;/);
  assert.match(styles, /\.sidebar \{[\s\S]*position: fixed;[\s\S]*height: 100vh;[\s\S]*overflow-y: auto;/);
  assert.match(styles, /\.workspace \{[\s\S]*width: calc\(100% - 226px\);[\s\S]*margin-left: 226px;/);
  assert.match(styles, /@media \(max-width: 980px\) \{[\s\S]*\.sidebar \{[\s\S]*position: static;/);
  assert.match(styles, /@media \(max-width: 980px\) \{[\s\S]*\.workspace \{[\s\S]*width: 100%;[\s\S]*margin-left: 0;/);
});
