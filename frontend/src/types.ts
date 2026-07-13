export type Category = "三新业务" | "技术支持" | "工程调试" | "售前支持" | "其他";

export type BusinessCategory = string;

export type WorkType = string;

export type AbilityDimension = string;

export type ViewMode = "daily" | "weekly" | "monthly" | "yearly" | "growth" | "knowledge" | "all" | "settings";

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
  versionId: string;
  businessCategory: string;
  workType: string;
  productSystem: string;
  subtask: string;
  unit: string;
  coefficient: number;
  remark: string;
  enabled: boolean;
  createTime: number;
  updateTime: number;
}

export type WorkloadStandardVersionStatus = "draft" | "active" | "retired";

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

export interface WorkloadStandardMatch {
  standard: WorkloadStandard;
  version: WorkloadStandardVersion;
  matchLevel: "exact" | "general";
}

export interface WorkloadStandardInput {
  versionId?: string;
  businessCategory: string;
  workType: string;
  productSystem?: string;
  subtask?: string;
  unit?: string;
  coefficient: number;
  remark?: string;
  enabled?: boolean;
}

export interface WorkloadStandardUpdateInput {
  businessCategory?: string;
  workType?: string;
  productSystem?: string;
  subtask?: string;
  unit?: string;
  coefficient?: number;
  remark?: string;
  enabled?: boolean;
}

export interface FocusScoreWeights {
  workload: number;
  timeHours: number;
  recordCount: number;
}

export interface WarningRules {
  abilityNoRecordDays: number;
  targetShareDeviationPercent: number;
}

export interface AppSettings {
  focusScoreWeights: FocusScoreWeights;
  warningRules: WarningRules;
  abilityTargets: Record<string, number>;
}

export interface AppSettingsInput {
  focusScoreWeights?: Partial<FocusScoreWeights>;
  warningRules?: Partial<WarningRules>;
  abilityTargets?: Record<string, number>;
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  category: string;
  targetType: string;
  targetValue: number;
  currentValue: number;
  deadline: string;
  enabled: boolean;
  sortOrder: number;
  createTime: number;
  updateTime: number;
}

export interface MilestoneInput {
  name: string;
  description?: string;
  category?: string;
  targetType?: string;
  targetValue?: number;
  currentValue?: number;
  deadline?: string;
  enabled?: boolean;
  sortOrder?: number;
}

export interface MilestoneUpdateInput {
  name?: string;
  description?: string;
  category?: string;
  targetType?: string;
  targetValue?: number;
  currentValue?: number;
  deadline?: string;
  enabled?: boolean;
  sortOrder?: number;
}

export type KnowledgeAssetStatus = "draft" | "published" | "archived";

export interface KnowledgeAsset {
  id: string;
  type: string;
  title: string;
  summary: string;
  sourceRecordId: string;
  projectName: string;
  productSystem: string;
  tags: string;
  status: KnowledgeAssetStatus;
  link: string;
  remark: string;
  createTime: number;
  updateTime: number;
}

export interface KnowledgeAssetInput {
  type?: string;
  title: string;
  summary?: string;
  sourceRecordId?: string;
  projectName?: string;
  productSystem?: string;
  tags?: string;
  status?: KnowledgeAssetStatus;
  link?: string;
  remark?: string;
}

export interface KnowledgeAssetUpdateInput {
  type?: string;
  title?: string;
  summary?: string;
  sourceRecordId?: string;
  projectName?: string;
  productSystem?: string;
  tags?: string;
  status?: KnowledgeAssetStatus;
  link?: string;
  remark?: string;
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
  workloadUnit?: string;
  coefficientSource?: import("./types/domain/workload").CoefficientSource;
  coefficientStandardId?: string | null;
  coefficientStandardVersionId?: string | null;
  workloadFormulaVersion?: "quantity_x_coefficient_v1";
  abilityAllocations?: import("./types/domain/workload").AbilityAllocation[];
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
  workloadUnit?: string;
  coefficientStandardId?: string | null;
  abilityAllocations?: Array<{
    abilityId: string;
    abilityName: string;
    percentage: number;
  }>;
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
