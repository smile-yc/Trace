import cors from "cors";
import express from "express";
import { z } from "zod";
import {
  clearRecords,
  deleteRecord,
  getAppSettings,
  getDatabasePath,
  insertKnowledgeAsset,
  insertRecord,
  insertConfigOption,
  insertMilestone,
  insertWorkloadStandard,
  listConfigOptions,
  listKnowledgeAssets,
  listMilestones,
  listRecords,
  listWorkloadStandards,
  matchWorkloadStandard,
  reorderConfigOptions,
  updateAppSettings,
  updateConfigOption,
  updateKnowledgeAsset,
  updateMilestone,
  updateWorkloadStandard,
  updateRecord
} from "./database.js";
import { buildExcel } from "./exporters/excel.js";
import { buildPdf } from "./exporters/pdf.js";
import { buildWord } from "./exporters/word.js";
import { sanitizeFileName } from "./report.js";
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
  RecordInput,
  WorkloadStandardInput,
  WorkloadStandardUpdateInput
} from "./types.js";

const app = express();
const port = Number(process.env.PORT || 4100);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

const configOptionTypes = ["businessCategory", "workType", "abilityDimension", "productSystem", "subtask"] as const;

const optionalNumberSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().finite().nullable().optional()
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
  productSystem: z.string().default(""),
  subtask: z.string().default(""),
  quantity: z.number().nullable().default(null),
  coefficient: z.number().nullable().default(null),
  workload: z.number().nullable().default(null),
  timeHours: z.number().nullable().default(null),
  tags: z.string().default(""),
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
  abilityDimension: z.string().trim().max(80).optional(),
  projectName: z.string().trim().max(120).optional(),
  productSystem: z.string().trim().max(80).optional(),
  subtask: z.string().trim().max(120).optional(),
  quantity: optionalNumberSchema,
  coefficient: optionalNumberSchema,
  workload: optionalNumberSchema,
  timeHours: optionalNumberSchema,
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
  businessCategory: z.string().trim().min(1).max(80),
  workType: z.string().trim().min(1).max(80),
  productSystem: z.string().trim().max(80).optional().default(""),
  subtask: z.string().trim().max(120).optional().default(""),
  coefficient: z.coerce.number().finite().min(0),
  remark: z.string().trim().max(300).optional().default(""),
  enabled: z.boolean().optional()
});

const workloadStandardUpdateSchema = z.object({
  businessCategory: z.string().trim().min(1).max(80).optional(),
  workType: z.string().trim().min(1).max(80).optional(),
  productSystem: z.string().trim().max(80).optional(),
  subtask: z.string().trim().max(120).optional(),
  coefficient: z.coerce.number().finite().min(0).optional(),
  remark: z.string().trim().max(300).optional(),
  enabled: z.boolean().optional()
});

const workloadMatchSchema = z.object({
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

app.post("/api/config-options/reorder", (req, res, next) => {
  try {
    const input = configReorderSchema.parse(req.body);
    const options = reorderConfigOptions(input.type, input.orderedIds);
    res.json({ options });
  } catch (error) {
    next(error);
  }
});

app.get("/api/workload-standards", (_req, res) => {
  res.json({ standards: listWorkloadStandards() });
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

app.get("/api/workload-standards/match", (req, res, next) => {
  try {
    const input = workloadMatchSchema.parse(req.query);
    res.json({ standard: matchWorkloadStandard(input) });
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

  if (error instanceof Error && error.message === "MILESTONE_INVALID") {
    res.status(400).json({ message: "里程碑缺少名称或数值无效。" });
    return;
  }

  if (error instanceof Error && error.message === "KNOWLEDGE_ASSET_INVALID") {
    res.status(400).json({ message: "知识资产缺少标题。" });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Server error." });
});

app.listen(port, () => {
  console.log(`Trace report backend listening on http://localhost:${port}`);
});
