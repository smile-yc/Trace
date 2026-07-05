import type { WorkRecord } from "../types";
import { formatShortDate, shiftDate } from "./date";
import { splitTags } from "./records";

export interface DistributionItem {
  label: string;
  count: number;
  workload: number;
  ratio: number;
}

export interface ProjectSummary {
  projectName: string;
  count: number;
  workload: number;
  latestDate: string;
  businessCategories: string[];
  workTypes: string[];
  productSystems: string[];
  records: WorkRecord[];
}

export interface TrendPoint {
  key: string;
  label: string;
  count: number;
  workload: number;
}

export interface DashboardAnalysis {
  totalRecords: number;
  totalWorkload: number;
  projectCount: number;
  businessDistribution: DistributionItem[];
  workTypeDistribution: DistributionItem[];
  productDistribution: DistributionItem[];
  projectSummaries: ProjectSummary[];
  topBusinessLabel: string;
  topWorkTypeLabel: string;
}

function workloadOf(record: WorkRecord): number {
  return record.workload ?? 0;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function getProjectName(record: WorkRecord): string {
  const tag = splitTags(record.tags)[0];
  return record.projectName || tag || "未归属项目";
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function sumWorkload(records: WorkRecord[]): number {
  return roundMetric(records.reduce((total, record) => total + workloadOf(record), 0));
}

export function buildDistribution(
  records: WorkRecord[],
  getLabel: (record: WorkRecord) => string,
  fallback: string
): DistributionItem[] {
  const groups = new Map<string, { count: number; workload: number }>();
  const total = records.length || 1;

  records.forEach((record) => {
    const label = getLabel(record) || fallback;
    const current = groups.get(label) ?? { count: 0, workload: 0 };
    current.count += 1;
    current.workload += workloadOf(record);
    groups.set(label, current);
  });

  return Array.from(groups.entries())
    .map(([label, value]) => ({
      label,
      count: value.count,
      workload: roundMetric(value.workload),
      ratio: Math.round((value.count / total) * 100)
    }))
    .sort((a, b) => b.workload - a.workload || b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
}

export function buildProjectSummaries(records: WorkRecord[]): ProjectSummary[] {
  const groups = new Map<string, WorkRecord[]>();

  records.forEach((record) => {
    const projectName = getProjectName(record);
    groups.set(projectName, [...(groups.get(projectName) ?? []), record]);
  });

  return Array.from(groups.entries())
    .map(([projectName, items]) => {
      const sortedItems = items.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createTime - a.createTime);
      return {
        projectName,
        count: items.length,
        workload: sumWorkload(items),
        latestDate: sortedItems[0]?.date ?? "",
        businessCategories: uniqueValues(items.map((item) => item.businessCategory || item.category)),
        workTypes: uniqueValues(items.map((item) => item.workType || "其他项")),
        productSystems: uniqueValues(items.map((item) => item.productSystem)),
        records: sortedItems
      };
    })
    .sort((a, b) => b.workload - a.workload || b.count - a.count || a.projectName.localeCompare(b.projectName, "zh-CN"));
}

export function analyzeRecords(records: WorkRecord[]): DashboardAnalysis {
  const projectSummaries = buildProjectSummaries(records);
  const businessDistribution = buildDistribution(
    records,
    (record) => record.businessCategory || record.category,
    "其他"
  );
  const workTypeDistribution = buildDistribution(records, (record) => record.workType, "其他项");
  const productDistribution = buildDistribution(records, (record) => record.productSystem, "未填写产品");

  return {
    totalRecords: records.length,
    totalWorkload: sumWorkload(records),
    projectCount: projectSummaries.length,
    businessDistribution,
    workTypeDistribution,
    productDistribution,
    projectSummaries,
    topBusinessLabel: businessDistribution[0]?.label ?? "暂无",
    topWorkTypeLabel: workTypeDistribution[0]?.label ?? "暂无"
  };
}

export function buildDailyTrend(records: WorkRecord[], start: string, end: string): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let cursor = start; cursor <= end; cursor = shiftDate(cursor, 1)) {
    const items = records.filter((record) => record.date === cursor);
    points.push({
      key: cursor,
      label: formatShortDate(cursor),
      count: items.length,
      workload: sumWorkload(items)
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
      workload: sumWorkload(items)
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
      workload: sumWorkload(items)
    };
  });
}
