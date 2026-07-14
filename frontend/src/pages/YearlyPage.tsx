import { ChevronLeft, ChevronRight, RotateCcw, Tags } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ExportPanel } from "../components/ExportPanel";
import { PageHeader } from "../components/PageHeader";
import { ReportDashboard } from "../components/ReportDashboard";
import { StatCards } from "../components/StatCards";
import { SummaryGroups } from "../components/SummaryGroups";
import { OutcomePeriodSection } from "../components/OutcomePeriodSection";
import { ReportReviewWorkspace } from "../components/ReportReviewWorkspace";
import type { Milestone, Outcome, WorkRecord } from "../types";
import { getYearRange, shiftYear, todayKey } from "../lib/date";
import { buildYearMonthTrend, sumWorkload } from "../lib/dashboard";
import { buildMonthlyReview, summarizeMilestones } from "../lib/growthReview";
import { fetchOutcomes } from "../lib/outcomeApi";
import { filterOutcomesByRange } from "../lib/outcomes";
import { fetchMilestones } from "../lib/milestoneApi";
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
  const [milestones, setMilestones] = useState<Milestone[]>([]);
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
  const yearlyReview = useMemo(() => buildMonthlyReview(yearlyRecords, milestones), [yearlyRecords, milestones]);
  const yearlyOutcomes = useMemo(() => filterOutcomesByRange(outcomes, range.start, range.end), [outcomes, range.start, range.end]);
  const milestoneSummaries = useMemo(() => summarizeMilestones(milestones), [milestones]);
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

    Promise.all([fetchMilestones(), fetchOutcomes()])
      .then(([nextMilestones, nextOutcomes]) => {
        if (ignore) return;
        setMilestones(nextMilestones);
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

      <section className="panel review-panel">
        <div className="panel-heading">
          <h2>年报复盘增强</h2>
          <span>{yearlyOutcomes.length} 项成果</span>
        </div>
        <div className="review-text">{yearlyReview.text}</div>
        <div className="year-review-grid">
          <article>
            <strong>{milestoneSummaries.filter((milestone) => milestone.status === "done").length}</strong>
            <span>完成里程碑</span>
          </article>
          <article>
            <strong>{yearlyOutcomes.filter((outcome) => outcome.status === "completed").length}</strong>
            <span>已完成成果</span>
          </article>
          <article>
            <strong>{yearlyOutcomes.filter((outcome) => outcome.type === "problem_resolution").length}</strong>
            <span>重要问题解决</span>
          </article>
        </div>
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
