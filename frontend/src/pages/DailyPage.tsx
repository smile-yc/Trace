import { ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { RecordForm } from "../components/RecordForm";
import { RecordList } from "../components/RecordList";
import { StatCards } from "../components/StatCards";
import { formatDate, getMonthRange, shiftDate, todayKey } from "../lib/date";
import { buildRecordCopyTemplate, type RecordCopyTemplate } from "../lib/recordFormState";
import { countUniqueTags, filterByDate, filterByRange } from "../lib/records";
import type { OutcomeSeed, RecordInput, WorkRecord } from "../types";

interface DailyPageProps {
  records: WorkRecord[];
  onAdd: (input: RecordInput) => void | Promise<void>;
  onEdit: (record: WorkRecord) => void;
  onDelete: (record: WorkRecord) => void | Promise<void>;
  onNotify: (message: string) => void;
  onCreateOutcome: (seed: Omit<OutcomeSeed, "nonce">) => void;
}

export function DailyPage({ records, onAdd, onEdit, onDelete, onNotify, onCreateOutcome }: DailyPageProps) {
  const [date, setDate] = useState(todayKey());
  const [copySource, setCopySource] = useState<{ id: string; template: RecordCopyTemplate } | null>(null);
  const dailyRecords = useMemo(() => filterByDate(records, date), [records, date]);
  const stats = useMemo(() => {
    const todayRecords = filterByDate(records, todayKey());
    const monthRange = getMonthRange(todayKey());
    const monthRecords = filterByRange(records, monthRange.start, monthRange.end);

    return [
      { label: "今日记录数", value: todayRecords.length },
      { label: "本月记录数", value: monthRecords.length },
      { label: "总记录数", value: records.length },
      { label: "标签总数", value: countUniqueTags(records) }
    ];
  }, [records]);

  async function handleAdd(input: RecordInput): Promise<void> {
    await onAdd(input);
    setCopySource(null);
    setDate(input.date);
  }

  function changeDate(nextDate: string): void {
    setCopySource(null);
    setDate(nextDate);
  }

  function handleCopy(record: WorkRecord): void {
    const targetDate = todayKey();
    setCopySource({ id: record.id, template: buildRecordCopyTemplate(record, targetDate) });
    setDate(targetDate);
    onNotify(`已复制“${record.title}”到今天，请确认后添加`);
  }

  return (
    <>
      <PageHeader
        eyebrow="Daily"
        title="今日工作台"
        description={`${formatDate(date)} · 记录、当量与复盘入口`}
        actions={
          <>
            <label className="date-jump">
              <span>查看日期</span>
              <input type="date" value={date} onChange={(event) => changeDate(event.target.value)} />
            </label>
            <button className="ghost-button" onClick={() => changeDate(shiftDate(date, -1))} type="button">
              <ChevronLeft size={16} />
              前一天
            </button>
            <button className="ghost-button" onClick={() => changeDate(todayKey())} type="button">
              <RotateCcw size={16} />
              今天
            </button>
            <button className="ghost-button" onClick={() => changeDate(shiftDate(date, 1))} type="button">
              后一天
              <ChevronRight size={16} />
            </button>
          </>
        }
      />

      <StatCards items={stats} />

      <section className="panel">
        <div className="panel-heading">
          <h2>{copySource ? "复制为新记录" : "快速记录"}</h2>
          {copySource && (
            <button className="ghost-button" onClick={() => setCopySource(null)} type="button">
              <X size={16} />
              取消复制
            </button>
          )}
        </div>
        <RecordForm
          key={`${date}:${copySource?.id ?? "new"}`}
          initialDate={date}
          template={copySource?.template}
          onSubmit={handleAdd}
          onNotify={onNotify}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>当日记录</h2>
          <span>{dailyRecords.length} 条</span>
        </div>
        <RecordList records={dailyRecords} emptyText="这一天还没有记录。" onEdit={onEdit} onCopy={handleCopy} onDelete={onDelete} onCreateOutcome={(record) => onCreateOutcome({ recordIds: [record.id], projectId: record.projectId ?? undefined })} />
      </section>
    </>
  );
}
