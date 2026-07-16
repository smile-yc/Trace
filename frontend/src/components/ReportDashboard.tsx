import {
  Activity,
  BriefcaseBusiness,
  CalendarCheck,
  Clock3,
  GitBranch,
  Layers3,
  ListFilter,
  PieChart,
  Radar,
  Sparkles,
  Trophy,
  Workflow,
  X,
  type LucideIcon
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import type { AppSettings, WorkRecord } from "../types";
import {
  analyzeRecords,
  filterDashboardSourceRecords,
  sumTimeHours,
  sumWorkload,
  type BusinessAbilityRelationItem,
  type DashboardSourceFilter,
  type DistributionItem,
  type ProjectSummary,
  type TrendPoint
} from "../lib/dashboard";
import { DEFAULT_APP_SETTINGS, fetchSettings } from "../lib/settingsApi";
import { formatDate } from "../lib/date";

interface ReportDashboardProps {
  records: WorkRecord[];
  trend: TrendPoint[];
  activeLabel: string;
}

const chartColors = ["#4b7f8b", "#769377", "#b29065", "#555243", "#6f8f98", "#8a765c"];
const businessColors = ["#555243", "#4b7f8b", "#769377", "#b29065", "#6f8f98", "#8a765c"];
const abilityColors = ["#4b7f8b", "#769377", "#b29065", "#555243", "#6f8f98", "#8a765c"];
const workTypeColors = ["#4b7f8b", "#b29065", "#769377", "#555243", "#6f8f98", "#8a765c"];

interface ChartPoint {
  x: number;
  y: number;
}

interface TrendTooltipState {
  point: TrendPoint;
  x: number;
  y: number;
}

interface DashboardSourceView {
  title: string;
  description: string;
  filter: DashboardSourceFilter;
}

type OpenDashboardSource = (title: string, filter: DashboardSourceFilter, description?: string) => void;

function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function metricValue(item: Pick<DistributionItem, "count" | "workload">): number {
  return item.workload > 0 ? item.workload : item.count;
}

function chartTotal(items: DistributionItem[]): number {
  return items.reduce((total, item) => total + metricValue(item), 0);
}

function percentOf(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function splitLabel(label: string, chunkSize = 5): string[] {
  if (label.length <= chunkSize) return [label];
  return [label.slice(0, chunkSize), label.slice(chunkSize)];
}

function polarPoint(cx: number, cy: number, radius: number, angle: number): ChartPoint {
  const radians = (Math.PI / 180) * angle;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function toPolyline(points: ChartPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function getTrendTooltipPosition(event: ReactMouseEvent<SVGElement>): { x: number; y: number } {
  const chart = event.currentTarget.closest(".trend-combo-chart");
  const rect = chart?.getBoundingClientRect();

  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }

  const xPadding = Math.min(78, Math.max(40, rect.width / 2 - 8));
  const yPadding = Math.min(72, Math.max(42, rect.height / 2 - 8));

  return {
    x: clamp(event.clientX - rect.left, xPadding, Math.max(xPadding, rect.width - xPadding)),
    y: clamp(event.clientY - rect.top, yPadding, Math.max(yPadding, rect.height - 12))
  };
}

function roundedArcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function SegmentedDonutChart({
  ariaLabel,
  centerLabel,
  className = "",
  colors,
  items
}: {
  ariaLabel: string;
  centerLabel: string;
  className?: string;
  colors: string[];
  items: DistributionItem[];
}) {
  const total = chartTotal(items);
  const cx = 180;
  const cy = 140;
  const radius = 88;
  const labelRadius = 116;
  const labelCount = Math.min(2, items.length);
  const segmentGap = items.length > 1 ? 5 : 0;
  let cursor = -90;

  const segments = items.map((item, index) => {
    const value = metricValue(item);
    const sweep = total > 0 ? (value / total) * 360 : 0;
    const gap = Math.min(segmentGap, sweep * 0.45);
    let startAngle = cursor + gap / 2;
    let endAngle = cursor + sweep - gap / 2;
    const midpoint = cursor + sweep / 2;

    if (endAngle <= startAngle) {
      startAngle = midpoint - 0.8;
      endAngle = midpoint + 0.8;
    }

    cursor += sweep;

    const lineStart = polarPoint(cx, cy, labelRadius - 10, midpoint);
    const lineBend = polarPoint(cx, cy, labelRadius + 13, midpoint);
    const isRight = lineBend.x >= cx;
    const lineEnd = { x: lineBend.x + (isRight ? 26 : -26), y: lineBend.y };
    const textAnchor: "start" | "end" = isRight ? "start" : "end";

    return {
      color: colors[index % colors.length],
      item,
      labelTextY: lineEnd.y - 4,
      labelValueY: lineEnd.y + 18,
      lineBend,
      lineEnd,
      lineStart,
      path: roundedArcPath(cx, cy, radius, startAngle, endAngle),
      percent: percentOf(value, total),
      textAnchor,
      textX: lineEnd.x + (isRight ? 8 : -8),
      value
    };
  });

  return (
    <div className={`segmented-donut-stage ${className}`.trim()}>
      <svg className="segmented-donut-chart" viewBox="0 -24 360 320" role="img" aria-label={ariaLabel}>
        <circle className="donut-base-path" cx={cx} cy={cy} r={radius} />
        {segments.map((segment) => (
          <path
            className="donut-segment-path"
            d={segment.path}
            key={segment.item.label}
            stroke={segment.color}
          />
        ))}
        {segments.slice(0, labelCount).map((segment) => (
          <g className="donut-external-label" key={`${segment.item.label}-label`}>
            <polyline
              className="donut-label-line"
              points={`${segment.lineStart.x},${segment.lineStart.y} ${segment.lineBend.x},${segment.lineBend.y} ${segment.lineEnd.x},${segment.lineEnd.y}`}
              stroke={segment.color}
            />
            <text className="donut-label-text" x={segment.textX} y={segment.labelTextY} textAnchor={segment.textAnchor}>
              {segment.item.label}
            </text>
            <text className="donut-label-value" x={segment.textX} y={segment.labelValueY} textAnchor={segment.textAnchor}>
              {formatMetric(segment.value)}当量 | {segment.percent}%
            </text>
          </g>
        ))}
      </svg>
      <div className="segmented-donut-center">
        <strong>{formatMetric(total)}</strong>
        <span>{centerLabel}</span>
      </div>
    </div>
  );
}

function CardHeading({
  icon: Icon,
  meta,
  onSource,
  title,
  tone = "purple"
}: {
  icon: LucideIcon;
  meta: string;
  onSource?: () => void;
  title: string;
  tone?: "purple" | "cyan" | "green" | "orange" | "navy";
}) {
  return (
    <div className="dashboard-card-heading">
      <div className="dashboard-heading-title">
        <span className={`heading-icon ${tone}`}>
          <Icon size={16} />
        </span>
        <h3>{title}</h3>
      </div>
      <div className="dashboard-heading-actions">
        <span className="heading-meta">{meta}</span>
        {onSource && (
          <button className="dashboard-source-button" onClick={onSource} title="查看来源日报" type="button">
            <ListFilter size={14} />
            来源
          </button>
        )}
      </div>
    </div>
  );
}

function DashboardSourcePanel({
  description,
  onClose,
  records,
  title
}: {
  description: string;
  onClose: () => void;
  records: WorkRecord[];
  title: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleRecords = showAll ? records : records.slice(0, 20);
  const hiddenCount = records.length - visibleRecords.length;

  return (
    <section className="panel dashboard-source-panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button className="ghost-button" onClick={onClose} type="button">
          <X size={16} />
          关闭
        </button>
      </div>
      <div className="dashboard-source-metrics">
        <span><strong>{records.length}</strong> 条记录</span>
        <span><strong>{formatMetric(sumWorkload(records))}</strong> 原始当量</span>
        <span><strong>{formatMetric(sumTimeHours(records))}</strong> 小时</span>
      </div>
      <div className="dashboard-source-list">
        {visibleRecords.map((record) => (
          <article key={record.id}>
            <time>{formatDate(record.date)}</time>
            <div>
              <strong>{record.title}</strong>
              <span>{record.projectName || "非项目事项"} · {record.businessCategory || record.category} · {record.workType || "其他项"}</span>
            </div>
            <small>{formatMetric(record.workload ?? 0)} 当量 · {formatMetric(record.timeHours ?? 0)}h</small>
          </article>
        ))}
        {!records.length && <div className="empty-state">当前条件没有来源日报。</div>}
      </div>
      {hiddenCount > 0 && (
        <button className="ghost-button dashboard-source-more" onClick={() => setShowAll(true)} type="button">
          显示其余 {hiddenCount} 条
        </button>
      )}
    </section>
  );
}

function BusinessCategoryDonut({ items, onOpenSource }: { items: DistributionItem[]; onOpenSource: OpenDashboardSource }) {
  const visibleItems = items;
  const total = chartTotal(visibleItems);
  const topItem = visibleItems[0];
  const secondItem = visibleItems[1];
  const topPercent = topItem ? percentOf(metricValue(topItem), total) : 0;
  const secondPercent = secondItem ? percentOf(metricValue(secondItem), total) : 0;

  return (
    <section className="dashboard-card business-donut-card">
      <CardHeading
        icon={PieChart}
        meta={`${items.length} 类`}
        title="业务分类占比"
        tone="purple"
        onSource={() => onOpenSource("业务分类全部来源", { kind: "all" })}
      />

      {visibleItems.length ? (
        <div className="business-donut-layout">
          <div className="business-donut-main">
            <div className="business-donut-stage">
              <SegmentedDonutChart
                ariaLabel="业务分类占比甜甜圈图"
                centerLabel={visibleItems.some((item) => item.workload > 0) ? "当量" : "条目"}
                colors={businessColors}
                items={visibleItems}
              />
            </div>

            <div className="business-donut-legend">
              {visibleItems.map((item, index) => (
                <button
                  className="business-legend-pill"
                  key={item.label}
                  onClick={() => onOpenSource(`业务分类：${item.label}`, { kind: "business", value: item.label })}
                  type="button"
                >
                  <i style={{ backgroundColor: businessColors[index % businessColors.length] }} />
                  <span>
                    <strong>{item.label}</strong>
                    <small className="business-legend-meta">{formatMetric(metricValue(item))} 当量</small>
                  </span>
                  <em>{percentOf(metricValue(item), total)}%</em>
                </button>
              ))}
            </div>
          </div>

          <div className="business-insight-card">
            <span>结构判断</span>
            <strong>{topItem?.label ?? "暂无业务"}是主投入面</strong>
            <small>
              {topItem
                ? `${topItem.label}占 ${topPercent}%`
                : "暂无占比"}
              {secondItem ? `，${secondItem.label}补充 ${secondPercent}%` : "，暂无补充业务"}。
            </small>
          </div>
        </div>
      ) : (
        <div className="empty-state">暂无统计数据。</div>
      )}
    </section>
  );
}

function AbilityRadarChart({ items, onOpenSource }: { items: DistributionItem[]; onOpenSource: OpenDashboardSource }) {
  const visibleItems = items;
  const total = chartTotal(visibleItems);
  const topItem = visibleItems[0];
  const topPercent = topItem ? percentOf(metricValue(topItem), total) : 0;
  const maxValue = Math.max(1, ...visibleItems.map(metricValue));
  const radarCenter = { x: 150, y: 128 };
  const radius = 76;
  const canDrawRadar = visibleItems.length >= 3;
  const points = canDrawRadar
    ? visibleItems.map((item, index) => {
        const angle = -90 + (360 / visibleItems.length) * index;
        return polarPoint(radarCenter.x, radarCenter.y, radius * (metricValue(item) / maxValue), angle);
      })
    : [];

  return (
    <section className="dashboard-card ability-radar-card">
      <CardHeading
        icon={Radar}
        meta={`${items.length} 类`}
        title="能力维度占比"
        tone="cyan"
        onSource={() => onOpenSource("能力投入全部来源", { kind: "all" }, "能力当量和工时按每条日报保存的分配比例计算。")}
      />

      {visibleItems.length ? (
        <div className="ability-radar-layout">
          <div className="ability-focus-card">
            <Sparkles className="ability-focus-icon" size={18} />
            <span>核心能力占比</span>
            <strong>{topPercent}%</strong>
            <em>{topItem?.label}</em>
            <small>{topItem ? formatMetric(metricValue(topItem)) : "0"} 当量 / {topItem?.count ?? 0} 条记录</small>
            <svg className="ability-focus-wave" viewBox="0 0 220 70" aria-hidden="true">
              <path d="M0 48 C28 18, 46 18, 68 42 S108 68, 136 32 S176 8, 220 40" />
            </svg>
          </div>

          <div className="ability-radar-plot">
            {canDrawRadar ? (
              <svg viewBox="0 0 300 276" role="img" aria-label="能力维度雷达占比图">
                {[0.33, 0.66, 1].map((scale) => (
                  <polygon
                    className="ability-radar-ring"
                    key={scale}
                    points={toPolyline(
                      visibleItems.map((_, index) =>
                        polarPoint(radarCenter.x, radarCenter.y, radius * scale, -90 + (360 / visibleItems.length) * index)
                      )
                    )}
                  />
                ))}
                {visibleItems.map((item, index) => {
                  const angle = -90 + (360 / visibleItems.length) * index;
                  const axisEnd = polarPoint(radarCenter.x, radarCenter.y, radius, angle);
                  const label = polarPoint(radarCenter.x, radarCenter.y, radius + 46, angle);
                  const labelLines = splitLabel(item.label, 5);
                  const anchor = label.x < radarCenter.x - 8 ? "end" : label.x > radarCenter.x + 8 ? "start" : "middle";
                  return (
                    <g key={item.label}>
                      <line className="ability-radar-axis" x1={radarCenter.x} y1={radarCenter.y} x2={axisEnd.x} y2={axisEnd.y} />
                      <text
                        className="ability-radar-label"
                        x={label.x}
                        y={label.y - (labelLines.length - 1) * 5}
                        textAnchor={anchor}
                      >
                        {labelLines.map((line, lineIndex) => (
                          <tspan x={label.x} dy={lineIndex === 0 ? 0 : 12} key={`${item.label}-${lineIndex}`}>
                            {line}
                          </tspan>
                        ))}
                      </text>
                      <text
                        className="ability-radar-percent"
                        x={label.x}
                        y={label.y + labelLines.length * 12}
                        textAnchor={anchor}
                      >
                        {percentOf(metricValue(item), total)}%
                      </text>
                    </g>
                  );
                })}
                <polygon className="ability-radar-shape" points={toPolyline(points)} />
                {points.map((point, index) => (
                  <circle
                    className="ability-radar-dot"
                    cx={point.x}
                    cy={point.y}
                    key={visibleItems[index].label}
                    r="4"
                  />
                ))}
              </svg>
            ) : (
              <div className="ability-radar-fallback">能力维度达到 3 类后展示雷达图。</div>
            )}
          </div>

          <div className="ability-radar-list">
            <div className="ability-radar-list-head">
              <span>能力</span>
              <span>当量</span>
              <span>记录数</span>
            </div>
            {visibleItems.map((item, index) => (
              <button
                className="ability-radar-row"
                key={item.label}
                onClick={() => onOpenSource(`能力维度：${item.label}`, { kind: "ability", value: item.label }, "一条多能力日报在来源列表中只出现一次，面板汇总仍使用日报原始当量和工时。")}
                type="button"
              >
                <span><i style={{ backgroundColor: abilityColors[index % abilityColors.length] }} />{item.label}</span>
                <strong>{formatMetric(metricValue(item))}</strong>
                <em>{item.count}</em>
              </button>
            ))}
          </div>

          <div className="ability-radar-insight">
            <strong>洞察</strong>
            <span>
              {topItem
                ? `${topItem.label}占 ${topPercent}%，是当前投入最高的能力维度`
                : "暂无能力维度数据"}
              {visibleItems[1] ? `；${visibleItems[1].label}占 ${percentOf(metricValue(visibleItems[1]), total)}%，形成补充支撑。` : "。"}
            </span>
          </div>
        </div>
      ) : (
        <div className="empty-state">暂无能力维度数据。</div>
      )}
    </section>
  );
}

function WorkTypeProfileChart({ items, onOpenSource }: { items: DistributionItem[]; onOpenSource: OpenDashboardSource }) {
  const visibleItems = items;
  const total = chartTotal(visibleItems);
  const topItem = visibleItems[0];
  const secondItem = visibleItems[1];
  const topPercent = topItem ? percentOf(metricValue(topItem), total) : 0;
  const secondPercent = secondItem ? percentOf(metricValue(secondItem), total) : 0;

  return (
    <section className="dashboard-card worktype-profile-card">
      <CardHeading
        icon={Workflow}
        meta={`${items.length} 类`}
        title="工作类型画像"
        tone="orange"
        onSource={() => onOpenSource("工作类型全部来源", { kind: "all" })}
      />

      {visibleItems.length ? (
        <div className="worktype-profile-layout">
          <div className="worktype-type-cards">
            <article>
              <span>主类型</span>
              <strong>{topItem?.label ?? "暂无类型"}</strong>
              <em>{topPercent}%</em>
              <small>投入占比</small>
            </article>
            {secondItem && (
              <article>
                <span>次类型</span>
                <strong>{secondItem.label}</strong>
                <em>{secondPercent}%</em>
                <small>投入占比</small>
              </article>
            )}
          </div>

          <div className="worktype-profile-main">
            <SegmentedDonutChart
              ariaLabel="工作类型画像甜甜圈图"
              centerLabel="总当量"
              className="worktype-segmented-donut"
              colors={workTypeColors}
              items={visibleItems}
            />
            <div className="worktype-metric-scroll">
              <div className="worktype-metric-list">
                {visibleItems.map((item, index) => (
                  <button
                    key={item.label}
                    onClick={() => onOpenSource(`工作类型：${item.label}`, { kind: "workType", value: item.label })}
                    type="button"
                  >
                    <i style={{ backgroundColor: workTypeColors[index % workTypeColors.length] }} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{formatMetric(metricValue(item))} 当量 / {item.count} 条</small>
                    </span>
                    <em>{percentOf(metricValue(item), total)}%</em>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="worktype-profile-note">注：类型投入占比可超过 100%，因存在多类型并行记录。</p>
        </div>
      ) : (
        <div className="empty-state">暂无工作类型数据。</div>
      )}
    </section>
  );
}

function BusinessAbilityMatrix({ relations, onOpenSource }: { relations: BusinessAbilityRelationItem[]; onOpenSource: OpenDashboardSource }) {
  const visibleBusinesses = Array.from(new Set(relations.map((item) => item.businessLabel)));
  const abilityTotals = new Map<string, number>();

  relations.forEach((item) => {
    abilityTotals.set(item.abilityLabel, (abilityTotals.get(item.abilityLabel) ?? 0) + (item.workload > 0 ? item.workload : item.count));
  });

  const visibleAbilities = Array.from(abilityTotals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .map(([label]) => label);
  const relationLookup = new Map(relations.map((item) => [`${item.businessLabel}\u0000${item.abilityLabel}`, item]));
  const maxValue = Math.max(1, ...relations.map((item) => (item.workload > 0 ? item.workload : item.count)));
  const topRelation = relations.slice().sort((a, b) => b.workload - a.workload || b.count - a.count)[0];

  return (
    <section className="dashboard-card business-ability-card">
      <CardHeading
        icon={GitBranch}
        meta="矩阵视图"
        title="业务与能力关联洞察"
        tone="green"
        onSource={() => onOpenSource("业务与能力全部来源", { kind: "all" }, "矩阵能力投入按日报能力分配比例计算。")}
      />

      {visibleBusinesses.length && visibleAbilities.length ? (
        <div className="business-ability-layout">
          <div
            className="business-ability-coordinate"
            style={{ "--ability-count": visibleAbilities.length, "--business-count": visibleBusinesses.length } as CSSProperties}
          >
            <span className="business-ability-axis-x">能力维度</span>
            <span className="business-ability-axis-y">业务类型</span>
            <div
              className="business-ability-matrix"
              role="img"
              aria-label="业务类型与能力维度关联坐标矩阵"
            >
            <span className="matrix-axis-corner">业务类型</span>
            {visibleAbilities.map((ability) => (
              <span className="matrix-ability-label" key={ability}>
                {ability}
              </span>
            ))}
            {visibleBusinesses.map((business) => (
              <Fragment key={business}>
                <span className="matrix-business-label">{business}</span>
                {visibleAbilities.map((ability, abilityIndex) => {
                  const relation = relationLookup.get(`${business}\u0000${ability}`);
                  const value = relation ? (relation.workload > 0 ? relation.workload : relation.count) : 0;
                  const scale = value > 0 ? clamp(value / maxValue, 0.12, 1) : 0;
                  return (
                    <span className="matrix-cell business-ability-gridline" key={`${business}-${ability}`}>
                      {relation && (
                        <button
                          aria-label={`查看${business}与${ability}的来源日报`}
                          className="relation-bubble"
                          onClick={() => onOpenSource(
                            `${business} / ${ability}`,
                            { kind: "businessAbility", business, ability },
                            "仅显示同时属于该业务分类并包含该能力分配的日报。"
                          )}
                          style={{
                            "--bubble-color": abilityColors[abilityIndex % abilityColors.length],
                            "--bubble-size": `${10 + scale * 48}px`
                          } as CSSProperties}
                          title={`${business} / ${ability}: ${formatMetric(relation.workload)} 当量，${formatMetric(relation.timeHours)}h，占该业务 ${relation.businessShare}%`}
                          type="button"
                        />
                      )}
                    </span>
                  );
                })}
              </Fragment>
            ))}
            </div>
          </div>

          <div className="business-ability-legend">
            <div className="legend-group">
              <strong>大小代表投入强度</strong>
              <span><i className="bubble-size-swatch high" />高投入</span>
              <span><i className="bubble-size-swatch middle" />中投入</span>
              <span><i className="bubble-size-swatch low" />低投入</span>
            </div>
            <div className="legend-group ability-color-legend">
              <strong>颜色对应能力维度</strong>
              {visibleAbilities.map((ability, index) => (
                <span key={ability}><i style={{ backgroundColor: abilityColors[index % abilityColors.length] }} />{ability}</span>
              ))}
            </div>
          </div>

          <div className="business-ability-insight">
            <strong>洞察</strong>
            <span>
              {topRelation
                ? `${topRelation.businessLabel}在${topRelation.abilityLabel}上的投入最高，占该业务 ${topRelation.businessShare}%。`
                : "暂无足够数据形成关联洞察。"}
            </span>
          </div>
        </div>
      ) : (
        <div className="empty-state">暂无业务与能力关联数据。</div>
      )}
    </section>
  );
}

function TrendChart({ points, onOpenSource }: { points: TrendPoint[]; onOpenSource: OpenDashboardSource }) {
  const [tooltip, setTooltip] = useState<TrendTooltipState | null>(null);
  const maxValue = Math.max(1, ...points.map((point) => Math.max(point.workload, point.timeHours)));
  const chartWidth = Math.max(520, points.length * 58 + 76);
  const chartHeight = 232;
  const padding = { top: 22, right: 28, bottom: 36, left: 38 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const bottom = padding.top + plotHeight;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const barWidth = clamp(points.length ? plotWidth / points.length * 0.34 : 22, 14, 28);
  const xFor = (index: number) => padding.left + (points.length > 1 ? index * step : plotWidth / 2);
  const yFor = (value: number) => bottom - (value / maxValue) * plotHeight;
  const timeLinePoints = points.map((point, index) => `${xFor(index)},${yFor(point.timeHours)}`).join(" ");
  const showTooltip = (point: TrendPoint, event: ReactMouseEvent<SVGElement>) => {
    setTooltip({ point, ...getTrendTooltipPosition(event) });
  };

  return (
    <section className="dashboard-card trend-card">
      <CardHeading
        icon={Activity}
        meta="当量 / 时间"
        title="工作量趋势"
        tone="cyan"
        onSource={() => onOpenSource("趋势全部来源", { kind: "all" })}
      />
      <div className="trend-combo-chart" onMouseLeave={() => setTooltip(null)}>
        {points.length ? (
          <svg className="trend-combo-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="工作量趋势柱线组合图">
            {[0, 0.25, 0.5, 0.75, 1].map((scale) => {
              const y = padding.top + plotHeight * scale;
              return (
                <line
                  className="trend-grid-line"
                  key={scale}
                  x1={padding.left}
                  x2={chartWidth - padding.right}
                  y1={y}
                  y2={y}
                />
              );
            })}
            {points.map((point, index) => {
              const x = xFor(index);
              const workloadY = yFor(point.workload);
              return (
                <g key={point.key}>
                  <rect
                    className="trend-workload-bar"
                    height={Math.max(3, bottom - workloadY)}
                    rx="7"
                    width={barWidth}
                    x={x - barWidth / 2}
                    y={workloadY}
                    onMouseEnter={(event) => showTooltip(point, event)}
                    onMouseMove={(event) => showTooltip(point, event)}
                  >
                    <title>{`${point.label}：当量 ${formatMetric(point.workload)}，时间 ${formatMetric(point.timeHours)}h`}</title>
                  </rect>
                  <rect
                    aria-label={`查看${point.label}来源日报`}
                    className="trend-hit-zone"
                    height={plotHeight}
                    width={Math.max(28, barWidth + 18)}
                    x={x - Math.max(28, barWidth + 18) / 2}
                    y={padding.top}
                    onMouseEnter={(event) => showTooltip(point, event)}
                    onMouseMove={(event) => showTooltip(point, event)}
                    onClick={() => onOpenSource(`趋势周期：${point.label}`, { kind: "trend", value: point.key })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenSource(`趋势周期：${point.label}`, { kind: "trend", value: point.key });
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  />
                  <text className="trend-label" x={x} y={chartHeight - 10} textAnchor="middle">
                    {point.label}
                  </text>
                </g>
              );
            })}
            <polyline className="trend-time-line" points={timeLinePoints} />
            {points.map((point, index) => {
              const x = xFor(index);
              const y = yFor(point.timeHours);
              return (
                <circle
                  className="trend-time-dot"
                  cx={x}
                  cy={y}
                  key={`${point.key}-time`}
                  r="4"
                  onMouseEnter={(event) => showTooltip(point, event)}
                  onMouseMove={(event) => showTooltip(point, event)}
                />
              );
            })}
          </svg>
        ) : (
          <div className="empty-state">暂无趋势数据。</div>
        )}
        {tooltip && (
          <div
            className="trend-tooltip"
            style={{ "--tooltip-x": `${tooltip.x}px`, "--tooltip-y": `${tooltip.y}px` } as CSSProperties}
          >
            <strong>{tooltip.point.label}</strong>
            <span>当量 {formatMetric(tooltip.point.workload)}</span>
            <span>时间 {formatMetric(tooltip.point.timeHours)}h</span>
          </div>
        )}
      </div>
      <div className="trend-legend">
        <span><i className="workload" />当量</span>
        <span><i className="time" />时间</span>
      </div>
    </section>
  );
}

function ProjectRank({ projects, onOpenSource }: { projects: ProjectSummary[]; onOpenSource: OpenDashboardSource }) {
  const maxValue = Math.max(1, ...projects.map((project) => Math.max(project.count, project.workload)));

  return (
    <section className="dashboard-card project-rank-card">
      <CardHeading
        icon={BriefcaseBusiness}
        meta={`${projects.length} 个项目`}
        title="项目工作量排行"
        tone="purple"
        onSource={() => onOpenSource("项目投入全部来源", { kind: "projectRecords" })}
      />
      <div className="project-rank-list">
        {projects.slice(0, 8).map((project, index) => {
          const width = Math.max(6, (Math.max(project.count, project.workload) / maxValue) * 100);
          return (
            <button
              className="project-rank-item"
              key={project.projectName}
              onClick={() => onOpenSource(`项目：${project.projectName}`, { kind: "project", value: project.projectName })}
              type="button"
            >
              <em>{String(index + 1).padStart(2, "0")}</em>
              <div>
                <strong>{project.projectName}</strong>
                <span>{project.count} 条 / {formatMetric(project.workload)} 当量</span>
                <i style={{ width: `${width}%` }} />
              </div>
            </button>
          );
        })}
        {!projects.length && <div className="empty-state">暂无项目数据。</div>}
      </div>
    </section>
  );
}

function FocusRank({
  items,
  onOpenSource,
  settings
}: {
  items: ReturnType<typeof analyzeRecords>["focusRankings"];
  onOpenSource: OpenDashboardSource;
  settings: AppSettings;
}) {
  const maxScore = Math.max(1, ...items.map((item) => item.score));
  const weightLabel = `${settings.focusScoreWeights.workload}/${settings.focusScoreWeights.timeHours}/${settings.focusScoreWeights.recordCount}`;
  const maxVisibleItems = 10;
  const visibleItems = items.slice(0, maxVisibleItems);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <section className="dashboard-card focus-rank-card">
      <CardHeading
        icon={Trophy}
        meta={`Top ${visibleItems.length}${hiddenCount ? ` / ${items.length}` : ""} · ${weightLabel}`}
        title="工作重心排行"
        tone="orange"
        onSource={() => onOpenSource("工作重心全部来源", { kind: "all" }, "重心分数由配置中的当量、工时和记录数权重计算，不代表工作价值评分。")}
      />
      <div className="focus-rank-list">
        {visibleItems.map((item, index) => {
          const width = Math.max(6, (item.score / maxScore) * 100);
          return (
            <button
              className="focus-rank-item"
              key={item.label}
              onClick={() => onOpenSource(`工作重心：${item.label}`, { kind: "project", value: item.label }, "该项目的重心分数由当量、工时和记录数占比加权得到。")}
              type="button"
            >
              <em>{String(index + 1).padStart(2, "0")}</em>
              <div>
                <div className="focus-rank-title">
                  <strong>{item.label}</strong>
                  <b>{formatMetric(item.score)} 分</b>
                </div>
                <span>{formatMetric(item.workload)} 当量 / {formatMetric(item.timeHours)}h / {item.count} 条</span>
                <i style={{ width: `${width}%` }} />
              </div>
            </button>
          );
        })}
        {!items.length && <div className="empty-state">暂无重心数据。</div>}
      </div>
      {hiddenCount > 0 && <p className="rank-more-note">其余 {hiddenCount} 项已收起，可在全部记录中继续查看。</p>}
    </section>
  );
}

function ProductMatrix({ items, onOpenSource }: { items: DistributionItem[]; onOpenSource: OpenDashboardSource }) {
  const visibleItems = items.slice(0, 8);
  const maxValue = Math.max(1, ...visibleItems.map(metricValue));

  return (
    <section className="dashboard-card product-matrix-card">
      <CardHeading
        icon={Layers3}
        meta={`${items.length} 类`}
        title="产品系统分布"
        tone="green"
        onSource={() => onOpenSource("产品系统全部来源", { kind: "all" })}
      />
      <div className="product-matrix">
        {visibleItems.length ? (
          visibleItems.map((item, index) => {
            const scale = Math.max(0.58, metricValue(item) / maxValue);
            return (
              <button
                key={item.label}
                onClick={() => onOpenSource(`产品系统：${item.label}`, { kind: "product", value: item.label })}
                style={{ "--matrix-scale": scale, "--matrix-color": chartColors[index % chartColors.length] } as CSSProperties}
                type="button"
              >
                <strong>{item.label}</strong>
                <span>{item.count} 条</span>
                <em>{formatMetric(item.workload)} 当量</em>
              </button>
            );
          })
        ) : (
          <div className="empty-state">暂无产品系统数据。</div>
        )}
      </div>
    </section>
  );
}

function ProjectCards({ projects, onOpenSource }: { projects: ProjectSummary[]; onOpenSource: OpenDashboardSource }) {
  return (
    <section className="panel project-summary-panel">
      <div className="panel-heading">
        <h2>项目汇总</h2>
        <span>{projects.length} 个</span>
      </div>
      <div className="project-summary-grid">
        {projects.length ? (
          projects.slice(0, 9).map((project) => (
            <article
              className="project-summary-card"
              key={project.projectName}
              onClick={() => onOpenSource(`项目：${project.projectName}`, { kind: "project", value: project.projectName })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenSource(`项目：${project.projectName}`, { kind: "project", value: project.projectName });
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="project-summary-top">
                <strong>{project.projectName}</strong>
                <span>{formatMetric(project.workload)} 当量</span>
              </div>
              <div className="project-summary-meta">
                <span>{project.count} 条记录</span>
                {project.latestDate && <span>最近：{formatDate(project.latestDate)}</span>}
              </div>
              <div className="project-summary-tags">
                {project.businessCategories.slice(0, 2).map((item) => (
                  <span className="category-chip" key={item}>{item}</span>
                ))}
                {project.workTypes.slice(0, 2).map((item) => (
                  <span className="worktype-chip" key={item}>{item}</span>
                ))}
                {project.productSystems.slice(0, 2).map((item) => (
                  <span className="detail-chip" key={item}>{item}</span>
                ))}
              </div>
              {project.records[0]?.content && <p>{project.records[0].content}</p>}
            </article>
          ))
        ) : (
          <div className="empty-state">当前范围暂无项目。</div>
        )}
      </div>
    </section>
  );
}

export function ReportDashboard({ records, trend, activeLabel }: ReportDashboardProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [sourceView, setSourceView] = useState<DashboardSourceView | null>(null);
  const sourcePanelRef = useRef<HTMLDivElement | null>(null);
  const analysis = useMemo(() => analyzeRecords(records, settings), [records, settings]);
  const sourceRecords = useMemo(
    () => sourceView ? filterDashboardSourceRecords(records, sourceView.filter) : [],
    [records, sourceView]
  );

  const openSource: OpenDashboardSource = (title, filter, description = "来源为当前报告周期内符合该条件的日报，记录按 ID 去重。") => {
    setSourceView({ title, filter, description });
  };

  useEffect(() => {
    let ignore = false;

    fetchSettings()
      .then((nextSettings) => {
        if (!ignore) setSettings(nextSettings);
      })
      .catch(() => {
        if (!ignore) setSettings(DEFAULT_APP_SETTINGS);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (sourceView) sourcePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sourceView]);

  return (
    <>
      <section className="dashboard-ledger">
        <button onClick={() => openSource("参与项目来源", { kind: "projectRecords" })} type="button">
          <BriefcaseBusiness size={18} />
          <span>参与项目</span>
          <strong>{analysis.projectCount}</strong>
        </button>
        <button onClick={() => openSource("原始工作当量来源", { kind: "all" })} type="button">
          <Activity size={18} />
          <span>工作当量</span>
          <strong>{formatMetric(analysis.totalWorkload)}</strong>
        </button>
        <button onClick={() => openSource("投入时间来源", { kind: "all" })} type="button">
          <Clock3 size={18} />
          <span>投入时间</span>
          <strong>{formatMetric(analysis.totalTimeHours)}h</strong>
        </button>
        <button onClick={() => openSource(`主要业务：${analysis.topBusinessLabel}`, { kind: "business", value: analysis.topBusinessLabel })} type="button">
          <PieChart size={18} />
          <span>主要业务</span>
          <strong>{analysis.topBusinessLabel}</strong>
        </button>
        <button onClick={() => openSource(`主要类型：${analysis.topWorkTypeLabel}`, { kind: "workType", value: analysis.topWorkTypeLabel })} type="button">
          <Workflow size={18} />
          <span>主要类型</span>
          <strong>{analysis.topWorkTypeLabel}</strong>
        </button>
        <button onClick={() => openSource("活跃周期来源", { kind: "all" })} type="button">
          <CalendarCheck size={18} />
          <span>活跃周期</span>
          <strong>{activeLabel}</strong>
        </button>
      </section>

      {sourceView && (
        <div ref={sourcePanelRef}>
          <DashboardSourcePanel
            key={`${sourceView.title}:${JSON.stringify(sourceView.filter)}`}
            description={sourceView.description}
            records={sourceRecords}
            title={sourceView.title}
            onClose={() => setSourceView(null)}
          />
        </div>
      )}

      <section className="dashboard-grid mixed">
        <div className="dashboard-row dashboard-row-three">
          <BusinessCategoryDonut items={analysis.businessDistribution} onOpenSource={openSource} />
          <TrendChart points={trend} onOpenSource={openSource} />
          <ProjectRank projects={analysis.projectSummaries} onOpenSource={openSource} />
        </div>

        <div className="dashboard-row dashboard-row-two dashboard-row-ability">
          <AbilityRadarChart items={analysis.abilityDistribution} onOpenSource={openSource} />
          <BusinessAbilityMatrix relations={analysis.businessAbilityRelations} onOpenSource={openSource} />
        </div>

        <div className="dashboard-row dashboard-row-two">
          <WorkTypeProfileChart items={analysis.workTypeDistribution} onOpenSource={openSource} />
          <ProductMatrix items={analysis.productDistribution} onOpenSource={openSource} />
        </div>

        <div className="dashboard-row dashboard-row-two dashboard-row-focus">
          <FocusRank items={analysis.focusRankings} onOpenSource={openSource} settings={settings} />
          <section className="dashboard-card insight-card">
            <CardHeading icon={Layers3} meta="自动洞察" title="本期观察" tone="navy" onSource={() => openSource("本期观察全部来源", { kind: "all" })} />
            <div className="insight-lines">
              <p>项目投入集中在 <strong>{analysis.projectSummaries[0]?.projectName ?? "暂无项目"}</strong></p>
              <p>主要业务方向为 <strong>{analysis.topBusinessLabel}</strong></p>
              <p>主要工作类型为 <strong>{analysis.topWorkTypeLabel}</strong></p>
              <p>能力投入集中在 <strong>{analysis.abilityDistribution[0]?.label ?? "暂无能力维度"}</strong></p>
            </div>
          </section>
        </div>
      </section>

      <ProjectCards projects={analysis.projectSummaries} onOpenSource={openSource} />
    </>
  );
}
