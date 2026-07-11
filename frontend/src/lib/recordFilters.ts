import type { WorkRecord } from "../types";

export type ArchiveMode = "week" | "month" | "year" | null;

const pad = (value: number) => String(value).padStart(2, "0");
const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDateKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const inRange = (date: string, start: string, end: string) => date >= start && date <= end;
function getWeekRange(dateKey: string): { start: string; end: string } {
  const date = parseDateKey(dateKey);
  const day = date.getDay() || 7;
  const start = new Date(date);
  start.setDate(date.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function sortRecordsDesc(records: WorkRecord[]): WorkRecord[] {
  return records.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createTime - a.createTime);
}

function hasTag(record: WorkRecord, tag: string): boolean {
  return record.tags.split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean).includes(tag);
}

interface KnowledgeRecordFilter {
  startDate: string;
  endDate: string;
  defaultLimit: number;
}

interface ArchiveRecordFilter {
  mode: ArchiveMode;
  period: string;
  selectedTag: string | null;
  today: string;
}

export function filterKnowledgeRecordOptions(records: WorkRecord[], filter: KnowledgeRecordFilter): WorkRecord[] {
  const { startDate, endDate, defaultLimit } = filter;
  if (startDate && endDate && startDate > endDate) return [];
  const sorted = sortRecordsDesc(records.filter((record) =>
    (!startDate || record.date >= startDate) && (!endDate || record.date <= endDate)
  ));
  return startDate || endDate ? sorted : sorted.slice(0, defaultLimit);
}

function getIsoWeekRange(weekKey: string): { start: string; end: string } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const januaryFourth = new Date(year, 0, 4);
  const day = januaryFourth.getDay() || 7;
  const start = new Date(januaryFourth);
  start.setDate(januaryFourth.getDate() - day + 1 + (week - 1) * 7);
  return getWeekRange(toDateKey(start));
}

export function getArchiveRange(mode: ArchiveMode, period: string): { start: string; end: string } | null {
  if (!mode || !period) return null;
  if (mode === "week") return getIsoWeekRange(period);
  if (mode === "month") {
    const [year, month] = period.split("-").map(Number);
    if (!year || !month) return null;
    return { start: `${year}-${pad(month)}-01`, end: toDateKey(new Date(year, month, 0)) };
  }
  return /^\d{4}$/.test(period) ? { start: `${period}-01-01`, end: `${period}-12-31` } : null;
}

export function filterArchivedRecords(records: WorkRecord[], filter: ArchiveRecordFilter): WorkRecord[] {
  const tagFiltered = filter.selectedTag
    ? records.filter((record) => hasTag(record, filter.selectedTag as string))
    : records;
  const selectedRange = filter.mode ? getArchiveRange(filter.mode, filter.period) : null;
  const range = selectedRange
    ? selectedRange
    : filter.selectedTag
      ? null
      : getWeekRange(filter.today);
  return sortRecordsDesc(range ? tagFiltered.filter((record) => inRange(record.date, range.start, range.end)) : tagFiltered);
}
