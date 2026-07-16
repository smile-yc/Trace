import {
  Award,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileWarning,
  Gauge,
  Link2,
  RotateCcw,
  Sparkles,
  Tags
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ExportPanel } from "../components/ExportPanel";
import { PageHeader } from "../components/PageHeader";
import { ReportDashboard } from "../components/ReportDashboard";
import { StatCards } from "../components/StatCards";
import { SummaryGroups } from "../components/SummaryGroups";
import { OutcomePeriodSection } from "../components/OutcomePeriodSection";
import { ReportReviewWorkspace } from "../components/ReportReviewWorkspace";
import type { Outcome, WorkRecord } from "../types";
import { getYearRange, shiftYear, todayKey } from "../lib/date";
import { buildYearMonthTrend, sumWorkload } from "../lib/dashboard";
import { buildAnnualOutputPackage } from "../lib/annualOutput";
import { fetchOutcomes } from "../lib/outcomeApi";
import { filterOutcomesByRange } from "../lib/outcomes";
import { countActiveMonths, countUniqueTags, filterByRange, groupByDate } from "../lib/records";
import {
  filterReportDetailRecords,
  getArchiveRange,
  getDefaultReportDetailPeriod,
  type ReportDetailMode
} from "../lib/recordFilters";

interface YearlyPageProps {
  records: WorkRecord[];
  onGenerateReport: (records: WorkRecord[], title: string) => void;
  onNotify: (message: string) => void;
}

export function YearlyPage({ records, onGenerateReport, onNotify }: YearlyPageProps) {
  const [date, setDate] = useState(todayKey());
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [workloadAdjustmentPercent, setWorkloadAdjustmentPercent] = useState(100);
  const range = useMemo(() => getYearRange(date), [date]);
  const [detailMode, setDetailMode] = useState<ReportDetailMode>("week");
  const [detailPeriod, setDetailPeriod] = useState(() =>
    getDefaultReportDetailPeriod("year", todayKey().slice(0, 4), "week", todayKey())
  );
  const defaultDetailPeriod = useMemo(
    () => getDefaultReportDetailPeriod("year", range.year, detailMode, todayKey()),
    [range.year, detailMode]
  );
  const yearlyRecords = useMemo(
    () => filterByRange(records, range.start, range.end),
    [records, range.start, range.end]
  );
  const previousRange = useMemo(() => getYearRange(shiftYear(date, -1)), [date]);
  const previousRecords = useMemo(
    () => filterByRange(records, previousRange.start, previousRange.end),
    [records, previousRange.start, previousRange.end]
  );
  const detailRecords = useMemo(
    () => filterReportDetailRecords(yearlyRecords, range, detailMode, detailPeriod, defaultDetailPeriod),
    [yearlyRecords, range, detailMode, detailPeriod, defaultDetailPeriod]
  );
  const detailGroups = useMemo(() => groupByDate(detailRecords), [detailRecords]);
  const trend = useMemo(() => buildYearMonthTrend(yearlyRecords, range.year), [yearlyRecords, range.year]);
  const title = `${range.year}年年报`;
  const activeMonths = countActiveMonths(yearlyRecords);
  const yearlyOutcomes = useMemo(() => filterOutcomesByRange(outcomes, range.start, range.end), [outcomes, range.start, range.end]);
  const annualPackage = useMemo(
    () => buildAnnualOutputPackage(yearlyRecords, yearlyOutcomes, workloadAdjustmentPercent),
    [yearlyRecords, yearlyOutcomes, workloadAdjustmentPercent]
  );
  const annualGapTotal = Object.values(annualPackage.gaps).reduce((sum, value) => sum + value, 0);
  const annualNeedsAttention = annualPackage.reminders.length > 0;
  const annualProjectMaxWorkload = Math.max(1, ...annualPackage.projects.map((project) => project.workload));
  const annualOutcomeItems = [
    { label: "正式交付", value: annualPackage.outcomeCounts.deliverable },
    { label: "重要问题解决", value: annualPackage.outcomeCounts.problemResolution },
    { label: "阶段性进展", value: annualPackage.outcomeCounts.stageProgress },
    { label: "可复用资产", value: annualPackage.outcomeCounts.reusableAsset }
  ];
  const annualOutcomeTotal = Math.max(1, annualOutcomeItems.reduce((sum, item) => sum + item.value, 0));
  const annualGapItems = [
    { label: "成果来源", value: annualPackage.gaps.missingSourceCount },
    { label: "汇报表述", value: annualPackage.gaps.missingReportSummaryCount },
    { label: "价值影响", value: annualPackage.gaps.missingValueImpactCount },
    { label: "个人贡献", value: annualPackage.gaps.missingContributionCount }
  ];
  const detailRange = getArchiveRange(detailMode, detailPeriod || defaultDetailPeriod);
  const detailStart = detailRange && detailRange.start > range.start ? detailRange.start : range.start;
  const detailEnd = detailRange && detailRange.end < range.end ? detailRange.end : range.end;

  useEffect(() => {
    setDetailMode("week");
    setDetailPeriod(getDefaultReportDetailPeriod("year", range.year, "week", todayKey()));
  }, [range.year]);

  function selectDetailMode(mode: ReportDetailMode): void {
    setDetailMode(mode);
    setDetailPeriod(getDefaultReportDetailPeriod("year", range.year, mode, todayKey()));
  }

  useEffect(() => {
    let ignore = false;

    fetchOutcomes()
      .then((nextOutcomes) => {
        if (ignore) return;
        setOutcomes(nextOutcomes.outcomes);
      })
      .catch((error) => {
        if (!ignore) onNotify(error instanceof Error ? error.message : "年报复盘数据读取失败");
      });

    return () => {
      ignore = true;
    };
  }, [onNotify]);

  return (
    <>
      <PageHeader
        eyebrow="Yearly"
        title={`${range.year} 年`}
        description={`${range.start} - ${range.end}`}
        actions={
          <>
            <button className="ghost-button" onClick={() => setDate(shiftYear(date, -1))} type="button">
              <ChevronLeft size={16} />
              去年
            </button>
            <button className="ghost-button" onClick={() => setDate(todayKey())} type="button">
              <RotateCcw size={16} />
              今年
            </button>
            <button className="ghost-button" onClick={() => setDate(shiftYear(date, 1))} type="button">
              明年
              <ChevronRight size={16} />
            </button>
            <button className="primary-button" onClick={() => onGenerateReport(yearlyRecords, title)} type="button">
              <Tags size={16} />
              按标签分组报告
            </button>
          </>
        }
      />

      <StatCards
        items={[
          { label: "全年记录数", value: yearlyRecords.length },
          { label: "有记录月份数", value: activeMonths },
          { label: "工作当量", value: sumWorkload(yearlyRecords) },
          { label: "标签数", value: countUniqueTags(yearlyRecords) }
        ]}
      />

      <ReportDashboard records={yearlyRecords} trend={trend} activeLabel={`${activeMonths} 月`} />

      <OutcomePeriodSection outcomes={yearlyOutcomes} title="年度代表性成果与进展" />

      <section className="panel annual-package-panel">
        <div className="annual-package-heading">
          <div>
            <span className="annual-package-kicker"><Award size={16} />年度汇报资产</span>
            <h2>年度成果包</h2>
            <p>把年度投入、成果证据和个人贡献整理为可直接用于总结与汇报的材料。</p>
          </div>
          <div className={`annual-package-status ${annualNeedsAttention ? "needs-attention" : "is-ready"}`}>
            {annualNeedsAttention ? <FileWarning size={18} /> : <CheckCircle2 size={18} />}
            <span>{annualNeedsAttention ? "材料待完善" : "材料状态"}</span>
            <strong>{annualGapTotal ? `${annualGapTotal} 项缺口` : annualNeedsAttention ? "待形成成果" : "证据完整"}</strong>
          </div>
        </div>

        <div className="annual-package-overview">
          <article className="annual-package-highlight">
            <span><Sparkles size={17} />可汇报成果</span>
            <strong>{annualPackage.metrics.reportableOutcomeCount}</strong>
            <p>统计阶段成果和已完成成果，作为年度总结的优先素材。</p>
            <div className="annual-evidence-summary">
              <span><Link2 size={15} /><b>{annualPackage.metrics.linkedRecordCount}</b> 条来源日报</span>
              <span><Gauge size={15} /><b>{annualPackage.metrics.linkedWorkload}</b> 关联当量</span>
            </div>
          </article>

          <div className="annual-package-metrics">
            <div><BriefcaseBusiness size={17} /><span>年度项目</span><strong>{annualPackage.metrics.projectCount}</strong></div>
            <div><Gauge size={17} /><span>原始工作当量</span><strong>{annualPackage.metrics.rawWorkload}</strong></div>
            <div><Clock3 size={17} /><span>投入小时</span><strong>{annualPackage.metrics.timeHours}</strong></div>
            <div><Link2 size={17} /><span>成果来源记录</span><strong>{annualPackage.metrics.linkedRecordCount}</strong></div>
          </div>
        </div>

        <div className="annual-package-content">
          <section className="annual-project-section">
            <div className="annual-section-heading">
              <div><h3>项目贡献材料</h3><p>按工作当量排序，辅助定位年度主要投入。</p></div>
              <span>Top {Math.min(6, annualPackage.projects.length)}</span>
            </div>
            <div className="annual-project-rank">
              {annualPackage.projects.slice(0, 6).map((project, index) => (
                <article key={project.name}>
                  <span className="annual-project-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="annual-project-copy">
                    <strong>{project.name}</strong>
                    <span>{project.recordCount} 条记录 · {project.outcomeCount} 项成果</span>
                    <i style={{ "--project-share": `${Math.max(4, project.workload / annualProjectMaxWorkload * 100)}%` } as CSSProperties} />
                  </div>
                  <div className="annual-project-values">
                    <strong>{project.workload}</strong><span>当量</span>
                    <strong>{project.timeHours}</strong><span>小时</span>
                  </div>
                </article>
              ))}
              {!annualPackage.projects.length && <p className="field-hint">本年度暂无项目投入记录。</p>}
            </div>
          </section>

          <div className="annual-package-side">
            <section className="annual-outcome-section">
              <div className="annual-section-heading"><div><h3>成果结构</h3><p>年度成果类型构成</p></div></div>
            <dl className="annual-outcome-breakdown">
                {annualOutcomeItems.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                    <i style={{ "--outcome-share": `${item.value / annualOutcomeTotal * 100}%` } as CSSProperties} />
                  </div>
                ))}
            </dl>
            </section>

            <section className="annual-gap-section">
              <div className="annual-section-heading">
                <div><h3>材料完整度</h3><p>只提示事实缺口，不评价成果价值。</p></div>
              </div>
              <div className="annual-gap-grid">
                {annualGapItems.map((item) => (
                  <div className={`annual-gap-item ${item.value ? "has-gap" : "is-complete"}`} key={item.label}>
                    {item.value ? <FileWarning size={16} /> : <CheckCircle2 size={16} />}
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.value ? "项待补" : "完整"}</small>
                  </div>
                ))}
              </div>
            <div className="annual-package-reminders">
              {annualPackage.reminders.map((message) => <p key={message}>{message}</p>)}
              {!annualPackage.reminders.length && <p>成果来源、价值影响、个人贡献和汇报表述已填写完整。</p>}
            </div>
            </section>
          </div>
        </div>
        <p className="annual-package-note">成果关联投入仅统计本年度已关联日报并按记录 ID 去重；系统不自动评价成果价值。</p>
      </section>

      <ReportReviewWorkspace
        reportType="year"
        periodKey={range.year}
        currentRecords={yearlyRecords}
        previousRecords={previousRecords}
        outcomes={yearlyOutcomes}
        onNotify={onNotify}
      />

      <section className="panel annual-adjustment-panel">
        <div className="panel-heading"><h2>年度汇报折算预览</h2><span>仅影响本次预览与导出</span></div>
        <div className="annual-adjustment-grid">
          <div><span>原始工作当量</span><strong>{sumWorkload(yearlyRecords)}</strong></div>
          <label><span>汇报折算比例</span><div><input min="0" max="1000" step="1" type="number" value={workloadAdjustmentPercent} onChange={(event) => setWorkloadAdjustmentPercent(Number(event.target.value) || 0)} /><span>%</span></div></label>
          <div><span>本次汇报当量</span><strong>{Number((sumWorkload(yearlyRecords) * workloadAdjustmentPercent / 100).toFixed(2))}</strong></div>
        </div>
        <p className="field-hint">默认 100%。不会修改日报、项目、成果或数据库中的原始工作当量。</p>
      </section>

      <ExportPanel
        records={yearlyRecords}
        title={title}
        periodType="year"
        startDate={range.start}
        endDate={range.end}
        workloadAdjustmentPercent={workloadAdjustmentPercent}
        onNotify={onNotify}
      />

      <section className="panel">
        <div className="panel-heading">
          <h2>原始明细</h2>
          <span>{detailRecords.length} 条 · {detailStart} - {detailEnd}</span>
        </div>
        <div className="report-detail-archive">
          <label>
            <span>归档方式</span>
            <select value={detailMode} onChange={(event) => selectDetailMode(event.target.value as ReportDetailMode)}>
              <option value="week">按周</option>
              <option value="month">按月</option>
            </select>
          </label>
          {detailMode === "week" ? (
            <input aria-label="选择明细周" type="week" value={detailPeriod} onChange={(event) => setDetailPeriod(event.target.value)} />
          ) : (
            <input aria-label="选择明细月份" min={`${range.year}-01`} max={`${range.year}-12`} type="month" value={detailPeriod} onChange={(event) => setDetailPeriod(event.target.value)} />
          )}
        </div>
        <SummaryGroups groups={detailGroups} emptyText={detailMode === "week" ? "该周暂无记录。" : "该月暂无记录。"} />
      </section>
    </>
  );
}
