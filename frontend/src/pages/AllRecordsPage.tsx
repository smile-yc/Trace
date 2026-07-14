import { Download, Eraser, Tags, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { RecordList } from "../components/RecordList";
import { StatCards } from "../components/StatCards";
import { TagPill } from "../components/TagPill";
import type { OutcomeSeed, WorkRecord } from "../types";
import { buildJsonBackup } from "../lib/storage";
import { downloadText } from "../lib/download";
import { todayKey } from "../lib/date";
import { filterArchivedRecords, type ArchiveMode } from "../lib/recordFilters";
import { countUniqueTags, getAllTags } from "../lib/records";

interface AllRecordsPageProps {
  records: WorkRecord[];
  onEdit: (record: WorkRecord) => void;
  onDelete: (record: WorkRecord) => void | Promise<void>;
  onClear: () => void | Promise<void>;
  onGenerateReport: (records: WorkRecord[], title: string) => void;
  onCreateOutcome: (seed: Omit<OutcomeSeed, "nonce">) => void;
}

export function AllRecordsPage({
  records,
  onEdit,
  onDelete,
  onClear,
  onGenerateReport,
  onCreateOutcome
}: AllRecordsPageProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [archiveMode, setArchiveMode] = useState<ArchiveMode>(null);
  const [archivePeriod, setArchivePeriod] = useState("");
  const tags = useMemo(() => getAllTags(records), [records]);
  const visibleRecords = useMemo(
    () => filterArchivedRecords(records, { mode: archiveMode, period: archivePeriod, selectedTag, today: todayKey() }),
    [records, archiveMode, archivePeriod, selectedTag]
  );

  function defaultPeriod(mode: Exclude<ArchiveMode, null>): string {
    const today = todayKey();
    if (mode === "month") return today.slice(0, 7);
    if (mode === "year") return today.slice(0, 4);
    const date = new Date(`${today}T00:00:00`);
    const thursday = new Date(date);
    thursday.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(thursday.getFullYear(), 0, 1);
    const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  function selectArchiveMode(value: string): void {
    const mode = (value || null) as ArchiveMode;
    setArchiveMode(mode);
    setArchivePeriod(mode ? defaultPeriod(mode) : "");
  }

  function clearFilters(): void {
    setSelectedTag(null);
    setArchiveMode(null);
    setArchivePeriod("");
  }

  const handleJsonExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(buildJsonBackup(records), `工作报告备份_${stamp}.json`);
  };

  const handleClear = async () => {
    if (window.confirm("确认清空所有记录吗？此操作无法撤销。")) {
      await onClear();
      clearFilters();
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="All Records"
        title="全部记录"
        description={selectedTag || archiveMode ? "按归档周期与标签组合筛选" : "默认显示当前周记录"}
        actions={
          <>
            <button className="ghost-button" onClick={handleJsonExport} type="button">
              <Download size={16} />
              导出 JSON
            </button>
            <button className="primary-button" onClick={() => onGenerateReport(visibleRecords, "全部记录标签报告")} type="button">
              <Tags size={16} />
              按标签分组报告
            </button>
            <button className="danger-button" onClick={handleClear} type="button">
              <Eraser size={16} />
              清空数据
            </button>
          </>
        }
      />

      <StatCards
        items={[
          { label: "总记录数", value: records.length },
          { label: "当前显示", value: visibleRecords.length },
          { label: "标签总数", value: countUniqueTags(records) }
        ]}
      />

      <section className="panel">
        <div className="panel-heading">
          <h2>时间归档</h2>
          {(archiveMode || selectedTag) && (
            <button className="inline-clear" onClick={clearFilters} type="button">
              <X size={14} />
              清除全部筛选
            </button>
          )}
        </div>
        <div className="archive-filter-row">
          <label>
            <span>归档方式</span>
            <select value={archiveMode ?? ""} onChange={(event) => selectArchiveMode(event.target.value)}>
              <option value="">默认当前周</option>
              <option value="week">按周</option>
              <option value="month">按月</option>
              <option value="year">按年</option>
            </select>
          </label>
          {archiveMode === "week" && <input aria-label="选择周" type="week" value={archivePeriod} onChange={(event) => setArchivePeriod(event.target.value)} />}
          {archiveMode === "month" && <input aria-label="选择月份" type="month" value={archivePeriod} onChange={(event) => setArchivePeriod(event.target.value)} />}
          {archiveMode === "year" && <input aria-label="选择年份" min="2000" max="2100" type="number" value={archivePeriod} onChange={(event) => setArchivePeriod(event.target.value)} />}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>标签筛选</h2>
          {selectedTag && (
            <button className="inline-clear" onClick={() => setSelectedTag(null)} type="button">
              <X size={14} />
              清除筛选
            </button>
          )}
        </div>
        <div className="tag-cloud">
          {tags.length ? (
            tags.map((tag) => (
              <TagPill key={tag} tag={tag} active={selectedTag === tag} onClick={setSelectedTag} />
            ))
          ) : (
            <span className="muted">暂无标签</span>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>记录列表</h2>
          <span>{visibleRecords.length} 条</span>
        </div>
        <RecordList
          records={visibleRecords}
          emptyText={selectedTag || archiveMode ? "当前筛选条件下暂无记录。" : "当前周暂无记录。"}
          onEdit={onEdit}
          onDelete={onDelete}
          onCreateOutcome={(record) => onCreateOutcome({ recordIds: [record.id], projectId: record.projectId ?? undefined })}
        />
      </section>
    </>
  );
}
