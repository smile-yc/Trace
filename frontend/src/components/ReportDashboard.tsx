import { Activity, BriefcaseBusiness, CalendarCheck, Clock3, Layers3, PieChart, Workflow } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AppSettings, WorkRecord } from "../types";
import { analyzeRecords, type DistributionItem, type ProjectSummary, type TrendPoint } from "../lib/dashboard";
import { DEFAULT_APP_SETTINGS, fetchSettings } from "../lib/settingsApi";
import { formatDate } from "../lib/date";

interface ReportDashboardProps {
  records: WorkRecord[];
  trend: TrendPoint[];
  activeLabel: string;
}

interface ChartPoint {
  x: number;
  y: number;
}

const chartColors = ["#b08a54", "#355c75", "#617265", "#a84f47", "#7d6a9e", "#8b7a59"];

function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function metricValue(item: Pick<DistributionItem, "count" | "workload">): number {
  return item.workload > 0 ? item.workload : item.count;
}

function chartTotal(items: DistributionItem[]): number {
  return items.reduce((total, item) => total + metricValue(item), 0);
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

function DonutChart({ title, items }: { title: string; items: DistributionItem[] }) {
  const visibleItems = items.slice(0, 5);
  const total = chartTotal(visibleItems);
  const unit = visibleItems.some((item) => item.workload > 0) ? "当量" : "条";
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <section className="dashboard-card donut-card">
      <div className="dashboard-card-heading">
        <h3>{title}</h3>
        <span>{items.length} 类</span>
      </div>

      {visibleItems.length ? (
        <div className="donut-layout">
          <div className="donut-chart">
            <svg viewBox="0 0 150 150" role="img" aria-label={title}>
              <circle className="donut-base" cx="75" cy="75" r={radius} />
              {visibleItems.map((item, index) => {
                const value = metricValue(item);
                const dash = total ? (value / total) * circumference : 0;
                const segment = (
                  <circle
                    className="donut-segment"
                    cx="75"
                    cy="75"
                    key={item.label}
                    r={radius}
                    stroke={chartColors[index % chartColors.length]}
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += dash;
                return segment;
              })}
            </svg>
            <div className="donut-center">
              <strong>{formatMetric(total)}</strong>
              <span>{unit}</span>
            </div>
          </div>

          <div className="donut-legend">
            {visibleItems.map((item, index) => (
              <div key={item.label}>
                <i style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                <span>{item.label}</span>
                <strong>{item.ratio}%</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">暂无统计数据。</div>
      )}
    </section>
  );
}

function RadarChart({ items }: { items: DistributionItem[] }) {
  const visibleItems = items.slice(0, 6);
  const maxValue = Math.max(1, ...visibleItems.map(metricValue));
  const center = 130;
  const radius = 78;
  const canDrawRadar = visibleItems.length >= 3;
  const roseRadius = 54;
  const roseCircumference = 2 * Math.PI * roseRadius;
  const roseTotal = chartTotal(visibleItems);
  let roseOffset = 0;
  const points = canDrawRadar
    ? visibleItems.map((item, index) => {
        const angle = -90 + (360 / visibleItems.length) * index;
        return polarPoint(center, center, radius * (metricValue(item) / maxValue), angle);
      })
    : [];

  return (
    <section className="dashboard-card radar-card">
      <div className="dashboard-card-heading">
        <h3>工作类型画像</h3>
        <span>{items.length} 类</span>
      </div>

      {canDrawRadar ? (
        <div className="radar-layout">
          <svg viewBox="0 0 260 260" role="img" aria-label="工作类型雷达图">
            {[0.33, 0.66, 1].map((scale) => (
              <polygon
                className="radar-ring"
                key={scale}
                points={toPolyline(
                  visibleItems.map((_, index) =>
                    polarPoint(center, center, radius * scale, -90 + (360 / visibleItems.length) * index)
                  )
                )}
              />
            ))}
            {visibleItems.map((item, index) => {
              const axisEnd = polarPoint(center, center, radius, -90 + (360 / visibleItems.length) * index);
              const label = polarPoint(center, center, radius + 28, -90 + (360 / visibleItems.length) * index);
              return (
                <g key={item.label}>
                  <line className="radar-axis" x1={center} y1={center} x2={axisEnd.x} y2={axisEnd.y} />
                  <text
                    className="radar-label"
                    x={label.x}
                    y={label.y}
                    textAnchor={label.x < center - 8 ? "end" : label.x > center + 8 ? "start" : "middle"}
                  >
                    {item.label.length > 6 ? `${item.label.slice(0, 6)}…` : item.label}
                  </text>
                </g>
              );
            })}
            <polygon className="radar-shape" points={toPolyline(points)} />
            {points.map((point, index) => (
              <circle className="radar-dot" cx={point.x} cy={point.y} key={visibleItems[index].label} r="3.5" />
            ))}
          </svg>

          <div className="radar-legend">
            {visibleItems.map((item) => (
              <span key={item.label}>{item.label} {formatMetric(metricValue(item))}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="rose-layout">
          {visibleItems.length ? (
            <>
              <div className="rose-chart">
                <svg viewBox="0 0 150 150" role="img" aria-label="工作类型玫瑰图">
                  <circle className="rose-base" cx="75" cy="75" r={roseRadius} />
                  {visibleItems.map((item, index) => {
                    const value = metricValue(item);
                    const dash = roseTotal ? (value / roseTotal) * roseCircumference : 0;
                    const segment = (
                      <circle
                        className="rose-segment"
                        cx="75"
                        cy="75"
                        key={item.label}
                        r={roseRadius}
                        stroke={chartColors[index % chartColors.length]}
                        strokeDasharray={`${dash} ${roseCircumference - dash}`}
                        strokeDashoffset={-roseOffset}
                        strokeWidth={14 + (value / maxValue) * 10}
                      />
                    );
                    roseOffset += dash;
                    return segment;
                  })}
                </svg>
                <div className="rose-center">
                  <strong>{formatMetric(roseTotal)}</strong>
                  <span>合计</span>
                </div>
              </div>
              <div className="rose-legend">
                {visibleItems.map((item, index) => (
                  <span key={item.label}>
                    <i style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                    <strong>{item.label}</strong>
                    {formatMetric(metricValue(item))}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">暂无工作类型数据。</div>
          )}
        </div>
      )}
    </section>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const maxValue = Math.max(1, ...points.map((point) => Math.max(point.count, point.workload, point.timeHours)));

  return (
    <section className="dashboard-card trend-card">
      <div className="dashboard-card-heading">
        <h3>工作量趋势</h3>
        <span>当量 / 记录</span>
      </div>
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
      <div className="dashboard-card-heading">
        <h3>项目工作量排行</h3>
        <span>{projects.length} 个项目</span>
      </div>
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

  return (
    <section className="dashboard-card">
      <div className="dashboard-card-heading">
        <h3>工作重心排行</h3>
        <span>{weightLabel}</span>
      </div>
      <div className="project-rank-list">
        {items.slice(0, 6).map((item, index) => {
          const width = Math.max(6, (item.score / maxScore) * 100);
          return (
            <article className="project-rank-item" key={item.label}>
              <em>{String(index + 1).padStart(2, "0")}</em>
              <div>
                <strong>{item.label}</strong>
                <span>
                  {formatMetric(item.score)} 分 / {formatMetric(item.workload)} 当量 / {formatMetric(item.timeHours)}h
                </span>
                <i style={{ width: `${width}%` }} />
              </div>
            </article>
          );
        })}
        {!items.length && <div className="empty-state">暂无重心数据。</div>}
      </div>
    </section>
  );
}

function ProductMatrix({ items }: { items: DistributionItem[] }) {
  const visibleItems = items.slice(0, 8);
  const maxValue = Math.max(1, ...visibleItems.map(metricValue));

  return (
    <section className="dashboard-card product-matrix-card">
      <div className="dashboard-card-heading">
        <h3>产品系统分布</h3>
        <span>{items.length} 类</span>
      </div>
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
        <TrendChart points={trend} />
        <ProjectRank projects={analysis.projectSummaries} />
        <DonutChart title="业务分类占比" items={analysis.businessDistribution} />
        <DonutChart title="能力维度占比" items={analysis.abilityDistribution} />
        <FocusRank items={analysis.focusRankings} settings={settings} />
        <RadarChart items={analysis.workTypeDistribution} />
        <ProductMatrix items={analysis.productDistribution} />
        <section className="dashboard-card insight-card">
          <div className="dashboard-card-heading">
            <h3>本期观察</h3>
            <Layers3 size={17} />
          </div>
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
