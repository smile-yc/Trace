import type { WorkRecord } from "../types";
import { splitTags } from "../lib/records";

interface SummaryGroup {
  key: string;
  label: string;
  records: WorkRecord[];
}

interface SummaryListProps {
  groups: SummaryGroup[];
  emptyText: string;
}

export function SummaryList({ groups, emptyText }: SummaryListProps) {
  if (!groups.length) {
    return (
      <div className="empty-state">
        <strong>{emptyText}</strong>
      </div>
    );
  }

  return (
    <div className="summary-list">
      {groups.map((group) => (
        <section className="summary-group" key={group.key}>
          <div className="summary-date">
            <strong>{group.label}</strong>
            <span>{group.records.length} 条</span>
          </div>
          <div className="summary-items">
            {group.records.map((record) => (
              <article className="summary-item" key={record.id}>
                <div>
                  <h3>{record.title}</h3>
                  <span>{record.category}</span>
                </div>
                {splitTags(record.tags).length > 0 && (
                  <div className="tag-row compact">
                    {splitTags(record.tags).map((tag) => (
                      <span className="tag-chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {record.content && <p>{record.content}</p>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
