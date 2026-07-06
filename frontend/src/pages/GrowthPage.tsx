import { AlertTriangle, CheckCircle2, Flag, Plus, RefreshCw, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { buildGrowthWarnings, summarizeMilestones } from "../lib/growthReview";
import { createMilestone, fetchMilestones, updateMilestoneApi } from "../lib/milestoneApi";
import { DEFAULT_APP_SETTINGS, fetchSettings } from "../lib/settingsApi";
import type { AppSettings, Milestone, WorkRecord } from "../types";

interface GrowthPageProps {
  records: WorkRecord[];
  onNotify: (message: string) => void;
}

interface MilestoneDraft {
  name: string;
  description: string;
  category: string;
  targetType: string;
  targetValue: string;
  currentValue: string;
  deadline: string;
}

const emptyDraft: MilestoneDraft = {
  name: "",
  description: "",
  category: "能力成长",
  targetType: "工作当量",
  targetValue: "",
  currentValue: "",
  deadline: ""
};

function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function parseNumber(value: string): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function GrowthPage({ records, onNotify }: GrowthPageProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [draft, setDraft] = useState<MilestoneDraft>(emptyDraft);
  const [progressDrafts, setProgressDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadGrowthData(): Promise<void> {
    try {
      setLoading(true);
      const [nextSettings, nextMilestones] = await Promise.all([fetchSettings(), fetchMilestones()]);
      setSettings(nextSettings);
      setMilestones(nextMilestones);
      setProgressDrafts(
        nextMilestones.reduce<Record<string, string>>((drafts, milestone) => {
          drafts[milestone.id] = String(milestone.currentValue);
          return drafts;
        }, {})
      );
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "成长数据读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGrowthData();
  }, []);

  const warnings = useMemo(() => buildGrowthWarnings(records, settings), [records, settings]);
  const milestoneSummaries = useMemo(() => summarizeMilestones(milestones), [milestones]);
  const doneCount = milestoneSummaries.filter((milestone) => milestone.status === "done").length;
  const averageProgress = milestoneSummaries.length
    ? milestoneSummaries.reduce((total, milestone) => total + milestone.progress, 0) / milestoneSummaries.length
    : 0;

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft.name.trim()) return;

    try {
      const milestone = await createMilestone({
        name: draft.name,
        description: draft.description,
        category: draft.category,
        targetType: draft.targetType,
        targetValue: parseNumber(draft.targetValue),
        currentValue: parseNumber(draft.currentValue),
        deadline: draft.deadline
      });
      setMilestones((current) => [...current, milestone]);
      setProgressDrafts((current) => ({ ...current, [milestone.id]: String(milestone.currentValue) }));
      setDraft(emptyDraft);
      onNotify("里程碑已新增");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "新增里程碑失败");
    }
  }

  async function handleSaveProgress(milestone: Milestone): Promise<void> {
    try {
      setSavingId(milestone.id);
      const nextMilestone = await updateMilestoneApi(milestone.id, {
        currentValue: parseNumber(progressDrafts[milestone.id] ?? String(milestone.currentValue))
      });
      setMilestones((current) => current.map((item) => (item.id === milestone.id ? nextMilestone : item)));
      setProgressDrafts((current) => ({ ...current, [milestone.id]: String(nextMilestone.currentValue) }));
      onNotify("里程碑进度已更新");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "保存里程碑失败");
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggle(milestone: Milestone): Promise<void> {
    try {
      setSavingId(milestone.id);
      const nextMilestone = await updateMilestoneApi(milestone.id, { enabled: !milestone.enabled });
      setMilestones((current) => current.map((item) => (item.id === milestone.id ? nextMilestone : item)));
      onNotify(nextMilestone.enabled ? "里程碑已启用" : "里程碑已停用");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "更新里程碑失败");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="成长地图"
        description="跟踪能力目标、里程碑进度，并对日报中的能力缺口做预警。"
        actions={
          <button className="ghost-button" disabled={loading} onClick={loadGrowthData} type="button">
            <RefreshCw size={16} />
            刷新
          </button>
        }
      />

      <StatCards
        items={[
          { label: "预警数", value: warnings.length },
          { label: "启用里程碑", value: milestoneSummaries.length },
          { label: "已完成", value: doneCount },
          { label: "平均进度", value: `${formatMetric(averageProgress)}%` }
        ]}
      />

      <section className="growth-layout">
        <section className="panel warning-panel">
          <div className="panel-heading">
            <h2>查漏补缺预警</h2>
            <AlertTriangle size={18} />
          </div>
          <div className="warning-list">
            {warnings.length ? (
              warnings.map((warning) => (
                <article className={`warning-item ${warning.severity}`} key={`${warning.type}-${warning.label}`}>
                  <strong>{warning.label}</strong>
                  <p>{warning.message}</p>
                  {warning.targetPercent !== undefined && (
                    <span>
                      实际 {warning.actualPercent ?? 0}% / 目标 {warning.targetPercent}%
                    </span>
                  )}
                </article>
              ))
            ) : (
              <div className="empty-state">暂无能力缺口预警。</div>
            )}
          </div>
        </section>

        <section className="panel milestone-form-panel">
          <div className="panel-heading">
            <h2>新增里程碑</h2>
            <Flag size={18} />
          </div>
          <form className="milestone-form" onSubmit={handleCreate}>
            <label className="wide">
              <span>名称</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              <span>分类</span>
              <input
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
              />
            </label>
            <label>
              <span>目标类型</span>
              <input
                value={draft.targetType}
                onChange={(event) => setDraft((current) => ({ ...current, targetType: event.target.value }))}
              />
            </label>
            <label>
              <span>目标值</span>
              <input
                min="0"
                step="0.1"
                type="number"
                value={draft.targetValue}
                onChange={(event) => setDraft((current) => ({ ...current, targetValue: event.target.value }))}
              />
            </label>
            <label>
              <span>当前值</span>
              <input
                min="0"
                step="0.1"
                type="number"
                value={draft.currentValue}
                onChange={(event) => setDraft((current) => ({ ...current, currentValue: event.target.value }))}
              />
            </label>
            <label>
              <span>截止日期</span>
              <input
                type="date"
                value={draft.deadline}
                onChange={(event) => setDraft((current) => ({ ...current, deadline: event.target.value }))}
              />
            </label>
            <label className="wide">
              <span>说明</span>
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
            <button className="primary-button" type="submit">
              <Plus size={16} />
              新增里程碑
            </button>
          </form>
        </section>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>里程碑列表</h2>
          <span>{milestones.length} 项</span>
        </div>
        <div className="milestone-list">
          {milestoneSummaries.length ? (
            milestoneSummaries.map((milestone) => {
              const isBusy = savingId === milestone.id;
              return (
                <article className="milestone-card" key={milestone.id}>
                  <div className="milestone-card-main">
                    <div>
                      <strong>{milestone.name}</strong>
                      <span>
                        {milestone.category} / {milestone.targetType}
                        {milestone.deadline ? ` / ${milestone.deadline}` : ""}
                      </span>
                    </div>
                    {milestone.status === "done" && <CheckCircle2 size={18} />}
                  </div>
                  {milestone.description && <p>{milestone.description}</p>}
                  <div className="milestone-progress">
                    <i style={{ width: `${milestone.progress}%` }} />
                  </div>
                  <div className="milestone-actions">
                    <span>
                      {formatMetric(milestone.currentValue)} / {formatMetric(milestone.targetValue)}
                    </span>
                    <input
                      min="0"
                      step="0.1"
                      type="number"
                      value={progressDrafts[milestone.id] ?? String(milestone.currentValue)}
                      onChange={(event) =>
                        setProgressDrafts((current) => ({ ...current, [milestone.id]: event.target.value }))
                      }
                    />
                    <button disabled={isBusy} onClick={() => handleSaveProgress(milestone)} type="button">
                      <Save size={15} />
                      保存
                    </button>
                    <button
                      className={milestone.enabled ? "toggle-on" : ""}
                      disabled={isBusy}
                      onClick={() => handleToggle(milestone)}
                      type="button"
                    >
                      {milestone.enabled ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                      {milestone.enabled ? "启用" : "停用"}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state">暂无启用里程碑。</div>
          )}
        </div>
      </section>
    </>
  );
}
