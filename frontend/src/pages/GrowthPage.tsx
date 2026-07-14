import { AlertTriangle, CheckCircle2, ChevronRight, Flag, Plus, RefreshCw, Save, Target } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { createGrowthGoal, fetchGrowthGoals, updateGrowthGoal } from "../lib/growthGoalApi";
import { buildGoalWarnings } from "../lib/growthGoals";
import { buildGrowthWarnings } from "../lib/growthReview";
import { correctMilestoneProgress, createMilestone, fetchMilestones, toggleMilestoneStage, updateMilestoneApi } from "../lib/milestoneApi";
import { DEFAULT_APP_SETTINGS, fetchSettings } from "../lib/settingsApi";
import type { AppSettings, GrowthGoal, GrowthGoalScope, Milestone, MilestoneMetricSource, MilestoneMetricType, WorkRecord } from "../types";

interface GrowthPageProps {
  records: WorkRecord[];
  onNotify: (message: string) => void;
  active?: boolean;
}

const scopeLabels: Record<GrowthGoalScope, string> = {
  career: "职业发展", cultivation: "公司培养", annual: "年度目标", learning: "学习成长"
};

const metricLabels: Record<MilestoneMetricType, string> = {
  quantity: "数量", input: "投入", stage: "阶段", continuous: "持续"
};

const sourceOptions: Record<MilestoneMetricType, Array<{ value: MilestoneMetricSource; label: string }>> = {
  quantity: [{ value: "outcome_count", label: "成果数量" }, { value: "problem_count", label: "重要问题解决" }, { value: "project_count", label: "参与项目数" }],
  input: [{ value: "time_hours", label: "投入工时" }, { value: "workload", label: "工作当量" }],
  stage: [{ value: "manual_stage", label: "阶段完成数" }],
  continuous: [{ value: "active_months", label: "持续活跃月数" }]
};

const emptyGoal = { title: "", scope: "career" as GrowthGoalScope, startDate: "", endDate: "", description: "" };
const emptyMilestone = {
  name: "", goalId: "", metricType: "quantity" as MilestoneMetricType, metricSource: "outcome_count" as MilestoneMetricSource,
  targetValue: "", startDate: "", deadline: "", abilityName: "", requiredOutcomeCount: "", description: "", stages: ""
};

function metric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function GrowthPage({ records, onNotify, active = true }: GrowthPageProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [goals, setGoals] = useState<GrowthGoal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [goalDraft, setGoalDraft] = useState(emptyGoal);
  const [milestoneDraft, setMilestoneDraft] = useState(emptyMilestone);
  const [correctionId, setCorrectionId] = useState("");
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData(): Promise<void> {
    setLoading(true);
    try {
      const [nextSettings, nextGoals, nextMilestones] = await Promise.all([fetchSettings(), fetchGrowthGoals(), fetchMilestones()]);
      setSettings(nextSettings);
      setGoals(nextGoals);
      setMilestones(nextMilestones);
      setSelectedGoalId((current) => current || nextGoals.find((goal) => goal.status === "active")?.id || nextGoals[0]?.id || "");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "成长目标读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (active) void loadData(); }, [active]);

  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? null;
  const visibleMilestones = milestones.filter((milestone) => !selectedGoalId || milestone.goalId === selectedGoalId);
  const abilityWarnings = useMemo(() => buildGrowthWarnings(records, settings), [records, settings]);
  const goalWarnings = useMemo(() => buildGoalWarnings(goals, milestones), [goals, milestones]);
  const evidenceCount = milestones.reduce((sum, item) => sum + (item.progressDetail?.evidence.length ?? 0), 0);

  async function handleCreateGoal(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!goalDraft.title.trim()) return;
    try {
      const goal = await createGrowthGoal({ ...goalDraft, status: "active", targetYear: goalDraft.endDate ? Number(goalDraft.endDate.slice(0, 4)) : null });
      setGoals((current) => [goal, ...current]);
      setSelectedGoalId(goal.id);
      setMilestoneDraft((current) => ({ ...current, goalId: goal.id }));
      setGoalDraft(emptyGoal);
      onNotify("成长目标已创建");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "成长目标创建失败");
    }
  }

  async function handleGoalStatus(goal: GrowthGoal, status: GrowthGoal["status"]): Promise<void> {
    try {
      const updated = await updateGrowthGoal(goal.id, { status });
      setGoals((current) => current.map((item) => item.id === goal.id ? updated : item).filter((item) => item.status !== "archived"));
      if (status === "archived") setSelectedGoalId("");
      onNotify("目标状态已更新");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "目标状态更新失败");
    }
  }

  async function handleCreateMilestone(event: FormEvent): Promise<void> {
    event.preventDefault();
    const goalId = milestoneDraft.goalId || selectedGoalId;
    if (!goalId || !milestoneDraft.name.trim()) return;
    try {
      await createMilestone({
        name: milestoneDraft.name, goalId, metricType: milestoneDraft.metricType, metricSource: milestoneDraft.metricSource,
        targetValue: Number(milestoneDraft.targetValue || 0), startDate: milestoneDraft.startDate, deadline: milestoneDraft.deadline,
        abilityId: milestoneDraft.abilityName ? `legacy:${encodeURIComponent(milestoneDraft.abilityName)}` : "",
        abilityName: milestoneDraft.abilityName, requiredOutcomeCount: Number(milestoneDraft.requiredOutcomeCount || 0),
        description: milestoneDraft.description,
        stages: milestoneDraft.metricType === "stage"
          ? milestoneDraft.stages.split("\n").map((label) => label.trim()).filter(Boolean).map((label) => ({ label }))
          : undefined
      });
      setMilestoneDraft({ ...emptyMilestone, goalId });
      await loadData();
      onNotify("量化里程碑已创建");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "里程碑创建失败");
    }
  }

  async function handleCorrection(milestone: Milestone): Promise<void> {
    if (!correctionReason.trim()) return;
    try {
      await correctMilestoneProgress(milestone.id, Number(correctionValue), correctionReason);
      setCorrectionId(""); setCorrectionValue(""); setCorrectionReason("");
      await loadData();
      onNotify("进度已纠偏，原因已留痕");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "进度纠偏失败");
    }
  }

  async function handleStageToggle(milestone: Milestone, stageId: string, completed: boolean): Promise<void> {
    try {
      await toggleMilestoneStage(milestone.id, stageId, completed);
      await loadData();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "阶段更新失败");
    }
  }

  return <>
    <PageHeader eyebrow="Growth" title="成长与目标" description="用工作和成果证据跟踪职业方向、培养计划与年度目标。" actions={
      <button className="ghost-button" disabled={loading} onClick={loadData} type="button"><RefreshCw size={16} />刷新</button>
    } />

    <StatCards items={[
      { label: "进行中目标", value: goals.filter((goal) => goal.status === "active").length },
      { label: "量化里程碑", value: milestones.filter((item) => item.enabled).length },
      { label: "待处理提醒", value: goalWarnings.length + abilityWarnings.length },
      { label: "进度证据", value: evidenceCount }
    ]} />

    <section className="growth-goal-workspace">
      <aside className="panel growth-goal-sidebar">
        <div className="panel-heading"><h2>目标方向</h2><Target size={18} /></div>
        <div className="growth-goal-list">
          {goals.map((goal) => <button className={goal.id === selectedGoalId ? "active" : ""} key={goal.id} onClick={() => {
            setSelectedGoalId(goal.id); setMilestoneDraft((current) => ({ ...current, goalId: goal.id }));
          }} type="button">
            <span>{scopeLabels[goal.scope]}</span><strong>{goal.title}</strong><small>{goal.endDate || "长期目标"}</small><ChevronRight size={15} />
          </button>)}
          {!goals.length && <div className="empty-state">先建立一个成长目标。</div>}
        </div>
        <form className="goal-quick-form" onSubmit={handleCreateGoal}>
          <input placeholder="新目标名称" value={goalDraft.title} onChange={(event) => setGoalDraft((current) => ({ ...current, title: event.target.value }))} />
          <div><select value={goalDraft.scope} onChange={(event) => setGoalDraft((current) => ({ ...current, scope: event.target.value as GrowthGoalScope }))}>
            {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select><input aria-label="目标截止日期" type="date" value={goalDraft.endDate} onChange={(event) => setGoalDraft((current) => ({ ...current, endDate: event.target.value }))} /></div>
          <button className="primary-button" type="submit"><Plus size={15} />新增目标</button>
        </form>
      </aside>

      <div className="growth-goal-main">
        <section className="panel growth-focus-panel">
          <div className="panel-heading"><h2>{selectedGoal?.title || "选择目标"}</h2>{selectedGoal && <span>{scopeLabels[selectedGoal.scope]}</span>}</div>
          {selectedGoal ? <>
            <p>{selectedGoal.description || "围绕该方向配置可自动追踪的里程碑。"}</p>
            <div className="goal-status-actions">
              {selectedGoal.status !== "completed" && <button onClick={() => handleGoalStatus(selectedGoal, "completed")} type="button"><CheckCircle2 size={15} />标记完成</button>}
              <button onClick={() => handleGoalStatus(selectedGoal, selectedGoal.status === "paused" ? "active" : "paused")} type="button">{selectedGoal.status === "paused" ? "恢复" : "暂停"}</button>
              <button onClick={() => handleGoalStatus(selectedGoal, "archived")} type="button">归档</button>
            </div>
          </> : <div className="empty-state">从左侧选择或创建目标。</div>}
        </section>

        <section className="panel milestone-form-panel">
          <div className="panel-heading"><h2>新增量化里程碑</h2><Flag size={18} /></div>
          <form className="milestone-form" onSubmit={handleCreateMilestone}>
            <label className="wide"><span>里程碑名称</span><input value={milestoneDraft.name} onChange={(event) => setMilestoneDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label><span>量化方式</span><select value={milestoneDraft.metricType} onChange={(event) => {
              const metricType = event.target.value as MilestoneMetricType;
              setMilestoneDraft((current) => ({ ...current, metricType, metricSource: sourceOptions[metricType][0].value }));
            }}>{Object.entries(metricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>数据来源</span><select value={milestoneDraft.metricSource} onChange={(event) => setMilestoneDraft((current) => ({ ...current, metricSource: event.target.value as MilestoneMetricSource }))}>{sourceOptions[milestoneDraft.metricType].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            {milestoneDraft.metricType === "stage" ? <label className="wide"><span>阶段清单（每行一个）</span><textarea value={milestoneDraft.stages} onChange={(event) => setMilestoneDraft((current) => ({ ...current, stages: event.target.value }))} /></label> : <label><span>目标值</span><input min="0" step="0.1" type="number" value={milestoneDraft.targetValue} onChange={(event) => setMilestoneDraft((current) => ({ ...current, targetValue: event.target.value }))} /></label>}
            <label><span>开始日期</span><input type="date" value={milestoneDraft.startDate} onChange={(event) => setMilestoneDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
            <label><span>截止日期</span><input type="date" value={milestoneDraft.deadline} onChange={(event) => setMilestoneDraft((current) => ({ ...current, deadline: event.target.value }))} /></label>
            <label><span>限定能力（可选）</span><input list="growth-ability-options" value={milestoneDraft.abilityName} onChange={(event) => setMilestoneDraft((current) => ({ ...current, abilityName: event.target.value }))} /></label>
            {milestoneDraft.metricType === "input" && <label><span>至少形成成果</span><input min="0" type="number" value={milestoneDraft.requiredOutcomeCount} onChange={(event) => setMilestoneDraft((current) => ({ ...current, requiredOutcomeCount: event.target.value }))} /></label>}
            <datalist id="growth-ability-options">{Array.from(new Set(records.flatMap((record) => record.abilityAllocations.map((item) => item.abilityName)))).map((item) => <option key={item} value={item} />)}</datalist>
            <button className="primary-button" type="submit"><Plus size={16} />新增里程碑</button>
          </form>
        </section>
      </div>
    </section>

    <section className="growth-layout">
      <section className="panel warning-panel">
        <div className="panel-heading"><h2>行动提醒</h2><AlertTriangle size={18} /></div>
        <div className="warning-list">
          {goalWarnings.map((warning) => <button className={`warning-item ${warning.severity}`} key={`${warning.type}-${warning.goalId}-${warning.milestoneId || ""}`} onClick={() => setSelectedGoalId(warning.goalId)} type="button"><strong>{warning.title}</strong><p>{warning.message}</p></button>)}
          {abilityWarnings.map((warning) => <article className={`warning-item ${warning.severity}`} key={`${warning.type}-${warning.label}`}><strong>{warning.label}</strong><p>{warning.message}</p></article>)}
          {!goalWarnings.length && !abilityWarnings.length && <div className="empty-state">当前没有需要处理的提醒。</div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading"><h2>里程碑进度与证据</h2><span>{visibleMilestones.length} 项</span></div>
        <div className="milestone-list">
          {visibleMilestones.map((milestone) => {
            const progress = milestone.progressDetail;
            return <article className="milestone-card" key={milestone.id}>
              <div className="milestone-card-main"><div><strong>{milestone.name}</strong><span>{metricLabels[milestone.metricType]} · {milestone.deadline || "长期"}</span></div><b>{metric(progress?.effectiveValue ?? milestone.currentValue)} / {metric(progress?.targetValue ?? milestone.targetValue)}</b></div>
              <div className="milestone-progress"><i style={{ width: `${progress?.progress ?? 0}%` }} /></div>
              <div className="milestone-meta"><span>自动值 {metric(progress?.calculatedValue ?? milestone.currentValue)}</span><span>完成 {metric(progress?.progress ?? 0)}%</span>{milestone.overrideReason && <span>已纠偏：{milestone.overrideReason}</span>}</div>
              {milestone.stages.map((stage) => <label className="milestone-stage" key={stage.id}><input checked={stage.completed} onChange={(event) => handleStageToggle(milestone, stage.id, event.target.checked)} type="checkbox" /><span>{stage.label}</span></label>)}
              {progress?.evidence.length ? <details className="milestone-evidence"><summary>查看 {progress.evidence.length} 条进度证据</summary>{progress.evidence.slice(0, 12).map((item) => <div key={`${item.kind}-${item.id}`}><span>{item.date}</span><strong>{item.title}</strong><small>{item.detail}</small></div>)}</details> : <p className="muted-copy">尚未匹配到源数据证据。</p>}
              {correctionId === milestone.id ? <div className="milestone-correction"><input min="0" step="0.1" type="number" value={correctionValue} onChange={(event) => setCorrectionValue(event.target.value)} /><input placeholder="填写纠偏原因" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} /><button onClick={() => handleCorrection(milestone)} type="button"><Save size={15} />保存纠偏</button></div> : <button className="text-button" onClick={() => { setCorrectionId(milestone.id); setCorrectionValue(String(progress?.effectiveValue ?? milestone.currentValue)); }} type="button">人工纠偏</button>}
              <button className="text-button" onClick={async () => { await updateMilestoneApi(milestone.id, { enabled: !milestone.enabled }); await loadData(); }} type="button">{milestone.enabled ? "暂停跟踪" : "恢复跟踪"}</button>
            </article>;
          })}
          {!visibleMilestones.length && <div className="empty-state">该目标还没有量化里程碑。</div>}
        </div>
      </section>
    </section>
  </>;
}
