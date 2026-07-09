import type { AppSettings, KnowledgeAsset, KnowledgeAssetStatus, Milestone, WorkRecord } from "../types";

export type GrowthWarningType = "missing-ability" | "stale-ability" | "target-gap";

export interface GrowthWarning {
  type: GrowthWarningType;
  label: string;
  message: string;
  severity: "info" | "warning" | "danger";
  actualPercent?: number;
  targetPercent?: number;
  daysSinceLastRecord?: number;
}

export interface MilestoneSummary extends Milestone {
  progress: number;
  status: "done" | "active" | "idle";
}

export interface KnowledgeAssetSummary {
  total: number;
  byStatus: Record<KnowledgeAssetStatus, number>;
  byType: Record<string, number>;
}

export interface MonthlyReview {
  title: string;
  lines: string[];
  text: string;
}

function numberValue(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function roundPercent(value: number): number {
  return Number(value.toFixed(1));
}

function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

function firstTag(tags: string): string {
  return String(tags || "")
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)[0] ?? "";
}

function getProjectName(record: WorkRecord): string {
  return record.projectName || firstTag(record.tags) || "未归属项目";
}

function sumWorkload(records: WorkRecord[]): number {
  return roundMetric(records.reduce((total, record) => total + numberValue(record.workload), 0));
}

function sumTimeHours(records: WorkRecord[]): number {
  return roundMetric(records.reduce((total, record) => total + numberValue(record.timeHours), 0));
}

function topGroup(records: WorkRecord[], getLabel: (record: WorkRecord) => string): {
  label: string;
  count: number;
  workload: number;
  timeHours: number;
} | null {
  const groups = new Map<string, { count: number; workload: number; timeHours: number }>();

  records.forEach((record) => {
    const label = getLabel(record);
    const current = groups.get(label) ?? { count: 0, workload: 0, timeHours: 0 };
    current.count += 1;
    current.workload += numberValue(record.workload);
    current.timeHours += numberValue(record.timeHours);
    groups.set(label, current);
  });

  return Array.from(groups.entries())
    .map(([label, value]) => ({
      label,
      count: value.count,
      workload: roundMetric(value.workload),
      timeHours: roundMetric(value.timeHours)
    }))
    .sort((a, b) => b.workload - a.workload || b.timeHours - a.timeHours || b.count - a.count || a.label.localeCompare(b.label, "zh-CN"))[0] ?? null;
}

function parseDate(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return new Date(`${date}T00:00:00.000Z`);
}

function daysBetween(start: string, end: string): number | null {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return null;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000);
}

function targetEntries(settings?: Partial<AppSettings>): Array<[string, number]> {
  return Object.entries(settings?.abilityTargets ?? {})
    .map(([label, value]) => [label.trim(), Number(value)] as [string, number])
    .filter(([label, value]) => Boolean(label) && Number.isFinite(value) && value > 0);
}

function workloadShareByAbility(records: WorkRecord[]): Record<string, number> {
  const totalWorkload = records.reduce((total, record) => total + numberValue(record.workload), 0);
  const totalCount = records.length || 1;
  const values = new Map<string, number>();

  records.forEach((record) => {
    const labels = parseAbilityDimensions(record.abilityDimension);
    const finalLabels = labels.length ? labels : ["未填写能力"];
    const value = totalWorkload > 0 ? numberValue(record.workload) : 1;
    finalLabels.forEach((label) => values.set(label, (values.get(label) ?? 0) + value));
  });

  return Array.from(values.entries()).reduce<Record<string, number>>((shares, [label, value]) => {
    shares[label] = totalWorkload > 0 ? (value / totalWorkload) * 100 : (value / totalCount) * 100;
    return shares;
  }, {});
}

export function buildGrowthWarnings(
  records: WorkRecord[],
  settings?: Partial<AppSettings>,
  asOfDate = new Date().toISOString().slice(0, 10)
): GrowthWarning[] {
  const abilityNoRecordDays = Math.max(1, Number(settings?.warningRules?.abilityNoRecordDays ?? 30));
  const deviation = Math.max(0, Number(settings?.warningRules?.targetShareDeviationPercent ?? 10));
  const shares = workloadShareByAbility(records);
  const warnings: GrowthWarning[] = [];

  targetEntries(settings).forEach(([label, targetPercent]) => {
    const relatedRecords = records
      .filter((record) => parseAbilityDimensions(record.abilityDimension).includes(label))
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!relatedRecords.length) {
      warnings.push({
        type: "missing-ability",
        label,
        severity: "danger",
        targetPercent,
        actualPercent: 0,
        message: `${label} 尚无记录，建议补充对应日报或下调目标占比。`
      });
    } else {
      const days = daysBetween(relatedRecords[0].date, asOfDate);
      if (days !== null && days > abilityNoRecordDays) {
        warnings.push({
          type: "stale-ability",
          label,
          severity: "warning",
          daysSinceLastRecord: days,
          message: `${label} 已 ${days} 天没有新增记录，超过 ${abilityNoRecordDays} 天预警阈值。`
        });
      }
    }

    const actualPercent = roundPercent(shares[label] ?? 0);
    if (targetPercent - actualPercent > deviation) {
      warnings.push({
        type: "target-gap",
        label,
        severity: "warning",
        targetPercent,
        actualPercent,
        message: `${label} 当前占比 ${actualPercent}%，低于目标 ${targetPercent}%。`
      });
    }
  });

  return warnings;
}

export function summarizeMilestones(milestones: Milestone[]): MilestoneSummary[] {
  return milestones
    .filter((milestone) => milestone.enabled)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createTime - b.createTime)
    .map((milestone) => {
      const progress =
        milestone.targetValue > 0 ? Math.min(100, Math.max(0, roundPercent((milestone.currentValue / milestone.targetValue) * 100))) : 0;

      return {
        ...milestone,
        progress,
        status: progress >= 100 ? "done" : progress > 0 ? "active" : "idle"
      };
    });
}

export function summarizeKnowledgeAssets(assets: KnowledgeAsset[]): KnowledgeAssetSummary {
  return assets.reduce<KnowledgeAssetSummary>(
    (summary, asset) => {
      summary.total += 1;
      summary.byStatus[asset.status] = (summary.byStatus[asset.status] ?? 0) + 1;
      summary.byType[asset.type || "未分类"] = (summary.byType[asset.type || "未分类"] ?? 0) + 1;
      return summary;
    },
    {
      total: 0,
      byStatus: { draft: 0, published: 0, archived: 0 },
      byType: {}
    }
  );
}

export function buildMonthlyReview(
  records: WorkRecord[],
  milestones: Milestone[] = [],
  assets: KnowledgeAsset[] = []
): MonthlyReview {
  const topProject = topGroup(records, getProjectName);
  const topAbility = topGroup(
    records.flatMap((record) => {
      const abilities = parseAbilityDimensions(record.abilityDimension);
      return (abilities.length ? abilities : ["未填写能力"]).map((ability) => ({
        ...record,
        abilityDimension: ability
      }));
    }),
    (record) => record.abilityDimension || "未填写能力"
  );
  const milestoneSummaries = summarizeMilestones(milestones);
  const assetSummary = summarizeKnowledgeAssets(assets);
  const lines = [
    `本月共记录 ${records.length} 条，形成 ${formatMetric(sumWorkload(records))} 工作当量，投入 ${formatMetric(sumTimeHours(records))} 小时。`,
    topProject
      ? `项目投入以 ${topProject.label} 为主，累计 ${formatMetric(topProject.workload)} 当量、${topProject.count} 条记录。`
      : "本月暂无可归属项目记录。",
    topAbility
      ? `能力维度集中在 ${topAbility.label}，对应 ${formatMetric(topAbility.workload)} 当量、${formatMetric(topAbility.timeHours)} 小时。`
      : "本月暂无能力维度数据。",
    topProject ? `综合工作重心排名第一为 ${topProject.label}。` : "本月暂无工作重心排名。"
  ];

  if (milestoneSummaries.length) {
    const milestoneLine = milestoneSummaries
      .slice(0, 3)
      .map((milestone) => `${milestone.name} ${formatMetric(milestone.progress)}%`)
      .join("；");
    lines.push(`里程碑推进：${milestoneLine}。`);
  } else {
    lines.push("里程碑推进：暂无启用里程碑。");
  }

  if (assets.length) {
    const titles = assets
      .slice()
      .sort((a, b) => b.updateTime - a.updateTime)
      .slice(0, 3)
      .map((asset) => asset.title)
      .join("、");
    lines.push(`知识资产沉淀：本月共 ${assetSummary.total} 项，代表资产包括 ${titles}。`);
  } else {
    lines.push("知识资产沉淀：本月暂无新增资产。");
  }

  return {
    title: "月报复盘",
    lines,
    text: lines.join("\n")
  };
}
