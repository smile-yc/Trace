export type Category = "三新业务" | "技术支持" | "工程调试" | "售前支持" | "其他";

export type BusinessCategory = string;

export type WorkType = string;

export type AbilityDimension = string;

export type ViewMode = "daily" | "weekly" | "monthly" | "yearly" | "all" | "settings";

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

export interface WorkRecord {
  id: string;
  date: string;
  title: string;
  content: string;
  category: Category;
  businessCategory: BusinessCategory;
  workType: WorkType;
  abilityDimension: AbilityDimension;
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

export interface RecordInput {
  date: string;
  title: string;
  content: string;
  category: Category;
  businessCategory?: BusinessCategory;
  workType?: WorkType;
  abilityDimension?: AbilityDimension;
  projectName?: string;
  productSystem?: string;
  subtask?: string;
  quantity?: number | null;
  coefficient?: number | null;
  workload?: number | null;
  timeHours?: number | null;
  tags: string;
}

export interface StatItem {
  label: string;
  value: number | string;
}

export interface TagGroup {
  tag: string;
  records: WorkRecord[];
}

export interface ReportBundle {
  title: string;
  records: WorkRecord[];
  tagGroups: TagGroup[];
  content: string;
}

export type ExportFormat = "docx" | "pdf" | "xlsx";

export interface ExportScope {
  type: "period" | "project" | "businessCategory" | "all" | "custom";
  periodType?: "week" | "month" | "year";
  label?: string;
  startDate?: string;
  endDate?: string;
  filterValue?: string;
}

export interface ExportOptions {
  scope?: ExportScope;
}
