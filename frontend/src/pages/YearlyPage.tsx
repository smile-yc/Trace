import { ChevronLeft, ChevronRight, RotateCcw, Tags } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ExportPanel } from "../components/ExportPanel";
import { PageHeader } from "../components/PageHeader";
import { ReportDashboard } from "../components/ReportDashboard";
import { StatCards } from "../components/StatCards";
import { SummaryGroups } from "../components/SummaryGroups";
import type { KnowledgeAsset, Milestone, WorkRecord } from "../types";
import { getYearRange, shiftYear, todayKey } from "../lib/date";
import { buildYearMonthTrend, sumWorkload } from "../lib/dashboard";
import { buildMonthlyReview, summarizeKnowledgeAssets, summarizeMilestones } from "../lib/growthReview";
import { fetchKnowledgeAssets } from "../lib/knowledgeApi";
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
  const [assets, setAssets] = useState<KnowledgeAsset[]>([]);
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
  const detailRecords = useMemo(
    () => filterReportDetailRecords(yearlyRecords, range, detailMode, detailPeriod, defaultDetailPeriod),
    [yearlyRecords, range, detailMode, detailPeriod, defaultDetailPeriod]
  );
  const detailGroups = useMemo(() => groupByDate(detailRecords), [detailRecords]);
  const trend = useMemo(() => buildYearMonthTrend(yearlyRecords, range.year), [yearlyRecords, range.year]);
  const title = `${range.year}年年报`;
  const activeMonths = countActiveMonths(yearlyRecords);
  const yearlyReview = useMemo(() => buildMonthlyReview(yearlyRecords, milestones, assets), [yearlyRecords, milestones, assets]);
  const milestoneSummaries = useMemo(() => summarizeMilestones(milestones), [milestones]);
  const assetSummary = useMemo(() => summarizeKnowledgeAssets(assets), [assets]);
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

    Promise.all([fetchMilestones(), fetchKnowledgeAssets()])
      .then(([nextMilestones, nextAssets]) => {
        if (ignore) return;
        setMilestones(nextMilestones);
        setAssets(nextAssets);
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

      <section className="panel review-panel">
        <div className="panel-heading">
          <h2>年报复盘增强</h2>
          <span>{assetSummary.total} 项知识资产</span>
        </div>
        <div className="review-text">{yearlyReview.text}</div>
        <div className="year-review-grid">
          <article>
            <strong>{milestoneSummaries.filter((milestone) => milestone.status === "done").length}</strong>
            <span>完成里程碑</span>
          </article>
          <article>
            <strong>{assetSummary.byStatus.published}</strong>
            <span>已发布资产</span>
          </article>
          <article>
            <strong>{assetSummary.byStatus.draft}</strong>
            <span>草稿资产</span>
          </article>
        </div>
      </section>

      <ExportPanel
        records={yearlyRecords}
        title={title}
        periodType="year"
        startDate={range.start}
        endDate={range.end}
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
