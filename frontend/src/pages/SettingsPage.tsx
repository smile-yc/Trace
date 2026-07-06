import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Plus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Star,
  Trash2,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import {
  createConfigOption,
  deleteConfigOptionApi,
  fetchConfigOptions,
  reorderConfigOptionsApi,
  updateConfigOptionApi
} from "../lib/configApi";
import {
  createWorkloadStandard,
  deleteWorkloadStandardApi,
  fetchWorkloadStandards,
  updateWorkloadStandardApi
} from "../lib/workloadApi";
import { DEFAULT_APP_SETTINGS, fetchSettings, updateSettings } from "../lib/settingsApi";
import type { AppSettings, ConfigOption, ConfigOptionType, FocusScoreWeights, WarningRules, WorkloadStandard } from "../types";

interface SettingsPageProps {
  onNotify: (message: string) => void;
}

interface ConfigGroupMeta {
  type: ConfigOptionType;
  label: string;
  shortLabel: string;
  eyebrow: string;
}

type SettingsPanel = "options" | "standards" | "analysis";

interface WorkloadStandardDraft {
  businessCategory: string;
  workType: string;
  productSystem: string;
  subtask: string;
  coefficient: string;
  remark: string;
  enabled: boolean;
}

const configGroups: ConfigGroupMeta[] = [
  { type: "businessCategory", label: "业务分类", shortLabel: "业务", eyebrow: "Business" },
  { type: "workType", label: "工作类型", shortLabel: "类型", eyebrow: "Work Type" },
  { type: "abilityDimension", label: "能力维度", shortLabel: "能力", eyebrow: "Ability" },
  { type: "productSystem", label: "产品系统", shortLabel: "产品", eyebrow: "Product" },
  { type: "subtask", label: "工作细项", shortLabel: "细项", eyebrow: "Work Item" }
];

const typeOrder = configGroups.map((group) => group.type);

const emptyStandardDraft: WorkloadStandardDraft = {
  businessCategory: "",
  workType: "",
  productSystem: "",
  subtask: "",
  coefficient: "",
  remark: "",
  enabled: true
};

function sortOptions(options: ConfigOption[]): ConfigOption[] {
  return options.slice().sort((a, b) => {
    const typeDiff = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
    if (typeDiff !== 0) return typeDiff;
    return a.sortOrder - b.sortOrder || a.createTime - b.createTime;
  });
}

function sortStandards(standards: WorkloadStandard[]): WorkloadStandard[] {
  return standards.slice().sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return (
      a.businessCategory.localeCompare(b.businessCategory, "zh-CN") ||
      a.workType.localeCompare(b.workType, "zh-CN") ||
      a.productSystem.localeCompare(b.productSystem, "zh-CN") ||
      a.subtask.localeCompare(b.subtask, "zh-CN") ||
      a.createTime - b.createTime
    );
  });
}

function replaceTypeOptions(
  options: ConfigOption[],
  type: ConfigOptionType,
  nextTypeOptions: ConfigOption[]
): ConfigOption[] {
  return sortOptions([...options.filter((option) => option.type !== type), ...nextTypeOptions]);
}

function toStandardDraft(standard: WorkloadStandard): WorkloadStandardDraft {
  return {
    businessCategory: standard.businessCategory,
    workType: standard.workType,
    productSystem: standard.productSystem,
    subtask: standard.subtask,
    coefficient: String(standard.coefficient),
    remark: standard.remark,
    enabled: standard.enabled
  };
}

function getEnabledLabels(options: ConfigOption[], type: ConfigOptionType, currentValue = "", includeBlank = false) {
  const labels = options
    .filter((option) => option.type === type && option.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createTime - b.createTime)
    .map((option) => option.label);
  const values = includeBlank ? ["", ...labels] : labels;

  if (currentValue && !values.includes(currentValue)) values.push(currentValue);
  return Array.from(new Set(values));
}

function parseCoefficient(value: string): number | null {
  if (!value.trim()) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isStandardDraftChanged(standard: WorkloadStandard, draft: WorkloadStandardDraft): boolean {
  return (
    standard.businessCategory !== draft.businessCategory ||
    standard.workType !== draft.workType ||
    standard.productSystem !== draft.productSystem ||
    standard.subtask !== draft.subtask ||
    standard.coefficient !== parseCoefficient(draft.coefficient) ||
    standard.remark !== draft.remark ||
    standard.enabled !== draft.enabled
  );
}

export function SettingsPage({ onNotify }: SettingsPageProps) {
  const [activePanel, setActivePanel] = useState<SettingsPanel>("options");
  const [options, setOptions] = useState<ConfigOption[]>([]);
  const [standards, setStandards] = useState<WorkloadStandard[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>({});
  const [standardDrafts, setStandardDrafts] = useState<Record<string, WorkloadStandardDraft>>({});
  const [newLabels, setNewLabels] = useState<Record<ConfigOptionType, string>>({
    businessCategory: "",
    workType: "",
    abilityDimension: "",
    productSystem: "",
    subtask: ""
  });
  const [newStandard, setNewStandard] = useState<WorkloadStandardDraft>(emptyStandardDraft);
  const [activeType, setActiveType] = useState<ConfigOptionType>("businessCategory");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadOptions(): Promise<void> {
    try {
      setLoading(true);
      const [nextOptions, nextStandards, nextSettings] = await Promise.all([
        fetchConfigOptions(),
        fetchWorkloadStandards(),
        fetchSettings()
      ]);
      const sortedOptions = sortOptions(nextOptions);
      const sortedStandards = sortStandards(nextStandards);

      setOptions(sortedOptions);
      setStandards(sortedStandards);
      setSettingsDraft(nextSettings);
      setDraftLabels(
        sortedOptions.reduce<Record<string, string>>((drafts, option) => {
          drafts[option.id] = option.label;
          return drafts;
        }, {})
      );
      setStandardDrafts(
        sortedStandards.reduce<Record<string, WorkloadStandardDraft>>((drafts, standard) => {
          drafts[standard.id] = toStandardDraft(standard);
          return drafts;
        }, {})
      );
      setNewStandard((current) => ({
        ...current,
        businessCategory: current.businessCategory || getEnabledLabels(sortedOptions, "businessCategory")[0] || "",
        workType: current.workType || getEnabledLabels(sortedOptions, "workType")[0] || ""
      }));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "配置读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOptions();
  }, []);

  const groupedOptions = useMemo(() => {
    return configGroups.reduce<Record<ConfigOptionType, ConfigOption[]>>(
      (groups, group) => {
        groups[group.type] = options.filter((option) => option.type === group.type);
        return groups;
      },
      { businessCategory: [], workType: [], abilityDimension: [], productSystem: [], subtask: [] }
    );
  }, [options]);

  const activeGroup = configGroups.find((group) => group.type === activeType) ?? configGroups[0];
  const activeOptions = groupedOptions[activeType];
  const enabledCount = options.filter((option) => option.enabled).length;
  const disabledCount = options.length - enabledCount;
  const enabledStandardCount = standards.filter((standard) => standard.enabled).length;
  const disabledStandardCount = standards.length - enabledStandardCount;
  const defaultCount = options.filter((option) => option.isDefault).length;
  const businessCategoryOptions = getEnabledLabels(options, "businessCategory", newStandard.businessCategory);
  const workTypeOptions = getEnabledLabels(options, "workType", newStandard.workType);
  const productSystemOptions = getEnabledLabels(options, "productSystem", newStandard.productSystem, true);
  const subtaskOptions = getEnabledLabels(options, "subtask", newStandard.subtask, true);
  const abilityTargetOptions = getEnabledLabels(options, "abilityDimension");

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const label = newLabels[activeType].trim();
    if (!label) return;

    try {
      const option = await createConfigOption({ type: activeType, label });
      setOptions((current) => sortOptions([...current.filter((item) => item.id !== option.id), option]));
      setDraftLabels((current) => ({ ...current, [option.id]: option.label }));
      setNewLabels((current) => ({ ...current, [activeType]: "" }));
      onNotify("配置项已新增");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "新增配置失败");
    }
  }

  async function handleCreateStandard(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const coefficient = parseCoefficient(newStandard.coefficient);
    if (!newStandard.businessCategory || !newStandard.workType || coefficient === null) return;

    try {
      const standard = await createWorkloadStandard({
        businessCategory: newStandard.businessCategory,
        workType: newStandard.workType,
        productSystem: newStandard.productSystem,
        subtask: newStandard.subtask,
        coefficient,
        remark: newStandard.remark,
        enabled: newStandard.enabled
      });
      setStandards((current) => sortStandards([...current, standard]));
      setStandardDrafts((current) => ({ ...current, [standard.id]: toStandardDraft(standard) }));
      setNewStandard((current) => ({ ...emptyStandardDraft, businessCategory: current.businessCategory, workType: current.workType }));
      onNotify("当量标准已新增");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "新增当量标准失败");
    }
  }

  async function handleSaveLabel(option: ConfigOption): Promise<void> {
    const label = (draftLabels[option.id] ?? option.label).trim();
    if (!label || label === option.label) return;

    try {
      setSavingId(option.id);
      const nextOption = await updateConfigOptionApi(option.id, { label });
      setOptions((current) => sortOptions(current.map((item) => (item.id === option.id ? nextOption : item))));
      setDraftLabels((current) => ({ ...current, [option.id]: nextOption.label }));
      onNotify("配置名称已更新");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "保存配置失败");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveStandard(standard: WorkloadStandard): Promise<void> {
    const draft = standardDrafts[standard.id];
    if (!draft) return;

    const coefficient = parseCoefficient(draft.coefficient);
    if (!draft.businessCategory || !draft.workType || coefficient === null) return;

    try {
      setSavingId(standard.id);
      const nextStandard = await updateWorkloadStandardApi(standard.id, {
        businessCategory: draft.businessCategory,
        workType: draft.workType,
        productSystem: draft.productSystem,
        subtask: draft.subtask,
        coefficient,
        remark: draft.remark,
        enabled: draft.enabled
      });
      setStandards((current) => sortStandards(current.map((item) => (item.id === standard.id ? nextStandard : item))));
      setStandardDrafts((current) => ({ ...current, [standard.id]: toStandardDraft(nextStandard) }));
      onNotify("当量标准已更新");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "保存当量标准失败");
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggle(option: ConfigOption): Promise<void> {
    try {
      setSavingId(option.id);
      const nextOption = await updateConfigOptionApi(option.id, { enabled: !option.enabled });
      setOptions((current) => sortOptions(current.map((item) => (item.id === option.id ? nextOption : item))));
      onNotify(nextOption.enabled ? "配置项已启用" : "配置项已禁用");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "更新配置失败");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteOption(option: ConfigOption): Promise<void> {
    if (!window.confirm(`确认删除配置项「${option.label}」吗？已有日报记录中的文本不会被删除。`)) return;

    try {
      setSavingId(option.id);
      await deleteConfigOptionApi(option.id);
      setOptions((current) => sortOptions(current.filter((item) => item.id !== option.id)));
      setDraftLabels((current) => {
        const { [option.id]: _removed, ...rest } = current;
        return rest;
      });
      onNotify("配置项已删除");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "删除配置失败");
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleStandard(standard: WorkloadStandard): Promise<void> {
    try {
      setSavingId(standard.id);
      const nextStandard = await updateWorkloadStandardApi(standard.id, { enabled: !standard.enabled });
      setStandards((current) => sortStandards(current.map((item) => (item.id === standard.id ? nextStandard : item))));
      setStandardDrafts((current) => ({ ...current, [standard.id]: toStandardDraft(nextStandard) }));
      onNotify(nextStandard.enabled ? "当量标准已启用" : "当量标准已禁用");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "更新当量标准失败");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteStandard(standard: WorkloadStandard): Promise<void> {
    const label = [standard.businessCategory, standard.workType, standard.productSystem, standard.subtask]
      .filter(Boolean)
      .join(" / ");
    if (!window.confirm(`确认删除当量标准「${label}」吗？已有日报记录中的当量不会被改写。`)) return;

    try {
      setSavingId(standard.id);
      await deleteWorkloadStandardApi(standard.id);
      setStandards((current) => sortStandards(current.filter((item) => item.id !== standard.id)));
      setStandardDrafts((current) => {
        const { [standard.id]: _removed, ...rest } = current;
        return rest;
      });
      onNotify("当量标准已删除");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "删除当量标准失败");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSetDefault(option: ConfigOption): Promise<void> {
    if (option.isDefault) return;

    try {
      setSavingId(option.id);
      const nextOption = await updateConfigOptionApi(option.id, { enabled: true, isDefault: true });
      setOptions((current) =>
        sortOptions(
          current.map((item) => {
            if (item.type !== option.type) return item;
            if (item.id === option.id) return nextOption;
            return { ...item, isDefault: false };
          })
        )
      );
      onNotify("默认项已设置");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "设置默认项失败");
    } finally {
      setSavingId(null);
    }
  }

  async function handleMove(option: ConfigOption, direction: -1 | 1): Promise<void> {
    const index = activeOptions.findIndex((item) => item.id === option.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= activeOptions.length) return;

    const nextOptions = activeOptions.slice();
    const [moved] = nextOptions.splice(index, 1);
    nextOptions.splice(targetIndex, 0, moved);

    try {
      setSavingId(option.id);
      const reordered = await reorderConfigOptionsApi(
        option.type,
        nextOptions.map((item) => item.id)
      );
      setOptions((current) => replaceTypeOptions(current, option.type, reordered));
      onNotify("排序已更新");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "排序更新失败");
    } finally {
      setSavingId(null);
    }
  }

  function handleLabelKeyDown(event: KeyboardEvent<HTMLInputElement>, option: ConfigOption): void {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSaveLabel(option);
    }
  }

  function updateStandardDraft(id: string, patch: Partial<WorkloadStandardDraft>): void {
    setStandardDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? emptyStandardDraft), ...patch }
    }));
  }

  function updateFocusWeight(key: keyof FocusScoreWeights, value: string): void {
    setSettingsDraft((current) => ({
      ...current,
      focusScoreWeights: {
        ...current.focusScoreWeights,
        [key]: Number(value)
      }
    }));
  }

  function updateWarningRule(key: keyof WarningRules, value: string): void {
    setSettingsDraft((current) => ({
      ...current,
      warningRules: {
        ...current.warningRules,
        [key]: Number(value)
      }
    }));
  }

  function updateAbilityTarget(label: string, value: string): void {
    setSettingsDraft((current) => ({
      ...current,
      abilityTargets: {
        ...current.abilityTargets,
        [label]: Number(value)
      }
    }));
  }

  async function handleSaveAnalysisSettings(): Promise<void> {
    try {
      setSavingId("analysis-settings");
      const nextSettings = await updateSettings(settingsDraft);
      setSettingsDraft(nextSettings);
      onNotify("分析规则已保存");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "保存分析规则失败");
    } finally {
      setSavingId(null);
    }
  }

  function renderBasicOptions() {
    return (
      <section className="config-layout">
        <aside className="config-index panel">
          <div className="panel-heading">
            <h2>配置分组</h2>
            <SlidersHorizontal size={18} />
          </div>

          <div className="config-group-list">
            {configGroups.map((group) => {
              const groupOptions = groupedOptions[group.type];
              const isActive = group.type === activeType;
              const groupEnabledCount = groupOptions.filter((option) => option.enabled).length;

              return (
                <button
                  className={`config-group-button ${isActive ? "active" : ""}`}
                  key={group.type}
                  onClick={() => setActiveType(group.type)}
                  type="button"
                >
                  <span>
                    <small>{group.eyebrow}</small>
                    <strong>{group.label}</strong>
                  </span>
                  <em>{groupEnabledCount}/{groupOptions.length}</em>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="config-workbench panel">
          <div className="config-workbench-header">
            <div>
              <span className="eyebrow">{activeGroup.eyebrow}</span>
              <h2>{activeGroup.label}</h2>
            </div>
            <span className="config-count">{activeOptions.length} 项</span>
          </div>

          <form className="config-add-form" onSubmit={handleCreate}>
            <label>
              <span>新增{activeGroup.shortLabel}</span>
              <input
                placeholder={`输入新的${activeGroup.label}`}
                value={newLabels[activeType]}
                onChange={(event) =>
                  setNewLabels((current) => ({ ...current, [activeType]: event.target.value }))
                }
              />
            </label>
            <button className="primary-button" type="submit">
              <Plus size={16} />
              新增
            </button>
          </form>

          <div className="config-option-list">
            {activeOptions.map((option, index) => {
              const draftLabel = draftLabels[option.id] ?? option.label;
              const hasChanges = draftLabel.trim() !== option.label;
              const isBusy = savingId === option.id;

              return (
                <article className={`config-option-row ${option.enabled ? "" : "disabled"}`} key={option.id}>
                  <div className="config-option-order">{String(index + 1).padStart(2, "0")}</div>

                  <div className="config-option-main">
                    <input
                      value={draftLabel}
                      onChange={(event) =>
                        setDraftLabels((current) => ({ ...current, [option.id]: event.target.value }))
                      }
                      onKeyDown={(event) => handleLabelKeyDown(event, option)}
                    />
                    <div className="config-option-badges">
                      {option.isSystem && <span>系统</span>}
                      {option.isDefault && (
                        <span className="default">
                          <CheckCircle2 size={12} />
                          默认
                        </span>
                      )}
                      {!option.enabled && <span className="muted-badge">已禁用</span>}
                    </div>
                  </div>

                  <div className="config-option-actions">
                    <button
                      aria-label="上移"
                      disabled={index === 0 || isBusy}
                      onClick={() => handleMove(option, -1)}
                      type="button"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      aria-label="下移"
                      disabled={index === activeOptions.length - 1 || isBusy}
                      onClick={() => handleMove(option, 1)}
                      type="button"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      aria-label="保存名称"
                      disabled={!hasChanges || isBusy}
                      onClick={() => handleSaveLabel(option)}
                      type="button"
                    >
                      <Save size={15} />
                    </button>
                    <button
                      aria-label="设为默认"
                      disabled={option.isDefault || isBusy}
                      onClick={() => handleSetDefault(option)}
                      type="button"
                    >
                      <Star size={15} />
                    </button>
                    <button
                      className={option.enabled ? "toggle-on" : ""}
                      aria-label={option.enabled ? "禁用配置项" : "启用配置项"}
                      disabled={isBusy}
                      onClick={() => handleToggle(option)}
                      type="button"
                    >
                      {option.enabled ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                      <span>{option.enabled ? "启用" : "禁用"}</span>
                    </button>
                    <button
                      className="danger-action"
                      aria-label="删除配置项"
                      title="删除配置项"
                      disabled={isBusy}
                      onClick={() => handleDeleteOption(option)}
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    );
  }

  function renderStandardForm() {
    return (
      <form className="standard-add-form" onSubmit={handleCreateStandard}>
        <label>
          <span>业务分类</span>
          <select
            value={newStandard.businessCategory}
            onChange={(event) => setNewStandard((current) => ({ ...current, businessCategory: event.target.value }))}
          >
            {businessCategoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>工作类型</span>
          <select
            value={newStandard.workType}
            onChange={(event) => setNewStandard((current) => ({ ...current, workType: event.target.value }))}
          >
            {workTypeOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>产品系统</span>
          <select
            value={newStandard.productSystem}
            onChange={(event) => setNewStandard((current) => ({ ...current, productSystem: event.target.value }))}
          >
            {productSystemOptions.map((item) => (
              <option key={item || "blank-product"} value={item}>
                {item || "不限"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>工作细项</span>
          <select
            value={newStandard.subtask}
            onChange={(event) => setNewStandard((current) => ({ ...current, subtask: event.target.value }))}
          >
            {subtaskOptions.map((item) => (
              <option key={item || "blank-subtask"} value={item}>
                {item || "不限"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>折算系数</span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={newStandard.coefficient}
            onChange={(event) => setNewStandard((current) => ({ ...current, coefficient: event.target.value }))}
          />
        </label>
        <label className="standard-remark-field">
          <span>备注</span>
          <input
            value={newStandard.remark}
            onChange={(event) => setNewStandard((current) => ({ ...current, remark: event.target.value }))}
          />
        </label>
        <button className="primary-button" type="submit">
          <Plus size={16} />
          新增标准
        </button>
      </form>
    );
  }

  function renderWorkloadStandards() {
    return (
      <section className="panel standards-panel">
        <div className="config-workbench-header">
          <div>
            <span className="eyebrow">Workload</span>
            <h2>当量标准</h2>
          </div>
          <span className="config-count">{standards.length} 条</span>
        </div>

        {renderStandardForm()}

        <div className="standard-list">
          {standards.length ? (
            standards.map((standard) => {
              const draft = standardDrafts[standard.id] ?? toStandardDraft(standard);
              const coefficient = parseCoefficient(draft.coefficient);
              const hasChanges = isStandardDraftChanged(standard, draft);
              const isBusy = savingId === standard.id;

              return (
                <article className={`standard-row ${draft.enabled ? "" : "disabled"}`} key={standard.id}>
                  <div className="standard-rule">
                    <select
                      value={draft.businessCategory}
                      onChange={(event) => updateStandardDraft(standard.id, { businessCategory: event.target.value })}
                    >
                      {getEnabledLabels(options, "businessCategory", draft.businessCategory).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.workType}
                      onChange={(event) => updateStandardDraft(standard.id, { workType: event.target.value })}
                    >
                      {getEnabledLabels(options, "workType", draft.workType).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.productSystem}
                      onChange={(event) => updateStandardDraft(standard.id, { productSystem: event.target.value })}
                    >
                      {getEnabledLabels(options, "productSystem", draft.productSystem, true).map((item) => (
                        <option key={item || "blank-product"} value={item}>
                          {item || "不限产品"}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.subtask}
                      onChange={(event) => updateStandardDraft(standard.id, { subtask: event.target.value })}
                    >
                      {getEnabledLabels(options, "subtask", draft.subtask, true).map((item) => (
                        <option key={item || "blank-subtask"} value={item}>
                          {item || "不限工作细项"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="standard-meta">
                    <label>
                      <span>系数</span>
                      <input
                        className={coefficient === null ? "invalid" : ""}
                        min="0"
                        step="0.01"
                        type="number"
                        value={draft.coefficient}
                        onChange={(event) => updateStandardDraft(standard.id, { coefficient: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>备注</span>
                      <input
                        value={draft.remark}
                        onChange={(event) => updateStandardDraft(standard.id, { remark: event.target.value })}
                      />
                    </label>
                  </div>

                  <div className="standard-actions">
                    <button
                      aria-label="保存当量标准"
                      disabled={!hasChanges || coefficient === null || isBusy}
                      onClick={() => handleSaveStandard(standard)}
                      type="button"
                    >
                      <Save size={15} />
                      保存
                    </button>
                    <button
                      className={standard.enabled ? "toggle-on" : ""}
                      aria-label={standard.enabled ? "禁用当量标准" : "启用当量标准"}
                      disabled={isBusy}
                      onClick={() => handleToggleStandard(standard)}
                      type="button"
                    >
                      {standard.enabled ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                      <span>{standard.enabled ? "启用" : "禁用"}</span>
                    </button>
                    <button
                      className="danger-action"
                      aria-label="删除当量标准"
                      disabled={isBusy}
                      onClick={() => handleDeleteStandard(standard)}
                      type="button"
                    >
                      <Trash2 size={15} />
                      删除
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state">暂无当量标准。</div>
          )}
        </div>
      </section>
    );
  }

  function renderAnalysisRules() {
    const weightTotal =
      Number(settingsDraft.focusScoreWeights.workload || 0) +
      Number(settingsDraft.focusScoreWeights.timeHours || 0) +
      Number(settingsDraft.focusScoreWeights.recordCount || 0);

    return (
      <section className="panel analysis-rules-panel">
        <div className="config-workbench-header">
          <div>
            <span className="eyebrow">Analysis Rules</span>
            <h2>分析规则</h2>
          </div>
          <button
            className="primary-button"
            disabled={savingId === "analysis-settings"}
            onClick={handleSaveAnalysisSettings}
            type="button"
          >
            <Save size={16} />
            保存规则
          </button>
        </div>

        <div className="analysis-settings-grid">
          <article className="analysis-setting-card">
            <div className="dashboard-card-heading">
              <h3>工作重心评分权重</h3>
              <span>合计 {weightTotal}</span>
            </div>
            <div className="settings-field-grid">
              <label>
                <span>工作当量权重</span>
                <input
                  min="0"
                  step="1"
                  type="number"
                  value={settingsDraft.focusScoreWeights.workload}
                  onChange={(event) => updateFocusWeight("workload", event.target.value)}
                />
              </label>
              <label>
                <span>投入时间权重</span>
                <input
                  min="0"
                  step="1"
                  type="number"
                  value={settingsDraft.focusScoreWeights.timeHours}
                  onChange={(event) => updateFocusWeight("timeHours", event.target.value)}
                />
              </label>
              <label>
                <span>记录数量权重</span>
                <input
                  min="0"
                  step="1"
                  type="number"
                  value={settingsDraft.focusScoreWeights.recordCount}
                  onChange={(event) => updateFocusWeight("recordCount", event.target.value)}
                />
              </label>
            </div>
          </article>

          <article className="analysis-setting-card">
            <div className="dashboard-card-heading">
              <h3>查漏补缺预警</h3>
              <span>目标偏差</span>
            </div>
            <div className="settings-field-grid two">
              <label>
                <span>能力未记录天数</span>
                <input
                  min="1"
                  step="1"
                  type="number"
                  value={settingsDraft.warningRules.abilityNoRecordDays}
                  onChange={(event) => updateWarningRule("abilityNoRecordDays", event.target.value)}
                />
              </label>
              <label>
                <span>目标占比偏差%</span>
                <input
                  min="0"
                  step="1"
                  type="number"
                  value={settingsDraft.warningRules.targetShareDeviationPercent}
                  onChange={(event) => updateWarningRule("targetShareDeviationPercent", event.target.value)}
                />
              </label>
            </div>
          </article>

          <article className="analysis-setting-card wide">
            <div className="dashboard-card-heading">
              <h3>能力目标占比</h3>
              <span>{abilityTargetOptions.length} 个能力维度</span>
            </div>
            <div className="ability-target-grid">
              {abilityTargetOptions.map((label) => (
                <label key={label}>
                  <span>{label}</span>
                  <input
                    min="0"
                    step="1"
                    type="number"
                    value={settingsDraft.abilityTargets[label] ?? 0}
                    onChange={(event) => updateAbilityTarget(label, event.target.value)}
                  />
                </label>
              ))}
              {!abilityTargetOptions.length && <div className="empty-state">请先在基础配置中启用能力维度。</div>}
            </div>
          </article>
        </div>
      </section>
    );
  }

  function renderActivePanel() {
    if (activePanel === "standards") return renderWorkloadStandards();
    if (activePanel === "analysis") return renderAnalysisRules();
    return renderBasicOptions();
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="配置中心"
        description="维护日报、当量统计和后续展板使用的基础口径。"
        actions={
          <button className="ghost-button" onClick={loadOptions} type="button" disabled={loading}>
            <RefreshCw size={16} />
            刷新配置
          </button>
        }
      />

      <StatCards
        items={[
          { label: "配置项", value: options.length },
          { label: "启用配置", value: enabledCount },
          { label: "当量标准", value: standards.length },
          { label: "启用标准", value: `${enabledStandardCount}/${standards.length || 0}` }
        ]}
      />

      <div className="settings-tabs">
        <button
          className={activePanel === "options" ? "active" : ""}
          onClick={() => setActivePanel("options")}
          type="button"
        >
          <SlidersHorizontal size={16} />
          基础配置
        </button>
        <button
          className={activePanel === "standards" ? "active" : ""}
          onClick={() => setActivePanel("standards")}
          type="button"
        >
          <ClipboardList size={16} />
          当量标准
        </button>
        <button
          className={activePanel === "analysis" ? "active" : ""}
          onClick={() => setActivePanel("analysis")}
          type="button"
        >
          <Gauge size={16} />
          分析规则
        </button>
        <span>{disabledCount + disabledStandardCount} 项停用</span>
        <span>{defaultCount} 个默认项</span>
      </div>

      {renderActivePanel()}
    </>
  );
}
