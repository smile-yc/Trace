import type { Project, ProjectSummary } from "../types";

export interface ProjectClosureSnapshot {
  metrics: {
    recordCount: number;
    activeDays: number;
    timeHours: number;
    workload: number;
    outcomeCount: number;
    reportableOutcomeCount: number;
  };
  outcomeCounts: {
    deliverable: number;
    problemResolution: number;
    stageProgress: number;
    reusableAsset: number;
  };
  gaps: {
    missingEndDate: boolean;
    missingCompletionSummary: boolean;
    missingSourceCount: number;
    missingReportSummaryCount: number;
    missingValueImpactCount: number;
    missingContributionCount: number;
  };
  reminders: string[];
}

export function buildProjectClosureSnapshot(project: Project, summary: ProjectSummary): ProjectClosureSnapshot {
  const reportableOutcomes = summary.outcomes.filter((outcome) => ["stage_result", "completed"].includes(outcome.status));
  const projectRecordIds = new Set(summary.records.map((record) => record.id));
  const gaps = {
    missingEndDate: !project.endDate?.trim(),
    missingCompletionSummary: !project.completionSummary?.trim(),
    missingSourceCount: reportableOutcomes.filter((outcome) => !(outcome.recordIds ?? []).some((id) => projectRecordIds.has(id))).length,
    missingReportSummaryCount: reportableOutcomes.filter((outcome) => !outcome.reportSummary?.trim()).length,
    missingValueImpactCount: reportableOutcomes.filter((outcome) => !outcome.valueImpact?.trim()).length,
    missingContributionCount: reportableOutcomes.filter((outcome) => !outcome.contribution?.trim()).length
  };
  const reminders: string[] = [];
  if (!summary.recordCount) reminders.push("项目尚无关联日报，请确认投入记录是否完整。");
  if (!reportableOutcomes.length) reminders.push("项目尚无阶段成果或已完成成果，请确认是否需要补充成果证据。");
  if (gaps.missingSourceCount) reminders.push(`${gaps.missingSourceCount} 项成果未关联本项目日报，无法核对成果投入。`);
  if (gaps.missingReportSummaryCount) reminders.push(`${gaps.missingReportSummaryCount} 项成果缺少汇报表述。`);
  if (gaps.missingValueImpactCount) reminders.push(`${gaps.missingValueImpactCount} 项成果缺少价值与影响说明。`);
  if (gaps.missingContributionCount) reminders.push(`${gaps.missingContributionCount} 项成果缺少个人贡献说明。`);

  return {
    metrics: {
      recordCount: summary.recordCount,
      activeDays: summary.activeDays,
      timeHours: summary.timeHours,
      workload: summary.workload,
      outcomeCount: summary.outcomes.length,
      reportableOutcomeCount: reportableOutcomes.length
    },
    outcomeCounts: {
      deliverable: summary.outcomes.filter((outcome) => outcome.type === "deliverable").length,
      problemResolution: summary.outcomes.filter((outcome) => outcome.type === "problem_resolution").length,
      stageProgress: summary.outcomes.filter((outcome) => outcome.type === "stage_progress").length,
      reusableAsset: summary.outcomes.filter((outcome) => outcome.type === "reusable_asset").length
    },
    gaps,
    reminders
  };
}
