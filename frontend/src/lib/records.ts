import type { AbilityDimension, BusinessCategory, Category, RecordInput, WorkRecord, WorkType } from "../types";
import type { AbilityAllocation, CoefficientSource } from "../types/domain/workload";
import { ABILITY_DIMENSIONS, BUSINESS_CATEGORIES, CATEGORIES, WORK_TYPES } from "../constants";
import { inRange } from "./date";

export function normalizeTags(input: string): string {
  const seen = new Set<string>();
  const tags = input
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => {
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });

  return tags.join(",");
}

export function splitTags(tags: string): string[] {
  if (!tags.trim()) return [];
  return normalizeTags(tags).split(",").filter(Boolean);
}

export function createId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNumber(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;

  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function normalizeWorkload(quantity: number | null, coefficient: number | null, explicit: unknown): number | null {
  const workload = normalizeNumber(explicit);
  if (workload !== null) return workload;
  if (quantity === null || coefficient === null) return null;

  return Number((quantity * coefficient).toFixed(4));
}

const COEFFICIENT_SOURCES = new Set<CoefficientSource>([
  "none",
  "legacy",
  "manual",
  "standard_exact",
  "standard_general"
]);

function normalizeNullableText(input: unknown): string | null {
  const value = String(input ?? "").trim();
  return value || null;
}

function normalizeCoefficientSource(input: unknown, coefficient: number | null): CoefficientSource {
  if (COEFFICIENT_SOURCES.has(input as CoefficientSource)) return input as CoefficientSource;
  return coefficient === null ? "none" : "legacy";
}

function splitAbilityNames(value: string): string[] {
  return Array.from(new Set(value.split(/[,\uFF0C\u3001\s]+/).map((item) => item.trim()).filter(Boolean)));
}

function normalizeAbilityAllocations(
  input: Array<Partial<AbilityAllocation>> | undefined,
  legacyAbilityDimension: string,
  timeHours: number | null,
  workload: number | null
): AbilityAllocation[] {
  const provided = input?.map((item) => ({
    abilityId: String(item.abilityId ?? "").trim(),
    abilityName: String(item.abilityName ?? "").trim(),
    percentage: normalizeNumber(item.percentage)
  })) ?? [];
  const providedTotal = provided.reduce((sum, item) => sum + (item.percentage ?? 0), 0);
  const providedIds = new Set(provided.map((item) => item.abilityId));
  const useProvided = provided.length > 0
    && providedIds.size === provided.length
    && provided.every((item) => item.abilityId && item.abilityName && item.percentage !== null && item.percentage >= 0)
    && Math.abs(providedTotal - 100) <= 0.000001;
  const base = useProvided
    ? provided.map((item) => ({
        abilityId: item.abilityId,
        abilityName: item.abilityName,
        percentage: item.percentage as number
      }))
    : splitAbilityNames(legacyAbilityDimension).map((abilityName, index, names) => ({
        abilityId: `legacy:${encodeURIComponent(abilityName)}`,
        abilityName,
        percentage: index === names.length - 1 ? 100 - (100 / names.length) * index : 100 / names.length
      }));

  return base.map((item) => ({
    ...item,
    allocatedTimeHours: timeHours === null ? null : Number((timeHours * item.percentage / 100).toFixed(4)),
    allocatedWorkload: workload === null ? null : Number((workload * item.percentage / 100).toFixed(4))
  }));
}

function inferBusinessCategory(input: RecordInput): BusinessCategory {
  if (input.businessCategory && BUSINESS_CATEGORIES.includes(input.businessCategory)) {
    return input.businessCategory;
  }

  return input.category === "三新业务" ? "三新业务" : "其他";
}

function inferWorkType(input: RecordInput): WorkType {
  if (input.workType && WORK_TYPES.includes(input.workType)) {
    return input.workType;
  }

  if (input.category === "工程调试") return "工程调试";
  if (input.category === "售前支持") return "售前方案";
  return "其他项";
}

function inferAbilityDimension(input: RecordInput): AbilityDimension {
  if (input.abilityDimension && ABILITY_DIMENSIONS.includes(input.abilityDimension)) {
    return input.abilityDimension;
  }

  return input.abilityDimension || "";
}

export function createRecord(input: RecordInput): WorkRecord {
  const now = Date.now();
  const quantity = normalizeNumber(input.quantity);
  const coefficient = normalizeNumber(input.coefficient);
  const workload = normalizeWorkload(quantity, coefficient, input.workload);
  const timeHours = normalizeNumber(input.timeHours);
  const coefficientStandardId = normalizeNullableText(input.coefficientStandardId);

  return {
    id: createId(),
    date: input.date,
    title: input.title.trim() || "无标题",
    content: input.content.trim(),
    category: input.category,
    businessCategory: inferBusinessCategory(input),
    workType: inferWorkType(input),
    abilityDimension: inferAbilityDimension(input),
    projectId: input.projectRelation === "project" ? normalizeNullableText(input.projectId) : null,
    projectRelation: input.projectRelation,
    projectName: "",
    productSystem: String(input.productSystem || "").trim(),
    subtask: String(input.subtask || "").trim(),
    quantity,
    coefficient,
    workload,
    timeHours,
    tags: normalizeTags(input.tags),
    workloadUnit: String(input.workloadUnit || "").trim(),
    coefficientSource: coefficientStandardId ? "standard_exact" : coefficient === null ? "none" : "manual",
    coefficientStandardId,
    coefficientStandardVersionId: null,
    workloadFormulaVersion: "quantity_x_coefficient_v1",
    abilityAllocations: normalizeAbilityAllocations(input.abilityAllocations, inferAbilityDimension(input), timeHours, workload),
    createTime: now,
    updateTime: now
  };
}

export function sanitizeRecord(record: Partial<WorkRecord>): WorkRecord | null {
  if (!record.id || !record.date) return null;

  const category = CATEGORIES.includes(record.category as Category)
    ? (record.category as Category)
    : "其他";
  const businessCategory = BUSINESS_CATEGORIES.includes(record.businessCategory as BusinessCategory)
    ? (record.businessCategory as BusinessCategory)
    : category === "三新业务"
      ? "三新业务"
      : "其他";
  const workType = WORK_TYPES.includes(record.workType as WorkType)
    ? (record.workType as WorkType)
    : category === "工程调试"
      ? "工程调试"
      : category === "售前支持"
        ? "售前方案"
        : "其他项";
  const quantity = normalizeNumber(record.quantity);
  const coefficient = normalizeNumber(record.coefficient);
  const workload = normalizeWorkload(quantity, coefficient, record.workload);
  const timeHours = normalizeNumber(record.timeHours);
  const abilityDimension = record.abilityDimension
    ? String(record.abilityDimension)
    : "";
  const storedProjectId = normalizeNullableText(record.projectId);
  const storedProjectRelation = record.projectRelation;
  const projectRelation = storedProjectRelation === "non_project"
    ? "non_project"
    : storedProjectRelation === "project" && storedProjectId
      ? "project"
      : "unassigned";

  return {
    id: String(record.id),
    date: String(record.date),
    title: String(record.title || "无标题"),
    content: String(record.content || ""),
    category,
    businessCategory,
    workType,
    abilityDimension,
    projectId: projectRelation === "project" ? storedProjectId : null,
    projectRelation,
    projectName: String(record.projectName || ""),
    productSystem: String(record.productSystem || ""),
    subtask: String(record.subtask || ""),
    quantity,
    coefficient,
    workload,
    timeHours,
    tags: normalizeTags(String(record.tags || "")),
    workloadUnit: String(record.workloadUnit || "").trim(),
    coefficientSource: normalizeCoefficientSource(record.coefficientSource, coefficient),
    coefficientStandardId: normalizeNullableText(record.coefficientStandardId),
    coefficientStandardVersionId: normalizeNullableText(record.coefficientStandardVersionId),
    workloadFormulaVersion: "quantity_x_coefficient_v1",
    abilityAllocations: normalizeAbilityAllocations(record.abilityAllocations, abilityDimension, timeHours, workload),
    createTime: Number(record.createTime || Date.now()),
    updateTime: Number(record.updateTime || record.createTime || Date.now())
  };
}

export function sortRecordsDesc(records: WorkRecord[]): WorkRecord[] {
  return records
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createTime - a.createTime);
}

export function sortRecordsAsc(records: WorkRecord[]): WorkRecord[] {
  return records
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.createTime - b.createTime);
}

export function filterByDate(records: WorkRecord[], dateKey: string): WorkRecord[] {
  return sortRecordsDesc(records.filter((record) => record.date === dateKey));
}

export function filterByRange(records: WorkRecord[], start: string, end: string): WorkRecord[] {
  return sortRecordsAsc(records.filter((record) => inRange(record.date, start, end)));
}

export function countUniqueTags(records: WorkRecord[]): number {
  return getAllTags(records).length;
}

export function getAllTags(records: WorkRecord[]): string[] {
  const tags = new Set<string>();
  records.forEach((record) => splitTags(record.tags).forEach((tag) => tags.add(tag)));
  return Array.from(tags).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function countActiveDays(records: WorkRecord[]): number {
  return new Set(records.map((record) => record.date)).size;
}

export function countActiveMonths(records: WorkRecord[]): number {
  return new Set(records.map((record) => record.date.slice(0, 7))).size;
}

export function groupByDate(records: WorkRecord[], direction: "asc" | "desc" = "asc") {
  const sorted = direction === "asc" ? sortRecordsAsc(records) : sortRecordsDesc(records);
  const groups = new Map<string, WorkRecord[]>();

  sorted.forEach((record) => {
    groups.set(record.date, [...(groups.get(record.date) ?? []), record]);
  });

  return Array.from(groups.entries()).map(([key, items]) => ({ key, records: items }));
}

export function groupByMonth(records: WorkRecord[]) {
  const groups = new Map<string, WorkRecord[]>();

  sortRecordsAsc(records).forEach((record) => {
    const key = record.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });

  return Array.from(groups.entries()).map(([key, items]) => ({ key, records: items }));
}
