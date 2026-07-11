import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { RecordForm } from "../components/RecordForm";
import { RecordList } from "../components/RecordList";
import { StatCards } from "../components/StatCards";
import { formatDate, getMonthRange, shiftDate, todayKey } from "../lib/date";
import { countUniqueTags, filterByDate, filterByRange } from "../lib/records";
import type { RecordInput, WorkRecord } from "../types";

interface DailyPageProps {
  records: WorkRecord[];
  onAdd: (input: RecordInput) => void | Promise<void>;
  onEdit: (record: WorkRecord) => void;
  onDelete: (record: WorkRecord) => void | Promise<void>;
  onNotify: (message: string) => void;
}

export function DailyPage({ records, onAdd, onEdit, onDelete, onNotify }: DailyPageProps) {
  const [date, setDate] = useState(todayKey());
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
    setDate(input.date);
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
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <button className="ghost-button" onClick={() => setDate(shiftDate(date, -1))} type="button">
              <ChevronLeft size={16} />
              前一天
            </button>
            <button className="ghost-button" onClick={() => setDate(todayKey())} type="button">
              <RotateCcw size={16} />
              今天
            </button>
            <button className="ghost-button" onClick={() => setDate(shiftDate(date, 1))} type="button">
              后一天
              <ChevronRight size={16} />
            </button>
          </>
        }
      />

      <StatCards items={stats} />

      <section className="panel">
        <div className="panel-heading">
          <h2>快速记录</h2>
        </div>
        <RecordForm key={date} initialDate={date} onSubmit={handleAdd} onNotify={onNotify} />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>当日记录</h2>
          <span>{dailyRecords.length} 条</span>
        </div>
        <RecordList records={dailyRecords} emptyText="这一天还没有记录。" onEdit={onEdit} onDelete={onDelete} />
      </section>
    </>
  );
}
