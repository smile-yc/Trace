import type { Outcome, WorkRecord } from "../types.js";

export interface AnnualProjectContribution {
  name: string;
  recordCount: number;
  timeHours: number;
  workload: number;
  outcomeCount: number;
  recordIds: string[];
  outcomeIds: string[];
}

export interface AnnualOutputPackage {
  metrics: {
    recordCount: number;
    activeMonths: number;
    projectCount: number;
    timeHours: number;
    rawWorkload: number;
    adjustedWorkload: number;
    reportableOutcomeCount: number;
    linkedRecordCount: number;
    linkedTimeHours: number;
    linkedWorkload: number;
  };
  outcomeCounts: { deliverable: number; problemResolution: number; stageProgress: number; reusableAsset: number };
  projects: AnnualProjectContribution[];
  reportableOutcomes: Outcome[];
  gaps: { missingSourceCount: number; missingReportSummaryCount: number; missingValueImpactCount: number; missingContributionCount: number };
  reminders: string[];
}

function numberValue(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

export function buildAnnualOutputPackage(records: WorkRecord[], outcomes: Outcome[], workloadAdjustmentPercent = 100): AnnualOutputPackage {
  const currentById = new Map(records.map((record) => [record.id, record]));
  const reportableOutcomes = outcomes.filter((outcome) => ["stage_result", "completed"].includes(outcome.status));
  const linkedRecordIds = new Set(reportableOutcomes.flatMap((outcome) => outcome.recordIds ?? []).filter((id) => currentById.has(id)));
  const linkedRecords = Array.from(linkedRecordIds).map((id) => currentById.get(id) as WorkRecord);
  const rawWorkload = records.reduce((sum, record) => sum + numberValue(record.workload), 0);
  const projectGroups = new Map<string, WorkRecord[]>();
  records.forEach((record) => {
    const name = record.projectName?.trim() || "非项目事项";
    projectGroups.set(name, [...(projectGroups.get(name) ?? []), record]);
  });
  const projects = Array.from(projectGroups.entries()).map(([name, projectRecords]) => {
    const projectRecordIds = new Set(projectRecords.map((record) => record.id));
    const projectOutcomes = outcomes.filter((outcome) => outcome.projectName?.trim() === name || (outcome.recordIds ?? []).some((id) => projectRecordIds.has(id)));
    return {
      name,
      recordCount: projectRecords.length,
      timeHours: roundMetric(projectRecords.reduce((sum, record) => sum + numberValue(record.timeHours), 0)),
      workload: roundMetric(projectRecords.reduce((sum, record) => sum + numberValue(record.workload), 0)),
      outcomeCount: projectOutcomes.length,
      recordIds: projectRecords.map((record) => record.id),
      outcomeIds: projectOutcomes.map((outcome) => outcome.id)
    };
  }).sort((a, b) => b.workload - a.workload || b.timeHours - a.timeHours || b.recordCount - a.recordCount || a.name.localeCompare(b.name, "zh-CN"));
  const gaps = {
    missingSourceCount: reportableOutcomes.filter((outcome) => !(outcome.recordIds ?? []).some((id) => currentById.has(id))).length,
    missingReportSummaryCount: reportableOutcomes.filter((outcome) => !outcome.reportSummary?.trim()).length,
    missingValueImpactCount: reportableOutcomes.filter((outcome) => !outcome.valueImpact?.trim()).length,
    missingContributionCount: reportableOutcomes.filter((outcome) => !outcome.contribution?.trim()).length
  };
  const reminders: string[] = [];
  if (!reportableOutcomes.length) reminders.push("本年度尚无阶段成果或已完成成果，请确认是否需要补充成果证据。");
  if (gaps.missingSourceCount) reminders.push(`${gaps.missingSourceCount} 项成果未关联本年度日报，无法核对成果投入。`);
  if (gaps.missingReportSummaryCount) reminders.push(`${gaps.missingReportSummaryCount} 项成果缺少汇报表述。`);
  if (gaps.missingValueImpactCount) reminders.push(`${gaps.missingValueImpactCount} 项成果缺少价值与影响说明。`);
  if (gaps.missingContributionCount) reminders.push(`${gaps.missingContributionCount} 项成果缺少个人贡献说明。`);
  return {
    metrics: {
      recordCount: records.length,
      activeMonths: new Set(records.map((record) => record.date?.slice(0, 7)).filter(Boolean)).size,
      projectCount: projects.filter((project) => project.name !== "非项目事项").length,
      timeHours: roundMetric(records.reduce((sum, record) => sum + numberValue(record.timeHours), 0)),
      rawWorkload: roundMetric(rawWorkload),
      adjustedWorkload: roundMetric(rawWorkload * workloadAdjustmentPercent / 100),
      reportableOutcomeCount: reportableOutcomes.length,
      linkedRecordCount: linkedRecords.length,
      linkedTimeHours: roundMetric(linkedRecords.reduce((sum, record) => sum + numberValue(record.timeHours), 0)),
      linkedWorkload: roundMetric(linkedRecords.reduce((sum, record) => sum + numberValue(record.workload), 0))
    },
    outcomeCounts: {
      deliverable: outcomes.filter((outcome) => outcome.type === "deliverable").length,
      problemResolution: outcomes.filter((outcome) => outcome.type === "problem_resolution").length,
      stageProgress: outcomes.filter((outcome) => outcome.type === "stage_progress").length,
      reusableAsset: outcomes.filter((outcome) => outcome.type === "reusable_asset").length
    },
    projects,
    reportableOutcomes,
    gaps,
    reminders
  };
}
