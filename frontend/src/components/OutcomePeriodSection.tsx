import { BriefcaseBusiness } from "lucide-react";
import { outcomeStatusLabels, outcomeTypeLabels } from "../lib/outcomes";
import type { Outcome } from "../types";

export function OutcomePeriodSection({ outcomes, title = "本期成果" }: { outcomes: Outcome[]; title?: string }) {
  return (
    <section className="panel period-outcomes">
      <div className="panel-heading"><h2>{title}</h2><span>{outcomes.length} 项</span></div>
      {outcomes.length ? (
        <div className="period-outcome-list">
          {outcomes.map((outcome) => (
            <article key={outcome.id}>
              <BriefcaseBusiness size={17} />
              <div><strong>{outcome.title}</strong><p>{outcome.reportSummary || outcome.completedWork || outcome.valueImpact || "暂无汇报表述"}</p></div>
              <span>{outcomeTypeLabels[outcome.type]} · {outcomeStatusLabels[outcome.status]}</span>
            </article>
          ))}
        </div>
      ) : <div className="empty-state">本期暂无成果、重要问题解决或阶段进展。</div>}
    </section>
  );
}
