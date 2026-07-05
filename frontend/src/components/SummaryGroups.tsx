import type { WorkRecord } from "../types";
import { formatDate, formatMonthLabel } from "../lib/date";
import { splitTags } from "../lib/records";
import { TagPill } from "./TagPill";

interface SummaryGroupsProps {
  groups: Array<{ key: string; records: WorkRecord[] }>;
  emptyText: string;
  groupType?: "date" | "month";
}

export function SummaryGroups({ groups, emptyText, groupType = "date" }: SummaryGroupsProps) {
  if (!groups.length) {
    return <div className="empty-state">{emptyText}</div>;
  }

  return (
    <div className="summary-groups">
      {groups.map((group) => (
        <section className="summary-group" key={group.key}>
          <header>
            <h3>{groupType === "month" ? formatMonthLabel(group.key) : formatDate(group.key)}</h3>
            <span>{group.records.length} 条</span>
          </header>

          <div className="summary-items">
            {group.records.map((record) => (
              <article className="summary-item" key={record.id}>
                <div className="summary-title">
                  <strong>{record.title}</strong>
                  <span>{record.businessCategory || record.category} / {record.workType || "其他项"}</span>
                </div>
                {record.content && <p>{record.content}</p>}
                <div className="record-meta">
                  {record.projectName && <span className="detail-chip">项目：{record.projectName}</span>}
                  {record.productSystem && <span className="detail-chip">产品：{record.productSystem}</span>}
                  {record.subtask && <span className="detail-chip">工作细项：{record.subtask}</span>}
                  {record.workload !== null && record.workload !== undefined && (
                    <span className="workload-chip">当量：{record.workload}</span>
                  )}
                  {splitTags(record.tags).map((tag) => (
                    <TagPill key={tag} tag={tag} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
