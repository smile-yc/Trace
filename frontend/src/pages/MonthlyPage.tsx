import { ChevronLeft, ChevronRight, RotateCcw, Tags } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ExportPanel } from "../components/ExportPanel";
import { PageHeader } from "../components/PageHeader";
import { ReportDashboard } from "../components/ReportDashboard";
import { StatCards } from "../components/StatCards";
import { SummaryGroups } from "../components/SummaryGroups";
import type { AppSettings, KnowledgeAsset, Milestone, WorkRecord } from "../types";
import { formatMonthLabel, getMonthRange, shiftMonth, todayKey } from "../lib/date";
import { buildMonthWeekTrend, sumWorkload } from "../lib/dashboard";
import { buildGrowthWarnings, buildMonthlyReview } from "../lib/growthReview";
import { fetchKnowledgeAssets } from "../lib/knowledgeApi";
import { fetchMilestones } from "../lib/milestoneApi";
import { countActiveDays, countUniqueTags, filterByRange, groupByDate } from "../lib/records";
import { filterReportDetailRecords, getArchiveRange, getDefaultReportDetailPeriod } from "../lib/recordFilters";
import { DEFAULT_APP_SETTINGS, fetchSettings } from "../lib/settingsApi";

interface MonthlyPageProps {
  records: WorkRecord[];
  onGenerateReport: (records: WorkRecord[], title: string) => void;
  onNotify: (message: string) => void;
}

export function MonthlyPage({ records, onGenerateReport, onNotify }: MonthlyPageProps) {
  const [date, setDate] = useState(todayKey());
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [assets, setAssets] = useState<KnowledgeAsset[]>([]);
  const range = useMemo(() => getMonthRange(date), [date]);
  const defaultDetailWeek = useMemo(
    () => getDefaultReportDetailPeriod("month", range.monthKey, "week", todayKey()),
    [range.monthKey]
  );
  const [detailWeek, setDetailWeek] = useState(() =>
    getDefaultReportDetailPeriod("month", todayKey().slice(0, 7), "week", todayKey())
  );
  const monthlyRecords = useMemo(
    () => filterByRange(records, range.start, range.end),
    [records, range.start, range.end]
  );
  const detailRecords = useMemo(
    () => filterReportDetailRecords(monthlyRecords, range, "week", detailWeek, defaultDetailWeek),
    [monthlyRecords, range, detailWeek, defaultDetailWeek]
  );
  const detailGroups = useMemo(() => groupByDate(detailRecords), [detailRecords]);
  const trend = useMemo(() => buildMonthWeekTrend(monthlyRecords, range.monthKey), [monthlyRecords, range.monthKey]);
  const title = `${formatMonthLabel(range.monthKey)}月报`;
  const activeDays = countActiveDays(monthlyRecords);
  const review = useMemo(() => buildMonthlyReview(monthlyRecords, milestones, assets), [monthlyRecords, milestones, assets]);
  const warnings = useMemo(() => buildGrowthWarnings(monthlyRecords, settings, range.end), [monthlyRecords, settings, range.end]);
  const lastDetailWeek = useMemo(
    () => getDefaultReportDetailPeriod("month", range.monthKey, "week", range.end),
    [range.monthKey, range.end]
  );
  const detailRange = getArchiveRange("week", detailWeek || defaultDetailWeek);
  const detailStart = detailRange && detailRange.start > range.start ? detailRange.start : range.start;
  const detailEnd = detailRange && detailRange.end < range.end ? detailRange.end : range.end;

  useEffect(() => {
    setDetailWeek(defaultDetailWeek);
  }, [defaultDetailWeek]);

  useEffect(() => {
    let ignore = false;

    Promise.all([fetchSettings(), fetchMilestones(), fetchKnowledgeAssets()])
      .then(([nextSettings, nextMilestones, nextAssets]) => {
        if (ignore) return;
        setSettings(nextSettings);
        setMilestones(nextMilestones);
        setAssets(nextAssets);
      })
      .catch((error) => {
        if (!ignore) onNotify(error instanceof Error ? error.message : "月报复盘数据读取失败");
      });

    return () => {
      ignore = true;
    };
  }, [onNotify]);

  return (
    <>
      <PageHeader
        eyebrow="Monthly"
        title={formatMonthLabel(range.monthKey)}
        description={`${range.start} - ${range.end}`}
        actions={
          <>
            <button className="ghost-button" onClick={() => setDate(shiftMonth(date, -1))} type="button">
              <ChevronLeft size={16} />
              上月
            </button>
            <button className="ghost-button" onClick={() => setDate(todayKey())} type="button">
              <RotateCcw size={16} />
              本月
            </button>
            <button className="ghost-button" onClick={() => setDate(shiftMonth(date, 1))} type="button">
              下月
              <ChevronRight size={16} />
            </button>
            <button className="primary-button" onClick={() => onGenerateReport(monthlyRecords, title)} type="button">
              <Tags size={16} />
              按标签分组报告
            </button>
          </>
        }
      />

      <StatCards
        items={[
          { label: "本月记录数", value: monthlyRecords.length },
          { label: "有记录天数", value: activeDays },
          { label: "工作当量", value: sumWorkload(monthlyRecords) },
          { label: "标签数", value: countUniqueTags(monthlyRecords) }
        ]}
      />

      <ReportDashboard records={monthlyRecords} trend={trend} activeLabel={`${activeDays} 天`} />

      <section className="panel review-panel">
        <div className="panel-heading">
          <h2>月报复盘增强</h2>
          <span>{warnings.length} 条预警</span>
        </div>
        <div className="review-text">{review.text}</div>
        {warnings.length ? (
          <div className="warning-inline-list">
            {warnings.slice(0, 5).map((warning) => (
              <span className={`warning-chip ${warning.severity}`} key={`${warning.type}-${warning.label}`}>
                {warning.message}
              </span>
            ))}
          </div>
        ) : (
          <div className="field-hint">当前月份暂无能力目标预警。</div>
        )}
      </section>

      <ExportPanel
        records={monthlyRecords}
        title={title}
        periodType="month"
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
            <span>按周归档</span>
            <input min={defaultDetailWeek} max={lastDetailWeek} type="week" value={detailWeek} onChange={(event) => setDetailWeek(event.target.value)} />
          </label>
        </div>
        <SummaryGroups groups={detailGroups} emptyText="该周暂无记录。" />
      </section>
    </>
  );
}
