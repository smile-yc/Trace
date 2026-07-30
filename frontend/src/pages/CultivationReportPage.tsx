import { CalendarDays, FileText, Plus, RefreshCw, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { fetchMilestones } from "../lib/milestoneApi";
import { fetchOutcomes } from "../lib/outcomeApi";
import { fetchCultivationReport, fetchGrowthJournalEntries, generateCultivationReportDraft, saveCultivationReport } from "../lib/growthJournalApi";
import { getMonthRange, todayKey } from "../lib/date";
import type {
  CultivationGrowthGain,
  CultivationModule,
  CultivationReportDraft,
  CultivationReportEvidence,
  CultivationSupportRequest,
  CultivationWorkItem,
  GrowthJournalEntry,
  Milestone,
  Outcome,
  WorkRecord
} from "../types";

const moduleOptions: Array<{ value: CultivationModule; label: string; className: string }> = [
  { value: "key_project_practice", label: "重点项目实战", className: "module-key-project-practice" },
  { value: "solution_support", label: "售前/方案支撑", className: "module-solution-support" },
  { value: "technical_learning", label: "技术学习与知识沉淀", className: "module-technical-learning" },
  { value: "independent_practice", label: "自主实践", className: "module-independent-practice" },
  { value: "political_progress", label: "政治进步", className: "module-political-progress" }
];

function emptyReport(month: string): CultivationReportDraft {
  const now = Date.now();
  return { id: "", month, evidence: [], workItems: [], growthGains: [], supportRequests: [], draftText: "", manualEdited: false, createTime: now, updateTime: now };
}

function moduleLabel(module: CultivationModule): string {
  return moduleOptions.find((item) => item.value === module)?.label ?? "其他";
}

function supportTypeLabel(type: CultivationSupportRequest["supportType"]): string {
  return ({
    materials: "资料",
    opportunity: "机会",
    mentor_guidance: "导师指导",
    other: "其他"
  } as Record<CultivationSupportRequest["supportType"], string>)[type];
}

function shiftMonthKey(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function CultivationReportPage({ records, onNotify }: { records: WorkRecord[]; onNotify: (message: string) => void }) {
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [growthEntries, setGrowthEntries] = useState<GrowthJournalEntry[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [report, setReport] = useState<CultivationReportDraft>(() => emptyReport(todayKey().slice(0, 7)));
  const [selectedModule, setSelectedModule] = useState<CultivationModule>("key_project_practice");
  const [gainText, setGainText] = useState("");
  const [supportDraft, setSupportDraft] = useState<CultivationSupportRequest>({ supportType: "materials", need: "", reason: "", expectedOutput: "", followUpPlan: "" });
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => getMonthRange(`${month}-01`), [month]);
  const monthRecords = useMemo(() => records.filter((record) => record.date >= range.start && record.date <= range.end), [records, range.start, range.end]);
  const monthOutcomes = useMemo(() => outcomes.filter((outcome) => {
    const date = outcome.updateDate || outcome.startDate || "";
    return date >= range.start && date <= range.end;
  }), [outcomes, range.start, range.end]);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const [nextGrowth, nextOutcomes, nextMilestones, nextReport] = await Promise.all([
        fetchGrowthJournalEntries({ startDate: range.start, endDate: range.end, reportScope: "cultivation" }),
        fetchOutcomes(),
        fetchMilestones(),
        fetchCultivationReport(month)
      ]);
      setGrowthEntries(nextGrowth);
      setOutcomes(nextOutcomes.outcomes);
      setMilestones(nextMilestones);
      setReport(nextReport ?? emptyReport(month));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "光子星月报数据读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadWorkspace(); }, [month, range.start, range.end]);

  function addEvidence(sourceType: CultivationReportEvidence["sourceType"], sourceId: string, title: string, summary: string) {
    const evidence: CultivationReportEvidence = { sourceType, sourceId, module: selectedModule };
    if (report.evidence.some((item) => item.sourceType === sourceType && item.sourceId === sourceId && item.module === selectedModule)) return;
    const workItem: CultivationWorkItem = { module: selectedModule, title, summary };
    setReport({ ...report, evidence: [...report.evidence, evidence], workItems: [...report.workItems, workItem], manualEdited: true });
  }

  function isEvidenceSelected(sourceType: CultivationReportEvidence["sourceType"], sourceId: string): boolean {
    return report.evidence.some((item) => item.sourceType === sourceType && item.sourceId === sourceId && item.module === selectedModule);
  }

  function renderEvidenceGroup(
    title: string,
    tone: string,
    items: Array<{ id: string; title: string; summary: string; meta: string; sourceType: CultivationReportEvidence["sourceType"] }>
  ) {
    return (
      <section className="evidence-group" aria-label={title}>
        <div className="evidence-group-heading">
          <h3>{title}</h3>
          <span>{items.length} 条</span>
        </div>
        {items.length ? (
          <div className="evidence-list">
            {items.map((item) => {
              const selected = isEvidenceSelected(item.sourceType, item.id);
              return (
                <article className={`cultivation-evidence-item evidence-tone-${tone}`} key={`${item.sourceType}-${item.id}`}>
                  <div className="cultivation-evidence-topline">
                    <span className="cultivation-evidence-source">{title}</span>
                    <span>{item.meta}</span>
                  </div>
                  <strong>{item.title}</strong>
                  {item.summary && <p>{item.summary}</p>}
                  <button
                    className={selected ? "ghost-button evidence-added" : "ghost-button"}
                    disabled={selected}
                    onClick={() => addEvidence(item.sourceType, item.id, item.title, item.summary)}
                    type="button"
                  >
                    <Plus size={14} />
                    {selected ? "已加入" : "加入"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="cultivation-empty-evidence">本月暂无{title}候选。</div>
        )}
      </section>
    );
  }

  function addGain() {
    if (!gainText.trim()) return;
    const gain: CultivationGrowthGain = { summary: gainText.trim(), evidenceIds: report.evidence.map((item) => item.sourceId).slice(0, 3) };
    setReport({ ...report, growthGains: [...report.growthGains, gain], manualEdited: true });
    setGainText("");
  }

  function addSupport() {
    if (!supportDraft.need.trim()) return;
    setReport({ ...report, supportRequests: [...report.supportRequests, supportDraft], manualEdited: true });
    setSupportDraft({ supportType: "materials", need: "", reason: "", expectedOutput: "", followUpPlan: "" });
  }

  async function saveReport(nextReport = report) {
    try {
      setReport(await saveCultivationReport(month, nextReport));
      onNotify("光子星月报草稿已保存");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "光子星月报保存失败");
    }
  }

  async function handleGenerate() {
    try {
      await saveCultivationReport(month, report);
      const result = await generateCultivationReportDraft(month);
      if (result.previewOnly) {
        setReport({ ...report, draftText: result.draftText });
        onNotify("已生成预览，未覆盖已编辑草稿");
      } else {
        setReport(result.report);
        onNotify("光子星月报草稿已生成");
      }
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "光子星月报生成失败");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cultivation"
        title="光子星月报"
        description="从正式工作、成长日志和成果中选择证据，生成三段式培养月报。"
        actions={<div className="cultivation-month-filter"><button className="ghost-button" onClick={() => setMonth(shiftMonthKey(month, -1))} type="button"><CalendarDays size={16} />上月</button><button className="ghost-button" onClick={() => setMonth(todayKey().slice(0, 7))} type="button">本月</button><label><span>筛选月份</span><input aria-label="筛选月份" type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} /></label><button className="ghost-button" disabled={loading} onClick={loadWorkspace} type="button"><RefreshCw size={16} />刷新</button></div>}
      />

      <section className="cultivation-workspace">
        <aside className="panel cultivation-evidence-column">
          <div className="panel-heading"><h2>候选证据</h2><span>{month}</span></div>
          <label className="module-select"><span>加入模块</span><select value={selectedModule} onChange={(event) => setSelectedModule(event.target.value as CultivationModule)}>{moduleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <div className="evidence-group-stack">
            {renderEvidenceGroup("正式工作", "work", monthRecords.map((record) => ({
              id: record.id,
              title: record.title,
              summary: record.content,
              meta: record.date,
              sourceType: "record"
            })))}
            {renderEvidenceGroup("成长日志", "growth", growthEntries.map((entry) => ({
              id: entry.id,
              title: entry.title,
              summary: entry.notes,
              meta: entry.date,
              sourceType: "growth_journal"
            })))}
            {renderEvidenceGroup("成果", "outcome", monthOutcomes.map((outcome) => ({
              id: outcome.id,
              title: outcome.title,
              summary: outcome.reportSummary || outcome.completedWork,
              meta: outcome.updateDate || outcome.startDate,
              sourceType: "outcome"
            })))}
            {renderEvidenceGroup("里程碑", "milestone", milestones.map((milestone) => ({
              id: milestone.id,
              title: milestone.name,
              summary: milestone.description,
              meta: milestone.category,
              sourceType: "milestone"
            })))}
          </div>
        </aside>

        <main className="panel cultivation-structure-column">
          <div className="panel-heading"><h2>月报结构</h2><span>{report.evidence.length} 条证据</span></div>
          <section className="cultivation-section">
            <div className="cultivation-section-heading">
              <h3>一、本月工作内容</h3>
              <span>3-4 项重点</span>
            </div>
            <div className="cultivation-module-board">
              {moduleOptions.map((module) => {
                const items = report.workItems.filter((item) => item.module === module.value);
                return (
                  <section className={`cultivation-module ${module.className}`} key={module.value}>
                    <div className="module-title-row">
                      <h4>{module.label}</h4>
                      <span>{items.length}</span>
                    </div>
                    {items.length ? items.map((item, index) => <p key={`${item.title}-${index}`}>{item.title}：{item.summary}</p>) : <p className="cultivation-muted">从左侧候选证据加入。</p>}
                  </section>
                );
              })}
            </div>
          </section>

          <section className="cultivation-section">
            <div className="cultivation-section-heading">
              <h3>二、本月成长收获</h3>
              <span>{report.growthGains.length} 条</span>
            </div>
            <div className="cultivation-editor-row">
              <label><span>收获表述</span><textarea value={gainText} onChange={(event) => setGainText(event.target.value)} placeholder="通过什么事，收获了/意识到了什么" /></label>
              <button className="ghost-button" onClick={addGain} type="button"><Plus size={15} />添加收获</button>
            </div>
            <div className="cultivation-gain-list">{report.growthGains.map((gain, index) => <p key={`${gain.summary}-${index}`}>{gain.summary}</p>)}</div>
          </section>

          <section className="cultivation-section">
            <div className="cultivation-section-heading">
              <h3>三、需支持事项</h3>
              <span>{report.supportRequests.length} 条</span>
            </div>
            <div className="support-request-grid">
              <label><span>支持类型</span><select value={supportDraft.supportType} onChange={(event) => setSupportDraft({ ...supportDraft, supportType: event.target.value as CultivationSupportRequest["supportType"] })}><option value="materials">资料</option><option value="opportunity">机会</option><option value="mentor_guidance">导师指导</option><option value="other">其他</option></select></label>
              <label><span>具体需求</span><input value={supportDraft.need} onChange={(event) => setSupportDraft({ ...supportDraft, need: event.target.value })} /></label>
              <label><span>需要原因</span><input value={supportDraft.reason} onChange={(event) => setSupportDraft({ ...supportDraft, reason: event.target.value })} /></label>
              <label><span>预期产出</span><input value={supportDraft.expectedOutput} onChange={(event) => setSupportDraft({ ...supportDraft, expectedOutput: event.target.value })} /></label>
              <label><span>反馈计划</span><input value={supportDraft.followUpPlan} onChange={(event) => setSupportDraft({ ...supportDraft, followUpPlan: event.target.value })} /></label>
              <button className="ghost-button" onClick={addSupport} type="button"><Plus size={15} />添加支持事项</button>
            </div>
            <div className="cultivation-support-list">
              {report.supportRequests.map((item, index) => (
                <p key={`${item.need}-${index}`}><span>{supportTypeLabel(item.supportType)}</span>{item.need}：{item.expectedOutput || item.followUpPlan}</p>
              ))}
            </div>
          </section>
        </main>

        <aside className="panel cultivation-preview-column">
          <div className="panel-heading"><h2><FileText size={18} />草稿预览</h2><span>{report.manualEdited ? "已手动编辑" : "可生成"}</span></div>
          <textarea value={report.draftText} onChange={(event) => setReport({ ...report, draftText: event.target.value, manualEdited: true })} placeholder="生成后可在这里继续调整正式提交文本" />
          <div className="cultivation-preview-actions">
            <button className="ghost-button" onClick={() => void saveReport()} type="button"><Save size={16} />保存草稿</button>
            <button className="primary-button" onClick={handleGenerate} type="button"><Sparkles size={16} />生成草稿</button>
          </div>
        </aside>
      </section>
    </>
  );
}
