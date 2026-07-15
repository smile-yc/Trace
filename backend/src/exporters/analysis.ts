import type { WorkRecord } from "../types.js";

export interface ExportSummaryItem {
  label: string;
  count: number;
  quantity: number;
  workload: number;
  timeHours: number;
  ratio: number;
}

export interface ExportAnalysis {
  totalRecords: number;
  totalQuantity: number;
  totalWorkload: number;
  totalTimeHours: number;
  dateStart: string;
  dateEnd: string;
  activeDays: number;
  projectCount: number;
  businessCount: number;
  workTypeCount: number;
  productCount: number;
  businessSummary: ExportSummaryItem[];
  workTypeSummary: ExportSummaryItem[];
  abilitySummary: ExportSummaryItem[];
  projectSummary: ExportSummaryItem[];
  productSummary: ExportSummaryItem[];
  dateSummary: ExportSummaryItem[];
}

function numberValue(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function safeLabel(value: string | null | undefined, fallback: string): string {
  const label = String(value || "").trim();
  return label || fallback;
}

function splitLabels(value: string | null | undefined): string[] {
  const seen = new Set<string>();

  return String(value || "")
    .split(/[,，、;；\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function resolvedAbilityMetrics(record: WorkRecord): Array<{ label: string; percentage: number; workload: number; timeHours: number }> {
  const stored = (record.abilityAllocations ?? []).filter(
    (item) => item.abilityName.trim() && Number.isFinite(item.percentage) && item.percentage > 0
  );
  if (stored.length) {
    return stored.map((item) => ({
      label: item.abilityName.trim(),
      percentage: item.percentage,
      workload: item.allocatedWorkload === null ? numberValue(record.workload) * item.percentage / 100 : numberValue(item.allocatedWorkload),
      timeHours: item.allocatedTimeHours === null ? numberValue(record.timeHours) * item.percentage / 100 : numberValue(item.allocatedTimeHours)
    }));
  }

  const labels = splitLabels(record.abilityDimension);
  const fallback = labels.length ? labels : ["未填写能力"];
  const percentage = 100 / fallback.length;
  return fallback.map((label) => ({
    label,
    percentage,
    workload: numberValue(record.workload) / fallback.length,
    timeHours: numberValue(record.timeHours) / fallback.length
  }));
}

function buildAbilitySummary(records: WorkRecord[]): ExportSummaryItem[] {
  const groups = new Map<string, { count: number; workload: number; timeHours: number; weightedCount: number }>();
  records.forEach((record) => resolvedAbilityMetrics(record).forEach((allocation) => {
    const current = groups.get(allocation.label) ?? { count: 0, workload: 0, timeHours: 0, weightedCount: 0 };
    current.count += 1;
    current.workload += allocation.workload;
    current.timeHours += allocation.timeHours;
    current.weightedCount += allocation.percentage / 100;
    groups.set(allocation.label, current);
  }));
  const totalWorkload = Array.from(groups.values()).reduce((sum, item) => sum + item.workload, 0);
  const totalTime = Array.from(groups.values()).reduce((sum, item) => sum + item.timeHours, 0);
  const totalWeightedCount = Array.from(groups.values()).reduce((sum, item) => sum + item.weightedCount, 0) || 1;

  return Array.from(groups.entries())
    .map(([label, value]) => {
      const ratio = totalWorkload > 0
        ? value.workload / totalWorkload
        : totalTime > 0 ? value.timeHours / totalTime : value.weightedCount / totalWeightedCount;
      return {
        label,
        count: value.count,
        quantity: 0,
        workload: roundMetric(value.workload),
        timeHours: roundMetric(value.timeHours),
        ratio: Number((ratio * 100).toFixed(1))
      };
    })
    .sort((a, b) => b.workload - a.workload || b.timeHours - a.timeHours || b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
}

function getProjectName(record: WorkRecord): string {
  const firstTag = String(record.tags || "")
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)[0];

  return safeLabel(record.projectName || firstTag, "未归属项目");
}

export function sortRecordsForExport(records: WorkRecord[]): WorkRecord[] {
  return records.slice().sort((a, b) => a.date.localeCompare(b.date) || a.createTime - b.createTime);
}

export function sumWorkload(records: WorkRecord[]): number {
  return roundMetric(records.reduce((total, record) => total + numberValue(record.workload), 0));
}

export function sumTimeHours(records: WorkRecord[]): number {
  return roundMetric(records.reduce((total, record) => total + numberValue(record.timeHours), 0));
}

export function sumQuantity(records: WorkRecord[]): number {
  return roundMetric(records.reduce((total, record) => total + numberValue(record.quantity), 0));
}

export function buildSummary(
  records: WorkRecord[],
  getLabel: (record: WorkRecord) => string,
  fallback: string
): ExportSummaryItem[] {
  return buildMultiSummary(records, (record) => [getLabel(record)], fallback);
}

export function buildMultiSummary(
  records: WorkRecord[],
  getLabels: (record: WorkRecord) => string[],
  fallback: string
): ExportSummaryItem[] {
  const groups = new Map<string, { count: number; quantity: number; workload: number; timeHours: number }>();
  const totalWorkload = sumWorkload(records);
  const totalCount = records.length || 1;

  records.forEach((record) => {
    const labels = getLabels(record).map((label) => safeLabel(label, "")).filter(Boolean);
    const finalLabels = labels.length ? labels : [fallback];

    finalLabels.forEach((label) => {
      const current = groups.get(label) ?? { count: 0, quantity: 0, workload: 0, timeHours: 0 };
      current.count += 1;
      current.quantity += numberValue(record.quantity);
      current.workload += numberValue(record.workload);
      current.timeHours += numberValue(record.timeHours);
      groups.set(label, current);
    });
  });

  return Array.from(groups.entries())
    .map(([label, value]) => ({
      label,
      count: value.count,
      quantity: roundMetric(value.quantity),
      workload: roundMetric(value.workload),
      timeHours: roundMetric(value.timeHours),
      ratio: totalWorkload > 0 ? Math.round((value.workload / totalWorkload) * 100) : Math.round((value.count / totalCount) * 100)
    }))
    .sort((a, b) => b.workload - a.workload || b.timeHours - a.timeHours || b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
}

export function analyzeExport(records: WorkRecord[]): ExportAnalysis {
  const sortedRecords = sortRecordsForExport(records);
  const dates = Array.from(new Set(sortedRecords.map((record) => record.date))).sort();
  const businessSummary = buildSummary(records, (record) => record.businessCategory || record.category, "其他");
  const workTypeSummary = buildSummary(records, (record) => record.workType, "其他项");
  const abilitySummary = buildAbilitySummary(records);
  const projectSummary = buildSummary(records, getProjectName, "未归属项目");
  const productSummary = buildSummary(records, (record) => record.productSystem, "未填写产品");
  const dateSummary = buildSummary(records, (record) => record.date, "未填写日期").sort((a, b) =>
    a.label.localeCompare(b.label)
  );

  return {
    totalRecords: records.length,
    totalQuantity: sumQuantity(records),
    totalWorkload: sumWorkload(records),
    totalTimeHours: sumTimeHours(records),
    dateStart: dates[0] ?? "",
    dateEnd: dates[dates.length - 1] ?? "",
    activeDays: dates.length,
    projectCount: projectSummary.length,
    businessCount: businessSummary.length,
    workTypeCount: workTypeSummary.length,
    productCount: productSummary.length,
    businessSummary,
    workTypeSummary,
    abilitySummary,
    projectSummary,
    productSummary,
    dateSummary
  };
}
