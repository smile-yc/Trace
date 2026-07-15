import type { Outcome, WorkRecord } from "../types";

export interface ReportComparisonMetric {
  key: "recordCount" | "workload" | "timeHours";
  label: string;
  current: number;
  previous: number;
  deltaPercent: number;
}

export interface ReportInsights {
  comparison: ReportComparisonMetric[];
  concentration: { projectName: string; share: number; records: WorkRecord[] };
  output: {
    completedOutcomeCount: number;
    linkedRecordCount: number;
    linkedWorkload: number;
    unlinkedOutcomeCount: number;
    outcomes: Outcome[];
  };
  reminders: string[];
}

function sum(records: WorkRecord[], field: "workload" | "timeHours"): number {
  return records.reduce((total, record) => total + (record[field] ?? 0), 0);
}

function delta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Number(((current - previous) / previous * 100).toFixed(1));
}

export function buildReportInsights(current: WorkRecord[], previous: WorkRecord[], outcomes: Outcome[]): ReportInsights {
  const currentWorkload = sum(current, "workload");
  const previousWorkload = sum(previous, "workload");
  const currentTime = sum(current, "timeHours");
  const previousTime = sum(previous, "timeHours");
  const comparison: ReportComparisonMetric[] = [
    { key: "recordCount", label: "记录数", current: current.length, previous: previous.length, deltaPercent: delta(current.length, previous.length) },
    { key: "workload", label: "工作当量", current: currentWorkload, previous: previousWorkload, deltaPercent: delta(currentWorkload, previousWorkload) },
    { key: "timeHours", label: "投入工时", current: currentTime, previous: previousTime, deltaPercent: delta(currentTime, previousTime) }
  ];
  const groups = new Map<string, WorkRecord[]>();
  current.forEach((record) => {
    const key = record.projectName || "非项目事项";
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });
  const ranked = Array.from(groups.entries()).map(([projectName, records]) => ({
    projectName, records, value: currentWorkload > 0 ? sum(records, "workload") : records.length
  })).sort((a, b) => b.value - a.value);
  const top = ranked[0] ?? { projectName: "暂无", records: [], value: 0 };
  const denominator = currentWorkload > 0 ? currentWorkload : current.length;
  const concentration = { projectName: top.projectName, share: denominator > 0 ? Number((top.value / denominator * 100).toFixed(1)) : 0, records: top.records };
  const completedOutcomes = outcomes.filter((outcome) => ["stage_result", "completed"].includes(outcome.status));
  const currentById = new Map(current.map((record) => [record.id, record]));
  const linkedRecordIds = new Set(completedOutcomes.flatMap((outcome) => outcome.recordIds ?? []).filter((id) => currentById.has(id)));
  const linkedRecords = Array.from(linkedRecordIds).map((id) => currentById.get(id) as WorkRecord);
  const output = {
    completedOutcomeCount: completedOutcomes.length,
    linkedRecordCount: linkedRecords.length,
    linkedWorkload: Number(sum(linkedRecords, "workload").toFixed(2)),
    unlinkedOutcomeCount: completedOutcomes.filter((outcome) => !(outcome.recordIds ?? []).some((id) => currentById.has(id))).length,
    outcomes: completedOutcomes
  };
  const reminders: string[] = [];
  if (!current.length) reminders.push("当前周期没有工作记录，请确认是否存在漏记。");
  if (current.length >= 3 && concentration.share >= 70) reminders.push(`投入集中在“${concentration.projectName}” (${concentration.share}%)，请确认是否符合当前重点。`);
  if (currentWorkload > 0 && !completedOutcomes.length) reminders.push("已有投入但尚未形成成果证据，下一周期应补充阶段进展或成果。");
  if (output.unlinkedOutcomeCount > 0) reminders.push(`${output.unlinkedOutcomeCount} 项成果未关联当前周期日报，无法计算成果关联投入。`);
  if (comparison[1].deltaPercent <= -20) reminders.push("工作当量较上期下降超过 20%，请在复盘中说明原因。");
  if (completedOutcomes.length) reminders.push("本周期已有成果，可补充价值影响和个人贡献用于汇报。");
  return { comparison, concentration, output, reminders };
}

export function buildAutomaticReportSummary(insights: ReportInsights): string {
  const records = insights.comparison.find((item) => item.key === "recordCount");
  const workload = insights.comparison.find((item) => item.key === "workload");
  const time = insights.comparison.find((item) => item.key === "timeHours");
  return [
    `本周期记录 ${records?.current ?? 0} 项，工作当量 ${workload?.current ?? 0}，投入工时 ${time?.current ?? 0}。`,
    `较上期工作当量${(workload?.deltaPercent ?? 0) >= 0 ? "增加" : "减少"} ${Math.abs(workload?.deltaPercent ?? 0)}%。`,
    `投入最高的项目为“${insights.concentration.projectName}”，占比 ${insights.concentration.share}%。`,
    `形成 ${insights.output.completedOutcomeCount} 项阶段性或已完成成果，其中 ${insights.output.linkedRecordCount} 条当前周期记录提供了直接投入证据。`
  ].join("\n");
}
