import type { Outcome, OutcomeAbility, OutcomeInput, WorkRecord } from "../types";

export const outcomeTypeLabels = {
  deliverable: "正式交付成果",
  problem_resolution: "重要问题解决",
  stage_progress: "阶段性进展",
  reusable_asset: "可复用资产"
} as const;

export const outcomeStatusLabels = {
  planned: "计划中",
  in_progress: "推进中",
  stage_result: "阶段成果",
  completed: "已完成"
} as const;

export function getOutcomeDate(outcome: Outcome): string {
  return outcome.completedDate || outcome.updateDate || outcome.startDate || new Date(outcome.createTime).toISOString().slice(0, 10);
}

export function filterOutcomesByRange(outcomes: Outcome[], startDate: string, endDate: string): Outcome[] {
  return outcomes.filter((outcome) => {
    const date = getOutcomeDate(outcome);
    return date && date >= startDate && date <= endDate;
  });
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function prefillOutcomeFromRecords(records: WorkRecord[]): Partial<OutcomeInput> {
  const sorted = records.slice().sort((left, right) => left.date.localeCompare(right.date));
  const projectIds = unique(sorted.map((record) => record.projectId || ""));
  const products = unique(sorted.map((record) => record.productSystem));
  const abilities = new Map<string, OutcomeAbility>();
  sorted.forEach((record) => record.abilityAllocations.forEach((ability) => {
    abilities.set(ability.abilityId, { abilityId: ability.abilityId, abilityName: ability.abilityName });
  }));
  const tags = unique(sorted.flatMap((record) => record.tags.split(/[,，、]/).map((tag) => tag.trim())));
  return {
    title: sorted.length === 1 ? sorted[0].title : "",
    projectId: projectIds.length === 1 ? projectIds[0] : null,
    productSystem: products.length === 1 ? products[0] : "",
    startDate: sorted[0]?.date ?? "",
    updateDate: sorted.at(-1)?.date ?? "",
    completedWork: sorted.map((record) => record.content || record.title).filter(Boolean).join("\n"),
    recordIds: sorted.map((record) => record.id),
    abilities: Array.from(abilities.values()),
    tags: tags.join(",")
  };
}
