import { ChevronDown, ChevronUp, Edit3, Trash2 } from "lucide-react";
import { useState } from "react";
import type { LedgerQualityCode } from "../lib/ledger";
import type { WorkRecord } from "../types";
import { formatDate } from "../lib/date";
import { splitTags } from "../lib/records";
import { TagPill } from "./TagPill";

const qualityLabels: Record<LedgerQualityCode, string> = {
  missing_project: "缺少项目",
  missing_ability: "缺少能力",
  missing_time: "缺少工时",
  missing_coefficient: "缺少系数",
  missing_content: "缺少工作内容"
};

const coefficientLabels: Record<WorkRecord["coefficientSource"], string> = {
  none: "未填写",
  legacy: "历史数据",
  manual: "手动填写",
  standard_exact: "标准精确匹配",
  standard_general: "标准通用规则"
};

interface LedgerRecordListProps {
  records: WorkRecord[];
  emptyText: string;
  selectedIds: ReadonlySet<string>;
  qualityByRecordId: Record<string, LedgerQualityCode[]>;
  onToggle: (recordId: string) => void;
  onEdit: (record: WorkRecord) => void;
  onDelete: (record: WorkRecord) => void;
}

export function LedgerRecordList({
  records,
  emptyText,
  selectedIds,
  qualityByRecordId,
  onToggle,
  onEdit,
  onDelete
}: LedgerRecordListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!records.length) return <div className="empty-state">{emptyText}</div>;

  function toggleExpanded(id: string): void {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="ledger-record-list">
      {records.map((record) => {
        const expanded = expandedIds.has(record.id);
        const qualityCodes = qualityByRecordId[record.id] ?? [];
        return (
          <article className={`ledger-record-row ${selectedIds.has(record.id) ? "is-selected" : ""}`} key={record.id}>
            <div className="ledger-record-summary">
              <label className="ledger-record-select">
                <input aria-label="选择记录" type="checkbox" checked={selectedIds.has(record.id)} onChange={() => onToggle(record.id)} />
              </label>
              <time dateTime={record.date}>{formatDate(record.date)}</time>
              <div className="ledger-record-main">
                <strong>{record.title}</strong>
                <span>{record.projectName || (record.projectRelation === "non_project" ? "非项目事项" : "项目未归属")}</span>
              </div>
              <span className="ledger-record-classification">{record.businessCategory || record.category} · {record.workType || "其他项"}</span>
              <span className="ledger-record-number">{record.timeHours ?? "-"}<small>h</small></span>
              <span className="ledger-record-number">{record.workload ?? "-"}<small>当量</small></span>
              <div className="ledger-record-quality" aria-label="数据质量状态">
                {qualityCodes.length
                  ? qualityCodes.map((code) => <span key={code}>{qualityLabels[code]}</span>)
                  : <span className="is-complete">完整</span>}
              </div>
              <div className="ledger-record-actions">
                <button aria-label={expanded ? "收起详情" : "展开详情"} title={expanded ? "收起详情" : "展开详情"} type="button" onClick={() => toggleExpanded(record.id)}>
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button aria-label="编辑记录" title="编辑" type="button" onClick={() => onEdit(record)}><Edit3 size={16} /></button>
                <button aria-label="删除记录" title="删除" type="button" onClick={() => onDelete(record)}><Trash2 size={16} /></button>
              </div>
            </div>

            {expanded && (
              <div className="ledger-record-detail">
                <div className="ledger-record-content">
                  <h4>工作内容</h4>
                  <p>{record.content || "未填写工作内容"}</p>
                </div>
                <dl>
                  <div><dt>产品 / 子任务</dt><dd>{[record.productSystem, record.subtask].filter(Boolean).join(" / ") || "未填写"}</dd></div>
                  <div><dt>能力分配</dt><dd>{record.abilityAllocations.length ? record.abilityAllocations.map((item) => `${item.abilityName} ${item.percentage}%`).join("、") : "未填写"}</dd></div>
                  <div><dt>系数来源</dt><dd>{coefficientLabels[record.coefficientSource]}{record.coefficient === null ? "" : ` · ${record.coefficient}`}</dd></div>
                  <div><dt>标准版本</dt><dd>{record.coefficientStandardVersionId || "无标准版本"}</dd></div>
                  <div><dt>计量</dt><dd>{record.quantity ?? "-"} {record.workloadUnit || "单位未填"}</dd></div>
                  <div><dt>更新时间</dt><dd>{new Date(record.updateTime).toLocaleString("zh-CN")}</dd></div>
                </dl>
                <div className="ledger-record-tags">
                  {splitTags(record.tags).length ? splitTags(record.tags).map((tag) => <TagPill key={tag} tag={tag} />) : <span className="muted">无标签</span>}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
