import type { CoefficientSource } from "../types/domain/workload";
import type { Outcome, OutcomeStatus, Project, ProjectRelation, WorkRecord } from "../types";

export type LedgerPeriodMode = "week" | "month" | "year" | "custom";
export type LedgerOutcomeStatusFilter = "" | "none" | OutcomeStatus;
export type LedgerQualityCode =
  | "missing_project"
  | "missing_ability"
  | "missing_time"
  | "missing_coefficient"
  | "missing_content";

export interface LedgerFilters {
  periodMode: LedgerPeriodMode;
  period: string;
  startDate: string;
  endDate: string;
  query: string;
  projectId: string;
  projectRelation: "" | ProjectRelation;
  businessCategory: string;
  workType: string;
  productSystem: string;
  subtask: string;
  ability: string;
  coefficientSource: "" | CoefficientSource;
  outcomeStatus: LedgerOutcomeStatusFilter;
  tag: string;
  qualityCode: "" | LedgerQualityCode;
}

export interface LedgerSummary {
  recordCount: number;
  timeHours: number;
  workload: number;
  projectCount: number;
  outcomeCount: number;
}

export interface LedgerQualitySummary {
  byRecordId: Record<string, LedgerQualityCode[]>;
  counts: Record<LedgerQualityCode, number>;
  issueRecordCount: number;
  manualCoefficientCount: number;
  manualCoefficientPercent: number;
  duplicateCategories: Record<"businessCategory" | "workType" | "productSystem" | "subtask", string[][]>;
  duplicateProjects: string[][];
}

const QUALITY_CODES: LedgerQualityCode[] = [
  "missing_project",
  "missing_ability",
  "missing_time",
  "missing_coefficient",
  "missing_content"
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getWeekRange(dateKey: string): { start: string; end: string } {
  const date = parseDateKey(dateKey);
  const day = date.getDay() || 7;
  const start = new Date(date);
  start.setDate(date.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function getArchiveRange(mode: Exclude<LedgerPeriodMode, "custom">, period: string): { start: string; end: string } | null {
  if (mode === "week") {
    const match = /^(\d{4})-W(\d{2})$/.exec(period);
    if (!match) return null;
    const year = Number(match[1]);
    const week = Number(match[2]);
    const januaryFourth = new Date(year, 0, 4);
    const day = januaryFourth.getDay() || 7;
    const start = new Date(januaryFourth);
    start.setDate(januaryFourth.getDate() - day + 1 + (week - 1) * 7);
    return getWeekRange(toDateKey(start));
  }
  if (mode === "month") {
    const [year, month] = period.split("-").map(Number);
    if (!year || !month) return null;
    return { start: `${year}-${pad(month)}-01`, end: toDateKey(new Date(year, month, 0)) };
  }
  return /^\d{4}$/.test(period) ? { start: `${period}-01-01`, end: `${period}-12-31` } : null;
}

function getIsoWeekKey(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${thursday.getFullYear()}-W${pad(week)}`;
}

function getLedgerRange(filters: LedgerFilters, today: string): { start: string; end: string } | null | false {
  if (filters.periodMode === "custom") {
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) return false;
    return {
      start: filters.startDate || "0000-01-01",
      end: filters.endDate || "9999-12-31"
    };
  }

  const period = filters.period || (filters.periodMode === "week"
    ? getIsoWeekKey(today)
    : filters.periodMode === "month"
      ? today.slice(0, 7)
      : today.slice(0, 4));
  return getArchiveRange(filters.periodMode, period);
}

function splitValues(value: string): string[] {
  return value.split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean);
}

function recordQualityCodes(record: WorkRecord): LedgerQualityCode[] {
  const result: LedgerQualityCode[] = [];
  if (record.projectRelation === "unassigned") result.push("missing_project");
  if (!record.abilityAllocations.length && !record.abilityDimension.trim()) result.push("missing_ability");
  if (record.timeHours === null || record.timeHours === undefined) result.push("missing_time");
  if (record.coefficientSource === "none") result.push("missing_coefficient");
  if (!record.content.trim()) result.push("missing_content");
  return result;
}

function linkedOutcomes(recordId: string, outcomes: Outcome[]): Outcome[] {
  return outcomes.filter((item) => !item.archived && item.recordIds.includes(recordId));
}

export function filterLedgerRecords(
  records: WorkRecord[],
  outcomes: Outcome[],
  filters: LedgerFilters,
  today: string
): WorkRecord[] {
  const range = getLedgerRange(filters, today);
  if (range === false || range === null) return [];
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");

  return records.filter((record) => {
    if (record.date < range.start || record.date > range.end) return false;
    if (query) {
      const haystack = [record.title, record.content, record.projectName, record.businessCategory, record.workType, record.productSystem, record.subtask, record.tags]
        .join(" ")
        .toLocaleLowerCase("zh-CN");
      if (!haystack.includes(query)) return false;
    }
    if (filters.projectId && record.projectId !== filters.projectId) return false;
    if (filters.projectRelation && record.projectRelation !== filters.projectRelation) return false;
    if (filters.businessCategory && record.businessCategory !== filters.businessCategory) return false;
    if (filters.workType && record.workType !== filters.workType) return false;
    if (filters.productSystem && record.productSystem !== filters.productSystem) return false;
    if (filters.subtask && record.subtask !== filters.subtask) return false;
    if (filters.ability) {
      const abilities = record.abilityAllocations.length
        ? record.abilityAllocations.map((item) => item.abilityName)
        : splitValues(record.abilityDimension);
      if (!abilities.includes(filters.ability)) return false;
    }
    if (filters.coefficientSource && record.coefficientSource !== filters.coefficientSource) return false;
    if (filters.tag && !splitValues(record.tags).includes(filters.tag)) return false;
    const outcomesForRecord = linkedOutcomes(record.id, outcomes);
    if (filters.outcomeStatus === "none" && outcomesForRecord.length > 0) return false;
    if (filters.outcomeStatus && filters.outcomeStatus !== "none" && !outcomesForRecord.some((item) => item.status === filters.outcomeStatus)) return false;
    if (filters.qualityCode && !recordQualityCodes(record).includes(filters.qualityCode)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createTime - a.createTime);
}

export function summarizeLedger(records: WorkRecord[], outcomes: Outcome[]): LedgerSummary {
  const recordIds = new Set(records.map((record) => record.id));
  return {
    recordCount: records.length,
    timeHours: records.reduce((sum, record) => sum + (record.timeHours ?? 0), 0),
    workload: records.reduce((sum, record) => sum + (record.workload ?? 0), 0),
    projectCount: new Set(records.map((record) => record.projectId).filter((id): id is string => Boolean(id))).size,
    outcomeCount: new Set(outcomes.filter((item) => !item.archived && item.recordIds.some((id) => recordIds.has(id))).map((item) => item.id)).size
  };
}

function normalizeDuplicateCandidate(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN").replace(/[\s\p{P}\p{S}_]+/gu, "");
}

export function findNormalizedDuplicateGroups(values: string[]): string[][] {
  const groups = new Map<string, Set<string>>();
  values.map((value) => value.trim()).filter(Boolean).forEach((value) => {
    const key = normalizeDuplicateCandidate(value);
    if (!key) return;
    const group = groups.get(key) ?? new Set<string>();
    group.add(value);
    groups.set(key, group);
  });

  return Array.from(groups.values())
    .filter((group) => group.size > 1)
    .map((group) => Array.from(group).sort((a, b) => a.localeCompare(b, "zh-CN")))
    .sort((a, b) => a[0].localeCompare(b[0], "zh-CN"));
}

export function analyzeLedgerQuality(records: WorkRecord[], projects: Project[]): LedgerQualitySummary {
  const byRecordId: Record<string, LedgerQualityCode[]> = {};
  const counts = Object.fromEntries(QUALITY_CODES.map((code) => [code, 0])) as Record<LedgerQualityCode, number>;

  records.forEach((record) => {
    const codes = recordQualityCodes(record);
    byRecordId[record.id] = codes;
    codes.forEach((code) => { counts[code] += 1; });
  });

  const manualCoefficientCount = records.filter((record) => record.coefficientSource === "manual").length;
  const percent = records.length ? (manualCoefficientCount / records.length) * 100 : 0;
  const duplicateCategories = {
    businessCategory: findNormalizedDuplicateGroups(records.map((record) => record.businessCategory)),
    workType: findNormalizedDuplicateGroups(records.map((record) => record.workType)),
    productSystem: findNormalizedDuplicateGroups(records.map((record) => record.productSystem)),
    subtask: findNormalizedDuplicateGroups(records.map((record) => record.subtask))
  };

  return {
    byRecordId,
    counts,
    issueRecordCount: Object.values(byRecordId).filter((codes) => codes.length > 0).length,
    manualCoefficientCount,
    manualCoefficientPercent: Math.round(percent * 10) / 10,
    duplicateCategories,
    duplicateProjects: findNormalizedDuplicateGroups(projects.filter((item) => item.mergedIntoProjectId === null).map((item) => item.name))
  };
}
