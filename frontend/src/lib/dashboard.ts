import type { WorkRecord } from "../types";
import { formatShortDate, shiftDate } from "./date";
import { sumTimeHours, sumWorkload } from "./analysis";
import type { TrendPoint } from "./analysis";

export {
  analyzeRecords,
  buildDistribution,
  buildFocusRankings,
  buildProjectSummaries,
  sumTimeHours,
  sumWorkload
} from "./analysis";
export type {
  DashboardAnalysis,
  DistributionItem,
  FocusRankingItem,
  ProjectSummary,
  TrendPoint
} from "./analysis";

export function buildDailyTrend(records: WorkRecord[], start: string, end: string): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let cursor = start; cursor <= end; cursor = shiftDate(cursor, 1)) {
    const items = records.filter((record) => record.date === cursor);
    points.push({
      key: cursor,
      label: formatShortDate(cursor),
      count: items.length,
      workload: sumWorkload(items),
      timeHours: sumTimeHours(items)
    });
  }
  return points;
}

export function buildMonthWeekTrend(records: WorkRecord[], monthKey: string): TrendPoint[] {
  const groups = new Map<number, WorkRecord[]>();

  records.forEach((record) => {
    if (!record.date.startsWith(monthKey)) return;
    const day = Number(record.date.slice(8, 10));
    const weekIndex = Math.ceil(day / 7);
    groups.set(weekIndex, [...(groups.get(weekIndex) ?? []), record]);
  });

  return Array.from({ length: 5 }, (_, index) => {
    const weekIndex = index + 1;
    const items = groups.get(weekIndex) ?? [];
    return {
      key: `${monthKey}-W${weekIndex}`,
      label: `第${weekIndex}周`,
      count: items.length,
      workload: sumWorkload(items),
      timeHours: sumTimeHours(items)
    };
  });
}

export function buildYearMonthTrend(records: WorkRecord[], year: string): TrendPoint[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    const items = records.filter((record) => record.date.startsWith(key));
    return {
      key,
      label: `${index + 1}月`,
      count: items.length,
      workload: sumWorkload(items),
      timeHours: sumTimeHours(items)
    };
  });
}
