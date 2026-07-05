import type { TagGroup, WorkRecord } from "./types.js";

export function splitTags(tags: string): string[] {
  return Array.from(
    new Set(
      tags
        .split(/[,，、\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

export function groupByTag(records: WorkRecord[]): TagGroup[] {
  const groups = new Map<string, WorkRecord[]>();

  records.forEach((record) => {
    const tags = splitTags(record.tags || "");
    const safeTags = tags.length ? tags : ["未分类"];

    safeTags.forEach((tag) => {
      const items = groups.get(tag) ?? [];
      items.push(record);
      groups.set(tag, items);
    });
  });

  return Array.from(groups.entries()).map(([tag, items]) => ({
    tag,
    records: items.sort((a, b) => a.date.localeCompare(b.date) || a.createTime - b.createTime)
  }));
}

export function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function sanitizeFileName(name: string): string {
  const trimmed = name.trim() || "工作报告";
  return trimmed.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

function buildRecordMeta(record: WorkRecord): string {
  const items = [
    `日期：${formatDate(record.date)}`,
    `业务：${record.businessCategory || record.category || "其他"}`,
    `工作类型：${record.workType || "其他项"}`,
    record.projectName ? `项目：${record.projectName}` : "",
    record.productSystem ? `产品：${record.productSystem}` : "",
    record.subtask ? `子任务：${record.subtask}` : "",
    record.workload !== null && record.workload !== undefined ? `当量：${record.workload}` : ""
  ].filter(Boolean);

  return items.join(" | ");
}

export function buildPlainReport(title: string, records: WorkRecord[]): string {
  const groups = groupByTag(records);
  const lines = [
    title,
    `共 ${records.length} 条记录，${groups.length} 个标签`,
    "----------------------------------------",
    ""
  ];

  groups.forEach((group) => {
    lines.push(`#${group.tag} (${group.records.length} 条)`);
    group.records.forEach((record, index) => {
      lines.push(`${index + 1}. ${record.title}`);
      if (record.content) lines.push(`   ${record.content}`);
      lines.push(`   ${buildRecordMeta(record)}`);
      lines.push("");
    });
  });

  return lines.join("\n");
}
