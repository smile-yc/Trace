import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(__dirname, "../src/styles.css"), "utf8");
const tokens = readFileSync(resolve(__dirname, "../src/styles/tokens.css"), "utf8");
const visualRefreshStyles = readFileSync(resolve(__dirname, "../src/styles/visual-refresh.css"), "utf8");
const main = readFileSync(resolve(__dirname, "../src/main.tsx"), "utf8");
const workOutcomesStyles = readFileSync(resolve(__dirname, "../src/styles/work-outcomes.css"), "utf8");
const reportDashboard = readFileSync(resolve(__dirname, "../src/components/ReportDashboard.tsx"), "utf8");

test("combo toggle styles do not leak into menu option buttons", () => {
  assert.equal(styles.includes(".combo-input-wrap button {"), false);
  assert.equal(styles.includes(".combo-input-wrap > button {"), true);
});

test("dashboard ledger uses the approved ink, teal, sage, and warm accent palette", () => {
  assert.equal(tokens.includes("--color-sidebar: #555243;"), true);
  assert.equal(tokens.includes("--color-brand: #4b7f8b;"), true);
  assert.equal(tokens.includes("--color-growth: #769377;"), true);
  assert.equal(tokens.includes("--color-accent-warm: #b29065;"), true);
  assert.equal(styles.includes(".app-shell {"), true);
  assert.match(styles, /\.app-shell \{[\s\S]*width: 100%;[\s\S]*min-height: 100vh;[\s\S]*margin: 0;/);
  assert.match(main, /import "\.\/styles\/settings-data\.css";\s*import "\.\/styles\/visual-refresh\.css";/);
  assert.match(reportDashboard, /const chartColors = \["#4b7f8b", "#769377", "#b29065", "#555243"/i);
  assert.doesNotMatch(reportDashboard, /#0c0c24|#f2764b|#7a3e8e/i);
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

test("ability focus summary stays readable on its neutral surface", () => {
  assert.match(styles, /\.ability-radar-card \.ability-focus-card \{[\s\S]*background: var\(--paper-muted\);[\s\S]*color: var\(--ink\);[\s\S]*box-shadow: var\(--shadow-soft\);/);
  assert.match(styles, /\.ability-radar-card \.ability-focus-icon \{[\s\S]*color: var\(--navy\);/);
  assert.match(styles, /\.ability-radar-card \.ability-focus-card span,[\s\S]*\.ability-radar-card \.ability-focus-card small \{[\s\S]*color: var\(--muted\);/);
  assert.match(styles, /\.ability-radar-card \.ability-focus-card strong,[\s\S]*\.ability-radar-card \.ability-focus-card em \{[\s\S]*color: var\(--ink\);/);
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
  assert.match(styles, /\.relation-bubble \{[\s\S]*border-radius: 50%;/);
});

test("dashboard uses independent vertical lanes without cross-card row gaps", () => {
  assert.match(visualRefreshStyles, /\.dashboard-masonry \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*align-items: start;/);
  assert.match(visualRefreshStyles, /\.dashboard-column \{[\s\S]*align-content: start;[\s\S]*gap: 14px;/);
  assert.match(visualRefreshStyles, /\.dashboard-column > \.dashboard-card \{[\s\S]*min-height: 0;[\s\S]*max-height: none;[\s\S]*overflow: visible;/);
  assert.match(visualRefreshStyles, /\.dashboard-column \.ability-radar-card \{[\s\S]*grid-column: auto;/);
  assert.match(visualRefreshStyles, /\.dashboard-column \.project-rank-list,[\s\S]*\.dashboard-column \.focus-rank-list \{[\s\S]*overflow: visible;/);
  assert.match(visualRefreshStyles, /\.trend-combo-chart \{[\s\S]*min-height: 250px;/);
  assert.match(visualRefreshStyles, /\.trend-combo-svg \{[\s\S]*min-width: 0;/);
  assert.match(visualRefreshStyles, /@media \(max-width: 900px\)[\s\S]*\.dashboard-masonry \{[\s\S]*grid-template-columns: 1fr;/);
  assert.match(visualRefreshStyles, /@media \(max-width: 900px\)[\s\S]*\.dashboard-column > \.dashboard-card \{[\s\S]*overflow: hidden;/);
  assert.match(visualRefreshStyles, /@media \(max-width: 900px\)[\s\S]*\.business-ability-coordinate \{[\s\S]*overflow-x: auto;/);
  assert.match(visualRefreshStyles, /@media \(max-width: 620px\)[\s\S]*\.trend-combo-svg \{[\s\S]*min-width: 680px;/);
});

test("report dashboard keeps trend full width and compacts sparse data cards", () => {
  assert.match(reportDashboard, /function densityClass\(count: number/);
  assert.match(reportDashboard, /<section className="dashboard-wide-row">[\s\S]*<TrendChart/);
  assert.match(reportDashboard, /const chartWidth = Math\.max\(760,/);
  assert.match(reportDashboard, /const chartHeight = 176;/);
  assert.match(reportDashboard, /business-donut-card \$\{densityClass\(items\.length\)\}/);
  assert.match(reportDashboard, /project-rank-card \$\{densityClass\(projects\.length\)\}/);
  assert.match(reportDashboard, /focus-rank-card \$\{densityClass\(items\.length\)\}/);
  assert.match(visualRefreshStyles, /\.dashboard-wide-row \{[\s\S]*margin-bottom: 14px;/);
  assert.match(visualRefreshStyles, /\.dashboard-wide-row \.trend-combo-chart \{[\s\S]*min-height: 176px;/);
  assert.match(visualRefreshStyles, /\.dashboard-card\.is-sparse \{[\s\S]*padding-bottom: 14px;/);
  assert.match(visualRefreshStyles, /\.dashboard-card\.is-empty \.empty-state \{[\s\S]*min-height: 72px;/);
});

test("ability focus decoration stays behind readable content", () => {
  assert.match(visualRefreshStyles, /\.ability-focus-card > :not\(\.ability-focus-wave\) \{[\s\S]*position: relative;[\s\S]*z-index: 1;/);
  assert.match(visualRefreshStyles, /\.ability-focus-wave \{[\s\S]*bottom: -34px;[\s\S]*z-index: 0;[\s\S]*opacity: 0\.28;[\s\S]*pointer-events: none;/);
});

test("ledger filters render as one compact segmented toolbar", () => {
  assert.match(visualRefreshStyles, /\.ledger-page \.ui-filter-bar \{[\s\S]*border: 1px solid var\(--color-border\);[\s\S]*background: var\(--color-surface\);/);
  assert.match(visualRefreshStyles, /\.ledger-page \.ui-filter-more \{[\s\S]*width: 100%;/);
  assert.match(visualRefreshStyles, /\.ledger-page \.ui-filter-controls \{[\s\S]*display: grid;[\s\S]*grid-template-columns: minmax\(110px, 0\.72fr\) minmax\(180px, 1fr\) minmax\(220px, 1\.3fr\) minmax\(130px, 0\.78fr\);/);
  assert.match(visualRefreshStyles, /\.ledger-page \.ledger-filter-grid \{[\s\S]*grid-template-columns: minmax\(130px, 0\.72fr\) minmax\(190px, 1fr\) minmax\(220px, 1\.25fr\) minmax\(150px, 0\.78fr\);/);
  assert.match(visualRefreshStyles, /\.ledger-page \.ledger-filter-field:focus-within,[\s\S]*\.ledger-page \.ledger-filter-grid label:focus-within \{[\s\S]*box-shadow: inset 0 -2px 0 var\(--color-brand\);/);
});

test("form controls share a themed surface and complete interaction states", () => {
  assert.match(visualRefreshStyles, /:is\(\.app-shell, \.ui-modal, \.ui-detail-panel, \.modal\) input:where\([\s\S]*:not\(\[type="checkbox"\]\)[\s\S]*:not\(\[type="radio"\]\)/);
  assert.doesNotMatch(visualRefreshStyles, /:not\(\[type="checkbox"\]\)\s+:not\(\[type="radio"\]\)/);
  assert.match(visualRefreshStyles, /:is\(\.app-shell, \.ui-modal, \.ui-detail-panel, \.modal\) select,[\s\S]*:is\(\.app-shell, \.ui-modal, \.ui-detail-panel, \.modal\) textarea \{[\s\S]*border-left: 3px solid var\(--color-control-accent\);[\s\S]*background: var\(--color-control\);[\s\S]*box-shadow: var\(--shadow-control\);/);
  assert.match(visualRefreshStyles, /:is\(\.app-shell, \.ui-modal, \.ui-detail-panel, \.modal\) \.ui-select-trigger,[\s\S]*:is\(\.app-shell, \.ui-modal, \.ui-detail-panel, \.modal\) \.ability-picker-trigger \{[\s\S]*background: var\(--color-control\);/);
  assert.match(visualRefreshStyles, /:is\(\.app-shell, \.ui-modal, \.ui-detail-panel, \.modal\) input:where\([\s\S]*:hover,[\s\S]*background: var\(--color-control-hover\);/);
  assert.match(visualRefreshStyles, /:is\(\.app-shell, \.ui-modal, \.ui-detail-panel, \.modal\) input:where\([\s\S]*:focus,[\s\S]*box-shadow: 0 0 0 3px rgba\(75, 127, 139, 0\.16\);/);
  assert.match(visualRefreshStyles, /:is\(\.app-shell, \.ui-modal, \.ui-detail-panel, \.modal\) input:where\([\s\S]*:disabled,[\s\S]*background: var\(--color-control-disabled\);/);
  assert.match(visualRefreshStyles, /\.ui-field\.has-error input,[\s\S]*\[aria-invalid="true"\] \{[\s\S]*border-left-color: var\(--color-danger\);/);
  assert.match(visualRefreshStyles, /\.ui-select-search input \{[\s\S]*border: 0;[\s\S]*box-shadow: none;/);
  assert.match(visualRefreshStyles, /input\[type="checkbox"\],[\s\S]*input\[type="radio"\] \{[\s\S]*width: 16px;[\s\S]*min-height: 16px;[\s\S]*accent-color: var\(--color-brand\);/);
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

test("report dashboard modules are balanced across two independent columns", () => {
  assert.match(
    reportDashboard,
    /<div className="dashboard-column dashboard-column-primary">[\s\S]*<BusinessCategoryDonut[\s\S]*<AbilityRadarChart[\s\S]*<ProductMatrix/
  );
  assert.match(
    reportDashboard,
    /<div className="dashboard-column dashboard-column-analysis">[\s\S]*<ProjectRank[\s\S]*<BusinessAbilityMatrix[\s\S]*<WorkTypeProfileChart/
  );
  assert.match(reportDashboard, /<section className="dashboard-grid mixed dashboard-masonry">/);
  assert.match(reportDashboard, /<section className="dashboard-bottom-row">[\s\S]*insight-card[\s\S]*<FocusRank/);
  assert.match(visualRefreshStyles, /\.dashboard-bottom-row \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*align-items: stretch;/);
  assert.match(visualRefreshStyles, /@media \(max-width: 900px\)[\s\S]*\.dashboard-bottom-row \{[\s\S]*grid-template-columns: 1fr;/);
});

test("dashboard metrics and chart groups can return to deduplicated source records", () => {
  assert.equal(reportDashboard.includes("function DashboardSourcePanel"), true);
  assert.equal(reportDashboard.includes("filterDashboardSourceRecords(records, sourceView.filter)"), true);
  assert.equal(reportDashboard.includes("dashboard-source-button"), true);
  assert.equal(reportDashboard.includes("一条多能力日报在来源列表中只出现一次"), true);
  assert.match(styles, /\.dashboard-source-list \{[\s\S]*display: grid;/);
  assert.match(styles, /\.dashboard-ledger button \{[\s\S]*text-align: left;/);
});

test("desktop sidebar stays fixed while workspace scrolls", () => {
  assert.match(styles, /\.app-shell \{[\s\S]*display: block;[\s\S]*overflow: visible;/);
  assert.match(styles, /\.sidebar \{[\s\S]*position: fixed;[\s\S]*height: 100vh;[\s\S]*overflow-y: auto;/);
  assert.match(styles, /\.workspace \{[\s\S]*width: calc\(100% - 226px\);[\s\S]*margin-left: 226px;/);
  assert.match(styles, /@media \(max-width: 980px\) \{[\s\S]*\.sidebar \{[\s\S]*position: static;/);
  assert.match(styles, /@media \(max-width: 980px\) \{[\s\S]*\.workspace \{[\s\S]*width: 100%;[\s\S]*margin-left: 0;/);
});

test("work ledger keeps stable desktop columns and usable mobile actions", () => {
  assert.match(workOutcomesStyles, /\.ledger-record-summary \{[\s\S]*grid-template-columns:[\s\S]*minmax\(220px, 1\.4fr\)/);
  assert.match(workOutcomesStyles, /\.ledger-record-actions button \{[\s\S]*min-width: var\(--touch-target\);[\s\S]*min-height: var\(--touch-target\);/);
  assert.match(workOutcomesStyles, /\.ledger-record-quality span \{[\s\S]*var\(--color-warning-soft\);[\s\S]*var\(--color-warning\);/);
  assert.match(workOutcomesStyles, /\.ledger-record-quality \.is-complete \{[\s\S]*var\(--color-success-soft\);[\s\S]*var\(--color-success\);/);
  assert.match(workOutcomesStyles, /@media \(max-width: 720px\) \{[\s\S]*\.ledger-record-summary \{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\);/);
});
