import { BookOpenCheck, Sprout } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchGrowthJournalEntries } from "../lib/growthJournalApi";
import type { GrowthJournalEntry, GrowthJournalReportScope } from "../types";

const activityLabels: Record<string, string> = {
  learning: "学习",
  reading: "阅读",
  practice: "练习",
  tool_trial: "工具尝试",
  side_project: "业余项目",
  reflection: "复盘思考",
  training: "培训交流",
  political_study: "政治学习"
};

const contextLabels: Record<string, string> = {
  work_related: "工作相关",
  after_hours: "工作之外",
  mixed: "混合"
};

export function GrowthLearningSection({
  startDate,
  endDate,
  reportScope,
  title = "成长与学习",
  onNotify
}: {
  startDate: string;
  endDate: string;
  reportScope: GrowthJournalReportScope;
  title?: string;
  onNotify: (message: string) => void;
}) {
  const [entries, setEntries] = useState<GrowthJournalEntry[]>([]);

  useEffect(() => {
    let ignore = false;
    fetchGrowthJournalEntries({ startDate, endDate, reportScope })
      .then((nextEntries) => {
        if (!ignore) setEntries(nextEntries);
      })
      .catch((error) => {
        if (!ignore) onNotify(error instanceof Error ? error.message : "成长日志读取失败");
      });
    return () => {
      ignore = true;
    };
  }, [startDate, endDate, reportScope, onNotify]);

  const summary = useMemo(() => {
    const outputCount = entries.filter((entry) => entry.outputType !== "none" || entry.outputTitle.trim()).length;
    const abilities = Array.from(new Set(entries.map((entry) => entry.abilityDimension).filter(Boolean)));
    return { outputCount, abilities };
  }, [entries]);

  return (
    <section className="panel growth-learning-section">
      <div className="panel-heading">
        <h2><Sprout size={18} />{title}</h2>
        <span>{entries.length} 条成长记录</span>
      </div>
      <div className="growth-learning-summary">
        <div><strong>{entries.length}</strong><span>本期学习动作</span></div>
        <div><strong>{summary.outputCount}</strong><span>形成产出</span></div>
        <div><strong>{summary.abilities.length}</strong><span>能力方向</span></div>
      </div>
      {entries.length ? (
        <div className="growth-learning-list">
          {entries.slice(0, 5).map((entry) => (
            <article className="growth-learning-item" key={entry.id}>
              <div>
                <strong>{entry.title}</strong>
                <p>{entry.notes || "暂无补充记录"}</p>
              </div>
              <div className="growth-entry-tags">
                <span>{activityLabels[entry.activityType]}</span>
                <span>{contextLabels[entry.sourceContext]}</span>
                {entry.abilityDimension && <span>{entry.abilityDimension}</span>}
                {entry.outputTitle && <span><BookOpenCheck size={12} />{entry.outputTitle}</span>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="growth-empty">本期暂无标记进入汇报的成长日志。</div>
      )}
    </section>
  );
}
