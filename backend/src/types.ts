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
  projectId: string | null;
  projectRelation: ProjectRelation;
  productSystem: string;
  subtask: string;
  quantity: number | null;
  coefficient: number | null;
  workload: number | null;
  timeHours: number | null;
  tags: string;
  workloadUnit: string;
  coefficientSource: CoefficientSource;
  coefficientStandardId: string | null;
  coefficientStandardVersionId: string | null;
  workloadFormulaVersion: "quantity_x_coefficient_v1";
  abilityAllocations: AbilityAllocation[];
  createTime: number;
  updateTime: number;
}

export type ProjectStatus = "planned" | "active" | "paused" | "completed" | "archived";

export type ProjectRelation = "project" | "non_project" | "unassigned";

export interface Project {
  id: string;
  name: string;
  normalizedName: string;
  shortName: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  personalRole: string;
  goal: string;
  description: string;
  completionSummary: string;
  aliases: string[];
  mergedIntoProjectId: string | null;
  archiveTime: number | null;
  createTime: number;
  updateTime: number;
}

export interface ProjectInput {
  name: string;
  shortName?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  personalRole?: string;
  goal?: string;
  description?: string;
  completionSummary?: string;
  aliases?: string[];
}

export type ProjectUpdateInput = Partial<ProjectInput>;

export interface ProjectBreakdownItem {
  label: string;
  recordCount: number;
  timeHours: number;
  workload: number;
}

export interface ProjectSummary {
  recordCount: number;
  activeDays: number;
  timeHours: number;
  workload: number;
  lastActiveDate: string;
  currentFocus: string[];
  businessCategories: ProjectBreakdownItem[];
  products: ProjectBreakdownItem[];
  abilities: ProjectBreakdownItem[];
  records: WorkRecord[];
}

export interface ProjectMergePreview {
  sourceProject: Project;
  targetProject: Project;
  recordCount: number;
  timeHours: number;
  workload: number;
}

export type CoefficientSource = "none" | "legacy" | "manual" | "standard_exact" | "standard_general";

export interface AbilityAllocation {
  abilityId: string;
  abilityName: string;
  percentage: number;
  allocatedTimeHours: number | null;
  allocatedWorkload: number | null;
}

export interface AbilityAllocationInput {
  abilityId: string;
  abilityName: string;
  percentage: number;
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

export interface WorkloadStandardVersionInput {
  name: string;
  year?: number | null;
  sourceType?: "manual" | "excel";
  sourceName?: string;
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

export interface RecordInput {
  date: string;
  title: string;
  content: string;
  category: string;
  businessCategory?: string;
  workType?: string;
  abilityDimension?: string;
  projectId: string | null;
  projectRelation: Exclude<ProjectRelation, "unassigned">;
  productSystem?: string;
  subtask?: string;
  quantity?: number | null;
  coefficient?: number | null;
  workload?: number | null;
  workloadUnit?: string;
  coefficientStandardId?: string | null;
  abilityAllocations?: AbilityAllocationInput[];
  timeHours?: number | null;
  tags: string;
}

export interface ExportPayload {
  title: string;
  records: WorkRecord[];
  scope?: ExportScope;
  configOptions?: ConfigOption[];
  workloadStandards?: WorkloadStandard[];
  appSettings?: AppSettings;
  milestones?: Milestone[];
  knowledgeAssets?: KnowledgeAsset[];
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
