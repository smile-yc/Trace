import { ChevronLeft, ChevronRight, Tags, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ExportPanel } from "../components/ExportPanel";
import { PageHeader } from "../components/PageHeader";
import { ReportDashboard } from "../components/ReportDashboard";
import { StatCards } from "../components/StatCards";
import { SummaryGroups } from "../components/SummaryGroups";
import { OutcomePeriodSection } from "../components/OutcomePeriodSection";
import { ReportReviewWorkspace } from "../components/ReportReviewWorkspace";
import type { Outcome, WorkRecord } from "../types";
import { formatDate, getWeekNumber, getWeekRange, shiftDate, todayKey } from "../lib/date";
import { buildDailyTrend, sumWorkload } from "../lib/dashboard";
import { countActiveDays, countUniqueTags, filterByRange, groupByDate } from "../lib/records";
import { fetchOutcomes } from "../lib/outcomeApi";
import { filterOutcomesByRange } from "../lib/outcomes";

interface WeeklyPageProps {
  records: WorkRecord[];
  onGenerateReport: (records: WorkRecord[], title: string) => void;
  onNotify: (message: string) => void;
}

export function WeeklyPage({ records, onGenerateReport, onNotify }: WeeklyPageProps) {
  const [date, setDate] = useState(todayKey());
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const range = useMemo(() => getWeekRange(date), [date]);
  const weeklyRecords = useMemo(
    () => filterByRange(records, range.start, range.end),
    [records, range.start, range.end]
  );
  const previousRange = useMemo(() => getWeekRange(shiftDate(date, -7)), [date]);
  const previousRecords = useMemo(
    () => filterByRange(records, previousRange.start, previousRange.end),
    [records, previousRange.start, previousRange.end]
  );
  const groups = useMemo(() => groupByDate(weeklyRecords), [weeklyRecords]);
  const trend = useMemo(() => buildDailyTrend(weeklyRecords, range.start, range.end), [weeklyRecords, range.start, range.end]);
  const title = `${formatDate(range.start)} 至 ${formatDate(range.end)} 周报`;
  const activeDays = countActiveDays(weeklyRecords);
  const weeklyOutcomes = useMemo(() => filterOutcomesByRange(outcomes, range.start, range.end), [outcomes, range.start, range.end]);

  useEffect(() => {
    fetchOutcomes().then((result) => setOutcomes(result.outcomes))
      .catch((error) => onNotify(error instanceof Error ? error.message : "周报成果读取失败"));
  }, [range.start, onNotify]);

  return (
    <>
      <PageHeader
        eyebrow="Weekly"
        title={`第 ${getWeekNumber(date)} 周`}
        description={`${formatDate(range.start)} - ${formatDate(range.end)}`}
        actions={
          <>
            <button className="ghost-button" onClick={() => setDate(shiftDate(date, -7))} type="button">
              <ChevronLeft size={16} />
              上一周
            </button>
            <button className="ghost-button" onClick={() => setDate(todayKey())} type="button">
              <RotateCcw size={16} />
              本周
            </button>
            <button className="ghost-button" onClick={() => setDate(shiftDate(date, 7))} type="button">
              下一周
              <ChevronRight size={16} />
            </button>
            <button className="primary-button" onClick={() => onGenerateReport(weeklyRecords, title)} type="button">
              <Tags size={16} />
              按标签分组报告
            </button>
          </>
        }
      />

      <StatCards
        items={[
          { label: "本周记录数", value: weeklyRecords.length },
          { label: "有记录天数", value: activeDays },
          { label: "工作当量", value: sumWorkload(weeklyRecords) },
          { label: "标签数", value: countUniqueTags(weeklyRecords) }
        ]}
      />

      <ReportDashboard records={weeklyRecords} trend={trend} activeLabel={`${activeDays} 天`} />

      <OutcomePeriodSection outcomes={weeklyOutcomes} title="本周成果与进展" />

      <ReportReviewWorkspace
        reportType="week"
        periodKey={range.start}
        currentRecords={weeklyRecords}
        previousRecords={previousRecords}
        outcomes={weeklyOutcomes}
        onNotify={onNotify}
      />

      <ExportPanel
        records={weeklyRecords}
        title={title}
        periodType="week"
        startDate={range.start}
        endDate={range.end}
        onNotify={onNotify}
      />

      <section className="panel">
        <div className="panel-heading">
          <h2>原始明细</h2>
          <span>{weeklyRecords.length} 条</span>
        </div>
        <SummaryGroups groups={groups} emptyText="本周暂无记录。" />
      </section>
    </>
  );
}
