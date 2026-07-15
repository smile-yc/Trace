import { Archive, CheckCircle2, GitMerge, Pencil, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ProjectEditor } from "../components/ProjectEditor";
import { ProjectMergeDialog } from "../components/ProjectMergeDialog";
import {
  archiveProject,
  createProject,
  fetchProjects,
  fetchProjectSummary,
  reactivateProject,
  updateProject
} from "../lib/projectApi";
import type { OutcomeSeed, Project, ProjectInput, ProjectStatus, ProjectSummary } from "../types";
import { buildProjectClosureSnapshot } from "../lib/projectClosure";
import { todayKey } from "../lib/date";
import {
  Button,
  DataTable,
  DetailPanel,
  EmptyState,
  ErrorState,
  FilterBar,
  IconButton,
  ModalDialog,
  StatusBadge,
  type DataTableColumn
} from "../components/ui";

interface ProjectsPageProps {
  onNotify: (message: string) => void;
  onCreateOutcome: (seed: Omit<OutcomeSeed, "nonce">) => void;
}

type StatusFilter = "current" | "all" | ProjectStatus;

const currentStatuses: ProjectStatus[] = ["planned", "active", "paused"];
const statusLabels: Record<ProjectStatus, string> = {
  planned: "计划中",
  active: "进行中",
  paused: "已暂停",
  completed: "已完成",
  archived: "已归档"
};
const statusTones = {
  planned: "info",
  active: "success",
  paused: "warning",
  completed: "neutral",
  archived: "neutral"
} as const;

function metric(value: number, digits = 0): string {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function ProjectsPage({ onNotify, onCreateOutcome }: ProjectsPageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProjectSummary>>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("current");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<ProjectSummary | null>(null);
  const [editorProject, setEditorProject] = useState<Project | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [closureProject, setClosureProject] = useState<Project | null>(null);
  const [closureEndDate, setClosureEndDate] = useState("");
  const [closureSummary, setClosureSummary] = useState("");
  const [closureSaving, setClosureSaving] = useState(false);

  const loadProjects = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const searchingHistory = Boolean(query.trim()) && status === "current";
      const statuses = status === "current"
        ? (searchingHistory ? undefined : currentStatuses)
        : status === "all"
          ? undefined
          : [status];
      const nextProjects = await fetchProjects({
        query,
        statuses,
        includeArchived: searchingHistory || status === "all" || status === "archived"
      });
      setProjects(nextProjects);
      const summaryEntries = await Promise.all(nextProjects.map(async (project) => [
        project.id,
        await fetchProjectSummary(project.id)
      ] as const));
      setSummaries(Object.fromEntries(summaryEntries));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "项目读取失败");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProjects(), 180);
    return () => window.clearTimeout(timer);
  }, [loadProjects]);

  async function openProject(project: Project): Promise<void> {
    setSelectedProject(project);
    setSelectedSummary(summaries[project.id] ?? null);
    try {
      setSelectedSummary(await fetchProjectSummary(project.id));
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : "项目详情读取失败");
    }
  }

  async function saveProject(input: ProjectInput): Promise<void> {
    setSaving(true);
    try {
      if (editorProject) {
        await updateProject(editorProject.id, input);
        onNotify("项目已更新");
      } else {
        await createProject(input);
        onNotify("项目已创建");
      }
      setEditorProject(undefined);
      await loadProjects();
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : "项目保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function changeArchiveState(project: Project): Promise<void> {
    const reactivating = project.status === "archived";
    const message = reactivating ? `确认恢复项目“${project.name}”吗？` : `确认归档项目“${project.name}”吗？`;
    if (!window.confirm(message)) return;
    try {
      if (reactivating) await reactivateProject(project.id);
      else await archiveProject(project.id);
      onNotify(reactivating ? "项目已恢复" : "项目已归档");
      setSelectedProject(null);
      await loadProjects();
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : "项目状态更新失败");
    }
  }

  function openClosure(project: Project): void {
    setClosureProject(project);
    setClosureEndDate(project.endDate || todayKey());
    setClosureSummary(project.completionSummary || "");
  }

  async function completeProject(): Promise<void> {
    if (!closureProject || !closureEndDate || !closureSummary.trim()) return;
    setClosureSaving(true);
    try {
      await updateProject(closureProject.id, {
        status: "completed",
        endDate: closureEndDate,
        completionSummary: closureSummary.trim()
      });
      setClosureProject(null);
      setSelectedProject(null);
      onNotify("项目已结项，投入、成果和历史记录保持不变");
      await loadProjects();
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : "项目结项失败");
    } finally {
      setClosureSaving(false);
    }
  }

  const columns = useMemo<DataTableColumn<Project>[]>(() => [
    { id: "project", header: "项目", width: "19%", cell: (project) => <strong>{project.name}</strong> },
    { id: "status", header: "状态", width: "9%", cell: (project) => <StatusBadge tone={statusTones[project.status]}>{statusLabels[project.status]}</StatusBadge> },
    { id: "role", header: "个人角色", width: "11%", cell: (project) => project.personalRole || "-" },
    { id: "time", header: "工时", align: "right", width: "8%", cell: (project) => `${metric(summaries[project.id]?.timeHours ?? 0, 1)} h` },
    { id: "workload", header: "原始工作当量", align: "right", width: "11%", cell: (project) => metric(summaries[project.id]?.workload ?? 0, 2) },
    { id: "active", header: "最近活跃", width: "10%", cell: (project) => summaries[project.id]?.lastActiveDate || "-" },
    { id: "focus", header: "当前重点", width: "19%", cell: (project) => summaries[project.id]?.currentFocus.slice(0, 2).join("；") || "-" },
    {
      id: "actions",
      header: "操作",
      width: "13%",
      cell: (project) => (
        <div className="project-row-actions" onClick={(event) => event.stopPropagation()}>
          <IconButton icon={<Pencil size={16} />} label="编辑项目" onClick={() => setEditorProject(project)} />
          <IconButton
            icon={project.status === "archived" ? <RotateCcw size={16} /> : <Archive size={16} />}
            label={project.status === "archived" ? "恢复项目" : "归档项目"}
            onClick={() => void changeArchiveState(project)}
          />
          <IconButton icon={<GitMerge size={16} />} label="合并项目" onClick={() => setMergeSourceId(project.id)} />
        </div>
      )
    }
  ], [summaries]);

  return (
    <section className="trace-work-outcomes projects-page">
      <PageHeader
        title="项目管理"
        context="工作投入与成果主线"
        primaryAction={<Button leadingIcon={<Plus size={17} />} variant="primary" onClick={() => setEditorProject(null)}>新建项目</Button>}
      />

      <FilterBar sticky={false}>
        <label className="project-filter-field">
          <span>关键词</span>
          <input placeholder="搜索名称、简称或别名" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="project-filter-field">
          <span>状态</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="current">当前项目</option>
            <option value="all">全部状态</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </FilterBar>

      {error ? (
        <ErrorState title="项目读取失败" description={error} action={<Button onClick={() => void loadProjects()}>重新加载</Button>} />
      ) : (
        <div className="project-table-band" aria-busy={loading}>
          <DataTable
            caption="项目投入列表"
            columns={columns}
            rows={projects}
            rowKey={(project) => project.id}
            onRowClick={(project) => void openProject(project)}
            empty={<EmptyState compact title={loading ? "正在读取项目" : "暂无匹配项目"} />}
          />
        </div>
      )}

      <DetailPanel
        open={Boolean(selectedProject)}
        title={selectedProject?.name ?? "项目详情"}
        width="wide"
        onClose={() => setSelectedProject(null)}
        footer={selectedProject && (
          <div className="project-detail-actions">
            <Button leadingIcon={<Pencil size={16} />} onClick={() => {
              setSelectedProject(null);
              setEditorProject(selectedProject);
            }}>编辑</Button>
            {!['completed', 'archived'].includes(selectedProject.status) && (
              <Button leadingIcon={<CheckCircle2 size={16} />} variant="primary" onClick={() => openClosure(selectedProject)}>项目结项</Button>
            )}
            <Button leadingIcon={<GitMerge size={16} />} onClick={() => {
              setSelectedProject(null);
              setMergeSourceId(selectedProject.id);
            }}>合并</Button>
            <Button
              leadingIcon={selectedProject.status === "archived" ? <RotateCcw size={16} /> : <Archive size={16} />}
              onClick={() => void changeArchiveState(selectedProject)}
            >
              {selectedProject.status === "archived" ? "恢复" : "归档"}
            </Button>
          </div>
        )}
      >
        {selectedProject && <ProjectDetail project={selectedProject} summary={selectedSummary} onCreateOutcome={onCreateOutcome} />}
      </DetailPanel>

      <ModalDialog open={editorProject !== undefined} title={editorProject ? "编辑项目" : "新建项目"} size="large" onClose={() => setEditorProject(undefined)}>
        <ProjectEditor project={editorProject ?? undefined} busy={saving} onCancel={() => setEditorProject(undefined)} onSubmit={saveProject} />
      </ModalDialog>

      <ModalDialog open={Boolean(closureProject)} title="项目结项" size="large" onClose={() => setClosureProject(null)}>
        {closureProject && summaries[closureProject.id] && (
          <div className="project-closure-dialog">
            <ProjectClosureEvidence project={closureProject} summary={summaries[closureProject.id]} />
            <label><span>结束日期</span><input type="date" value={closureEndDate} onChange={(event) => setClosureEndDate(event.target.value)} /></label>
            <label><span>结项总结</span><textarea rows={6} placeholder="总结项目目标完成情况、关键成果、个人贡献和后续安排" value={closureSummary} onChange={(event) => setClosureSummary(event.target.value)} /></label>
            <p className="field-hint">结项只更新项目状态、结束日期和人工总结，不修改日报、成果或原始工作当量。</p>
            <div className="project-editor-actions">
              <Button onClick={() => setClosureProject(null)}>取消</Button>
              <Button disabled={!closureEndDate || !closureSummary.trim()} loading={closureSaving} variant="primary" onClick={() => void completeProject()}>确认结项</Button>
            </div>
          </div>
        )}
      </ModalDialog>

      <ProjectMergeDialog
        open={Boolean(mergeSourceId)}
        projects={projects}
        sourceId={mergeSourceId}
        onClose={() => setMergeSourceId("")}
        onMerged={async () => {
          setSelectedProject(null);
          onNotify("项目已合并");
          await loadProjects();
        }}
      />
    </section>
  );
}

function ProjectDetail({ project, summary, onCreateOutcome }: {
  project: Project;
  summary: ProjectSummary | null;
  onCreateOutcome: (seed: Omit<OutcomeSeed, "nonce">) => void;
}) {
  if (!summary) return <EmptyState compact title="正在读取项目详情" />;

  return (
    <div className="project-detail">
      <div className="project-detail-meta">
        <StatusBadge tone={statusTones[project.status]}>{statusLabels[project.status]}</StatusBadge>
        <span>个人角色：{project.personalRole || "未填写"}</span>
        <span>周期：{project.startDate || "未填写"} 至 {project.endDate || "持续中"}</span>
      </div>
      {(project.goal || project.description) && <p className="project-detail-description">{project.goal || project.description}</p>}
      <dl className="project-metrics">
        <div><dt>记录数</dt><dd>{summary.recordCount}</dd></div>
        <div><dt>活跃天数</dt><dd>{summary.activeDays}</dd></div>
        <div><dt>工时</dt><dd>{metric(summary.timeHours, 1)} h</dd></div>
        <div><dt>原始工作当量</dt><dd>{metric(summary.workload, 2)}</dd></div>
      </dl>
      <section className="project-detail-section">
        <h3>当前重点</h3>
        {summary.currentFocus.length ? <ul>{summary.currentFocus.map((focus) => <li key={focus}>{focus}</li>)}</ul> : <EmptyState compact title="暂无当前重点" />}
      </section>
      <div className="project-breakdown-grid">
        <ProjectBreakdown title="业务分类" rows={summary.businessCategories} />
        <ProjectBreakdown title="产品系统" rows={summary.products} />
        <ProjectBreakdown title="能力投入" rows={summary.abilities} />
      </div>
      <section className="project-detail-section">
        <div className="panel-heading">
          <h3>关联成果</h3>
          <button className="ghost-button" onClick={() => onCreateOutcome({ projectId: project.id })} type="button">
            <Plus size={15} />
            新增成果
          </button>
        </div>
        {summary.outcomes.length ? (
          <ul className="project-outcome-list">
            {summary.outcomes.map((outcome) => (
              <li key={outcome.id}>
                <strong>{outcome.title}</strong>
                <span>{outcome.recordCount} 条日报 / {metric(outcome.workload, 2)} 当量</span>
              </li>
            ))}
          </ul>
        ) : <EmptyState compact title="尚无关联成果" />}
      </section>
      <section className="project-detail-section">
        <h3>工作时间线</h3>
        {summary.records.length ? (
          <ol className="project-timeline">
            {summary.records.map((record) => (
              <li key={record.id}>
                <time>{record.date}</time>
                <div><strong>{record.title}</strong><p>{record.content || record.subtask || "无补充说明"}</p></div>
                <span>{metric(record.timeHours ?? 0, 1)} h / {metric(record.workload ?? 0, 2)}</span>
              </li>
            ))}
          </ol>
        ) : <EmptyState compact title="尚无工作记录" />}
      </section>
      {project.status === "completed" && (
        <section className="project-detail-section project-completion-summary">
          <h3>结项总结</h3>
          <p>{project.completionSummary || "尚未填写结项总结"}</p>
          <span>结束日期：{project.endDate || "未填写"}</span>
        </section>
      )}
    </div>
  );
}

function ProjectClosureEvidence({ project, summary }: { project: Project; summary: ProjectSummary }) {
  const snapshot = buildProjectClosureSnapshot(project, summary);
  return (
    <div className="project-closure-evidence">
      <dl>
        <div><dt>工作记录</dt><dd>{snapshot.metrics.recordCount}</dd></div>
        <div><dt>投入工时</dt><dd>{metric(snapshot.metrics.timeHours, 1)} h</dd></div>
        <div><dt>原始工作当量</dt><dd>{metric(snapshot.metrics.workload, 2)}</dd></div>
        <div><dt>可汇报成果</dt><dd>{snapshot.metrics.reportableOutcomeCount}</dd></div>
      </dl>
      <div className="project-closure-reminders">
        {snapshot.reminders.map((message) => <p key={message}>{message}</p>)}
        {!snapshot.reminders.length && <p>项目成果来源、价值影响、个人贡献和汇报表述已填写完整。</p>}
      </div>
      <p className="field-hint">以上为材料完整度检查，不评价项目价值或个人绩效。</p>
    </div>
  );
}

function ProjectBreakdown({ title, rows }: { title: string; rows: ProjectSummary["businessCategories"] }) {
  return (
    <section className="project-detail-section">
      <h3>{title}</h3>
      {rows.length ? (
        <ul className="project-breakdown-list">
          {rows.map((row) => <li key={row.label}><span>{row.label}</span><strong>{metric(row.timeHours, 1)} h</strong></li>)}
        </ul>
      ) : <EmptyState compact title={`暂无${title}数据`} />}
    </section>
  );
}
