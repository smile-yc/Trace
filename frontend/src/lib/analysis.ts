import type { AppSettings, FocusScoreWeights, WorkRecord } from "../types";

export const DEFAULT_FOCUS_SCORE_WEIGHTS: FocusScoreWeights = {
  workload: 50,
  timeHours: 30,
  recordCount: 20
};

export interface DistributionItem {
  label: string;
  count: number;
  workload: number;
  timeHours: number;
  ratio: number;
}

export interface ProjectSummary {
  projectName: string;
  count: number;
  workload: number;
  timeHours: number;
  latestDate: string;
  businessCategories: string[];
  workTypes: string[];
  abilityDimensions: string[];
  productSystems: string[];
  records: WorkRecord[];
}

export interface FocusRankingItem {
  label: string;
  count: number;
  workload: number;
  timeHours: number;
  workloadShare: number;
  timeShare: number;
  countShare: number;
  score: number;
}

export interface TrendPoint {
  key: string;
  label: string;
  count: number;
  workload: number;
  timeHours: number;
}

export interface DashboardAnalysis {
  totalRecords: number;
  totalWorkload: number;
  totalTimeHours: number;
  projectCount: number;
  businessDistribution: DistributionItem[];
  workTypeDistribution: DistributionItem[];
  abilityDistribution: DistributionItem[];
  productDistribution: DistributionItem[];
  projectSummaries: ProjectSummary[];
  focusRankings: FocusRankingItem[];
  topBusinessLabel: string;
  topWorkTypeLabel: string;
}

export interface AnalysisOptions {
  focusScoreWeights?: Partial<FocusScoreWeights>;
}

function numberValue(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function workloadOf(record: WorkRecord): number {
  return numberValue(record.workload);
}

function timeOf(record: WorkRecord): number {
  return numberValue(record.timeHours);
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function roundShare(value: number): number {
  return Number(value.toFixed(4));
}

function parseAbilityDimensions(value: string | null | undefined): string[] {
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

function normalizeFocusScoreWeights(weights?: Partial<FocusScoreWeights>): FocusScoreWeights {
  const merged = {
    workload: Number.isFinite(Number(weights?.workload)) ? Math.max(0, Number(weights?.workload)) : DEFAULT_FOCUS_SCORE_WEIGHTS.workload,
    timeHours: Number.isFinite(Number(weights?.timeHours)) ? Math.max(0, Number(weights?.timeHours)) : DEFAULT_FOCUS_SCORE_WEIGHTS.timeHours,
    recordCount: Number.isFinite(Number(weights?.recordCount)) ? Math.max(0, Number(weights?.recordCount)) : DEFAULT_FOCUS_SCORE_WEIGHTS.recordCount
  };
  const total = merged.workload + merged.timeHours + merged.recordCount;

  if (total <= 0) return DEFAULT_FOCUS_SCORE_WEIGHTS;

  return {
    workload: (merged.workload / total) * 100,
    timeHours: (merged.timeHours / total) * 100,
    recordCount: (merged.recordCount / total) * 100
  };
}

function normalizeAnalysisOptions(options?: AnalysisOptions | Partial<AppSettings>): AnalysisOptions {
  return {
    focusScoreWeights: options?.focusScoreWeights
  };
}

function firstTag(tags: string): string {
  return String(tags || "")
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)[0] ?? "";
}

function getProjectName(record: WorkRecord): string {
  return record.projectName || firstTag(record.tags) || "未归属项目";
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function sumWorkload(records: WorkRecord[]): number {
  return roundMetric(records.reduce((total, record) => total + workloadOf(record), 0));
}

export function sumTimeHours(records: WorkRecord[]): number {
  return roundMetric(records.reduce((total, record) => total + timeOf(record), 0));
}

export function buildDistribution(
  records: WorkRecord[],
  getLabel: (record: WorkRecord) => string,
  fallback: string
): DistributionItem[] {
  return buildMultiDistribution(records, (record) => [getLabel(record)], fallback);
}

export function buildMultiDistribution(
  records: WorkRecord[],
  getLabels: (record: WorkRecord) => string[],
  fallback: string
): DistributionItem[] {
  const groups = new Map<string, { count: number; workload: number; timeHours: number }>();
  const total = records.length || 1;

  records.forEach((record) => {
    const labels = getLabels(record).map((label) => label.trim()).filter(Boolean);
    const finalLabels = labels.length ? labels : [fallback];

    finalLabels.forEach((label) => {
      const current = groups.get(label) ?? { count: 0, workload: 0, timeHours: 0 };
      current.count += 1;
      current.workload += workloadOf(record);
      current.timeHours += timeOf(record);
      groups.set(label, current);
    });
  });

  return Array.from(groups.entries())
    .map(([label, value]) => ({
      label,
      count: value.count,
      workload: roundMetric(value.workload),
      timeHours: roundMetric(value.timeHours),
      ratio: Math.round((value.count / total) * 100)
    }))
    .sort((a, b) => b.workload - a.workload || b.timeHours - a.timeHours || b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
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
        timeHours: sumTimeHours(items),
        latestDate: sortedItems[0]?.date ?? "",
        businessCategories: uniqueValues(items.map((item) => item.businessCategory || item.category)),
        workTypes: uniqueValues(items.map((item) => item.workType || "其他项")),
        abilityDimensions: uniqueValues(items.flatMap((item) => parseAbilityDimensions(item.abilityDimension))),
        productSystems: uniqueValues(items.map((item) => item.productSystem)),
        records: sortedItems
      };
    })
    .sort((a, b) => b.workload - a.workload || b.timeHours - a.timeHours || b.count - a.count || a.projectName.localeCompare(b.projectName, "zh-CN"));
}

export function buildFocusRankings(records: WorkRecord[], weights?: Partial<FocusScoreWeights>): FocusRankingItem[] {
  const normalizedWeights = normalizeFocusScoreWeights(weights);
  const totalWorkload = records.reduce((total, record) => total + workloadOf(record), 0);
  const totalTime = records.reduce((total, record) => total + timeOf(record), 0);
  const totalCount = records.length || 1;

  return buildProjectSummaries(records)
    .map((project) => {
      const workloadShare = totalWorkload > 0 ? project.workload / totalWorkload : 0;
      const timeShare = totalTime > 0 ? project.timeHours / totalTime : 0;
      const countShare = project.count / totalCount;
      const score =
        workloadShare * normalizedWeights.workload +
        timeShare * normalizedWeights.timeHours +
        countShare * normalizedWeights.recordCount;

      return {
        label: project.projectName,
        count: project.count,
        workload: project.workload,
        timeHours: project.timeHours,
        workloadShare: roundShare(workloadShare),
        timeShare: roundShare(timeShare),
        countShare: roundShare(countShare),
        score: roundMetric(score)
      };
    })
    .sort((a, b) => b.score - a.score || b.workload - a.workload || a.label.localeCompare(b.label, "zh-CN"));
}

export function analyzeRecords(records: WorkRecord[], options?: AnalysisOptions | Partial<AppSettings>): DashboardAnalysis {
  const normalizedOptions = normalizeAnalysisOptions(options);
  const projectSummaries = buildProjectSummaries(records);
  const businessDistribution = buildDistribution(
    records,
    (record) => record.businessCategory || record.category,
    "其他"
  );
  const workTypeDistribution = buildDistribution(records, (record) => record.workType, "其他项");
  const abilityDistribution = buildMultiDistribution(records, (record) => parseAbilityDimensions(record.abilityDimension), "未填写能力");
  const productDistribution = buildDistribution(records, (record) => record.productSystem, "未填写产品");

  return {
    totalRecords: records.length,
    totalWorkload: sumWorkload(records),
    totalTimeHours: sumTimeHours(records),
    projectCount: projectSummaries.length,
    businessDistribution,
    workTypeDistribution,
    abilityDistribution,
    productDistribution,
    projectSummaries,
    focusRankings: buildFocusRankings(records, normalizedOptions.focusScoreWeights),
    topBusinessLabel: businessDistribution[0]?.label ?? "暂无",
    topWorkTypeLabel: workTypeDistribution[0]?.label ?? "暂无"
  };
}
