import { Download, Eraser, Tags, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { RecordList } from "../components/RecordList";
import { StatCards } from "../components/StatCards";
import { TagPill } from "../components/TagPill";
import type { WorkRecord } from "../types";
import { buildJsonBackup } from "../lib/storage";
import { downloadText } from "../lib/download";
import { countUniqueTags, getAllTags, sortRecordsDesc, splitTags } from "../lib/records";

interface AllRecordsPageProps {
  records: WorkRecord[];
  onEdit: (record: WorkRecord) => void;
  onDelete: (record: WorkRecord) => void | Promise<void>;
  onClear: () => void | Promise<void>;
  onGenerateReport: (records: WorkRecord[], title: string) => void;
}

export function AllRecordsPage({
  records,
  onEdit,
  onDelete,
  onClear,
  onGenerateReport
}: AllRecordsPageProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const tags = useMemo(() => getAllTags(records), [records]);
  const visibleRecords = useMemo(() => {
    if (!selectedTag) return sortRecordsDesc(records);
    return sortRecordsDesc(records.filter((record) => splitTags(record.tags).includes(selectedTag)));
  }, [records, selectedTag]);

  const handleJsonExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(buildJsonBackup(records), `工作报告备份_${stamp}.json`);
  };

  const handleClear = async () => {
    if (window.confirm("确认清空所有记录吗？此操作无法撤销。")) {
      await onClear();
      setSelectedTag(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="All Records"
        title="全部记录"
        description={selectedTag ? `正在筛选：${selectedTag}` : "按日期倒序展示所有历史记录"}
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
          emptyText={selectedTag ? "当前标签下暂无记录。" : "还没有任何记录。"}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </section>
    </>
  );
}
