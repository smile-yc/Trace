export type CoefficientSource = "none" | "legacy" | "manual" | "standard_exact" | "standard_general";
export type WorkloadStandardVersionStatus = "draft" | "active" | "retired";

export interface AbilityAllocation {
  abilityId: string;
  abilityName: string;
  percentage: number;
  allocatedTimeHours: number | null;
  allocatedWorkload: number | null;
}

export interface WorkloadStandardVersion {
  id: string;
  name: string;
  year: number | null;
  status: WorkloadStandardVersionStatus;
  sourceType: "legacy" | "manual" | "excel";
  sourceName: string;
  createTime: number;
  updateTime: number;
}
