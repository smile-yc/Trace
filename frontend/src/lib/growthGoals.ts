import type { GrowthGoal, Milestone } from "../types";

export interface GoalWarning {
  type: "due" | "overdue" | "stale" | "deviation" | "high-input-low-output";
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  goalId: string;
  milestoneId?: string;
}

const DAY = 24 * 60 * 60 * 1000;

export function buildGoalWarnings(goals: GrowthGoal[], milestones: Milestone[], now = new Date()): GoalWarning[] {
  const today = now.toISOString().slice(0, 10);
  const nowTime = now.getTime();
  const warnings: GoalWarning[] = [];
  goals.filter((goal) => ["active", "paused"].includes(goal.status)).forEach((goal) => {
    if (goal.endDate) {
      const days = Math.ceil((new Date(`${goal.endDate}T23:59:59`).getTime() - nowTime) / DAY);
      if (goal.endDate < today) warnings.push({ type: "overdue", severity: "danger", title: `${goal.title} 已逾期`, message: `计划结束于 ${goal.endDate}，请调整计划或确认完成。`, goalId: goal.id });
      else if (days <= 30) warnings.push({ type: "due", severity: "warning", title: `${goal.title} 临近截止`, message: `距离计划结束还有 ${Math.max(0, days)} 天。`, goalId: goal.id });
    }
    if (nowTime - goal.updateTime > 60 * DAY) warnings.push({ type: "stale", severity: "info", title: `${goal.title} 长期未更新`, message: "超过 60 天没有更新，请确认目标仍然有效。", goalId: goal.id });
  });
  milestones.filter((item) => item.enabled && item.goalId).forEach((milestone) => {
    const goal = goals.find((item) => item.id === milestone.goalId);
    if (!goal || goal.status !== "active") return;
    const progress = milestone.progressDetail;
    if (progress && milestone.startDate && milestone.deadline && today >= milestone.startDate) {
      const start = new Date(`${milestone.startDate}T00:00:00`).getTime();
      const total = Math.max(DAY, new Date(`${milestone.deadline}T00:00:00`).getTime() - start);
      const elapsed = Math.min(100, Math.max(0, (nowTime - start) / total * 100));
      if (elapsed - progress.progress >= 20) warnings.push({ type: "deviation", severity: "warning", title: `${milestone.name} 进度偏离`, message: `时间进度约 ${Math.round(elapsed)}%，当前完成 ${Math.round(progress.progress)}%。`, goalId: goal.id, milestoneId: milestone.id });
    }
    if (progress && milestone.metricType === "input" && progress.progress >= 50 && !progress.outcomeRequirementMet) {
      warnings.push({ type: "high-input-low-output", severity: "warning", title: `${milestone.name} 投入尚未形成成果`, message: `投入进度已达 ${Math.round(progress.progress)}%，成果证据仍低于要求。`, goalId: goal.id, milestoneId: milestone.id });
    }
  });
  return warnings;
}
