import { ChevronLeft, ChevronRight, RotateCcw, Tags } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
        <div className="panel-heading">
          <h2>年度成果包</h2>
          <span>{annualPackage.metrics.reportableOutcomeCount} 项可汇报成果</span>
        </div>
        <div className="annual-package-metrics">
          <div><strong>{annualPackage.metrics.projectCount}</strong><span>年度项目</span></div>
          <div><strong>{annualPackage.metrics.rawWorkload}</strong><span>原始工作当量</span></div>
          <div><strong>{annualPackage.metrics.timeHours}</strong><span>投入小时</span></div>
          <div><strong>{annualPackage.metrics.linkedRecordCount}</strong><span>成果来源记录</span></div>
        </div>
        <div className="annual-package-grid">
          <div>
            <h3>项目贡献材料</h3>
            <div className="annual-project-list">
              {annualPackage.projects.slice(0, 6).map((project) => (
                <div key={project.name}>
                  <strong>{project.name}</strong>
                  <span>{project.workload} 当量 · {project.timeHours} 小时 · {project.outcomeCount} 项成果</span>
                </div>
              ))}
              {!annualPackage.projects.length && <p className="field-hint">本年度暂无项目投入记录。</p>}
            </div>
          </div>
          <div>
            <h3>成果结构</h3>
            <dl className="annual-outcome-breakdown">
              <div><dt>正式交付</dt><dd>{annualPackage.outcomeCounts.deliverable}</dd></div>
              <div><dt>重要问题解决</dt><dd>{annualPackage.outcomeCounts.problemResolution}</dd></div>
              <div><dt>阶段性进展</dt><dd>{annualPackage.outcomeCounts.stageProgress}</dd></div>
              <div><dt>可复用资产</dt><dd>{annualPackage.outcomeCounts.reusableAsset}</dd></div>
            </dl>
          </div>
          <div>
            <h3>材料待补充</h3>
            <div className="annual-package-reminders">
              {annualPackage.reminders.map((message) => <p key={message}>{message}</p>)}
              {!annualPackage.reminders.length && <p>成果来源、价值影响、个人贡献和汇报表述已填写完整。</p>}
            </div>
          </div>
        </div>
        <p className="field-hint">成果关联投入仅统计本年度已关联日报并按记录 ID 去重；系统不自动评价成果价值。</p>
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
