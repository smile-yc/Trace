import { BookOpenCheck, CheckCircle2, FileCheck2, Milestone } from "lucide-react";
import { outcomeStatusLabels, outcomeTypeLabels } from "../lib/outcomes";
import type { Outcome } from "../types";
import { StatusBadge, type StatusTone } from "./ui";

const outcomeIcons = {
  deliverable: FileCheck2,
  problem_resolution: CheckCircle2,
  stage_progress: Milestone,
  reusable_asset: BookOpenCheck
} as const;

function getStatusTone(status: Outcome["status"]): StatusTone {
  if (status === "completed") return "success";
  if (status === "stage_result") return "info";
  if (status === "in_progress") return "warning";
  return "neutral";
}

export function OutcomePeriodSection({ outcomes, title = "本期成果" }: { outcomes: Outcome[]; title?: string }) {
  return (
    <section className="panel period-outcomes">
      <div className="panel-heading"><h2>{title}</h2><span>{outcomes.length} 项</span></div>
      {outcomes.length ? (
        <div className="period-outcome-list">
          <div className="period-outcome-header" aria-hidden="true">
            <span>成果 / 进展</span>
            <span>关联项目</span>
            <span>贡献 / 影响</span>
            <span>完成时间</span>
            <span>状态</span>
          </div>
          {outcomes.map((outcome) => {
            const Icon = outcomeIcons[outcome.type];
            const summary = outcome.reportSummary || outcome.completedWork || outcome.valueImpact || "暂无汇报表述";
            const contribution = outcome.valueImpact || outcome.contribution || "待补充价值与贡献";
            const date = outcome.completedDate || outcome.updateDate || outcome.startDate || "—";

            return (
              <article key={outcome.id}>
                <span className={`outcome-type-icon tone-${outcome.type}`} aria-hidden="true">
                  <Icon size={17} />
                </span>
                <div className="outcome-primary">
                  <strong>{outcome.title}</strong>
                  <p>{summary}</p>
                  <small>{outcomeTypeLabels[outcome.type]}</small>
                </div>
                <span className="outcome-project">{outcome.projectName || "非项目成果"}</span>
                <span className="outcome-contribution">{contribution}</span>
                <time>{date}</time>
                <StatusBadge tone={getStatusTone(outcome.status)} icon={false}>
                  {outcomeStatusLabels[outcome.status]}
                </StatusBadge>
              </article>
            );
          })}
        </div>
      ) : <div className="empty-state">本期暂无成果、重要问题解决或阶段进展。</div>}
    </section>
  );
}
