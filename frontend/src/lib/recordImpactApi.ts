import { API_BASE } from "../constants";
import type { OutcomeStatus, OutcomeType } from "../types";

export interface RecordDeleteImpact {
  recordId: string;
  title: string;
  project: { id: string; name: string } | null;
  outcomes: Array<{ id: string; title: string; type: OutcomeType; status: OutcomeStatus }>;
}

export async function fetchRecordDeleteImpact(id: string): Promise<RecordDeleteImpact> {
  const response = await fetch(`${API_BASE}/api/records/${encodeURIComponent(id)}/impact`);
  const data = await response.json().catch(() => ({})) as { impact?: RecordDeleteImpact; message?: string };
  if (!response.ok || !data.impact) throw new Error(data.message || "无法读取记录关联影响");
  return data.impact;
}

export function formatRecordDeleteImpact(impact: RecordDeleteImpact): string {
  const lines = [`确认删除「${impact.title}」吗？`];
  if (impact.project) lines.push(`删除后将影响项目「${impact.project.name}」的投入和报告统计。`);
  if (impact.outcomes.length) lines.push(`删除后将影响 ${impact.outcomes.length} 项成果：${impact.outcomes.map((item) => item.title).join("、")}。`);
  lines.push("此操作无法撤销。");
  return lines.join("\n");
}
