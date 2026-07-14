import cors from "cors";
import express from "express";
import { z } from "zod";
import {
  archiveProject,
  clearRecords,
  deleteConfigOption,
  deleteRecord,
  deleteWorkloadStandard,
  getAppSettings,
  getDatabasePath,
  getProject,
  getProjectMergePreview,
  getProjectSummary,
  insertKnowledgeAsset,
  insertWorkloadStandardVersion,
  activateWorkloadStandardVersion,
  insertRecord,
  insertConfigOption,
  insertMilestone,
  insertProject,
  insertWorkloadStandard,
  listConfigOptions,
  listKnowledgeAssets,
  listMilestones,
  listProjects,
  listRecords,
  listWorkloadStandards,
  listWorkloadStandardVersions,
  matchWorkloadStandard,
  mergeProjects,
  reactivateProject,
  reorderConfigOptions,
  updateAppSettings,
  updateConfigOption,
  updateKnowledgeAsset,
  updateMilestone,
  updateProject,
  updateWorkloadStandard,
  updateRecord
} from "./database.js";
import { buildExcel } from "./exporters/excel.js";
import { buildPdf } from "./exporters/pdf.js";
import { buildWord } from "./exporters/word.js";
import { sanitizeFileName } from "./report.js";
import { createImportRouter } from "./routes/import.js";
import type {
  AppSettingsInput,
  ConfigOptionInput,
  ConfigOptionType,
  ConfigOptionUpdateInput,
  ExportPayload,
  KnowledgeAssetInput,
  KnowledgeAssetUpdateInput,
  MilestoneInput,
  MilestoneUpdateInput,
  ProjectInput,
  ProjectStatus,
  ProjectUpdateInput,
  RecordInput,
  WorkloadStandardInput,
  WorkloadStandardUpdateInput
  ,WorkloadStandardVersionInput
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

const milestoneInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).optional().default(""),
  category: z.string().trim().max(80).optional().default("成长目标"),
  targetType: z.string().trim().max(80).optional().default("工作当量"),
  targetValue: z.coerce.number().finite().min(0).optional().default(0),
  currentValue: z.coerce.number().finite().min(0).optional().default(0),
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
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional()
});

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
  scope: exportScopeSchema
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

app.get("/api/milestones", (_req, res) => {
  res.json({ milestones: listMilestones() });
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

app.get("/api/knowledge-assets", (_req, res) => {
  res.json({ assets: listKnowledgeAssets() });
});

app.post("/api/knowledge-assets", (req, res, next) => {
  try {
    const input: KnowledgeAssetInput = knowledgeAssetInputSchema.parse(req.body);
    const asset = insertKnowledgeAsset(input);
    res.status(201).json({ asset });
  } catch (error) {
    next(error);
  }
});

app.put("/api/knowledge-assets/:id", (req, res, next) => {
  try {
    const input: KnowledgeAssetUpdateInput = knowledgeAssetUpdateSchema.parse(req.body);
    const asset = updateKnowledgeAsset(req.params.id, input);

    if (!asset) {
      res.status(404).json({ message: "Knowledge asset not found." });
      return;
    }

    res.json({ asset });
  } catch (error) {
    next(error);
  }
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

app.post("/api/export/:format", async (req, res, next) => {
  try {
    const format = req.params.format as ExportFormat;
    if (!["docx", "pdf", "xlsx"].includes(format)) {
      res.status(404).json({ message: "Unsupported export format." });
      return;
    }

    const input = exportSchema.parse(req.body);
    const payload: ExportPayload = {
      ...input,
      configOptions: listConfigOptions(),
      workloadStandards: listWorkloadStandards(),
      appSettings: getAppSettings(),
      milestones: listMilestones(),
      knowledgeAssets: listKnowledgeAssets()
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
