import { ChevronLeft, ChevronRight, RotateCcw, Tags } from "lucide-react";
import { useMemo, useState } from "react";
import { ExportPanel } from "../components/ExportPanel";
import { PageHeader } from "../components/PageHeader";
import { ReportDashboard } from "../components/ReportDashboard";
import { StatCards } from "../components/StatCards";
import { SummaryGroups } from "../components/SummaryGroups";
import type { WorkRecord } from "../types";
import { getYearRange, shiftYear, todayKey } from "../lib/date";
import { buildYearMonthTrend, sumWorkload } from "../lib/dashboard";
import { countActiveMonths, countUniqueTags, filterByRange, groupByMonth } from "../lib/records";

interface YearlyPageProps {
  records: WorkRecord[];
  onGenerateReport: (records: WorkRecord[], title: string) => void;
  onNotify: (message: string) => void;
}

export function YearlyPage({ records, onGenerateReport, onNotify }: YearlyPageProps) {
  const [date, setDate] = useState(todayKey());
  const range = useMemo(() => getYearRange(date), [date]);
  const yearlyRecords = useMemo(
    () => filterByRange(records, range.start, range.end),
    [records, range.start, range.end]
  );
  const groups = useMemo(() => groupByMonth(yearlyRecords), [yearlyRecords]);
  const trend = useMemo(() => buildYearMonthTrend(yearlyRecords, range.year), [yearlyRecords, range.year]);
  const title = `${range.year}年年报`;
  const activeMonths = countActiveMonths(yearlyRecords);

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
