import { FocusEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Calculator, ChevronDown, Plus, Save, X } from "lucide-react";
import { ABILITY_DIMENSIONS, BUSINESS_CATEGORIES, PRODUCT_SYSTEMS, SUBTASK_TEMPLATES, WORK_TYPES } from "../constants";
import {
  formatAbilityDimensions,
  formatAbilitySelectionSummary,
  parseAbilityDimensions
} from "../lib/abilityDimensions";
import { createConfigOption, fetchConfigOptions } from "../lib/configApi";
import {
  collectPersistedConfigOptionInputs,
  getConfigOptionDraftState,
  getConfigOptionMenuChoices,
  isSelectedForPersistence,
  normalizeConfigOptionLabel,
  type ConfigOptionPersistenceSelections,
  type ConfigOptionValues
} from "../lib/configOptionDrafts";
import { todayKey } from "../lib/date";
import { getInitialOptionFieldValue, getPostSubmitCoefficientValue } from "../lib/recordFormState";
import { matchWorkloadStandard } from "../lib/workloadApi";
import type {
  BusinessCategory,
  Category,
  ConfigOption,
  ConfigOptionType,
  RecordInput,
  WorkloadStandard,
  WorkRecord
} from "../types";

interface RecordFormProps {
  initialDate?: string;
  record?: WorkRecord;
  compact?: boolean;
  onSubmit: (input: RecordInput) => void | Promise<void>;
}

type FallbackOptions = Record<ConfigOptionType, string[]>;

const fallbackOptions: FallbackOptions = {
  businessCategory: BUSINESS_CATEGORIES,
  workType: WORK_TYPES,
  abilityDimension: ABILITY_DIMENSIONS,
  productSystem: PRODUCT_SYSTEMS,
  subtask: SUBTASK_TEMPLATES
};

function toOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatOptionalNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function formatWorkload(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function deriveLegacyCategory(businessCategory: string, workType: string, fallback?: Category): Category {
  if (businessCategory === "三新业务") return "三新业务";
  if (workType === "工程调试") return "工程调试";
  if (workType === "售前方案") return "售前支持";
  return fallback ?? "其他";
}

function getDefaultOption(options: ConfigOption[], type: ConfigOptionType, fallback: string): string {
  const enabledOptions = options.filter((option) => option.type === type && option.enabled);
  return enabledOptions.find((option) => option.isDefault)?.label ?? enabledOptions[0]?.label ?? fallback;
}

interface ConfigurableOptionFieldProps {
  type: ConfigOptionType;
  label: string;
  value: string;
  options: ConfigOption[];
  fallback: string[];
  listId: string;
  persistenceSelections: ConfigOptionPersistenceSelections;
  allowEmpty?: boolean;
  placeholder?: string;
  required?: boolean;
  onPersistenceChange: (key: string, checked: boolean) => void;
  onValueChange: (value: string) => void;
}

function ConfigurableOptionField({
  type,
  label,
  value,
  options,
  fallback,
  listId,
  persistenceSelections,
  allowEmpty = false,
  placeholder,
  required = false,
  onPersistenceChange,
  onValueChange
}: ConfigurableOptionFieldProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const optionLabels = getConfigOptionMenuChoices(options, type, value, fallback, allowEmpty);
  const draftState = getConfigOptionDraftState(options, type, value);
  const shouldPersist = isSelectedForPersistence(draftState, persistenceSelections);

  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsMenuOpen(false);
    }
  }

  function handleSelectOption(option: string): void {
    onValueChange(option);
    setIsMenuOpen(false);
  }

  return (
    <div className="configurable-field" onBlur={handleBlur}>
      <label>
        <span>{label}</span>
        <div className="combo-input-wrap">
          <input
            aria-expanded={isMenuOpen}
            aria-haspopup="listbox"
            aria-label={label}
            placeholder={placeholder}
            required={required}
            value={value}
            onChange={(event) => {
              onValueChange(event.target.value);
              setIsMenuOpen(true);
            }}
            onFocus={() => setIsMenuOpen(true)}
          />
          <button
            aria-label={`展开${label}候选项`}
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <ChevronDown size={16} />
          </button>
          {isMenuOpen && (
            <div className="combo-menu" id={listId} role="listbox">
              {optionLabels.map((item) => (
                <button
                  className={item === value ? "active" : ""}
                  key={item || `${listId}-empty`}
                  role="option"
                  type="button"
                  aria-selected={item === value}
                  onClick={() => handleSelectOption(item)}
                >
                  {item || "未选择"}
                </button>
              ))}
            </div>
          )}
        </div>
      </label>
      {draftState.isCustom && draftState.key && (
        <label className="save-common-option">
          <input
            checked={shouldPersist}
            type="checkbox"
            onChange={(event) => onPersistenceChange(draftState.key as string, event.target.checked)}
          />
          <span>保存为常用项</span>
        </label>
      )}
    </div>
  );
}

interface AbilityMultiSelectFieldProps {
  value: string;
  options: ConfigOption[];
  fallback: string[];
  onValueChange: (value: string) => void;
}

function AbilityMultiSelectField({
  value,
  options,
  fallback,
  onValueChange
}: AbilityMultiSelectFieldProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [customAbility, setCustomAbility] = useState("");
  const selectedAbilities = parseAbilityDimensions(value);
  const selectedSet = new Set(selectedAbilities);
  const choiceLabels = Array.from(
    new Set([
      ...getConfigOptionMenuChoices(options, "abilityDimension", "", fallback, false),
      ...selectedAbilities
    ])
  ).filter(Boolean);

  function toggleAbility(label: string): void {
    const nextAbilities = selectedSet.has(label)
      ? selectedAbilities.filter((item) => item !== label)
      : [...selectedAbilities, label];

    onValueChange(formatAbilityDimensions(nextAbilities));
  }

  function handleAddCustom(): void {
    const label = customAbility.trim();
    if (!label) return;

    onValueChange(formatAbilityDimensions([...selectedAbilities, label]));
    setCustomAbility("");
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsMenuOpen(false);
    }
  }

  function removeAbility(label: string): void {
    onValueChange(formatAbilityDimensions(selectedAbilities.filter((item) => item !== label)));
  }

  return (
    <div className="ability-multi-field" onBlur={handleBlur}>
      <span>能力维度</span>
      <div className="ability-picker-wrap">
        <button
          className="ability-picker-trigger"
          type="button"
          aria-expanded={isMenuOpen}
          aria-haspopup="listbox"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span>{formatAbilitySelectionSummary(value)}</span>
          <ChevronDown size={16} />
        </button>

        {isMenuOpen && (
          <div className="ability-picker-menu" role="listbox" aria-label="能力维度" aria-multiselectable="true">
            <div className="ability-option-list">
              {choiceLabels.map((label) => (
                <label className="ability-option-row" key={label}>
                  <input
                    checked={selectedSet.has(label)}
                    type="checkbox"
                    onChange={() => toggleAbility(label)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="ability-custom-row">
              <input
                placeholder="输入自定义能力"
                value={customAbility}
                onChange={(event) => setCustomAbility(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddCustom();
                  }
                }}
              />
              <button type="button" onClick={handleAddCustom}>
                <Plus size={15} />
                添加
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedAbilities.length > 0 && (
        <div className="ability-selected-list" aria-label="已选能力维度">
          {selectedAbilities.map((ability) => (
            <button
              className="ability-selected-tag"
              key={ability}
              type="button"
              aria-label={`移除能力维度：${ability}`}
              onClick={() => removeAbility(ability)}
            >
              <span>{ability}</span>
              <X size={13} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecordForm({ initialDate, record, compact = false, onSubmit }: RecordFormProps) {
  const [configOptions, setConfigOptions] = useState<ConfigOption[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configPersistenceSelections, setConfigPersistenceSelections] =
    useState<ConfigOptionPersistenceSelections>({});
  const [title, setTitle] = useState(record?.title ?? "");
  const [date, setDate] = useState(record?.date ?? initialDate ?? todayKey());
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory>(
    getInitialOptionFieldValue(record?.businessCategory)
  );
  const [workType, setWorkType] = useState(getInitialOptionFieldValue(record?.workType));
  const [abilityDimension, setAbilityDimension] = useState(record?.abilityDimension ?? "");
  const [projectName, setProjectName] = useState(record?.projectName ?? "");
  const [productSystem, setProductSystem] = useState(record?.productSystem ?? "");
  const [subtask, setSubtask] = useState(record?.subtask ?? "");
  const [quantity, setQuantity] = useState(formatOptionalNumber(record?.quantity));
  const [coefficient, setCoefficient] = useState(formatOptionalNumber(record?.coefficient));
  const [coefficientTouched, setCoefficientTouched] = useState(Boolean(record?.coefficient));
  const [workload, setWorkload] = useState(formatOptionalNumber(record?.workload));
  const [timeHours, setTimeHours] = useState(formatOptionalNumber(record?.timeHours));
  const [matchedStandard, setMatchedStandard] = useState<WorkloadStandard | null>(null);
  const [tags, setTags] = useState(record?.tags ?? "");
  const [content, setContent] = useState(record?.content ?? "");

  useEffect(() => {
    let isMounted = true;

    fetchConfigOptions()
      .then((options) => {
        if (!isMounted) return;
        setConfigOptions(options);
        setConfigError(null);
      })
      .catch((error) => {
        if (!isMounted) return;
        setConfigError(error instanceof Error ? `配置读取失败：${error.message}` : "配置读取失败");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (record || !configOptions.length) return;

    setBusinessCategory((current) =>
      current || getDefaultOption(configOptions, "businessCategory", "其他")
    );
    setWorkType((current) => current || getDefaultOption(configOptions, "workType", "其他项"));
    setAbilityDimension((current) => current || getDefaultOption(configOptions, "abilityDimension", ""));
    setProductSystem((current) => current || getDefaultOption(configOptions, "productSystem", ""));
    setSubtask((current) => current || getDefaultOption(configOptions, "subtask", ""));
  }, [configOptions, record]);

  useEffect(() => {
    if (!businessCategory || !workType || coefficientTouched) return;

    let isMounted = true;

    matchWorkloadStandard({ businessCategory, workType, productSystem, subtask })
      .then((standard) => {
        if (!isMounted) return;
        setMatchedStandard(standard);
        if (standard) setCoefficient(formatOptionalNumber(standard.coefficient));
      })
      .catch(() => {
        if (!isMounted) return;
        setMatchedStandard(null);
      });

    return () => {
      isMounted = false;
    };
  }, [businessCategory, workType, productSystem, subtask, coefficientTouched]);

  const quantityNumber = toOptionalNumber(quantity);
  const coefficientNumber = toOptionalNumber(coefficient);
  const calculatedWorkload = useMemo(() => {
    if (quantityNumber === null || coefficientNumber === null) return null;
    return quantityNumber * coefficientNumber;
  }, [quantityNumber, coefficientNumber]);

  useEffect(() => {
    if (calculatedWorkload === null) return;
    setWorkload(formatWorkload(calculatedWorkload));
  }, [calculatedWorkload]);

  function handleCriteriaChange(update: () => void): void {
    update();
    setCoefficientTouched(false);
    setMatchedStandard(null);
  }

  function handleConfigPersistenceChange(key: string, checked: boolean): void {
    setConfigPersistenceSelections((current) => ({ ...current, [key]: checked }));
  }

  async function persistCustomConfigOptions(values: ConfigOptionValues): Promise<void> {
    const inputs = collectPersistedConfigOptionInputs(
      configOptions,
      values,
      configPersistenceSelections
    );

    if (!inputs.length) return;

    try {
      await Promise.all(inputs.map((input) => createConfigOption(input)));
      const refreshedOptions = await fetchConfigOptions();
      setConfigOptions(refreshedOptions);
      setConfigError(null);
    } catch (error) {
      setConfigError(
        error instanceof Error
          ? `记录已保存，但常用项写入失败：${error.message}`
          : "记录已保存，但常用项写入失败"
      );
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() && !content.trim()) return;

    const normalizedValues: ConfigOptionValues = {
      businessCategory: normalizeConfigOptionLabel(businessCategory),
      workType: normalizeConfigOptionLabel(workType),
      abilityDimension: formatAbilityDimensions(parseAbilityDimensions(abilityDimension)),
      productSystem: normalizeConfigOptionLabel(productSystem),
      subtask: normalizeConfigOptionLabel(subtask)
    };

    if (!normalizedValues.businessCategory || !normalizedValues.workType) return;

    const category = deriveLegacyCategory(
      normalizedValues.businessCategory,
      normalizedValues.workType,
      record?.category
    );

    await onSubmit({
      title,
      date,
      category,
      tags,
      content,
      businessCategory: normalizedValues.businessCategory,
      workType: normalizedValues.workType,
      abilityDimension: normalizedValues.abilityDimension,
      projectName,
      productSystem: normalizedValues.productSystem,
      subtask: normalizedValues.subtask,
      quantity: quantityNumber,
      coefficient: coefficientNumber,
      workload: toOptionalNumber(workload),
      timeHours: toOptionalNumber(timeHours)
    });

    await persistCustomConfigOptions(normalizedValues);

    if (!record) {
      const nextCoefficient = getPostSubmitCoefficientValue({
        coefficientTouched,
        matchedCoefficient: matchedStandard?.coefficient
      });

      setTitle("");
      setTags("");
      setContent("");
      setQuantity("");
      setCoefficient(formatOptionalNumber(nextCoefficient));
      setCoefficientTouched(false);
      setMatchedStandard(nextCoefficient === null ? null : matchedStandard);
      setWorkload("");
      setTimeHours("");
      setDate(initialDate ?? todayKey());
    }
  };

  return (
    <form className={`record-form ${compact ? "compact" : ""}`} onSubmit={handleSubmit}>
      {configError && <div className="status-banner error">{configError}</div>}

      <div className="form-section">
        <div className="form-section-title">
          <span>基本信息</span>
        </div>
        <div className="form-row">
          <label>
            <span>标题</span>
            <input
              placeholder="例如：马东铁路网开关联调"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            <span>日期</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">
          <span>工作口径</span>
        </div>
        <div className="form-row three">
          <ConfigurableOptionField
            fallback={fallbackOptions.businessCategory}
            label="业务分类"
            listId="business-category-options"
            options={configOptions}
            persistenceSelections={configPersistenceSelections}
            required
            type="businessCategory"
            value={businessCategory}
            onPersistenceChange={handleConfigPersistenceChange}
            onValueChange={(value) => handleCriteriaChange(() => setBusinessCategory(value))}
          />
          <ConfigurableOptionField
            fallback={fallbackOptions.workType}
            label="工作类型"
            listId="work-type-options"
            options={configOptions}
            persistenceSelections={configPersistenceSelections}
            required
            type="workType"
            value={workType}
            onPersistenceChange={handleConfigPersistenceChange}
            onValueChange={(value) => handleCriteriaChange(() => setWorkType(value))}
          />
          <AbilityMultiSelectField
            fallback={fallbackOptions.abilityDimension}
            options={configOptions}
            value={abilityDimension}
            onValueChange={setAbilityDimension}
          />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">
          <span>项目与当量</span>
        </div>
        <div className="form-row three">
          <label>
            <span>项目名称</span>
            <input
              placeholder="例如：马东铁路"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
            />
          </label>
          <ConfigurableOptionField
            allowEmpty
            fallback={fallbackOptions.productSystem}
            label="产品系统"
            listId="product-system-options"
            options={configOptions}
            persistenceSelections={configPersistenceSelections}
            placeholder="未选择"
            type="productSystem"
            value={productSystem}
            onPersistenceChange={handleConfigPersistenceChange}
            onValueChange={(value) => handleCriteriaChange(() => setProductSystem(value))}
          />
          <ConfigurableOptionField
            allowEmpty
            fallback={fallbackOptions.subtask}
            label="工作细项"
            listId="subtask-options"
            options={configOptions}
            persistenceSelections={configPersistenceSelections}
            placeholder="未选择"
            type="subtask"
            value={subtask}
            onPersistenceChange={handleConfigPersistenceChange}
            onValueChange={(value) => handleCriteriaChange(() => setSubtask(value))}
          />
        </div>

        <div className="form-row three">
          <label>
            <span>数量</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label>
            <span>折算系数</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={coefficient}
              onChange={(event) => {
                setCoefficient(event.target.value);
                setCoefficientTouched(true);
                setMatchedStandard(null);
              }}
            />
            {matchedStandard && <small className="field-hint">匹配标准：{matchedStandard.coefficient}</small>}
          </label>
          <label className="calculated-field">
            <span>工作当量</span>
            <div>
              <Calculator size={16} />
              <input readOnly value={workload} />
            </div>
          </label>
        </div>
        <div className="form-row">
          <label>
            <span>投入时间（小时）</span>
            <input
              min="0"
              step="0.25"
              type="number"
              value={timeHours}
              onChange={(event) => setTimeHours(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">
          <span>内容记录</span>
        </div>
        <label>
          <span>二级标签</span>
          <input
            placeholder="包神项目, 深圳地铁"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </label>

        <label>
          <span>详细内容</span>
          <textarea
            placeholder="记录今天完成的工作、问题、结论或后续动作"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
      </div>

      <button className="primary-button" type="submit">
        {record ? <Save size={17} /> : <Plus size={17} />}
        {record ? "保存修改" : "添加记录"}
      </button>
    </form>
  );
}
