import { BookOpenCheck, LayoutDashboard, Filter, PackagePlus, Plus, RefreshCw, Search, Sprout } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { createGrowthJournalEntry, deleteGrowthJournalEntryApi, fetchGrowthJournalEntries } from "../lib/growthJournalApi";
import { getMonthRange, todayKey } from "../lib/date";
import type { GrowthJournalActivityType, GrowthJournalEntry, GrowthJournalInput, GrowthJournalReportScope, GrowthJournalSourceContext, OutcomeSeed } from "../types";

const activityOptions: Array<{ value: GrowthJournalActivityType; label: string }> = [
  { value: "learning", label: "学习" },
  { value: "reading", label: "阅读" },
  { value: "practice", label: "练习" },
  { value: "tool_trial", label: "工具尝试" },
  { value: "side_project", label: "业余项目" },
  { value: "reflection", label: "复盘思考" },
  { value: "training", label: "培训交流" },
  { value: "political_study", label: "政治学习" }
];

const sourceOptions: Array<{ value: GrowthJournalSourceContext; label: string }> = [
  { value: "work_related", label: "工作相关" },
  { value: "after_hours", label: "工作之外" },
  { value: "mixed", label: "混合" }
];

const reportOptions: Array<{ value: GrowthJournalReportScope; label: string }> = [
  { value: "weekly", label: "周报" },
  { value: "monthly", label: "月报" },
  { value: "yearly", label: "年报" },
  { value: "cultivation", label: "光子星" }
];

function emptyDraft(date = todayKey()): GrowthJournalInput {
  return {
    date,
    title: "",
    activityType: "learning",
    sourceContext: "after_hours",
    abilityDimension: "",
    reportScopes: [],
    notes: "",
    outputType: "none",
    outputTitle: "",
    tags: ""
  };
}

function toOutcomeSeed(entry: GrowthJournalEntry): Omit<OutcomeSeed, "nonce"> {
  return {
    type: entry.outputType === "template" || entry.outputType === "document" || entry.outputType === "code" ? "reusable_asset" : "stage_progress",
    title: entry.outputTitle || entry.title,
    completedWork: entry.notes || entry.title,
    reportSummary: `成长日志：${entry.title}${entry.notes ? `。${entry.notes}` : ""}`,
    tags: entry.tags,
    remark: `来源：成长日志；类型：${activityOptions.find((item) => item.value === entry.activityType)?.label ?? entry.activityType}`
  };
}

export function GrowthJournalPage({
  onNotify,
  onCreateOutcome,
  onNavigatePage
}: {
  onNotify: (message: string) => void;
  onCreateOutcome: (seed: Omit<OutcomeSeed, "nonce">) => void;
  onNavigatePage: (pageId: string) => void;
}) {
  const [draft, setDraft] = useState<GrowthJournalInput>(() => emptyDraft());
  const [entries, setEntries] = useState<GrowthJournalEntry[]>([]);
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [query, setQuery] = useState("");
  const [reportScope, setReportScope] = useState<GrowthJournalReportScope | "">("");
  const [showEnrichment, setShowEnrichment] = useState(false);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    const today = todayKey();
    if (period === "year") return { start: `${today.slice(0, 4)}-01-01`, end: `${today.slice(0, 4)}-12-31` };
    if (period === "month") return getMonthRange(today);
    const base = new Date(`${today}T00:00:00`);
    const day = base.getDay() || 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (value: Date) => value.toISOString().slice(0, 10);
    return { start: fmt(monday), end: fmt(sunday) };
  }, [period]);

  async function loadEntries() {
    setLoading(true);
    try {
      setEntries(await fetchGrowthJournalEntries({ startDate: range.start, endDate: range.end, reportScope, query }));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "成长日志读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadEntries(); }, [range.start, range.end, reportScope]);

  function toggleReportScope(scope: GrowthJournalReportScope) {
    const current = draft.reportScopes ?? [];
    setDraft({
      ...draft,
      reportScopes: current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createGrowthJournalEntry(draft);
      setDraft(emptyDraft(draft.date));
      setShowEnrichment(false);
      onNotify("成长日志已保存");
      await loadEntries();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "成长日志保存失败");
    }
  }

  async function handleDelete(entry: GrowthJournalEntry) {
    if (!window.confirm(`删除成长日志“${entry.title}”？`)) return;
    await deleteGrowthJournalEntryApi(entry.id);
    onNotify("成长日志已删除");
    await loadEntries();
  }

  const outputCount = entries.filter((entry) => entry.outputType !== "none" || entry.outputTitle).length;

  return (
    <>
      <PageHeader
        eyebrow="Growth journal"
        title="成长日志"
        description="记录学习、工具尝试、业余实践和光子星候选材料，不默认计入工作量。"
        actions={<><button className="ghost-button" onClick={() => onNavigatePage("daily")} type="button"><LayoutDashboard size={16} />返回今日工作台</button><button className="ghost-button" disabled={loading} onClick={loadEntries} type="button"><RefreshCw size={16} />刷新</button></>}
      />

      <section className="panel growth-journal-quick-form">
        <div className="panel-heading">
          <h2><Sprout size={18} />快速记录</h2>
        </div>
        <form className="growth-entry-form" onSubmit={handleSubmit}>
          <label><span>日期</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
          <label><span>标题</span><input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="今天学了什么 / 做了什么" /></label>
          <label><span>类型</span><select value={draft.activityType} onChange={(event) => setDraft({ ...draft, activityType: event.target.value as GrowthJournalActivityType })}>{activityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span>来源</span><select value={draft.sourceContext} onChange={(event) => setDraft({ ...draft, sourceContext: event.target.value as GrowthJournalSourceContext })}>{sourceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span>能力</span><input value={draft.abilityDimension} onChange={(event) => setDraft({ ...draft, abilityDimension: event.target.value })} placeholder="新业务 / AI提效 / 方案能力" /></label>
          <fieldset className="growth-report-scope">
            <legend>进入汇报</legend>
            {reportOptions.map((item) => <label key={item.value}><input checked={(draft.reportScopes ?? []).includes(item.value)} onChange={() => toggleReportScope(item.value)} type="checkbox" />{item.label}</label>)}
          </fieldset>
          <label className="growth-notes"><span>简要记录</span><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="1-3句话记录关键收获或动作" /></label>
          <div className="growth-journal-enrichment">
            <button className="ghost-button" onClick={() => setShowEnrichment(!showEnrichment)} type="button">{showEnrichment ? "收起更多" : "展开更多"}</button>
            {showEnrichment && (
              <div className="growth-entry-more">
                <label><span>产出类型</span><select value={draft.outputType} onChange={(event) => setDraft({ ...draft, outputType: event.target.value as GrowthJournalInput["outputType"] })}><option value="none">无</option><option value="note">笔记</option><option value="document">文档</option><option value="template">模板</option><option value="code">代码</option><option value="demo">Demo</option><option value="framework">框架</option><option value="other">其他</option></select></label>
                <label><span>产出物</span><input value={draft.outputTitle} onChange={(event) => setDraft({ ...draft, outputTitle: event.target.value })} placeholder="笔记、模板、代码、Demo 名称" /></label>
                <label><span>标签</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} /></label>
              </div>
            )}
          </div>
          <button className="primary-button" type="submit"><Plus size={16} />保存成长日志</button>
        </form>
      </section>

      <section className="panel growth-journal-list">
        <div className="panel-heading">
          <h2>成长台账</h2>
          <span>{entries.length} 条 / {outputCount} 项产出</span>
        </div>
        <div className="growth-journal-toolbar">
          <div className="segmented-control">{(["week", "month", "year"] as const).map((item) => <button className={period === item ? "active" : ""} key={item} onClick={() => setPeriod(item)} type="button">{item === "week" ? "本周" : item === "month" ? "本月" : "今年"}</button>)}</div>
          <label><Filter size={15} /><select value={reportScope} onChange={(event) => setReportScope(event.target.value as GrowthJournalReportScope | "")}><option value="">全部汇报</option>{reportOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} onBlur={loadEntries} placeholder="搜索标题、摘要、标签" /></label>
        </div>
        {entries.length ? (
          <div className="growth-entry-list">
            {entries.map((entry) => (
              <article className="growth-entry-row" key={entry.id}>
                <div className="growth-entry-date">{entry.date}</div>
                <div className="growth-entry-main">
                  <strong>{entry.title}</strong>
                  <p>{entry.notes || "暂无补充记录"}</p>
                  <div className="growth-entry-tags">
                    <span>{activityOptions.find((item) => item.value === entry.activityType)?.label}</span>
                    <span>{sourceOptions.find((item) => item.value === entry.sourceContext)?.label}</span>
                    {entry.abilityDimension && <span>{entry.abilityDimension}</span>}
                    {entry.reportScopes.includes("cultivation") && <span>光子星候选</span>}
                    {entry.outputTitle && <span><BookOpenCheck size={12} />{entry.outputTitle}</span>}
                  </div>
                </div>
                <div className="growth-entry-actions">
                  <button className="ghost-button" onClick={() => onCreateOutcome(toOutcomeSeed(entry))} type="button"><PackagePlus size={15} />提炼为成果</button>
                  <button className="ghost-button" onClick={() => setDraft({ ...entry, links: [] })} type="button">编辑</button>
                  <button className="ghost-button danger" onClick={() => void handleDelete(entry)} type="button">删除</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="growth-empty">当前范围暂无成长日志。</div>
        )}
      </section>
    </>
  );
}
