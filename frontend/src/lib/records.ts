import type { BusinessCategory, Category, RecordInput, WorkRecord, WorkType } from "../types";
import { BUSINESS_CATEGORIES, CATEGORIES, WORK_TYPES } from "../constants";
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

export function createRecord(input: RecordInput): WorkRecord {
  const now = Date.now();
  const quantity = normalizeNumber(input.quantity);
  const coefficient = normalizeNumber(input.coefficient);

  return {
    id: createId(),
    date: input.date,
    title: input.title.trim() || "无标题",
    content: input.content.trim(),
    category: input.category,
    businessCategory: inferBusinessCategory(input),
    workType: inferWorkType(input),
    projectName: String(input.projectName || "").trim(),
    productSystem: String(input.productSystem || "").trim(),
    subtask: String(input.subtask || "").trim(),
    quantity,
    coefficient,
    workload: normalizeWorkload(quantity, coefficient, input.workload),
    tags: normalizeTags(input.tags),
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

  return {
    id: String(record.id),
    date: String(record.date),
    title: String(record.title || "无标题"),
    content: String(record.content || ""),
    category,
    businessCategory,
    workType,
    projectName: String(record.projectName || ""),
    productSystem: String(record.productSystem || ""),
    subtask: String(record.subtask || ""),
    quantity,
    coefficient,
    workload: normalizeWorkload(quantity, coefficient, record.workload),
    tags: normalizeTags(String(record.tags || "")),
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
