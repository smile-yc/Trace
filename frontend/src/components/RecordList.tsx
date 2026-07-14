import { Edit3, PackagePlus, Trash2 } from "lucide-react";
import type { WorkRecord } from "../types";
import { parseAbilityDimensions } from "../lib/abilityDimensions";
import { formatDate } from "../lib/date";
import { splitTags } from "../lib/records";
import { TagPill } from "./TagPill";

interface RecordListProps {
  records: WorkRecord[];
  emptyText: string;
  onEdit?: (record: WorkRecord) => void;
  onDelete?: (record: WorkRecord) => void;
  onCreateOutcome?: (record: WorkRecord) => void;
}

export function RecordList({ records, emptyText, onEdit, onDelete, onCreateOutcome }: RecordListProps) {
  if (!records.length) {
    return <div className="empty-state">{emptyText}</div>;
  }

  return (
    <div className="record-list">
      {records.map((record) => (
        <article className="record-card" key={record.id}>
          <div className="record-topline">
            <div>
              <h3>{record.title}</h3>
              <p>{formatDate(record.date)}</p>
            </div>
            {(onEdit || onDelete || onCreateOutcome) && (
              <div className="record-actions no-print">
                {onCreateOutcome && (
                  <button aria-label="提炼为成果" onClick={() => onCreateOutcome(record)} title="提炼为成果" type="button">
                    <PackagePlus size={16} />
                  </button>
                )}
                {onEdit && (
                  <button aria-label="编辑记录" onClick={() => onEdit(record)} type="button">
                    <Edit3 size={16} />
                  </button>
                )}
                {onDelete && (
                  <button aria-label="删除记录" onClick={() => onDelete(record)} type="button">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="record-meta">
            <span className="category-chip">{record.businessCategory || record.category}</span>
            <span className="worktype-chip">{record.workType || "其他项"}</span>
            {record.projectName && <span className="detail-chip">项目：{record.projectName}</span>}
            {parseAbilityDimensions(record.abilityDimension).map((ability) => (
              <span className="detail-chip" key={ability}>能力：{ability}</span>
            ))}
            {record.productSystem && <span className="detail-chip">产品：{record.productSystem}</span>}
            {record.subtask && <span className="detail-chip">工作细项：{record.subtask}</span>}
            {record.workload !== null && record.workload !== undefined && (
              <span className="workload-chip">当量：{record.workload}</span>
            )}
            {record.timeHours !== null && record.timeHours !== undefined && (
              <span className="detail-chip">时间：{record.timeHours}h</span>
            )}
            {splitTags(record.tags).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>

          {record.content && <p className="record-content">{record.content}</p>}

          <div className="record-time">
            创建：{new Date(record.createTime).toLocaleString("zh-CN")}
          </div>
        </article>
      ))}
    </div>
  );
}
