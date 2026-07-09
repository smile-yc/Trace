import {
  Activity,
  BriefcaseBusiness,
  CalendarCheck,
  Clock3,
  GitBranch,
  Layers3,
  PieChart,
  Radar,
  Sparkles,
  Trophy,
  Workflow,
  type LucideIcon
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AppSettings, WorkRecord } from "../types";
import {
  analyzeRecords,
  type BusinessAbilityRelationItem,
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

const chartColors = ["#0c0c24", "#5dbac0", "#7a3e8e", "#f2764b", "#78a943", "#2f6f88"];
const businessColors = ["#0c0c24", "#5dbac0", "#f2764b", "#78a943", "#7a3e8e", "#2f6f88"];
const abilityColors = ["#7a3e8e", "#5dbac0", "#78a943", "#f2764b", "#0c0c24", "#2f6f88"];
const workTypeColors = ["#0c0c24", "#f2764b", "#5dbac0", "#78a943", "#7a3e8e", "#2f6f88"];

interface ChartPoint {
  x: number;
  y: number;
}

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

function visualSegment(value: number, total: number, circumference: number): number {
  if (value <= 0 || total <= 0) return 0;
  return Math.max((value / total) * circumference, 4.5);
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

function CardHeading({
  icon: Icon,
  meta,
  title,
  tone = "purple"
}: {
  icon: LucideIcon;
  meta: string;
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
      <span className="heading-meta">{meta}</span>
    </div>
  );
}

function BusinessCategoryDonut({ items }: { items: DistributionItem[] }) {
  const visibleItems = items;
  const total = chartTotal(visibleItems);
  const topItem = visibleItems[0];
  const secondItem = visibleItems[1];
  const topPercent = topItem ? percentOf(metricValue(topItem), total) : 0;
  const secondPercent = secondItem ? percentOf(metricValue(secondItem), total) : 0;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <section className="dashboard-card business-donut-card">
      <CardHeading icon={PieChart} meta={`${items.length} 类`} title="业务分类占比" tone="purple" />

      {visibleItems.length ? (
        <div className="business-donut-layout">
          <div className="business-donut-main">
            <div className="business-donut-stage">
              <div className="business-donut-chart">
                <svg viewBox="0 0 164 164" role="img" aria-label="业务分类占比圆环图">
                  <circle className="business-donut-base" cx="82" cy="82" r={radius} />
                  {visibleItems.map((item, index) => {
                    const value = metricValue(item);
                    const dash = total ? visualSegment(value, total, circumference) : 0;
                    const segment = (
                      <circle
                        className="business-donut-segment"
                        cx="82"
                        cy="82"
                        key={item.label}
                        r={radius}
                        stroke={businessColors[index % businessColors.length]}
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        strokeDashoffset={-offset}
                      />
                    );
                    offset += dash;
                    return segment;
                  })}
                </svg>
                <div className="business-donut-center">
                  <strong>{formatMetric(total)}</strong>
                  <span>{visibleItems.some((item) => item.workload > 0) ? "当量" : "条"}</span>
                </div>
              </div>
            </div>

            <div className="business-donut-legend">
              {visibleItems.map((item, index) => (
                <span className="business-legend-pill" key={item.label}>
                  <i style={{ backgroundColor: businessColors[index % businessColors.length] }} />
                  <span>
                    <strong>{item.label}</strong>
                    <small className="business-legend-meta">{formatMetric(metricValue(item))} 当量</small>
                  </span>
                  <em>{percentOf(metricValue(item), total)}%</em>
                </span>
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

function AbilityRadarChart({ items }: { items: DistributionItem[] }) {
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
      <CardHeading icon={Radar} meta={`${items.length} 类`} title="能力维度占比" tone="cyan" />

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
              <div className="ability-radar-row" key={item.label}>
                <span><i style={{ backgroundColor: abilityColors[index % abilityColors.length] }} />{item.label}</span>
                <strong>{formatMetric(metricValue(item))}</strong>
                <em>{item.count}</em>
              </div>
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

function WorkTypeProfileChart({ items }: { items: DistributionItem[] }) {
  const visibleItems = items;
  const total = chartTotal(visibleItems);
  const topItem = visibleItems[0];
  const secondItem = visibleItems[1];
  const topPercent = topItem ? percentOf(metricValue(topItem), total) : 0;
  const secondPercent = secondItem ? percentOf(metricValue(secondItem), total) : 0;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <section className="dashboard-card worktype-profile-card">
      <CardHeading icon={Workflow} meta={`${items.length} 类`} title="工作类型画像" tone="orange" />

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
            <div className="worktype-donut-chart">
              <svg viewBox="0 0 136 136" role="img" aria-label="工作类型圆环占比图">
                <circle className="worktype-donut-base" cx="68" cy="68" r={radius} />
                {visibleItems.map((item, index) => {
                  const value = metricValue(item);
                  const dash = total ? visualSegment(value, total, circumference) : 0;
                  const segment = (
                    <circle
                      className="worktype-donut-segment"
                      cx="68"
                      cy="68"
                      key={item.label}
                      r={radius}
                      stroke={workTypeColors[index % workTypeColors.length]}
                      strokeDasharray={`${dash} ${circumference - dash}`}
                      strokeDashoffset={-offset}
                    />
                  );
                  offset += dash;
                  return segment;
                })}
              </svg>
              <div className="worktype-donut-center">
                <strong>{formatMetric(total)}</strong>
                <span>总当量</span>
              </div>
            </div>

            <div className="worktype-metric-scroll">
              <div className="worktype-metric-list">
                {visibleItems.map((item, index) => (
                  <div key={item.label}>
                    <i style={{ backgroundColor: workTypeColors[index % workTypeColors.length] }} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{formatMetric(metricValue(item))} 当量 / {item.count} 条</small>
                    </span>
                    <em>{percentOf(metricValue(item), total)}%</em>
                  </div>
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

function BusinessAbilityMatrix({ relations }: { relations: BusinessAbilityRelationItem[] }) {
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
      <CardHeading icon={GitBranch} meta="矩阵视图" title="业务与能力关联洞察" tone="green" />

      {visibleBusinesses.length && visibleAbilities.length ? (
        <div className="business-ability-layout">
          <div
            className="business-ability-matrix"
            style={{ "--ability-count": visibleAbilities.length } as CSSProperties}
            role="img"
            aria-label="业务类型与能力维度关联矩阵"
          >
            {visibleBusinesses.map((business) => (
              <Fragment key={business}>
                <span className="matrix-business-label">{business}</span>
                {visibleAbilities.map((ability, abilityIndex) => {
                  const relation = relationLookup.get(`${business}\u0000${ability}`);
                  const value = relation ? (relation.workload > 0 ? relation.workload : relation.count) : 0;
                  const scale = value > 0 ? clamp(value / maxValue, 0.12, 1) : 0;
                  return (
                    <span className="matrix-cell" key={`${business}-${ability}`}>
                      {relation && (
                        <i
                          className="relation-bubble"
                          style={{
                            "--bubble-color": abilityColors[abilityIndex % abilityColors.length],
                            "--bubble-size": `${10 + scale * 48}px`
                          } as CSSProperties}
                          title={`${business} / ${ability}: ${formatMetric(relation.workload)} 当量，${relation.businessShare}%`}
                        />
                      )}
                    </span>
                  );
                })}
              </Fragment>
            ))}
            <span className="matrix-axis-corner">能力维度</span>
            {visibleAbilities.map((ability) => (
              <span className="matrix-axis-footer" key={ability}>
                <span>{ability}</span>
              </span>
            ))}
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

function TrendChart({ points }: { points: TrendPoint[] }) {
  const maxValue = Math.max(1, ...points.map((point) => Math.max(point.count, point.workload, point.timeHours)));

  return (
    <section className="dashboard-card trend-card">
      <CardHeading icon={Activity} meta="当量 / 记录" title="工作量趋势" tone="cyan" />
      <div className="trend-bars">
        {points.map((point) => {
          const countHeight = Math.max(3, (point.count / maxValue) * 100);
          const workloadHeight = Math.max(3, (point.workload / maxValue) * 100);
          const timeHeight = Math.max(3, (point.timeHours / maxValue) * 100);
          return (
            <div className="trend-point" key={point.key}>
              <div className="trend-bar-pair">
                <i className="workload" style={{ height: `${workloadHeight}%` }} title={`当量 ${formatMetric(point.workload)}`} />
                <i className="time" style={{ height: `${timeHeight}%` }} title={`时间 ${formatMetric(point.timeHours)}h`} />
                <i className="count" style={{ height: `${countHeight}%` }} title={`记录 ${point.count}`} />
              </div>
              <span>{point.label}</span>
            </div>
          );
        })}
        {!points.length && <div className="empty-state">暂无趋势数据。</div>}
      </div>
      <div className="trend-legend">
        <span><i className="workload" />当量</span>
        <span><i className="time" />时间</span>
        <span><i className="count" />记录</span>
      </div>
    </section>
  );
}

function ProjectRank({ projects }: { projects: ProjectSummary[] }) {
  const maxValue = Math.max(1, ...projects.map((project) => Math.max(project.count, project.workload)));

  return (
    <section className="dashboard-card">
      <CardHeading icon={BriefcaseBusiness} meta={`${projects.length} 个项目`} title="项目工作量排行" tone="purple" />
      <div className="project-rank-list">
        {projects.slice(0, 8).map((project, index) => {
          const width = Math.max(6, (Math.max(project.count, project.workload) / maxValue) * 100);
          return (
            <article className="project-rank-item" key={project.projectName}>
              <em>{String(index + 1).padStart(2, "0")}</em>
              <div>
                <strong>{project.projectName}</strong>
                <span>{project.count} 条 / {formatMetric(project.workload)} 当量</span>
                <i style={{ width: `${width}%` }} />
              </div>
            </article>
          );
        })}
        {!projects.length && <div className="empty-state">暂无项目数据。</div>}
      </div>
    </section>
  );
}

function FocusRank({
  items,
  settings
}: {
  items: ReturnType<typeof analyzeRecords>["focusRankings"];
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
      />
      <div className="focus-rank-list">
        {visibleItems.map((item, index) => {
          const width = Math.max(6, (item.score / maxScore) * 100);
          return (
            <article className="focus-rank-item" key={item.label}>
              <em>{String(index + 1).padStart(2, "0")}</em>
              <div>
                <div className="focus-rank-title">
                  <strong>{item.label}</strong>
                  <b>{formatMetric(item.score)} 分</b>
                </div>
                <span>{formatMetric(item.workload)} 当量 / {formatMetric(item.timeHours)}h / {item.count} 条</span>
                <i style={{ width: `${width}%` }} />
              </div>
            </article>
          );
        })}
        {!items.length && <div className="empty-state">暂无重心数据。</div>}
      </div>
      {hiddenCount > 0 && <p className="rank-more-note">其余 {hiddenCount} 项已收起，可在全部记录中继续查看。</p>}
    </section>
  );
}

function ProductMatrix({ items }: { items: DistributionItem[] }) {
  const visibleItems = items.slice(0, 8);
  const maxValue = Math.max(1, ...visibleItems.map(metricValue));

  return (
    <section className="dashboard-card product-matrix-card">
      <CardHeading icon={Layers3} meta={`${items.length} 类`} title="产品系统分布" tone="green" />
      <div className="product-matrix">
        {visibleItems.length ? (
          visibleItems.map((item, index) => {
            const scale = Math.max(0.58, metricValue(item) / maxValue);
            return (
              <article
                key={item.label}
                style={{ "--matrix-scale": scale, "--matrix-color": chartColors[index % chartColors.length] } as CSSProperties}
              >
                <strong>{item.label}</strong>
                <span>{item.count} 条</span>
                <em>{formatMetric(item.workload)} 当量</em>
              </article>
            );
          })
        ) : (
          <div className="empty-state">暂无产品系统数据。</div>
        )}
      </div>
    </section>
  );
}

function ProjectCards({ projects }: { projects: ProjectSummary[] }) {
  return (
    <section className="panel project-summary-panel">
      <div className="panel-heading">
        <h2>项目汇总</h2>
        <span>{projects.length} 个</span>
      </div>
      <div className="project-summary-grid">
        {projects.length ? (
          projects.slice(0, 9).map((project) => (
            <article className="project-summary-card" key={project.projectName}>
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
  const analysis = useMemo(() => analyzeRecords(records, settings), [records, settings]);

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

  return (
    <>
      <section className="dashboard-ledger">
        <article>
          <BriefcaseBusiness size={18} />
          <span>参与项目</span>
          <strong>{analysis.projectCount}</strong>
        </article>
        <article>
          <Activity size={18} />
          <span>工作当量</span>
          <strong>{formatMetric(analysis.totalWorkload)}</strong>
        </article>
        <article>
          <Clock3 size={18} />
          <span>投入时间</span>
          <strong>{formatMetric(analysis.totalTimeHours)}h</strong>
        </article>
        <article>
          <PieChart size={18} />
          <span>主要业务</span>
          <strong>{analysis.topBusinessLabel}</strong>
        </article>
        <article>
          <Workflow size={18} />
          <span>主要类型</span>
          <strong>{analysis.topWorkTypeLabel}</strong>
        </article>
        <article>
          <CalendarCheck size={18} />
          <span>活跃周期</span>
          <strong>{activeLabel}</strong>
        </article>
      </section>

      <section className="dashboard-grid mixed">
        <BusinessCategoryDonut items={analysis.businessDistribution} />
        <AbilityRadarChart items={analysis.abilityDistribution} />
        <FocusRank items={analysis.focusRankings} settings={settings} />
        <WorkTypeProfileChart items={analysis.workTypeDistribution} />
        <BusinessAbilityMatrix relations={analysis.businessAbilityRelations} />
        <TrendChart points={trend} />
        <ProjectRank projects={analysis.projectSummaries} />
        <ProductMatrix items={analysis.productDistribution} />
        <section className="dashboard-card insight-card">
          <CardHeading icon={Layers3} meta="自动洞察" title="本期观察" tone="navy" />
          <div className="insight-lines">
            <p>项目投入集中在 <strong>{analysis.projectSummaries[0]?.projectName ?? "暂无项目"}</strong></p>
            <p>主要业务方向为 <strong>{analysis.topBusinessLabel}</strong></p>
            <p>主要工作类型为 <strong>{analysis.topWorkTypeLabel}</strong></p>
            <p>能力投入集中在 <strong>{analysis.abilityDistribution[0]?.label ?? "暂无能力维度"}</strong></p>
          </div>
        </section>
      </section>

      <ProjectCards projects={analysis.projectSummaries} />
    </>
  );
}
