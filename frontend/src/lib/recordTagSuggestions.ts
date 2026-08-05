import type { WorkRecord } from "../types";

export interface RecordTagSuggestion {
  label: string;
  projectSpecific: boolean;
  count: number;
  latestTime: number;
}

const tagSplitPattern = /[,，、\s]+/;

function normalizeTagKey(tag: string): string {
  return tag.trim().toLocaleLowerCase("zh-CN");
}

export function parseRecordTags(tags: string): string[] {
  const seen = new Set<string>();
  return tags
    .split(tagSplitPattern)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => {
      const key = normalizeTagKey(tag);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function recordTime(record: WorkRecord): number {
  if (Number.isFinite(record.updateTime) && record.updateTime > 0) return record.updateTime;
  if (Number.isFinite(record.createTime) && record.createTime > 0) return record.createTime;
  const parsed = Date.parse(record.date);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getRecordTagSuggestions(
  records: WorkRecord[],
  selectedProjectId: string | null | undefined,
  currentTags = "",
  limit = 12
): RecordTagSuggestion[] {
  const selectedKeys = new Set(parseRecordTags(currentTags).map(normalizeTagKey));
  const stats = new Map<string, RecordTagSuggestion>();

  records.forEach((record) => {
    const isProjectMatch = Boolean(selectedProjectId && record.projectId === selectedProjectId);
    parseRecordTags(record.tags).forEach((tag) => {
      const key = normalizeTagKey(tag);
      if (!key || selectedKeys.has(key)) return;

      const existing = stats.get(key);
      const latestTime = recordTime(record);
      if (!existing) {
        stats.set(key, { label: tag, projectSpecific: isProjectMatch, count: 1, latestTime });
        return;
      }

      existing.count += 1;
      existing.projectSpecific = existing.projectSpecific || isProjectMatch;
      existing.latestTime = Math.max(existing.latestTime, latestTime);
    });
  });

  return Array.from(stats.values())
    .sort((a, b) =>
      Number(b.projectSpecific) - Number(a.projectSpecific)
      || b.count - a.count
      || b.latestTime - a.latestTime
      || a.label.localeCompare(b.label, "zh-CN")
    )
    .slice(0, limit);
}

export function appendRecordTag(currentTags: string, tag: string): string {
  const existing = parseRecordTags(currentTags);
  const existingKeys = new Set(existing.map(normalizeTagKey));
  const nextTag = tag.trim();

  if (!nextTag || existingKeys.has(normalizeTagKey(nextTag))) return existing.join(",");
  return [...existing, nextTag].join(",");
}
