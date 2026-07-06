export interface WorkRecord {
  id: string;
  date: string;
  title: string;
  content: string;
  category: string;
  businessCategory: string;
  workType: string;
  abilityDimension: string;
  projectName: string;
  productSystem: string;
  subtask: string;
  quantity: number | null;
  coefficient: number | null;
  workload: number | null;
  timeHours: number | null;
  tags: string;
  createTime: number;
  updateTime: number;
}

export type ConfigOptionType = "businessCategory" | "workType" | "abilityDimension" | "productSystem" | "subtask";

export interface ConfigOption {
  id: string;
  type: ConfigOptionType;
  label: string;
  enabled: boolean;
  sortOrder: number;
  isDefault: boolean;
  isSystem: boolean;
  createTime: number;
  updateTime: number;
}

export interface ConfigOptionInput {
  type: ConfigOptionType;
  label: string;
  enabled?: boolean;
  sortOrder?: number;
  isDefault?: boolean;
}

export interface ConfigOptionUpdateInput {
  label?: string;
  enabled?: boolean;
  sortOrder?: number;
  isDefault?: boolean;
}

export interface WorkloadStandard {
  id: string;
  businessCategory: string;
  workType: string;
  productSystem: string;
  subtask: string;
  coefficient: number;
  remark: string;
  enabled: boolean;
  createTime: number;
  updateTime: number;
}

export interface WorkloadStandardInput {
  businessCategory: string;
  workType: string;
  productSystem?: string;
  subtask?: string;
  coefficient: number;
  remark?: string;
  enabled?: boolean;
}

export interface WorkloadStandardUpdateInput {
  businessCategory?: string;
  workType?: string;
  productSystem?: string;
  subtask?: string;
  coefficient?: number;
  remark?: string;
  enabled?: boolean;
}

export interface RecordInput {
  date: string;
  title: string;
  content: string;
  category: string;
  businessCategory?: string;
  workType?: string;
  abilityDimension?: string;
  projectName?: string;
  productSystem?: string;
  subtask?: string;
  quantity?: number | null;
  coefficient?: number | null;
  workload?: number | null;
  timeHours?: number | null;
  tags: string;
}

export interface ExportPayload {
  title: string;
  records: WorkRecord[];
  scope?: ExportScope;
  configOptions?: ConfigOption[];
  workloadStandards?: WorkloadStandard[];
}

export interface ExportScope {
  type: "period" | "project" | "businessCategory" | "all" | "custom";
  periodType?: "week" | "month" | "year";
  label?: string;
  startDate?: string;
  endDate?: string;
  filterValue?: string;
}

export interface TagGroup {
  tag: string;
  records: WorkRecord[];
}
