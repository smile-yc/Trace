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
import { countActiveMonths, countUniqueTags, filterByRange, groupByMonth } from "../lib/records";

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
  const yearlyRecords = useMemo(
    () => filterByRange(records, range.start, range.end),
    [records, range.start, range.end]
  );
  const groups = useMemo(() => groupByMonth(yearlyRecords), [yearlyRecords]);
  const trend = useMemo(() => buildYearMonthTrend(yearlyRecords, range.year), [yearlyRecords, range.year]);
  const title = `${range.year}年年报`;
  const activeMonths = countActiveMonths(yearlyRecords);
  const yearlyReview = useMemo(() => buildMonthlyReview(yearlyRecords, milestones, assets), [yearlyRecords, milestones, assets]);
  const milestoneSummaries = useMemo(() => summarizeMilestones(milestones), [milestones]);
  const assetSummary = useMemo(() => summarizeKnowledgeAssets(assets), [assets]);

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
          <span>{yearlyRecords.length} 条</span>
        </div>
        <SummaryGroups groups={groups} emptyText="全年暂无记录。" groupType="month" />
      </section>
    </>
  );
}
