import { Download, Eraser, FileText, PackagePlus, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LedgerRecordList } from "../components/LedgerRecordList";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { FilterBar, SearchSelect } from "../components/ui";
import { todayKey } from "../lib/date";
import { downloadText } from "../lib/download";
import {
  analyzeLedgerQuality,
  buildLedgerOutcomeSeed,
  filterLedgerRecords,
  reconcileLedgerSelection,
  summarizeLedger,
  type LedgerFilters,
  type LedgerQualityCode
} from "../lib/ledger";
import { fetchOutcomes } from "../lib/outcomeApi";
import { fetchProjects } from "../lib/projectApi";
import { getAllTags } from "../lib/records";
import { buildJsonBackup } from "../lib/storage";
import type { Outcome, OutcomeSeed, Project, WorkRecord } from "../types";

interface AllRecordsPageProps {
  active: boolean;
  records: WorkRecord[];
  onEdit: (record: WorkRecord) => void;
  onDelete: (record: WorkRecord) => void | Promise<void>;
  onClear: () => void | Promise<void>;
  onGenerateReport: (records: WorkRecord[], title: string) => void;
  onCreateOutcome: (seed: Omit<OutcomeSeed, "nonce">) => void;
}

type RangePreset = "current" | "week" | "month" | "year" | "custom";

const qualityLabels: Record<LedgerQualityCode, string> = {
  missing_project: "缺少项目",
  missing_ability: "缺少能力",
  missing_time: "缺少工时",
  missing_coefficient: "缺少系数",
  missing_content: "缺少工作内容"
};

const coefficientLabels: Record<WorkRecord["coefficientSource"], string> = {
  none: "未填写",
  legacy: "历史数据",
  manual: "手动填写",
  standard_exact: "标准精确匹配",
  standard_general: "标准通用规则"
};

const outcomeStatusLabels = {
  planned: "计划中",
  in_progress: "推进中",
  stage_result: "阶段成果",
  completed: "已完成"
} as const;

function isoWeekKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function defaultFilters(today: string): LedgerFilters {
  return {
    periodMode: "week",
    period: isoWeekKey(today),
    startDate: "",
    endDate: "",
    query: "",
    projectId: "",
    projectRelation: "",
    businessCategory: "",
    workType: "",
    productSystem: "",
    subtask: "",
    ability: "",
    coefficientSource: "",
    outcomeStatus: "",
    tag: "",
    qualityCode: ""
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function AllRecordsPage({ active, records, onEdit, onDelete, onClear, onGenerateReport, onCreateOutcome }: AllRecordsPageProps) {
  const today = todayKey();
  const [rangePreset, setRangePreset] = useState<RangePreset>("current");
  const [filters, setFilters] = useState<LedgerFilters>(() => defaultFilters(today));
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [relationError, setRelationError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    Promise.all([fetchProjects({ includeArchived: true }), fetchOutcomes({ includeArchived: true })])
      .then(([nextProjects, outcomeResult]) => {
        if (cancelled) return;
        setProjects(nextProjects);
        setOutcomes(outcomeResult.outcomes);
        setRelationError("");
      })
      .catch((error) => {
        if (!cancelled) setRelationError(error instanceof Error ? error.message : "项目与成果数据加载失败");
      });
    return () => { cancelled = true; };
  }, [active, records.length]);

  const scopeRecords = useMemo(
    () => filterLedgerRecords(records, outcomes, { ...filters, qualityCode: "" }, today),
    [records, outcomes, filters, today]
  );
  const visibleRecords = useMemo(
    () => filterLedgerRecords(records, outcomes, filters, today),
    [records, outcomes, filters, today]
  );
  const summary = useMemo(() => summarizeLedger(visibleRecords, outcomes), [visibleRecords, outcomes]);
  const quality = useMemo(() => analyzeLedgerQuality(scopeRecords, projects), [scopeRecords, projects]);
  const selectedRecords = useMemo(() => visibleRecords.filter((record) => selectedIds.has(record.id)), [visibleRecords, selectedIds]);
  const visibleKey = visibleRecords.map((record) => record.id).join("|");

  useEffect(() => {
    setSelectedIds((current) => {
      const next = reconcileLedgerSelection(current, visibleRecords);
      return next.size === current.size ? current : next;
    });
  }, [visibleKey]);

  const dimensionOptions = useMemo(() => ({
    businessCategory: unique(records.map((record) => record.businessCategory)),
    workType: unique(records.map((record) => record.workType)),
    productSystem: unique(records.map((record) => record.productSystem)),
    subtask: unique(records.map((record) => record.subtask)),
    ability: unique(records.flatMap((record) => record.abilityAllocations.length ? record.abilityAllocations.map((item) => item.abilityName) : [record.abilityDimension])),
    tags: getAllTags(records)
  }), [records]);

  const projectOptions = useMemo(() => [
    { value: "", label: "全部项目" },
    ...projects.filter((project) => project.mergedIntoProjectId === null).map((project) => ({ value: project.id, label: project.name, keywords: [project.shortName, ...project.aliases] }))
  ], [projects]);

  function updateFilter<K extends keyof LedgerFilters>(key: K, value: LedgerFilters[K]): void {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function changeRangePreset(next: RangePreset): void {
    setRangePreset(next);
    if (next === "current") setFilters((current) => ({ ...current, periodMode: "week", period: isoWeekKey(today), startDate: "", endDate: "" }));
    if (next === "week") setFilters((current) => ({ ...current, periodMode: "week", period: current.period || isoWeekKey(today) }));
    if (next === "month") setFilters((current) => ({ ...current, periodMode: "month", period: today.slice(0, 7) }));
    if (next === "year") setFilters((current) => ({ ...current, periodMode: "year", period: today.slice(0, 4) }));
    if (next === "custom") setFilters((current) => ({ ...current, periodMode: "custom", startDate: current.startDate || today, endDate: current.endDate || today }));
  }

  function clearFilters(): void {
    setRangePreset("current");
    setFilters(defaultFilters(today));
    setSelectedIds(new Set());
  }

  function toggleRecord(recordId: string): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  function handleReport(): void {
    const reportRecords = selectedRecords.length ? selectedRecords : visibleRecords;
    onGenerateReport(reportRecords, selectedRecords.length ? "已选工作记录报告" : "工作台账筛选报告");
  }

  const handleJsonExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(buildJsonBackup(records), `工作报告备份_${stamp}.json`);
  };

  const handleClear = async () => {
    if (!window.confirm(`确认清空全部 ${records.length} 条记录吗？这将影响所有项目、成果和报告统计，且无法撤销。`)) return;
    await onClear();
    clearFilters();
  };

  const customDateInvalid = rangePreset === "custom" && Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate);
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => !["periodMode", "period", "startDate", "endDate"].includes(key) && Boolean(value)).length;

  return (
    <div className="ledger-page">
      <PageHeader
        eyebrow="Work Ledger"
        title="工作台账"
        description="检索工作事实、核对投入，并把重要记录继续沉淀为成果和汇报材料。"
        actions={<>
          <button className="ghost-button" onClick={handleJsonExport} type="button"><Download size={16} />导出备份</button>
          <button className="primary-button" onClick={handleReport} type="button"><FileText size={16} />生成报告</button>
          <button className="danger-button" onClick={handleClear} type="button"><Eraser size={16} />清空数据</button>
        </>}
      />

      <StatCards items={[
        { label: "记录", value: summary.recordCount },
        { label: "投入工时", value: `${summary.timeHours.toFixed(1)} h` },
        { label: "原始工作当量", value: summary.workload.toFixed(2) },
        { label: "项目", value: summary.projectCount },
        { label: "成果", value: summary.outcomeCount }
      ]} />

      <FilterBar
        sticky={false}
        moreOpen={moreFiltersOpen}
        onMoreToggle={() => setMoreFiltersOpen((current) => !current)}
        onClearAll={activeFilterCount ? clearFilters : undefined}
        activeFilters={activeFilterCount ? [{ id: "active", label: `${activeFilterCount} 项组合条件` }] : []}
        onRemoveFilter={clearFilters}
        moreFilters={<div className="ledger-filter-grid">
          <label><span>业务分类</span><select value={filters.businessCategory} onChange={(event) => updateFilter("businessCategory", event.target.value)}><option value="">全部业务</option>{dimensionOptions.businessCategory.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>工作类型</span><select value={filters.workType} onChange={(event) => updateFilter("workType", event.target.value)}><option value="">全部类型</option>{dimensionOptions.workType.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>产品</span><select value={filters.productSystem} onChange={(event) => updateFilter("productSystem", event.target.value)}><option value="">全部产品</option>{dimensionOptions.productSystem.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>子任务</span><select value={filters.subtask} onChange={(event) => updateFilter("subtask", event.target.value)}><option value="">全部子任务</option>{dimensionOptions.subtask.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>能力</span><select value={filters.ability} onChange={(event) => updateFilter("ability", event.target.value)}><option value="">全部能力</option>{dimensionOptions.ability.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>系数来源</span><select value={filters.coefficientSource} onChange={(event) => updateFilter("coefficientSource", event.target.value as LedgerFilters["coefficientSource"])}><option value="">全部来源</option>{Object.entries(coefficientLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>成果状态</span><select value={filters.outcomeStatus} onChange={(event) => updateFilter("outcomeStatus", event.target.value as LedgerFilters["outcomeStatus"])}><option value="">全部成果状态</option><option value="none">未形成成果</option>{Object.entries(outcomeStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>标签</span><select value={filters.tag} onChange={(event) => updateFilter("tag", event.target.value)}><option value="">全部标签</option>{dimensionOptions.tags.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>}
      >
        <label className="ledger-filter-field ledger-range-field"><span>时间范围</span><select value={rangePreset} onChange={(event) => changeRangePreset(event.target.value as RangePreset)}><option value="current">当前周</option><option value="week">指定周</option><option value="month">指定月</option><option value="year">指定年</option><option value="custom">自定义日期</option></select></label>
        {rangePreset === "week" && <input aria-label="指定周" type="week" value={filters.period} onChange={(event) => updateFilter("period", event.target.value)} />}
        {rangePreset === "month" && <input aria-label="指定月" type="month" value={filters.period} onChange={(event) => updateFilter("period", event.target.value)} />}
        {rangePreset === "year" && <input aria-label="指定年" min="2000" max="2100" type="number" value={filters.period} onChange={(event) => updateFilter("period", event.target.value)} />}
        {rangePreset === "custom" && <div className="ledger-custom-range"><input aria-label="开始日期" type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} /><span>至</span><input aria-label="结束日期" type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} /></div>}
        <label className="ledger-filter-field"><span>关键词</span><input type="search" placeholder="标题、内容、项目或标签" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} /></label>
        <label className="ledger-filter-field ledger-project-filter"><span>项目</span><SearchSelect ariaLabel="按项目筛选工作台账" options={projectOptions} value={filters.projectId} onChange={(value) => updateFilter("projectId", value)} /></label>
        <label className="ledger-filter-field"><span>项目关系</span><select value={filters.projectRelation} onChange={(event) => updateFilter("projectRelation", event.target.value as LedgerFilters["projectRelation"])}><option value="">全部关系</option><option value="project">项目事项</option><option value="non_project">非项目事项</option><option value="unassigned">项目未归属</option></select></label>
      </FilterBar>
      {customDateInvalid && <p className="field-error">开始日期不能晚于结束日期。</p>}
      {relationError && <div className="status-banner error">项目与成果筛选暂不可用：{relationError}</div>}

      <section className="ledger-quality-band" aria-labelledby="ledger-quality-title">
        <div className="ledger-section-heading"><div><h2 id="ledger-quality-title">数据质量</h2><p>{quality.issueRecordCount ? `${quality.issueRecordCount} 条记录需要补充` : "当前范围未发现缺失项"}</p></div><button className="inline-clear" type="button" onClick={() => updateFilter("qualityCode", "")}><RotateCcw size={14} />查看全部</button></div>
        <div className="ledger-quality-actions">
          {(Object.keys(qualityLabels) as LedgerQualityCode[]).map((code) => <button className={filters.qualityCode === code ? "is-active" : ""} key={code} type="button" onClick={() => updateFilter("qualityCode", code)}><span>{qualityLabels[code]}</span><strong>{quality.counts[code]}</strong></button>)}
          <button className={filters.coefficientSource === "manual" ? "is-active" : ""} type="button" onClick={() => updateFilter("coefficientSource", "manual")}><span>手动系数</span><strong>{quality.manualCoefficientCount} · {quality.manualCoefficientPercent}%</strong></button>
        </div>
        {(Object.values(quality.duplicateCategories).some((groups) => groups.length) || quality.duplicateProjects.length > 0) && <div className="ledger-duplicate-notices">
          {Object.entries(quality.duplicateCategories).flatMap(([key, groups]) => groups.map((group) => <button key={`${key}-${group.join("-")}`} type="button" onClick={() => updateFilter(key as keyof Pick<LedgerFilters, "businessCategory" | "workType" | "productSystem" | "subtask">, group[0])}>疑似重复分类：{group.join(" / ")}</button>))}
          {quality.duplicateProjects.map((group) => <button key={group.join("-")} type="button" onClick={() => updateFilter("projectId", projects.find((project) => project.name === group[0])?.id ?? "")}>疑似重复项目：{group.join(" / ")}</button>)}
        </div>}
      </section>

      <section className="ledger-list-band">
        <div className="ledger-section-heading">
          <div><h2>记录列表</h2><p>{visibleRecords.length} 条，按日期倒序</p></div>
          <div className="ledger-list-tools">
            <button className="ghost-button" type="button" onClick={() => setSelectedIds(new Set(visibleRecords.map((record) => record.id)))}>选择当前范围</button>
            {selectedIds.size > 0 && <button className="inline-clear" type="button" onClick={() => setSelectedIds(new Set())}><X size={14} />清除选择</button>}
          </div>
        </div>
        {selectedRecords.length > 0 && <div className="ledger-batch-bar"><span>已选择 <strong>{selectedRecords.length}</strong> 条记录</span><div><button className="ghost-button" type="button" onClick={handleReport}><FileText size={16} />生成报告</button><button className="primary-button" type="button" onClick={() => onCreateOutcome(buildLedgerOutcomeSeed(selectedRecords))}><PackagePlus size={16} />提炼为成果</button></div></div>}
        <LedgerRecordList records={visibleRecords} emptyText={customDateInvalid ? "请先修正日期范围。" : "当前筛选条件下暂无记录。"} selectedIds={selectedIds} qualityByRecordId={quality.byRecordId} onToggle={toggleRecord} onEdit={onEdit} onDelete={onDelete} />
      </section>
    </div>
  );
}
