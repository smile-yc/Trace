import type { ProjectRelation, RecordInput, WorkRecord } from "../types";

export type RecordCopyTemplate = Omit<RecordInput, "projectRelation" | "coefficientStandardId"> & {
  projectRelation: ProjectRelation;
};

export function buildRecordCopyTemplate(record: WorkRecord, targetDate: string): RecordCopyTemplate {
  return {
    date: targetDate,
    title: record.title,
    content: record.content,
    category: record.category,
    businessCategory: record.businessCategory,
    workType: record.workType,
    abilityDimension: record.abilityDimension,
    abilityAllocations: record.abilityAllocations.map(({ abilityId, abilityName, percentage }) => ({
      abilityId,
      abilityName,
      percentage
    })),
    projectId: record.projectId,
    projectRelation: record.projectRelation,
    productSystem: record.productSystem,
    subtask: record.subtask,
    quantity: record.quantity,
    coefficient: record.coefficient,
    workload: record.workload,
    workloadUnit: record.workloadUnit,
    timeHours: record.timeHours,
    tags: record.tags
  };
}

export function getInitialOptionFieldValue(recordValue: string | null | undefined): string {
  return recordValue ?? "";
}

export function getPostSubmitCoefficientValue({
  coefficientTouched,
  matchedCoefficient
}: {
  coefficientTouched: boolean;
  matchedCoefficient: number | null | undefined;
}): number | null {
  if (matchedCoefficient === null || matchedCoefficient === undefined) return null;

  const coefficient = Number(matchedCoefficient);
  if (coefficientTouched || !Number.isFinite(coefficient) || coefficient < 0) return null;
  return coefficient;
}
