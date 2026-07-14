import cors from "cors";
import express from "express";
import { z } from "zod";
import {
  archiveOutcome,
  archiveProject,
  clearRecords,
  deleteConfigOption,
  deleteRecord,
  deleteWorkloadStandard,
  getAppSettings,
  getMilestoneProgress,
  getDatabasePath,
  getOutcome,
  getProject,
  getRecordDeleteImpact,
  getReportReview,
  getProjectMergePreview,
  getProjectSummary,
  insertKnowledgeAsset,
  insertGrowthGoal,
  insertOutcome,
  insertWorkloadStandardVersion,
  activateWorkloadStandardVersion,
  insertRecord,
  insertConfigOption,
  insertMilestone,
  insertProject,
  insertWorkloadStandard,
  listConfigOptions,
  listKnowledgeAssets,
  listGrowthGoals,
  listOutcomes,
  listMilestoneCorrections,
  listMilestonesWithProgress,
  listProjects,
  listRecords,
  listReportReviews,
  listWorkloadStandards,
  listWorkloadStandardVersions,
  matchWorkloadStandard,
  mergeProjects,
  reactivateProject,
  reactivateOutcome,
  reorderConfigOptions,
  summarizeOutcomes,
  correctMilestone,
  resetMilestoneCorrection,
  toggleMilestoneStage,
  updateAppSettings,
  updateConfigOption,
  updateKnowledgeAsset,
  updateGrowthGoal,
  updateOutcome,
  updateMilestone,
  updateProject,
  updateWorkloadStandard,
  updateRecord,
  upsertReportReview
} from "./database.js";
import { buildExcel } from "./exporters/excel.js";
import { buildPdf } from "./exporters/pdf.js";
import { buildWord } from "./exporters/word.js";
import { createBackupPackage, previewRestorePackage, restoreBackupPackage } from "./core/backup.js";
import { createYearArchive, previewYearArchive } from "./core/yearArchive.js";
import { sanitizeFileName } from "./report.js";
import { createImportRouter } from "./routes/import.js";
import type {
  AppSettingsInput,
  ConfigOptionInput,
  ConfigOptionType,
  ConfigOptionUpdateInput,
  ExportPayload,
  GrowthGoalInput,
  GrowthGoalUpdateInput,
  KnowledgeAssetInput,
  KnowledgeAssetUpdateInput,
  MilestoneInput,
  MilestoneUpdateInput,
  OutcomeInput,
  OutcomeStatus,
  OutcomeType,
  OutcomeUpdateInput,
  ProjectInput,
  ProjectStatus,
  ProjectUpdateInput,
  RecordInput,
  ReportReviewInput,
  ReportReviewType,
  WorkloadStandardInput,
  WorkloadStandardUpdateInput,
  WorkloadStandardVersionInput
} from "./types.js";

const app = express();
const port = Number(process.env.PORT || 4100);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));
app.use("/api/import", createImportRouter());

const configOptionTypes = ["businessCategory", "workType", "abilityDimension", "productSystem", "subtask"] as const;

const optionalNumberSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().finite().nullable().optional()
);

const optionalNonNegativeNumberSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().finite().min(0).nullable().optional()
);

const recordSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1),
  content: z.string().default(""),
  category: z.string().default("其他"),
  businessCategory: z.string().default("其他"),
  workType: z.string().default("其他项"),
  abilityDimension: z.string().default(""),
  projectName: z.string().default(""),
  projectId: z.string().nullable().default(null),
  projectRelation: z.enum(["project", "non_project", "unassigned"]).default("unassigned"),
  productSystem: z.string().default(""),
  subtask: z.string().default(""),
  quantity: z.number().nullable().default(null),
  coefficient: z.number().nullable().default(null),
  workload: z.number().nullable().default(null),
  timeHours: z.number().nullable().default(null),
  tags: z.string().default(""),
  workloadUnit: z.string().default(""),
  coefficientSource: z.enum(["none", "legacy", "manual", "standard_exact", "standard_general"]).default("none"),
  coefficientStandardId: z.string().nullable().default(null),
  coefficientStandardVersionId: z.string().nullable().default(null),
  workloadFormulaVersion: z.literal("quantity_x_coefficient_v1").default("quantity_x_coefficient_v1"),
  abilityAllocations: z.array(z.object({
    abilityId: z.string(),
    abilityName: z.string(),
    percentage: z.number(),
    allocatedTimeHours: z.number().nullable(),
    allocatedWorkload: z.number().nullable()
  })).default([]),
  createTime: z.number(),
  updateTime: z.number()
});

const recordInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(200),
  content: z.string().default(""),
  category: z.enum(["三新业务", "技术支持", "工程调试", "售前支持", "其他"]).default("其他"),
  businessCategory: z.string().trim().max(80).optional(),
  workType: z.string().trim().max(80).optional(),
  abilityDimension: z.string().trim().max(300).optional(),
  projectId: z.string().trim().nullable(),
  projectRelation: z.enum(["project", "non_project"]),
  productSystem: z.string().trim().max(80).optional(),
  subtask: z.string().trim().max(120).optional(),
  quantity: optionalNonNegativeNumberSchema,
  coefficient: optionalNonNegativeNumberSchema,
  workload: optionalNonNegativeNumberSchema,
  workloadUnit: z.string().trim().max(40).optional(),
  coefficientStandardId: z.string().trim().nullable().optional(),
  abilityAllocations: z.array(z.object({
    abilityId: z.string().trim().min(1).max(120),
    abilityName: z.string().trim().min(1).max(120),
    percentage: z.coerce.number().finite().min(0).max(100)
  })).max(30).optional(),
  timeHours: optionalNonNegativeNumberSchema,
  tags: z.string().default("")
});

const configOptionInputSchema = z.object({
  type: z.enum(configOptionTypes),
  label: z.string().trim().min(1).max(80),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  isDefault: z.boolean().optional()
});

const configOptionUpdateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  isDefault: z.boolean().optional()
});

const configReorderSchema = z.object({
  type: z.enum(configOptionTypes),
  orderedIds: z.array(z.string().min(1)).max(500)
});

const workloadStandardInputSchema = z.object({
  versionId: z.string().trim().min(1).optional(),
  businessCategory: z.string().trim().min(1).max(80),
  workType: z.string().trim().min(1).max(80),
  productSystem: z.string().trim().max(80).optional().default(""),
  subtask: z.string().trim().max(120).optional().default(""),
  unit: z.string().trim().max(40).optional().default(""),
  coefficient: z.coerce.number().finite().min(0),
  remark: z.string().trim().max(300).optional().default(""),
  enabled: z.boolean().optional()
});

const workloadStandardUpdateSchema = z.object({
  businessCategory: z.string().trim().min(1).max(80).optional(),
  workType: z.string().trim().min(1).max(80).optional(),
  productSystem: z.string().trim().max(80).optional(),
  subtask: z.string().trim().max(120).optional(),
  unit: z.string().trim().max(40).optional(),
  coefficient: z.coerce.number().finite().min(0).optional(),
  remark: z.string().trim().max(300).optional(),
  enabled: z.boolean().optional()
});

const workloadStandardVersionInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  year: z.coerce.number().int().min(2000).max(2200).nullable().optional(),
  sourceType: z.enum(["manual", "excel"]).optional(),
  sourceName: z.string().trim().max(200).optional()
});

const projectStatuses = ["planned", "active", "paused", "completed", "archived"] as const;
const optionalProjectDateSchema = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);
const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  shortName: z.string().trim().max(80).optional(),
  status: z.enum(projectStatuses).optional(),
  startDate: optionalProjectDateSchema.optional(),
  endDate: optionalProjectDateSchema.optional(),
  personalRole: z.string().trim().max(160).optional(),
  goal: z.string().trim().max(1200).optional(),
  description: z.string().trim().max(2000).optional(),
  completionSummary: z.string().trim().max(2000).optional(),
  aliases: z.array(z.string().trim().min(1).max(160)).max(50).optional()
});
const projectUpdateSchema = projectInputSchema.partial();
const projectMergeSchema = z.object({ targetId: z.string().trim().min(1) });

const workloadMatchSchema = z.object({
  versionId: z.string().trim().min(1).optional(),
  businessCategory: z.string().trim().min(1).max(80),
  workType: z.string().trim().min(1).max(80),
  productSystem: z.string().trim().max(80).optional().default(""),
  subtask: z.string().trim().max(120).optional().default("")
});

const focusScoreWeightsSchema = z.object({
  workload: z.coerce.number().finite().min(0).optional(),
  timeHours: z.coerce.number().finite().min(0).optional(),
  recordCount: z.coerce.number().finite().min(0).optional()
});

const warningRulesSchema = z.object({
  abilityNoRecordDays: z.coerce.number().finite().min(1).optional(),
  targetShareDeviationPercent: z.coerce.number().finite().min(0).optional()
});

const appSettingsSchema = z.object({
  focusScoreWeights: focusScoreWeightsSchema.optional(),
  warningRules: warningRulesSchema.optional(),
  abilityTargets: z.record(z.string().trim().min(1).max(80), z.coerce.number().finite().min(0)).optional()
});

const reportReviewSchema = z.object({
  reportType: z.enum(["week", "month", "year"]),
  periodKey: z.string().trim().min(4).max(10),
  achievements: z.string().trim().max(5000).optional().default(""),
  shortcomings: z.string().trim().max(5000).optional().default(""),
  causes: z.string().trim().max(5000).optional().default(""),
  improvements: z.string().trim().max(5000).optional().default(""),
  growth: z.string().trim().max(5000).optional().default(""),
  nextPlan: z.string().trim().max(5000).optional().default(""),
  status: z.enum(["draft", "final"]).optional().default("draft")
});

const milestoneInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).optional().default(""),
  category: z.string().trim().max(80).optional().default("成长目标"),
  targetType: z.string().trim().max(80).optional().default("工作当量"),
  targetValue: z.coerce.number().finite().min(0).optional().default(0),
  currentValue: z.coerce.number().finite().min(0).optional().default(0),
  goalId: z.string().trim().max(120).optional().default(""),
  metricType: z.enum(["quantity", "input", "stage", "continuous"]).optional().default("stage"),
  metricSource: z.enum(["outcome_count", "problem_count", "project_count", "time_hours", "workload", "active_months", "manual_stage", "legacy_manual"]).optional().default("manual_stage"),
  abilityId: z.string().trim().max(120).optional().default(""),
  abilityName: z.string().trim().max(120).optional().default(""),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).default(""),
  requiredOutcomeCount: z.coerce.number().finite().min(0).optional().default(0),
  stages: z.array(z.object({
    id: z.string().trim().max(120).optional(),
    label: z.string().trim().min(1).max(160),
    sortOrder: z.number().int().min(0).max(100000).optional(),
    completed: z.boolean().optional(),
    completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""))
  })).max(50).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).default(""),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional()
});

const milestoneUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(600).optional(),
  category: z.string().trim().max(80).optional(),
  targetType: z.string().trim().max(80).optional(),
  targetValue: z.coerce.number().finite().min(0).optional(),
  currentValue: z.coerce.number().finite().min(0).optional(),
  goalId: z.string().trim().max(120).optional(),
  metricType: z.enum(["quantity", "input", "stage", "continuous"]).optional(),
  metricSource: z.enum(["outcome_count", "problem_count", "project_count", "time_hours", "workload", "active_months", "manual_stage", "legacy_manual"]).optional(),
  abilityId: z.string().trim().max(120).optional(),
  abilityName: z.string().trim().max(120).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  requiredOutcomeCount: z.coerce.number().finite().min(0).optional(),
  stages: z.array(z.object({
    id: z.string().trim().max(120).optional(),
    label: z.string().trim().min(1).max(160),
    sortOrder: z.number().int().min(0).max(100000).optional(),
    completed: z.boolean().optional(),
    completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""))
  })).max(50).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional()
});

const growthGoalInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  scope: z.enum(["career", "cultivation", "annual", "learning"]).optional().default("career"),
  status: z.enum(["planned", "active", "paused", "completed", "archived"]).optional().default("planned"),
  description: z.string().trim().max(1200).optional().default(""),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).default(""),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).default(""),
  targetYear: z.coerce.number().int().min(2000).max(2200).nullable().optional(),
  abilityId: z.string().trim().max(120).optional().default(""),
  abilityName: z.string().trim().max(120).optional().default("")
});

const growthGoalUpdateSchema = growthGoalInputSchema.partial();

const knowledgeAssetStatuses = ["draft", "published", "archived"] as const;

const knowledgeAssetInputSchema = z.object({
  type: z.string().trim().max(80).optional().default("复盘"),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(1200).optional().default(""),
  sourceRecordId: z.string().trim().max(120).optional().default(""),
  projectName: z.string().trim().max(120).optional().default(""),
  productSystem: z.string().trim().max(80).optional().default(""),
  tags: z.string().trim().max(300).optional().default(""),
  status: z.enum(knowledgeAssetStatuses).optional().default("draft"),
  link: z.string().trim().max(500).optional().default(""),
  remark: z.string().trim().max(600).optional().default("")
});

const knowledgeAssetUpdateSchema = z.object({
  type: z.string().trim().max(80).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  summary: z.string().trim().max(1200).optional(),
  sourceRecordId: z.string().trim().max(120).optional(),
  projectName: z.string().trim().max(120).optional(),
  productSystem: z.string().trim().max(80).optional(),
  tags: z.string().trim().max(300).optional(),
  status: z.enum(knowledgeAssetStatuses).optional(),
  link: z.string().trim().max(500).optional(),
  remark: z.string().trim().max(600).optional()
});

const outcomeTypes = ["deliverable", "problem_resolution", "stage_progress", "reusable_asset"] as const;
const outcomeStatuses = ["planned", "in_progress", "stage_result", "completed"] as const;
const outcomeDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));
const outcomeAbilitySchema = z.object({
  abilityId: z.string().trim().min(1).max(120),
  abilityName: z.string().trim().min(1).max(120)
});
const outcomeFields = {
  type: z.enum(outcomeTypes),
  status: z.enum(outcomeStatuses).optional(),
  title: z.string().trim().min(1).max(160),
  projectId: z.string().trim().max(120).nullable().optional(),
  startDate: outcomeDateSchema,
  updateDate: outcomeDateSchema,
  completedDate: outcomeDateSchema,
  backgroundGoal: z.string().trim().max(2000).optional(),
  completedWork: z.string().trim().max(4000).optional(),
  valueImpact: z.string().trim().max(2000).optional(),
  personalRole: z.string().trim().max(300).optional(),
  contribution: z.string().trim().max(2000).optional(),
  reportSummary: z.string().trim().max(1200).optional(),
  productSystem: z.string().trim().max(160).optional(),
  tags: z.string().trim().max(500).optional(),
  remark: z.string().trim().max(1200).optional(),
  recordIds: z.array(z.string().trim().min(1).max(120)).max(500).optional(),
  abilities: z.array(outcomeAbilitySchema).max(100).optional(),
  milestoneIds: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
  statusNote: z.string().trim().max(600).optional()
};
const outcomeInputSchema = z.object(outcomeFields);
const outcomeUpdateSchema = z.object({
  ...outcomeFields,
  type: outcomeFields.type.optional(),
  title: outcomeFields.title.optional()
});

const exportScopeSchema = z
  .object({
    type: z.enum(["period", "project", "businessCategory", "all", "custom"]).default("custom"),
    periodType: z.enum(["week", "month", "year"]).optional(),
    label: z.string().trim().max(120).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    filterValue: z.string().trim().max(120).optional()
  })
  .optional();

const exportSchema = z.object({
  title: z.string().min(1).max(120),
  records: z.array(recordSchema).max(5000),
  scope: exportScopeSchema,
  workloadAdjustmentPercent: z.coerce.number().finite().min(0).max(1000).optional().default(100)
});

const backupPayloadSchema = z.object({
  backupBase64: z.string().min(1)
});

type ExportFormat = "docx" | "pdf" | "xlsx";

const contentTypes: Record<ExportFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

async function buildExport(format: ExportFormat, payload: ExportPayload): Promise<Buffer> {
  if (format === "docx") return buildWord(payload);
  if (format === "pdf") return buildPdf(payload);
  return buildExcel(payload);
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "trace-report-backend",
    database: getDatabasePath()
  });
});

app.get("/api/records", (_req, res) => {
  res.json({ records: listRecords() });
});

app.get("/api/projects", (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query : undefined;
  const statuses = typeof req.query.statuses === "string"
    ? req.query.statuses.split(",").filter((status): status is ProjectStatus => projectStatuses.includes(status as ProjectStatus))
    : undefined;
  const includeArchived = req.query.includeArchived === "true";
  res.json({ projects: listProjects({ query, statuses, includeArchived }) });
});

app.get("/api/projects/:id", (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ message: "项目不存在。" });
    return;
  }
  res.json({ project });
});

app.get("/api/projects/:id/summary", (req, res) => {
  const summary = getProjectSummary(req.params.id);
  if (!summary) {
    res.status(404).json({ message: "项目不存在。" });
    return;
  }
  res.json({ summary });
});

app.post("/api/projects", (req, res, next) => {
  try {
    const project = insertProject(projectInputSchema.parse(req.body) as ProjectInput);
    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/projects/:id", (req, res, next) => {
  try {
    const project = updateProject(req.params.id, projectUpdateSchema.parse(req.body) as ProjectUpdateInput);
    if (!project) {
      res.status(404).json({ message: "项目不存在。" });
      return;
    }
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/archive", (req, res, next) => {
  try {
    const project = archiveProject(req.params.id);
    if (!project) {
      res.status(404).json({ message: "项目不存在。" });
      return;
    }
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/reactivate", (req, res, next) => {
  try {
    const project = reactivateProject(req.params.id);
    if (!project) {
      res.status(404).json({ message: "项目不存在。" });
      return;
    }
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:id/merge-preview", (req, res, next) => {
  try {
    const { targetId } = projectMergeSchema.parse(req.query);
    const preview = getProjectMergePreview(req.params.id, targetId);
    if (!preview) {
      res.status(400).json({ message: "项目合并目标无效。" });
      return;
    }
    res.json({ preview });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/merge", (req, res, next) => {
  try {
    const { targetId } = projectMergeSchema.parse(req.body);
    res.json({ project: mergeProjects(req.params.id, targetId) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/config-options", (req, res) => {
  const type = req.query.type;
  const parsedType = typeof type === "string" && configOptionTypes.includes(type as ConfigOptionType)
    ? (type as ConfigOptionType)
    : undefined;

  res.json({ options: listConfigOptions(parsedType) });
});

app.post("/api/config-options", (req, res, next) => {
  try {
    const input: ConfigOptionInput = configOptionInputSchema.parse(req.body);
    const option = insertConfigOption(input);
    res.status(201).json({ option });
  } catch (error) {
    next(error);
  }
});

app.put("/api/config-options/:id", (req, res, next) => {
  try {
    const input: ConfigOptionUpdateInput = configOptionUpdateSchema.parse(req.body);
    const option = updateConfigOption(req.params.id, input);

    if (!option) {
      res.status(404).json({ message: "Config option not found." });
      return;
    }

    res.json({ option });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/config-options/:id", (req, res) => {
  if (!deleteConfigOption(req.params.id)) {
    res.status(404).json({ message: "Config option not found." });
    return;
  }

  res.status(204).send();
});

app.post("/api/config-options/reorder", (req, res, next) => {
  try {
    const input = configReorderSchema.parse(req.body);
    const options = reorderConfigOptions(input.type, input.orderedIds);
    res.json({ options });
  } catch (error) {
    next(error);
  }
});

app.get("/api/workload-standard-versions", (_req, res) => {
  res.json({ versions: listWorkloadStandardVersions() });
});

app.post("/api/workload-standard-versions", (req, res, next) => {
  try {
    const version = insertWorkloadStandardVersion(workloadStandardVersionInputSchema.parse(req.body) as WorkloadStandardVersionInput);
    res.status(201).json({ version });
  } catch (error) {
    next(error);
  }
});

app.post("/api/workload-standard-versions/:id/activate", (req, res, next) => {
  try {
    const version = activateWorkloadStandardVersion(req.params.id);
    if (!version) {
      res.status(404).json({ message: "Workload standard version not found." });
      return;
    }
    res.json({ version });
  } catch (error) {
    next(error);
  }
});

app.get("/api/workload-standards", (req, res) => {
  const versionId = typeof req.query.versionId === "string" ? req.query.versionId : undefined;
  res.json({ standards: listWorkloadStandards(versionId) });
});

app.post("/api/workload-standards", (req, res, next) => {
  try {
    const input: WorkloadStandardInput = workloadStandardInputSchema.parse(req.body);
    const standard = insertWorkloadStandard(input);
    res.status(201).json({ standard });
  } catch (error) {
    next(error);
  }
});

app.put("/api/workload-standards/:id", (req, res, next) => {
  try {
    const input: WorkloadStandardUpdateInput = workloadStandardUpdateSchema.parse(req.body);
    const standard = updateWorkloadStandard(req.params.id, input);

    if (!standard) {
      res.status(404).json({ message: "Workload standard not found." });
      return;
    }

    res.json({ standard });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/workload-standards/:id", (req, res) => {
  if (!deleteWorkloadStandard(req.params.id)) {
    res.status(404).json({ message: "Workload standard not found." });
    return;
  }

  res.status(204).send();
});

app.get("/api/workload-standards/match", (req, res, next) => {
  try {
    const input = workloadMatchSchema.parse(req.query);
    const match = matchWorkloadStandard(input);
    res.json({ standard: match?.standard ?? null, match });
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", (_req, res) => {
  res.json({ settings: getAppSettings() });
});

app.put("/api/settings", (req, res, next) => {
  try {
    const input: AppSettingsInput = appSettingsSchema.parse(req.body);
    res.json({ settings: updateAppSettings(input) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/report-reviews", (req, res, next) => {
  try {
    const reportType = z.enum(["week", "month", "year"]).parse(req.query.reportType) as ReportReviewType;
    const periodKey = typeof req.query.periodKey === "string" ? req.query.periodKey : "";
    if (periodKey) {
      res.json({ review: getReportReview(reportType, periodKey) });
      return;
    }
    const periodPrefix = typeof req.query.periodPrefix === "string" ? req.query.periodPrefix : "";
    res.json({ reviews: listReportReviews(reportType, periodPrefix) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/report-reviews", (req, res, next) => {
  try {
    const input: ReportReviewInput = reportReviewSchema.parse(req.body);
    res.json({ review: upsertReportReview(input) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/growth-goals", (req, res) => {
  res.json({ goals: listGrowthGoals({ includeArchived: req.query.includeArchived === "true" }) });
});

app.post("/api/growth-goals", (req, res, next) => {
  try {
    const input: GrowthGoalInput = growthGoalInputSchema.parse(req.body);
    res.status(201).json({ goal: insertGrowthGoal(input) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/growth-goals/:id", (req, res, next) => {
  try {
    const input: GrowthGoalUpdateInput = growthGoalUpdateSchema.parse(req.body);
    const goal = updateGrowthGoal(req.params.id, input);
    if (!goal) {
      res.status(404).json({ message: "Growth goal not found." });
      return;
    }
    res.json({ goal });
  } catch (error) {
    next(error);
  }
});

app.get("/api/milestones", (_req, res) => {
  res.json({ milestones: listMilestonesWithProgress() });
});

app.post("/api/milestones", (req, res, next) => {
  try {
    const input: MilestoneInput = milestoneInputSchema.parse(req.body);
    const milestone = insertMilestone(input);
    res.status(201).json({ milestone });
  } catch (error) {
    next(error);
  }
});

app.put("/api/milestones/:id", (req, res, next) => {
  try {
    const input: MilestoneUpdateInput = milestoneUpdateSchema.parse(req.body);
    const milestone = updateMilestone(req.params.id, input);

    if (!milestone) {
      res.status(404).json({ message: "Milestone not found." });
      return;
    }

    res.json({ milestone });
  } catch (error) {
    next(error);
  }
});

app.post("/api/milestones/:id/correction", (req, res, next) => {
  try {
    const input = z.object({ value: z.coerce.number().finite().min(0), reason: z.string().trim().min(1).max(600) }).parse(req.body);
    const milestone = correctMilestone(req.params.id, input.value, input.reason);
    if (!milestone) {
      res.status(404).json({ message: "Milestone not found." });
      return;
    }
    res.json({ milestone, progress: getMilestoneProgress(milestone.id), corrections: listMilestoneCorrections(milestone.id) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/milestones/:id/correction/reset", (req, res, next) => {
  try {
    const input = z.object({ reason: z.string().trim().min(1).max(600) }).parse(req.body);
    const milestone = resetMilestoneCorrection(req.params.id, input.reason);
    if (!milestone) {
      res.status(404).json({ message: "Milestone not found." });
      return;
    }
    res.json({ milestone, progress: getMilestoneProgress(milestone.id), corrections: listMilestoneCorrections(milestone.id) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/milestones/:id/stages/:stageId/toggle", (req, res, next) => {
  try {
    const input = z.object({ completed: z.boolean(), completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")) }).parse(req.body);
    const milestone = toggleMilestoneStage(req.params.id, req.params.stageId, input.completed, input.completedDate);
    if (!milestone) {
      res.status(404).json({ message: "Milestone stage not found." });
      return;
    }
    res.json({ milestone, progress: getMilestoneProgress(milestone.id) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/knowledge-assets", (_req, res) => {
  res.json({ assets: listKnowledgeAssets() });
});

app.post("/api/knowledge-assets", (req, res, next) => {
  res.status(410).json({ message: "知识资产已迁移到成果管理，请使用成果接口。" });
});

app.put("/api/knowledge-assets/:id", (req, res, next) => {
  res.status(410).json({ message: "知识资产已迁移到成果管理，请使用成果接口。" });
});

app.get("/api/outcomes", (req, res, next) => {
  try {
    const type = typeof req.query.type === "string" ? z.enum(outcomeTypes).parse(req.query.type) : undefined;
    const status = typeof req.query.status === "string" ? z.enum(outcomeStatuses).parse(req.query.status) : undefined;
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const abilityId = typeof req.query.abilityId === "string" ? req.query.abilityId : undefined;
    const year = typeof req.query.year === "string" ? z.string().regex(/^\d{4}$/).parse(req.query.year) : undefined;
    const query = typeof req.query.query === "string" ? req.query.query : undefined;
    const includeArchived = req.query.includeArchived === "true";
    const outcomes = listOutcomes({ type: type as OutcomeType | undefined, status: status as OutcomeStatus | undefined, projectId, abilityId, year, query, includeArchived });
    res.json({ outcomes, summary: summarizeOutcomes(outcomes) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/outcomes/:id", (req, res) => {
  const outcome = getOutcome(req.params.id);
  if (!outcome) {
    res.status(404).json({ message: "Outcome not found." });
    return;
  }
  res.json({ outcome });
});

app.post("/api/outcomes", (req, res, next) => {
  try {
    const outcome = insertOutcome(outcomeInputSchema.parse(req.body) as OutcomeInput);
    res.status(201).json({ outcome });
  } catch (error) {
    next(error);
  }
});

app.put("/api/outcomes/:id", (req, res, next) => {
  try {
    const outcome = updateOutcome(req.params.id, outcomeUpdateSchema.parse(req.body) as OutcomeUpdateInput);
    if (!outcome) {
      res.status(404).json({ message: "Outcome not found." });
      return;
    }
    res.json({ outcome });
  } catch (error) {
    next(error);
  }
});

app.post("/api/outcomes/:id/archive", (req, res) => {
  const outcome = archiveOutcome(req.params.id);
  if (!outcome) {
    res.status(404).json({ message: "Outcome not found." });
    return;
  }
  res.json({ outcome });
});

app.post("/api/outcomes/:id/reactivate", (req, res) => {
  const outcome = reactivateOutcome(req.params.id);
  if (!outcome) {
    res.status(404).json({ message: "Outcome not found." });
    return;
  }
  res.json({ outcome });
});

app.post("/api/records", (req, res, next) => {
  try {
    const input: RecordInput = recordInputSchema.parse(req.body);
    const record = insertRecord(input);
    res.status(201).json({ record });
  } catch (error) {
    next(error);
  }
});

app.put("/api/records/:id", (req, res, next) => {
  try {
    const input: RecordInput = recordInputSchema.parse(req.body);
    const record = updateRecord(req.params.id, input);

    if (!record) {
      res.status(404).json({ message: "Record not found." });
      return;
    }

    res.json({ record });
  } catch (error) {
    next(error);
  }
});

app.get("/api/records/:id/impact", (req, res) => {
  const impact = getRecordDeleteImpact(req.params.id);
  if (!impact) {
    res.status(404).json({ message: "Record not found." });
    return;
  }

  res.json({ impact });
});

app.delete("/api/records/:id", (req, res) => {
  if (!deleteRecord(req.params.id)) {
    res.status(404).json({ message: "Record not found." });
    return;
  }

  res.status(204).send();
});

app.delete("/api/records", (_req, res) => {
  clearRecords();
  res.status(204).send();
});

app.get("/api/backup", (_req, res, next) => {
  try {
    const buffer = createBackupPackage();
    const fileName = `trace-backup-${new Date().toISOString().slice(0, 10)}.json.gz`;
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Length", buffer.byteLength);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

app.post("/api/backup/preview", (req, res, next) => {
  try {
    const input = backupPayloadSchema.parse(req.body);
    const preview = previewRestorePackage(Buffer.from(input.backupBase64, "base64"));
    res.json({ preview });
  } catch (error) {
    next(error);
  }
});

app.post("/api/backup/restore", (req, res, next) => {
  try {
    const input = backupPayloadSchema.parse(req.body);
    const result = restoreBackupPackage(Buffer.from(input.backupBase64, "base64"));
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

app.get("/api/year-archives/:year/preview", (req, res, next) => {
  try {
    const year = z.coerce.number().int().min(2000).max(2200).parse(req.params.year);
    res.json({ preview: previewYearArchive(year) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/year-archives/:year", (req, res, next) => {
  try {
    const year = z.coerce.number().int().min(2000).max(2200).parse(req.params.year);
    res.status(201).json({ archive: createYearArchive(year) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/export/:format", async (req, res, next) => {
  try {
    const format = req.params.format as ExportFormat;
    if (!["docx", "pdf", "xlsx"].includes(format)) {
      res.status(404).json({ message: "Unsupported export format." });
      return;
    }

    const input = exportSchema.parse(req.body);
    const selectedRecordIds = new Set(input.records.map((record) => record.id));
    const allOutcomes = listOutcomes({ includeArchived: false });
    const outcomes = allOutcomes.filter((outcome) => {
      if (input.scope?.type === "project" && input.scope.filterValue) return outcome.projectName === input.scope.filterValue;
      if (outcome.recordIds.some((recordId) => selectedRecordIds.has(recordId))) return true;
      const date = outcome.completedDate || outcome.updateDate || outcome.startDate || new Date(outcome.createTime).toISOString().slice(0, 10);
      if (input.scope?.startDate && date && date < input.scope.startDate) return false;
      if (input.scope?.endDate && date && date > input.scope.endDate) return false;
      return Boolean(date && (input.scope?.startDate || input.scope?.endDate));
    });
    const payload: ExportPayload = {
      ...input,
      configOptions: listConfigOptions(),
      workloadStandards: listWorkloadStandards(),
      appSettings: getAppSettings(),
      milestones: listMilestonesWithProgress(),
      knowledgeAssets: listKnowledgeAssets(),
      outcomes,
      workloadAdjustmentPercent: input.workloadAdjustmentPercent,
      reportReview: input.scope?.periodType && input.scope.startDate
        ? getReportReview(
          input.scope.periodType,
          input.scope.periodType === "week" ? input.scope.startDate
            : input.scope.periodType === "month" ? input.scope.startDate.slice(0, 7)
              : input.scope.startDate.slice(0, 4)
        )
        : null
    };
    const buffer = await buildExport(format, payload);
    const safeName = sanitizeFileName(payload.title);

    res.setHeader("Content-Type", contentTypes[format]);
    res.setHeader("Content-Length", buffer.byteLength);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(safeName)}.${format}"; filename*=UTF-8''${encodeURIComponent(safeName)}.${format}`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: "Invalid request payload.", issues: error.flatten() });
    return;
  }

  if (error instanceof Error && error.message === "CONFIG_OPTION_DUPLICATE") {
    res.status(409).json({ message: "同类型下已存在同名配置项。" });
    return;
  }

  if (error instanceof Error && error.message === "WORKLOAD_STANDARD_DUPLICATE") {
    res.status(409).json({ message: "已存在相同业务分类、工作类型、产品系统和子任务的当量标准。" });
    return;
  }

  if (error instanceof Error && error.message === "WORKLOAD_STANDARD_INVALID") {
    res.status(400).json({ message: "当量标准缺少必填项或折算系数无效。" });
    return;
  }

  if (error instanceof Error && error.message.startsWith("WORKLOAD_STANDARD_IMPORT_")) {
    res.status(400).json({ message: "导入文件、冲突决策或标准行无效。" });
    return;
  }

  if (error instanceof Error && error.message === "ABILITY_ALLOCATION_INVALID") {
    res.status(400).json({ message: "能力分配比例必须合计为 100%。" });
    return;
  }

  if (error instanceof Error && error.message === "WORKLOAD_STANDARD_MISMATCH") {
    res.status(400).json({ message: "标准与记录分类或实际系数不一致。" });
    return;
  }

  if (error instanceof Error && error.message === "WORKLOAD_STANDARD_IN_USE") {
    res.status(409).json({ message: "该标准已被历史记录引用，不能删除。" });
    return;
  }

  if (error instanceof Error && error.message === "MILESTONE_INVALID") {
    res.status(400).json({ message: "里程碑缺少名称或数值无效。" });
    return;
  }

  if (error instanceof Error && error.message === "KNOWLEDGE_ASSET_INVALID") {
    res.status(400).json({ message: "知识资产缺少标题。" });
    return;
  }

  if (error instanceof Error && ["OUTCOME_INVALID", "OUTCOME_INVALID_DATE", "OUTCOME_RELATION_INVALID"].includes(error.message)) {
    const messages: Record<string, string> = {
      OUTCOME_INVALID: "成果类型、状态或标题无效。",
      OUTCOME_INVALID_DATE: "成果日期范围无效。",
      OUTCOME_RELATION_INVALID: "成果关联的项目、记录、能力或里程碑无效。"
    };
    res.status(400).json({ message: messages[error.message] });
    return;
  }

  if (error instanceof Error) {
    const projectErrors: Record<string, [number, string]> = {
      PROJECT_NAME_CONFLICT: [409, "已存在同名项目。"],
      PROJECT_ALIAS_CONFLICT: [409, "项目名称、简称或别名与其他项目冲突。"],
      PROJECT_NOT_FOUND: [404, "项目不存在。"],
      PROJECT_INVALID_STATUS: [400, "项目状态无效。"],
      PROJECT_INVALID_DATE_RANGE: [400, "项目结束日期不能早于开始日期。"],
      PROJECT_RELATION_INVALID: [400, "请选择项目或明确标记为非项目事项。"],
      PROJECT_NOT_SELECTABLE: [409, "该项目已合并，不能继续关联新记录。"],
      PROJECT_MERGE_TARGET_INVALID: [400, "项目合并目标无效。"]
    };
    const mapped = projectErrors[error.message];
    if (mapped) {
      res.status(mapped[0]).json({ message: mapped[1] });
      return;
    }
  }

  console.error(error);
  res.status(500).json({ message: "Server error." });
});

app.listen(port, () => {
  console.log(`Trace report backend listening on http://localhost:${port}`);
});
