import { Archive, CheckCircle2, Plus, RefreshCw, RotateCcw, Save, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { SearchSelect, StatusBadge } from "../components/ui";
import { fetchConfigOptions } from "../lib/configApi";
import { fetchMilestones } from "../lib/milestoneApi";
import { archiveOutcome, createOutcome, fetchOutcomes, reactivateOutcome, updateOutcomeApi } from "../lib/outcomeApi";
import { outcomeStatusLabels, outcomeTypeLabels, prefillOutcomeFromRecords } from "../lib/outcomes";
import { fetchProjects } from "../lib/projectApi";
import type {
  ConfigOption, Milestone, Outcome, OutcomeAbility, OutcomeInput, OutcomeSeed, OutcomeStatus,
  OutcomeSummary, OutcomeType, Project, WorkRecord
} from "../types";

interface KnowledgePageProps {
  records: WorkRecord[];
  initialSeed?: OutcomeSeed | null;
  onSeedConsumed?: () => void;
  onNotify: (message: string) => void;
}

interface OutcomeDraft extends Required<Omit<OutcomeInput, "projectId" | "statusNote">> {
  projectId: string;
  statusNote: string;
}

const emptyDraft = (): OutcomeDraft => ({
  type: "deliverable", status: "planned", title: "", projectId: "", startDate: "", updateDate: "",
  completedDate: "", backgroundGoal: "", completedWork: "", valueImpact: "", personalRole: "",
  contribution: "", reportSummary: "", productSystem: "", tags: "", remark: "", recordIds: [],
  abilities: [], milestoneIds: [], statusNote: ""
});

const emptySummary: OutcomeSummary = {
  outcomeCount: 0, recordCount: 0, timeHours: 0, workload: 0,
  byType: { deliverable: 0, problem_resolution: 0, stage_progress: 0, reusable_asset: 0 },
  byStatus: { planned: 0, in_progress: 0, stage_result: 0, completed: 0 }
};

function outcomeToDraft(outcome: Outcome): OutcomeDraft {
  return {
    type: outcome.type, status: outcome.status, title: outcome.title, projectId: outcome.projectId ?? "",
    startDate: outcome.startDate, updateDate: outcome.updateDate, completedDate: outcome.completedDate,
    backgroundGoal: outcome.backgroundGoal, completedWork: outcome.completedWork, valueImpact: outcome.valueImpact,
    personalRole: outcome.personalRole, contribution: outcome.contribution, reportSummary: outcome.reportSummary,
    productSystem: outcome.productSystem, tags: outcome.tags, remark: outcome.remark,
    recordIds: outcome.recordIds, abilities: outcome.abilities, milestoneIds: outcome.milestoneIds, statusNote: ""
  };
}

export function KnowledgePage({ records, initialSeed, onSeedConsumed, onNotify }: KnowledgePageProps) {
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [summary, setSummary] = useState<OutcomeSummary>(emptySummary);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [abilities, setAbilities] = useState<ConfigOption[]>([]);
  const [draft, setDraft] = useState<OutcomeDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordPicker, setRecordPicker] = useState("");
  const [abilityPicker, setAbilityPicker] = useState("");
  const [milestonePicker, setMilestonePicker] = useState("");
  const [filters, setFilters] = useState({ query: "", type: "", status: "", projectId: "", abilityId: "", year: String(new Date().getFullYear()), includeArchived: false });

  async function loadOutcomes() {
    try {
      setLoading(true);
      const result = await fetchOutcomes({
        query: filters.query, type: filters.type as OutcomeType || undefined,
        status: filters.status as OutcomeStatus || undefined, projectId: filters.projectId, abilityId: filters.abilityId,
        year: filters.year, includeArchived: filters.includeArchived
      });
      setOutcomes(result.outcomes);
      setSummary(result.summary);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "成果读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadOutcomes(); }, []);
  useEffect(() => {
    Promise.all([fetchProjects({ includeArchived: true }), fetchMilestones(), fetchConfigOptions("abilityDimension")])
      .then(([nextProjects, nextMilestones, nextAbilities]) => {
        setProjects(nextProjects); setMilestones(nextMilestones); setAbilities(nextAbilities);
      })
      .catch((error) => onNotify(error instanceof Error ? error.message : "成果关联选项读取失败"));
  }, [onNotify]);

  useEffect(() => {
    if (!initialSeed) return;
    const selected = records.filter((record) => initialSeed.recordIds?.includes(record.id));
    const seed = prefillOutcomeFromRecords(selected);
    setEditingId(null);
    setDraft((current) => ({ ...emptyDraft(), ...current, ...seed, projectId: initialSeed.projectId || seed.projectId || "" } as OutcomeDraft));
    onSeedConsumed?.();
  }, [initialSeed?.nonce]);

  const projectOptions = useMemo(() => [
    { value: "", label: "非项目成果" },
    ...projects.filter((project) => !project.mergedIntoProjectId).map((project) => ({
      value: project.id, label: project.name, keywords: [project.shortName, ...project.aliases]
    }))
  ], [projects]);
  const projectFilterOptions = useMemo(() => [
    { value: "", label: "全部项目" },
    ...projects.filter((project) => !project.mergedIntoProjectId).map((project) => ({ value: project.id, label: project.name, keywords: [project.shortName, ...project.aliases] }))
  ], [projects]);
  const abilityFilterOptions = useMemo(() => [
    { value: "", label: "全部能力" },
    ...abilities.filter((ability) => ability.enabled).map((ability) => ({ value: ability.id, label: ability.label }))
  ], [abilities]);
  const recordOptions = useMemo(() => records
    .filter((record) => !draft.recordIds.includes(record.id))
    .map((record) => ({ value: record.id, label: `${record.date} · ${record.title}`, keywords: [record.projectName, record.content, record.tags] })), [records, draft.recordIds]);
  const abilityOptions = useMemo(() => abilities.filter((ability) => ability.enabled && !draft.abilities.some((item) => item.abilityId === ability.id))
    .map((ability) => ({ value: ability.id, label: ability.label })), [abilities, draft.abilities]);
  const milestoneOptions = useMemo(() => milestones.filter((milestone) => milestone.enabled && !draft.milestoneIds.includes(milestone.id))
    .map((milestone) => ({ value: milestone.id, label: milestone.name })), [milestones, draft.milestoneIds]);

  function addRecord(id: string) {
    const selected = records.filter((record) => [...draft.recordIds, id].includes(record.id));
    const seed = prefillOutcomeFromRecords(selected);
    setDraft((current) => ({ ...current, ...seed, title: current.title || seed.title || "", projectId: current.projectId || seed.projectId || "" } as OutcomeDraft));
    setRecordPicker("");
  }

  function addAbility(id: string) {
    const option = abilities.find((ability) => ability.id === id);
    if (option) setDraft((current) => ({ ...current, abilities: [...current.abilities, { abilityId: option.id, abilityName: option.label }] }));
    setAbilityPicker("");
  }

  function addMilestone(id: string) {
    if (id) setDraft((current) => ({ ...current, milestoneIds: [...current.milestoneIds, id] }));
    setMilestonePicker("");
  }

  function resetForm() { setDraft(emptyDraft()); setEditingId(null); }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    try {
      setSaving(true);
      const payload: OutcomeInput = { ...draft, projectId: draft.projectId || null };
      if (editingId) await updateOutcomeApi(editingId, payload);
      else await createOutcome(payload);
      onNotify(editingId ? "成果已更新" : "成果已创建");
      resetForm();
      await loadOutcomes();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "成果保存失败");
    } finally { setSaving(false); }
  }

  async function toggleArchive(outcome: Outcome) {
    try {
      if (outcome.archived) await reactivateOutcome(outcome.id); else await archiveOutcome(outcome.id);
      onNotify(outcome.archived ? "成果已恢复" : "成果已归档");
      await loadOutcomes();
    } catch (error) { onNotify(error instanceof Error ? error.message : "成果状态更新失败"); }
  }

  return (
    <>
      <PageHeader eyebrow="Outcomes" title="成果管理" description="沉淀正式成果、重要问题解决、阶段进展和可复用资产。"
        actions={<button className="ghost-button" disabled={loading} onClick={loadOutcomes} type="button"><RefreshCw size={16} />刷新</button>} />
      <StatCards items={[
        { label: "成果数", value: summary.outcomeCount }, { label: "已完成", value: summary.byStatus.completed },
        { label: "关联日报", value: summary.recordCount }, { label: "关联工作当量", value: summary.workload }
      ]} />

      <section className="panel outcome-filter-panel">
        <div className="outcome-filter-grid">
          <input placeholder="搜索标题、项目、价值或标签" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
          <select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">全部类型</option>{Object.entries(outcomeTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">全部状态</option>{Object.entries(outcomeStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <SearchSelect ariaLabel="按项目筛选成果" options={projectFilterOptions} value={filters.projectId} onChange={(projectId) => setFilters({ ...filters, projectId })} />
          <SearchSelect ariaLabel="按能力筛选成果" options={abilityFilterOptions} value={filters.abilityId} onChange={(abilityId) => setFilters({ ...filters, abilityId })} />
          <input aria-label="成果年份" min="2000" max="2100" type="number" value={filters.year} onChange={(event) => setFilters({ ...filters, year: event.target.value })} />
          <label className="outcome-archive-toggle"><input type="checkbox" checked={filters.includeArchived} onChange={(event) => setFilters({ ...filters, includeArchived: event.target.checked })} />包含归档</label>
          <button className="primary-button" onClick={loadOutcomes} type="button">应用筛选</button>
        </div>
      </section>

      <section className="panel knowledge-form-panel" id="outcome-form">
        <div className="panel-heading"><h2>{editingId ? "编辑成果" : "新增成果"}</h2>{editingId && <button className="inline-clear" onClick={resetForm} type="button"><RotateCcw size={14} />取消编辑</button>}</div>
        <form className="knowledge-form outcome-form" onSubmit={handleSubmit}>
          <label><span>成果类型</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as OutcomeType })}>{Object.entries(outcomeTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>状态</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as OutcomeStatus })}>{Object.entries(outcomeStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="wide"><span>标题</span><input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label><span>关联项目</span><SearchSelect ariaLabel="搜索关联项目" options={projectOptions} value={draft.projectId} onChange={(projectId) => setDraft({ ...draft, projectId })} /></label>
          <label><span>开始日期</span><input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label>
          <label><span>更新日期</span><input type="date" value={draft.updateDate} onChange={(event) => setDraft({ ...draft, updateDate: event.target.value })} /></label>
          <label><span>完成日期</span><input type="date" value={draft.completedDate} onChange={(event) => setDraft({ ...draft, completedDate: event.target.value })} /></label>
          <label><span>产品系统</span><input value={draft.productSystem} onChange={(event) => setDraft({ ...draft, productSystem: event.target.value })} /></label>
          <label><span>个人角色</span><input value={draft.personalRole} onChange={(event) => setDraft({ ...draft, personalRole: event.target.value })} /></label>
          <label><span>标签</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} /></label>
          <label className="wide"><span>背景与目标</span><textarea value={draft.backgroundGoal} onChange={(event) => setDraft({ ...draft, backgroundGoal: event.target.value })} /></label>
          <label className="wide"><span>完成内容或解决的问题</span><textarea value={draft.completedWork} onChange={(event) => setDraft({ ...draft, completedWork: event.target.value })} /></label>
          <label className="wide"><span>价值与影响</span><textarea value={draft.valueImpact} onChange={(event) => setDraft({ ...draft, valueImpact: event.target.value })} /></label>
          <label className="wide"><span>个人具体贡献</span><textarea value={draft.contribution} onChange={(event) => setDraft({ ...draft, contribution: event.target.value })} /></label>
          <label className="wide"><span>用于汇报的简明表述</span><textarea value={draft.reportSummary} onChange={(event) => setDraft({ ...draft, reportSummary: event.target.value })} /></label>

          <div className="outcome-relation-field wide"><span>关联日报</span><SearchSelect ariaLabel="搜索并添加日报" options={recordOptions} value={recordPicker} placeholder="搜索日期、标题、项目或内容" onChange={addRecord} />
            <div className="outcome-relation-chips">{draft.recordIds.map((id) => { const item = records.find((record) => record.id === id); return <button key={id} onClick={() => setDraft({ ...draft, recordIds: draft.recordIds.filter((value) => value !== id) })} type="button">{item?.date} {item?.title || id}<X size={13} /></button>; })}</div></div>
          <div className="outcome-relation-field"><span>关联能力</span><SearchSelect ariaLabel="搜索并添加能力" options={abilityOptions} value={abilityPicker} onChange={addAbility} />
            <div className="outcome-relation-chips">{draft.abilities.map((ability) => <button key={ability.abilityId} onClick={() => setDraft({ ...draft, abilities: draft.abilities.filter((item) => item.abilityId !== ability.abilityId) })} type="button">{ability.abilityName}<X size={13} /></button>)}</div></div>
          <div className="outcome-relation-field"><span>关联里程碑</span><SearchSelect ariaLabel="搜索并添加里程碑" options={milestoneOptions} value={milestonePicker} onChange={addMilestone} />
            <div className="outcome-relation-chips">{draft.milestoneIds.map((id) => <button key={id} onClick={() => setDraft({ ...draft, milestoneIds: draft.milestoneIds.filter((value) => value !== id) })} type="button">{milestones.find((item) => item.id === id)?.name || id}<X size={13} /></button>)}</div></div>
          <label className="wide"><span>状态变更说明</span><input value={draft.statusNote} onChange={(event) => setDraft({ ...draft, statusNote: event.target.value })} /></label>
          <label className="wide"><span>备注</span><textarea value={draft.remark} onChange={(event) => setDraft({ ...draft, remark: event.target.value })} /></label>
          <button className="primary-button" disabled={saving} type="submit">{editingId ? <Save size={16} /> : <Plus size={16} />}{saving ? "保存中" : editingId ? "保存成果" : "新增成果"}</button>
        </form>
      </section>

      <section className="panel"><div className="panel-heading"><h2>成果清单</h2><span>{outcomes.length} 项</span></div>
        <div className="knowledge-list outcome-list">{outcomes.length ? outcomes.map((outcome) => (
          <article className="knowledge-card outcome-card" key={outcome.id}>
            <div className="knowledge-card-top"><div><strong>{outcome.title}</strong><span>{outcomeTypeLabels[outcome.type]} · {outcome.projectName || "非项目成果"}</span></div><StatusBadge tone={outcome.status === "completed" ? "success" : outcome.status === "stage_result" ? "info" : "neutral"}>{outcomeStatusLabels[outcome.status]}</StatusBadge></div>
            {(outcome.reportSummary || outcome.completedWork) && <p>{outcome.reportSummary || outcome.completedWork}</p>}
            <div className="record-meta"><span className="detail-chip">{outcome.recordCount} 条日报</span><span className="detail-chip">{outcome.timeHours} h</span><span className="workload-chip">{outcome.workload} 当量</span>{outcome.valueImpact && <span className="detail-chip">价值：{outcome.valueImpact}</span>}</div>
            {(outcome.records.length > 0 || outcome.milestones.length > 0) && <details className="outcome-history"><summary>证据来源（{outcome.records.length + outcome.milestones.length}）</summary><ol>{outcome.records.map((record) => <li key={record.id}><time>{record.date}</time><span>{record.title}</span></li>)}{outcome.milestones.map((milestone) => <li key={milestone.id}><time>里程碑</time><span>{milestone.name}</span></li>)}</ol></details>}
            <details className="outcome-history"><summary>状态轨迹（{outcome.statusHistory.length}）</summary><ol>{outcome.statusHistory.map((history) => <li key={history.id}><time>{new Date(history.changedTime).toLocaleDateString("zh-CN")}</time><span>{history.fromStatus ? outcomeStatusLabels[history.fromStatus] : "创建"} → {outcomeStatusLabels[history.toStatus]}{history.note ? `：${history.note}` : ""}</span></li>)}</ol></details>
            <div className="outcome-card-actions"><button onClick={() => { setEditingId(outcome.id); setDraft(outcomeToDraft(outcome)); document.getElementById("outcome-form")?.scrollIntoView({ behavior: "smooth" }); }} type="button"><Save size={15} />编辑</button><button onClick={() => toggleArchive(outcome)} type="button">{outcome.archived ? <CheckCircle2 size={15} /> : <Archive size={15} />}{outcome.archived ? "恢复" : "归档"}</button></div>
          </article>
        )) : <div className="empty-state">当前条件下暂无成果。</div>}</div>
      </section>
    </>
  );
}
