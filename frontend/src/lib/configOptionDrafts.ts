import type { ConfigOption, ConfigOptionInput, ConfigOptionType } from "../types";

export type ConfigOptionValues = Record<ConfigOptionType, string>;
export type ConfigOptionPersistenceSelections = Record<string, boolean>;

export const configurableOptionTypes: ConfigOptionType[] = [
  "businessCategory",
  "workType",
  "abilityDimension",
  "productSystem",
  "subtask"
];

export interface ConfigOptionDraftState {
  isCustom: boolean;
  label: string;
  key: string | null;
  defaultPersist: boolean;
}

export function normalizeConfigOptionLabel(value: string | undefined): string {
  return String(value || "").trim();
}

function splitConfigOptionLabels(value: string | undefined): string[] {
  const seen = new Set<string>();

  return String(value || "")
    .split(/[,，、;；\s]+/)
    .map((item) => normalizeConfigOptionLabel(item))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

export function getConfigOptionDraftKey(type: ConfigOptionType, label: string): string | null {
  const normalizedLabel = normalizeConfigOptionLabel(label);
  return normalizedLabel ? `${type}:${normalizedLabel}` : null;
}

export function shouldPersistConfigOptionByDefault(type: ConfigOptionType): boolean {
  return type !== "businessCategory";
}

export function hasEnabledConfigOption(
  options: ConfigOption[],
  type: ConfigOptionType,
  label: string
): boolean {
  const normalizedLabel = normalizeConfigOptionLabel(label);
  if (!normalizedLabel) return false;

  return options.some(
    (option) =>
      option.type === type &&
      option.enabled &&
      normalizeConfigOptionLabel(option.label) === normalizedLabel
  );
}

export function getConfigOptionDraftState(
  options: ConfigOption[],
  type: ConfigOptionType,
  value: string
): ConfigOptionDraftState {
  const label = normalizeConfigOptionLabel(value);
  const isCustom = Boolean(label) && !hasEnabledConfigOption(options, type, label);

  return {
    isCustom,
    label,
    key: isCustom ? getConfigOptionDraftKey(type, label) : null,
    defaultPersist: isCustom ? shouldPersistConfigOptionByDefault(type) : false
  };
}

export function getConfigOptionLabels(
  options: ConfigOption[],
  type: ConfigOptionType,
  currentValue: string,
  fallback: string[],
  allowEmpty = false
): string[] {
  const labels = options
    .filter((option) => option.type === type && option.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createTime - b.createTime)
    .map((option) => option.label);

  const merged = labels.length ? labels : fallback;
  const values = allowEmpty ? ["", ...merged] : merged.slice();
  const normalizedCurrent = normalizeConfigOptionLabel(currentValue);

  if (
    normalizedCurrent &&
    !values.some((item) => normalizeConfigOptionLabel(item) === normalizedCurrent)
  ) {
    values.push(normalizedCurrent);
  }

  return Array.from(new Set(values));
}

export function getConfigOptionMenuChoices(
  options: ConfigOption[],
  type: ConfigOptionType,
  currentValue: string,
  fallback: string[],
  allowEmpty = false
): string[] {
  return getConfigOptionLabels(options, type, currentValue, fallback, allowEmpty);
}

export function isSelectedForPersistence(
  state: ConfigOptionDraftState,
  selections: ConfigOptionPersistenceSelections
): boolean {
  if (!state.isCustom || !state.key) return false;
  return selections[state.key] ?? state.defaultPersist;
}

export function collectPersistedConfigOptionInputs(
  options: ConfigOption[],
  values: ConfigOptionValues,
  selections: ConfigOptionPersistenceSelections
): ConfigOptionInput[] {
  return configurableOptionTypes.flatMap((type) => {
    const labels = type === "abilityDimension" ? splitConfigOptionLabels(values[type]) : [values[type]];

    return labels.flatMap((label) => {
      const state = getConfigOptionDraftState(options, type, label);
      if (!isSelectedForPersistence(state, selections)) return [];

      return [{ type, label: state.label }];
    });
  });
}
