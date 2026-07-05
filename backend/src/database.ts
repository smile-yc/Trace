import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type {
  ConfigOption,
  ConfigOptionInput,
  ConfigOptionType,
  ConfigOptionUpdateInput,
  RecordInput,
  WorkloadStandard,
  WorkloadStandardInput,
  WorkloadStandardUpdateInput,
  WorkRecord
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.resolve(__dirname, "..", "data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "report.sqlite");

fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '其他',
    businessCategory TEXT NOT NULL DEFAULT '其他',
    workType TEXT NOT NULL DEFAULT '其他项',
    projectName TEXT NOT NULL DEFAULT '',
    productSystem TEXT NOT NULL DEFAULT '',
    subtask TEXT NOT NULL DEFAULT '',
    quantity REAL DEFAULT NULL,
    coefficient REAL DEFAULT NULL,
    workload REAL DEFAULT NULL,
    tags TEXT NOT NULL DEFAULT '',
    createTime INTEGER NOT NULL,
    updateTime INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_records_date ON records(date);
  CREATE INDEX IF NOT EXISTS idx_records_update_time ON records(updateTime);

  CREATE TABLE IF NOT EXISTS config_options (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    isDefault INTEGER NOT NULL DEFAULT 0,
    isSystem INTEGER NOT NULL DEFAULT 0,
    createTime INTEGER NOT NULL,
    updateTime INTEGER NOT NULL,
    UNIQUE(type, label)
  );

  CREATE INDEX IF NOT EXISTS idx_config_options_type ON config_options(type, sortOrder);

  CREATE TABLE IF NOT EXISTS workload_standards (
    id TEXT PRIMARY KEY,
    businessCategory TEXT NOT NULL DEFAULT '',
    workType TEXT NOT NULL DEFAULT '',
    productSystem TEXT NOT NULL DEFAULT '',
    subtask TEXT NOT NULL DEFAULT '',
    coefficient REAL NOT NULL,
    remark TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    createTime INTEGER NOT NULL,
    updateTime INTEGER NOT NULL,
    UNIQUE(businessCategory, workType, productSystem, subtask)
  );

  CREATE INDEX IF NOT EXISTS idx_workload_standards_lookup
  ON workload_standards(businessCategory, workType, productSystem, subtask, enabled);
`);

const recordColumnDefinitions = [
  { name: "businessCategory", definition: "TEXT NOT NULL DEFAULT '其他'" },
  { name: "workType", definition: "TEXT NOT NULL DEFAULT '其他项'" },
  { name: "projectName", definition: "TEXT NOT NULL DEFAULT ''" },
  { name: "productSystem", definition: "TEXT NOT NULL DEFAULT ''" },
  { name: "subtask", definition: "TEXT NOT NULL DEFAULT ''" },
  { name: "quantity", definition: "REAL DEFAULT NULL" },
  { name: "coefficient", definition: "REAL DEFAULT NULL" },
  { name: "workload", definition: "REAL DEFAULT NULL" }
];

function ensureRecordColumns(): void {
  const columns = new Set(
    db
      .prepare("PRAGMA table_info(records)")
      .all()
      .map((column) => String((column as { name: unknown }).name))
  );

  recordColumnDefinitions.forEach((column) => {
    if (!columns.has(column.name)) {
      db.exec(`ALTER TABLE records ADD COLUMN ${column.name} ${column.definition};`);
    }
  });

  db.exec(`
    UPDATE records SET businessCategory = '三新业务'
    WHERE businessCategory = '其他' AND category = '三新业务';

    UPDATE records SET workType = '工程调试'
    WHERE workType = '其他项' AND category = '工程调试';

    UPDATE records SET workType = '售前方案'
    WHERE workType = '其他项' AND category = '售前支持';

    UPDATE records SET workload = quantity * coefficient
    WHERE workload IS NULL AND quantity IS NOT NULL AND coefficient IS NOT NULL;
  `);
}

ensureRecordColumns();

const selectSql = `
  SELECT
    id,
    date,
    title,
    content,
    category,
    businessCategory,
    workType,
    projectName,
    productSystem,
    subtask,
    quantity,
    coefficient,
    workload,
    tags,
    createTime,
    updateTime
  FROM records
`;

function normalizeTags(input: string): string {
  const seen = new Set<string>();

  return input
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => {
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    })
    .join(",");
}

function createId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const defaultConfigOptions: Record<ConfigOptionType, string[]> = {
  businessCategory: ["三新业务", "传统业务", "其他"],
  workType: [
    "工程设计",
    "工程测试",
    "工程调试",
    "售前方案",
    "新产品导入",
    "问题处理",
    "现场支持",
    "现场质量检查",
    "其他项"
  ],
  productSystem: ["GM1000", "GM2000", "GM6000", "GM7000", "PHM", "智能巡检", "其他"],
  subtask: [
    "牵引变电所",
    "分区所",
    "开闭所",
    "AT所",
    "配电所",
    "箱变/信号变",
    "综合变",
    "规约测试",
    "软件测试发布",
    "方案编制",
    "科研方案编制",
    "询价编制成本",
    "相关配合工作及测试实验",
    "现场支持",
    "其他"
  ]
};

const defaultLabels: Record<ConfigOptionType, string> = {
  businessCategory: "其他",
  workType: "其他项",
  productSystem: "其他",
  subtask: "其他"
};

function seedConfigOptions(): void {
  (Object.keys(defaultConfigOptions) as ConfigOptionType[]).forEach((type) => {
    const count = Number(
      (db.prepare("SELECT COUNT(*) AS count FROM config_options WHERE type = ?").get(type) as { count: number }).count
    );
    if (count > 0) return;

    const now = Date.now();
    defaultConfigOptions[type].forEach((label, index) => {
      db.prepare(
        `INSERT INTO config_options (
           id,
           type,
           label,
           enabled,
           sortOrder,
           isDefault,
           isSystem,
           createTime,
           updateTime
         )
         VALUES (?, ?, ?, 1, ?, ?, 1, ?, ?)`
      ).run(createId(), type, label, (index + 1) * 10, label === defaultLabels[type] ? 1 : 0, now, now);
    });
  });
}

seedConfigOptions();

function normalizeText(input: unknown): string {
  return String(input || "").trim();
}

function normalizeNumber(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;

  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function normalizeWorkload(quantity: number | null, coefficient: number | null, explicit: unknown): number | null {
  const workload = normalizeNumber(explicit);
  if (workload !== null) return workload;
  if (quantity === null || coefficient === null) return null;

  return Number((quantity * coefficient).toFixed(4));
}

function inferBusinessCategory(input: RecordInput): string {
  if (input.businessCategory) return input.businessCategory;
  if (input.category === "三新业务") return "三新业务";
  return "其他";
}

function inferWorkType(input: RecordInput): string {
  if (input.workType) return input.workType;
  if (input.category === "工程调试") return "工程调试";
  if (input.category === "售前支持") return "售前方案";
  return "其他项";
}

function toConfigOption(row: unknown): ConfigOption {
  const option = row as {
    id: unknown;
    type: unknown;
    label: unknown;
    enabled: unknown;
    sortOrder: unknown;
    isDefault: unknown;
    isSystem: unknown;
    createTime: unknown;
    updateTime: unknown;
  };

  return {
    id: String(option.id),
    type: String(option.type) as ConfigOptionType,
    label: String(option.label),
    enabled: Boolean(option.enabled),
    sortOrder: Number(option.sortOrder),
    isDefault: Boolean(option.isDefault),
    isSystem: Boolean(option.isSystem),
    createTime: Number(option.createTime),
    updateTime: Number(option.updateTime)
  };
}

function toWorkloadStandard(row: unknown): WorkloadStandard {
  const standard = row as {
    id: unknown;
    businessCategory: unknown;
    workType: unknown;
    productSystem: unknown;
    subtask: unknown;
    coefficient: unknown;
    remark: unknown;
    enabled: unknown;
    createTime: unknown;
    updateTime: unknown;
  };

  return {
    id: String(standard.id),
    businessCategory: String(standard.businessCategory || ""),
    workType: String(standard.workType || ""),
    productSystem: String(standard.productSystem || ""),
    subtask: String(standard.subtask || ""),
    coefficient: Number(standard.coefficient),
    remark: String(standard.remark || ""),
    enabled: Boolean(standard.enabled),
    createTime: Number(standard.createTime),
    updateTime: Number(standard.updateTime)
  };
}

function getNextSortOrder(type: ConfigOptionType): number {
  const result = db
    .prepare("SELECT MAX(sortOrder) AS maxSortOrder FROM config_options WHERE type = ?")
    .get(type) as { maxSortOrder: number | null };

  return Number(result.maxSortOrder || 0) + 10;
}

function findConfigOptionByLabel(type: ConfigOptionType, label: string, excludeId?: string): ConfigOption | null {
  const row = excludeId
    ? db.prepare("SELECT * FROM config_options WHERE type = ? AND label = ? AND id != ?").get(type, label, excludeId)
    : db.prepare("SELECT * FROM config_options WHERE type = ? AND label = ?").get(type, label);

  return row ? toConfigOption(row) : null;
}

function unsetDefault(type: ConfigOptionType): void {
  db.prepare("UPDATE config_options SET isDefault = 0 WHERE type = ?").run(type);
}

export function listConfigOptions(type?: ConfigOptionType): ConfigOption[] {
  const sql = type
    ? "SELECT * FROM config_options WHERE type = ? ORDER BY sortOrder ASC, createTime ASC"
    : "SELECT * FROM config_options ORDER BY type ASC, sortOrder ASC, createTime ASC";
  const rows = type ? db.prepare(sql).all(type) : db.prepare(sql).all();

  return rows.map(toConfigOption);
}

export function getConfigOption(id: string): ConfigOption | null {
  const row = db.prepare("SELECT * FROM config_options WHERE id = ?").get(id);
  return row ? toConfigOption(row) : null;
}

export function insertConfigOption(input: ConfigOptionInput): ConfigOption {
  const label = normalizeText(input.label);
  const existing = findConfigOptionByLabel(input.type, label);
  if (existing) {
    return updateConfigOption(existing.id, {
      enabled: input.enabled ?? true,
      isDefault: input.isDefault,
      sortOrder: input.sortOrder
    }) as ConfigOption;
  }

  const now = Date.now();
  const id = createId();
  const sortOrder = input.sortOrder ?? getNextSortOrder(input.type);
  const enabled = input.enabled ?? true;
  const isDefault = enabled && Boolean(input.isDefault);

  if (isDefault) unsetDefault(input.type);

  db.prepare(
    `INSERT INTO config_options (
       id,
       type,
       label,
       enabled,
       sortOrder,
       isDefault,
       isSystem,
       createTime,
       updateTime
     )
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(id, input.type, label, enabled ? 1 : 0, sortOrder, isDefault ? 1 : 0, now, now);

  return getConfigOption(id) as ConfigOption;
}

export function updateConfigOption(id: string, input: ConfigOptionUpdateInput): ConfigOption | null {
  const existing = getConfigOption(id);
  if (!existing) return null;

  const label = input.label === undefined ? existing.label : normalizeText(input.label);
  const duplicate = findConfigOptionByLabel(existing.type, label, id);
  if (duplicate) throw new Error("CONFIG_OPTION_DUPLICATE");

  const enabled = input.enabled ?? existing.enabled;
  const isDefault = enabled ? (input.isDefault ?? existing.isDefault) : false;
  const sortOrder = input.sortOrder ?? existing.sortOrder;
  const now = Date.now();

  if (isDefault) unsetDefault(existing.type);

  db.prepare(
    `UPDATE config_options
     SET label = ?, enabled = ?, sortOrder = ?, isDefault = ?, updateTime = ?
     WHERE id = ?`
  ).run(label, enabled ? 1 : 0, sortOrder, isDefault ? 1 : 0, now, id);

  return getConfigOption(id);
}

export function reorderConfigOptions(type: ConfigOptionType, orderedIds: string[]): ConfigOption[] {
  const availableIds = new Set(listConfigOptions(type).map((option) => option.id));
  const ids = orderedIds.filter((id) => availableIds.has(id));

  db.exec("BEGIN");
  try {
    ids.forEach((id, index) => {
      db.prepare("UPDATE config_options SET sortOrder = ?, updateTime = ? WHERE id = ?").run(
        (index + 1) * 10,
        Date.now(),
        id
      );
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return listConfigOptions(type);
}

function findWorkloadStandardByKey(
  businessCategory: string,
  workType: string,
  productSystem: string,
  subtask: string,
  excludeId?: string
): WorkloadStandard | null {
  const row = excludeId
    ? db
        .prepare(
          `SELECT * FROM workload_standards
           WHERE businessCategory = ? AND workType = ? AND productSystem = ? AND subtask = ? AND id != ?`
        )
        .get(businessCategory, workType, productSystem, subtask, excludeId)
    : db
        .prepare(
          `SELECT * FROM workload_standards
           WHERE businessCategory = ? AND workType = ? AND productSystem = ? AND subtask = ?`
        )
        .get(businessCategory, workType, productSystem, subtask);

  return row ? toWorkloadStandard(row) : null;
}

export function listWorkloadStandards(): WorkloadStandard[] {
  return db
    .prepare(
      `SELECT * FROM workload_standards
       ORDER BY enabled DESC, businessCategory ASC, workType ASC, productSystem ASC, subtask ASC, createTime ASC`
    )
    .all()
    .map(toWorkloadStandard);
}

export function getWorkloadStandard(id: string): WorkloadStandard | null {
  const row = db.prepare("SELECT * FROM workload_standards WHERE id = ?").get(id);
  return row ? toWorkloadStandard(row) : null;
}

export function insertWorkloadStandard(input: WorkloadStandardInput): WorkloadStandard {
  const businessCategory = normalizeText(input.businessCategory);
  const workType = normalizeText(input.workType);
  const productSystem = normalizeText(input.productSystem);
  const subtask = normalizeText(input.subtask);
  const coefficient = normalizeNumber(input.coefficient);

  if (!businessCategory || !workType || coefficient === null) {
    throw new Error("WORKLOAD_STANDARD_INVALID");
  }

  if (findWorkloadStandardByKey(businessCategory, workType, productSystem, subtask)) {
    throw new Error("WORKLOAD_STANDARD_DUPLICATE");
  }

  const now = Date.now();
  const id = createId();

  db.prepare(
    `INSERT INTO workload_standards (
       id,
       businessCategory,
       workType,
       productSystem,
       subtask,
       coefficient,
       remark,
       enabled,
       createTime,
       updateTime
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    businessCategory,
    workType,
    productSystem,
    subtask,
    coefficient,
    normalizeText(input.remark),
    input.enabled === false ? 0 : 1,
    now,
    now
  );

  return getWorkloadStandard(id) as WorkloadStandard;
}

export function updateWorkloadStandard(id: string, input: WorkloadStandardUpdateInput): WorkloadStandard | null {
  const existing = getWorkloadStandard(id);
  if (!existing) return null;

  const businessCategory =
    input.businessCategory === undefined ? existing.businessCategory : normalizeText(input.businessCategory);
  const workType = input.workType === undefined ? existing.workType : normalizeText(input.workType);
  const productSystem = input.productSystem === undefined ? existing.productSystem : normalizeText(input.productSystem);
  const subtask = input.subtask === undefined ? existing.subtask : normalizeText(input.subtask);
  const coefficient = input.coefficient === undefined ? existing.coefficient : normalizeNumber(input.coefficient);

  if (!businessCategory || !workType || coefficient === null) {
    throw new Error("WORKLOAD_STANDARD_INVALID");
  }

  if (findWorkloadStandardByKey(businessCategory, workType, productSystem, subtask, id)) {
    throw new Error("WORKLOAD_STANDARD_DUPLICATE");
  }

  db.prepare(
    `UPDATE workload_standards
     SET businessCategory = ?,
         workType = ?,
         productSystem = ?,
         subtask = ?,
         coefficient = ?,
         remark = ?,
         enabled = ?,
         updateTime = ?
     WHERE id = ?`
  ).run(
    businessCategory,
    workType,
    productSystem,
    subtask,
    coefficient,
    input.remark === undefined ? existing.remark : normalizeText(input.remark),
    (input.enabled ?? existing.enabled) ? 1 : 0,
    Date.now(),
    id
  );

  return getWorkloadStandard(id);
}

export function matchWorkloadStandard(input: {
  businessCategory?: string;
  workType?: string;
  productSystem?: string;
  subtask?: string;
}): WorkloadStandard | null {
  const businessCategory = normalizeText(input.businessCategory);
  const workType = normalizeText(input.workType);
  const productSystem = normalizeText(input.productSystem);
  const subtask = normalizeText(input.subtask);

  if (!businessCategory || !workType) return null;

  const rows = db
    .prepare(
      `SELECT * FROM workload_standards
       WHERE enabled = 1
         AND businessCategory = ?
         AND workType = ?
         AND productSystem IN (?, '')
         AND subtask IN (?, '')
       ORDER BY
         CASE WHEN productSystem = ? THEN 1 ELSE 0 END +
         CASE WHEN subtask = ? THEN 1 ELSE 0 END DESC,
         productSystem DESC,
         subtask DESC,
         createTime ASC
       LIMIT 1`
    )
    .all(businessCategory, workType, productSystem, subtask, productSystem, subtask);

  return rows[0] ? toWorkloadStandard(rows[0]) : null;
}

function toRecord(row: unknown): WorkRecord {
  const record = row as WorkRecord;
  return {
    id: String(record.id),
    date: String(record.date),
    title: String(record.title),
    content: String(record.content || ""),
    category: String(record.category || "其他"),
    businessCategory: String(record.businessCategory || "其他"),
    workType: String(record.workType || "其他项"),
    projectName: String(record.projectName || ""),
    productSystem: String(record.productSystem || ""),
    subtask: String(record.subtask || ""),
    quantity: normalizeNumber(record.quantity),
    coefficient: normalizeNumber(record.coefficient),
    workload: normalizeNumber(record.workload),
    tags: String(record.tags || ""),
    createTime: Number(record.createTime),
    updateTime: Number(record.updateTime)
  };
}

export function listRecords(): WorkRecord[] {
  return db
    .prepare(`${selectSql} ORDER BY date DESC, createTime DESC`)
    .all()
    .map(toRecord);
}

export function getRecord(id: string): WorkRecord | null {
  const row = db.prepare(`${selectSql} WHERE id = ?`).get(id);
  return row ? toRecord(row) : null;
}

export function insertRecord(input: RecordInput): WorkRecord {
  const now = Date.now();
  const quantity = normalizeNumber(input.quantity);
  const coefficient = normalizeNumber(input.coefficient);
  const record: WorkRecord = {
    id: createId(),
    date: input.date,
    title: input.title.trim() || "无标题",
    content: input.content.trim(),
    category: input.category || "其他",
    businessCategory: inferBusinessCategory(input),
    workType: inferWorkType(input),
    projectName: normalizeText(input.projectName),
    productSystem: normalizeText(input.productSystem),
    subtask: normalizeText(input.subtask),
    quantity,
    coefficient,
    workload: normalizeWorkload(quantity, coefficient, input.workload),
    tags: normalizeTags(input.tags || ""),
    createTime: now,
    updateTime: now
  };

  db.prepare(
    `INSERT INTO records (
       id,
       date,
       title,
       content,
       category,
       businessCategory,
       workType,
       projectName,
       productSystem,
       subtask,
       quantity,
       coefficient,
       workload,
       tags,
       createTime,
       updateTime
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.date,
    record.title,
    record.content,
    record.category,
    record.businessCategory,
    record.workType,
    record.projectName,
    record.productSystem,
    record.subtask,
    record.quantity,
    record.coefficient,
    record.workload,
    record.tags,
    record.createTime,
    record.updateTime
  );

  return record;
}

export function updateRecord(id: string, input: RecordInput): WorkRecord | null {
  const existing = getRecord(id);
  if (!existing) return null;

  const quantity = input.quantity === undefined ? existing.quantity : normalizeNumber(input.quantity);
  const coefficient = input.coefficient === undefined ? existing.coefficient : normalizeNumber(input.coefficient);
  const shouldRecalculateWorkload =
    input.workload !== undefined || input.quantity !== undefined || input.coefficient !== undefined;
  const next: WorkRecord = {
    ...existing,
    date: input.date,
    title: input.title.trim() || "无标题",
    content: input.content.trim(),
    category: input.category || "其他",
    businessCategory: input.businessCategory ? inferBusinessCategory(input) : existing.businessCategory,
    workType: input.workType ? inferWorkType(input) : existing.workType,
    projectName: input.projectName === undefined ? existing.projectName : normalizeText(input.projectName),
    productSystem: input.productSystem === undefined ? existing.productSystem : normalizeText(input.productSystem),
    subtask: input.subtask === undefined ? existing.subtask : normalizeText(input.subtask),
    quantity,
    coefficient,
    workload: shouldRecalculateWorkload ? normalizeWorkload(quantity, coefficient, input.workload) : existing.workload,
    tags: normalizeTags(input.tags || ""),
    updateTime: Date.now()
  };

  db.prepare(
    `UPDATE records
     SET
       date = ?,
       title = ?,
       content = ?,
       category = ?,
       businessCategory = ?,
       workType = ?,
       projectName = ?,
       productSystem = ?,
       subtask = ?,
       quantity = ?,
       coefficient = ?,
       workload = ?,
       tags = ?,
       updateTime = ?
     WHERE id = ?`
  ).run(
    next.date,
    next.title,
    next.content,
    next.category,
    next.businessCategory,
    next.workType,
    next.projectName,
    next.productSystem,
    next.subtask,
    next.quantity,
    next.coefficient,
    next.workload,
    next.tags,
    next.updateTime,
    id
  );

  return next;
}

export function deleteRecord(id: string): boolean {
  const result = db.prepare("DELETE FROM records WHERE id = ?").run(id);
  return result.changes > 0;
}

export function clearRecords(): void {
  db.prepare("DELETE FROM records").run();
}

export function getDatabasePath(): string {
  return dbPath;
}
