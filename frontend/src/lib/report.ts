import type { ReportBundle, TagGroup, WorkRecord } from "../types";
import { formatDate } from "./date";
import { splitTags, sortRecordsAsc } from "./records";

export function buildTagGroups(records: WorkRecord[]): TagGroup[] {
  const groups = new Map<string, WorkRecord[]>();

  sortRecordsAsc(records).forEach((record) => {
    const tags = splitTags(record.tags);
    const safeTags = tags.length ? tags : ["未分类"];

    safeTags.forEach((tag) => {
      groups.set(tag, [...(groups.get(tag) ?? []), record]);
    });
  });

  return Array.from(groups.entries()).map(([tag, items]) => ({ tag, records: items }));
}

function appendIndentedContent(lines: string[], content: string): void {
  content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .forEach((line) => {
      lines.push(`    ${line}`);
    });
}

function buildRecordMeta(record: WorkRecord): string {
  const items = [
    `日期：${formatDate(record.date)}`,
    `业务：${record.businessCategory || record.category}`,
    `工作类型：${record.workType || "其他项"}`,
    record.abilityDimension ? `能力：${record.abilityDimension}` : "",
    record.projectName ? `项目：${record.projectName}` : "",
    record.productSystem ? `产品：${record.productSystem}` : "",
    record.subtask ? `工作细项：${record.subtask}` : "",
    record.workload !== null && record.workload !== undefined ? `当量：${record.workload}` : "",
    record.timeHours !== null && record.timeHours !== undefined ? `时间：${record.timeHours}h` : ""
  ].filter(Boolean);

  return items.join(" | ");
}

export function generateTagReport(records: WorkRecord[], title: string): ReportBundle {
  const tagGroups = buildTagGroups(records);
  const lines = [
    title,
    `共 ${records.length} 条记录，${tagGroups.length} 个标签`,
    "----------------------------------------",
    ""
  ];

  tagGroups.forEach((group) => {
    lines.push(`#${group.tag} (${group.records.length} 条)`);
    group.records.forEach((record, index) => {
      lines.push(`${index + 1}. ${record.title}`);
      if (record.content) appendIndentedContent(lines, record.content);
      lines.push(`    ${buildRecordMeta(record)}`);
      lines.push("");
    });
  });

  return {
    title,
    records: sortRecordsAsc(records),
    tagGroups,
    content: lines.join("\n")
  };
}
