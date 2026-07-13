import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type {
  AppSettings,
  AppSettingsInput,
  ConfigOption,
  ConfigOptionInput,
  ConfigOptionType,
  ConfigOptionUpdateInput,
  KnowledgeAsset,
  KnowledgeAssetInput,
  KnowledgeAssetStatus,
  KnowledgeAssetUpdateInput,
  Milestone,
  MilestoneInput,
  MilestoneUpdateInput,
  RecordInput,
  AbilityAllocation,
  AbilityAllocationInput,
  CoefficientSource,
  WorkloadStandard,
  WorkloadStandardInput,
  WorkloadStandardUpdateInput,
  WorkloadStandardVersion,
  WorkloadStandardVersionInput,
  WorkloadStandardVersionStatus,
  WorkloadStandardMatch,
  WorkRecord
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.resolve(__dirname, "..", "data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "report.sqlite");

fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

interface Migration {
  version: number;
  name: string;
  up(database: DatabaseSync): void;
}

function runMigrations(database: DatabaseSync, migrations: readonly Migration[]): void {
  database.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, appliedTime INTEGER NOT NULL)");
  const applied = new Set(database.prepare("SELECT version FROM schema_migrations").all().map((row) => Number((row as { version: unknown }).version)));
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    database.exec("BEGIN IMMEDIATE");
    try {
      migration.up(database);
      database.prepare("INSERT INTO schema_migrations (version, name, appliedTime) VALUES (?, ?, ?)").run(migration.version, migration.name, Date.now());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '其他',
    businessCategory TEXT NOT NULL DEFAULT '其他',
    workType TEXT NOT NULL DEFAULT '其他项',
    abilityDimension TEXT NOT NULL DEFAULT '',
    projectName TEXT NOT NULL DEFAULT '',
    productSystem TEXT NOT NULL DEFAULT '',
    subtask TEXT NOT NULL DEFAULT '',
    quantity REAL DEFAULT NULL,
    coefficient REAL DEFAULT NULL,
    workload REAL DEFAULT NULL,
    timeHours REAL DEFAULT NULL,
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

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updateTime INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    targetType TEXT NOT NULL DEFAULT '',
    targetValue REAL NOT NULL DEFAULT 0,
    currentValue REAL NOT NULL DEFAULT 0,
    deadline TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createTime INTEGER NOT NULL,
    updateTime INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_milestones_enabled_sort ON milestones(enabled, sortOrder, createTime);

  CREATE TABLE IF NOT EXISTS knowledge_assets (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    sourceRecordId TEXT NOT NULL DEFAULT '',
    projectName TEXT NOT NULL DEFAULT '',
    productSystem TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    link TEXT NOT NULL DEFAULT '',
    remark TEXT NOT NULL DEFAULT '',
    createTime INTEGER NOT NULL,
    updateTime INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_knowledge_assets_status ON knowledge_assets(status, updateTime);

  CREATE TABLE IF NOT EXISTS record_ability_allocations (
    recordId TEXT NOT NULL,
    abilityId TEXT NOT NULL,
    abilityName TEXT NOT NULL,
    percentage REAL NOT NULL,
    PRIMARY KEY (recordId, abilityId),
    FOREIGN KEY (recordId) REFERENCES records(id) ON DELETE CASCADE
  );
`);

function hasColumn(table: string, column: string): boolean {
  return db.prepare(`PRAGMA table_info(${table})`).all()
    .some((item) => String((item as { name: unknown }).name) === column);
}

const foundationMigrations: Migration[] = [
  {
    version: 2026071301,
    name: "version workload standards",
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS workload_standard_versions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          year INTEGER DEFAULT NULL,
          status TEXT NOT NULL CHECK(status IN ('draft', 'active', 'retired')),
          sourceType TEXT NOT NULL DEFAULT 'manual',
          sourceName TEXT NOT NULL DEFAULT '',
          createTime INTEGER NOT NULL,
          updateTime INTEGER NOT NULL
        );
      `);
      const now = Date.now();
      database.prepare(`INSERT OR IGNORE INTO workload_standard_versions
        (id, name, year, status, sourceType, sourceName, createTime, updateTime)
        VALUES (?, ?, NULL, 'active', 'legacy', ?, ?, ?)`)
        .run("legacy-standard-version", "迁移前标准", "现有 Trace 数据", now, now);
      const hasVersion = database.prepare("PRAGMA table_info(workload_standards)").all()
        .some((item) => String((item as { name: unknown }).name) === "versionId");
      if (!hasVersion) {
        database.exec(`
          ALTER TABLE workload_standards RENAME TO workload_standards_legacy;
          CREATE TABLE workload_standards (
            id TEXT PRIMARY KEY,
            versionId TEXT NOT NULL,
            businessCategory TEXT NOT NULL DEFAULT '',
            workType TEXT NOT NULL DEFAULT '',
            productSystem TEXT NOT NULL DEFAULT '',
            subtask TEXT NOT NULL DEFAULT '',
            unit TEXT NOT NULL DEFAULT '',
            coefficient REAL NOT NULL,
            remark TEXT NOT NULL DEFAULT '',
            enabled INTEGER NOT NULL DEFAULT 1,
            createTime INTEGER NOT NULL,
            updateTime INTEGER NOT NULL,
            UNIQUE(versionId, businessCategory, workType, productSystem, subtask),
            FOREIGN KEY(versionId) REFERENCES workload_standard_versions(id) ON DELETE RESTRICT
          );
          INSERT INTO workload_standards
            (id, versionId, businessCategory, workType, productSystem, subtask, unit, coefficient, remark, enabled, createTime, updateTime)
          SELECT id, 'legacy-standard-version', businessCategory, workType, productSystem, subtask, '', coefficient, remark, enabled, createTime, updateTime
          FROM workload_standards_legacy;
          DROP TABLE workload_standards_legacy;
          CREATE INDEX IF NOT EXISTS idx_workload_standards_lookup
            ON workload_standards(versionId, businessCategory, workType, productSystem, subtask, enabled);
        `);
      }
    }
  },
  {
    version: 2026071302,
    name: "snapshot record provenance",
    up(database) {
      const columns = new Set(database.prepare("PRAGMA table_info(records)").all()
        .map((item) => String((item as { name: unknown }).name)));
      const additions = [
        ["workloadUnit", "TEXT NOT NULL DEFAULT ''"],
        ["coefficientSource", "TEXT NOT NULL DEFAULT 'none'"],
        ["coefficientStandardId", "TEXT DEFAULT NULL"],
        ["coefficientStandardVersionId", "TEXT DEFAULT NULL"],
        ["workloadFormulaVersion", "TEXT NOT NULL DEFAULT 'quantity_x_coefficient_v1'"]
      ];
      for (const [name, definition] of additions) {
        if (!columns.has(name)) database.exec(`ALTER TABLE records ADD COLUMN ${name} ${definition}`);
      }
      database.exec(`UPDATE records SET coefficientSource = CASE WHEN coefficient IS NULL THEN 'none' ELSE 'legacy' END
        WHERE coefficientSource = 'none'`);
    }
  }
];

runMigrations(db, foundationMigrations);

const recordColumnDefinitions = [
  { name: "businessCategory", definition: "TEXT NOT NULL DEFAULT '其他'" },
  { name: "workType", definition: "TEXT NOT NULL DEFAULT '其他项'" },
  { name: "abilityDimension", definition: "TEXT NOT NULL DEFAULT ''" },
  { name: "projectName", definition: "TEXT NOT NULL DEFAULT ''" },
  { name: "productSystem", definition: "TEXT NOT NULL DEFAULT ''" },
  { name: "subtask", definition: "TEXT NOT NULL DEFAULT ''" },
  { name: "quantity", definition: "REAL DEFAULT NULL" },
  { name: "coefficient", definition: "REAL DEFAULT NULL" },
  { name: "workload", definition: "REAL DEFAULT NULL" },
  { name: "timeHours", definition: "REAL DEFAULT NULL" }
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

  `);
}

ensureRecordColumns();

function backfillLegacyAbilityAllocations(): void {
  const rows = db.prepare("SELECT id, abilityDimension FROM records").all() as Array<{ id: string; abilityDimension: string }>;
  rows.forEach((row) => {
    const count = Number((db.prepare("SELECT COUNT(*) AS count FROM record_ability_allocations WHERE recordId = ?").get(row.id) as { count: number }).count);
    if (count === 0) replaceAbilityAllocations(row.id, normalizeAbilityAllocations(undefined, row.abilityDimension));
  });
}

backfillLegacyAbilityAllocations();

const selectSql = `
  SELECT
    id,
    date,
    title,
    content,
    category,
    businessCategory,
    workType,
    abilityDimension,
    projectName,
    productSystem,
    subtask,
    quantity,
    coefficient,
    workload,
    timeHours,
    tags,
    workloadUnit,
    coefficientSource,
    coefficientStandardId,
    coefficientStandardVersionId,
    workloadFormulaVersion,
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
  abilityDimension: [
    "新业务探索",
    "工程技术",
    "售前支撑",
    "项目管理与推进",
    "AI与提效工具",
    "客户交流",
    "知识沉淀"
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
  abilityDimension: "工程技术",
  productSystem: "其他",
  subtask: "其他"
};

const defaultAppSettings: AppSettings = {
  focusScoreWeights: {
    workload: 50,
    timeHours: 30,
    recordCount: 20
  },
  warningRules: {
    abilityNoRecordDays: 30,
    targetShareDeviationPercent: 10
  },
  abilityTargets: {}
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

function normalizeOptionalNonNegativeNumber(input: unknown): number | null {
  const value = normalizeNumber(input);
  if (value === null || value < 0) return null;
  return value;
}

function normalizeRequiredNumber(input: unknown, fallback = 0): number {
  const value = normalizeNumber(input);
  return value === null ? fallback : value;
}

function normalizeNonNegativeNumber(input: unknown, fallback = 0): number {
  return Math.max(0, normalizeRequiredNumber(input, fallback));
}

function normalizeAppSettings(input?: AppSettingsInput, base: AppSettings = defaultAppSettings): AppSettings {
  const focusScoreWeights = {
    workload: normalizeNonNegativeNumber(input?.focusScoreWeights?.workload, base.focusScoreWeights.workload),
    timeHours: normalizeNonNegativeNumber(input?.focusScoreWeights?.timeHours, base.focusScoreWeights.timeHours),
    recordCount: normalizeNonNegativeNumber(input?.focusScoreWeights?.recordCount, base.focusScoreWeights.recordCount)
  };
  const warningRules = {
    abilityNoRecordDays: Math.max(
      1,
      normalizeRequiredNumber(input?.warningRules?.abilityNoRecordDays, base.warningRules.abilityNoRecordDays)
    ),
    targetShareDeviationPercent: Math.max(
      0,
      normalizeRequiredNumber(
        input?.warningRules?.targetShareDeviationPercent,
        base.warningRules.targetShareDeviationPercent
      )
    )
  };
  const abilityTargets = Object.entries(input?.abilityTargets ?? base.abilityTargets).reduce<Record<string, number>>(
    (targets, [label, value]) => {
      const normalizedLabel = normalizeText(label);
      const target = normalizeNumber(value);
      if (normalizedLabel && target !== null && target > 0) targets[normalizedLabel] = target;
      return targets;
    },
    {}
  );

  return {
    focusScoreWeights,
    warningRules,
    abilityTargets
  };
}

function seedAppSettings(): void {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("appSettings");
  if (row) return;

  db.prepare("INSERT INTO app_settings (key, value, updateTime) VALUES (?, ?, ?)").run(
    "appSettings",
    JSON.stringify(defaultAppSettings),
    Date.now()
  );
}

seedAppSettings();

function normalizeWorkload(quantity: number | null, coefficient: number | null, explicit: unknown): number | null {
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
    versionId: unknown;
    businessCategory: unknown;
    workType: unknown;
    productSystem: unknown;
    subtask: unknown;
    unit: unknown;
    coefficient: unknown;
    remark: unknown;
    enabled: unknown;
    createTime: unknown;
    updateTime: unknown;
  };

  return {
    id: String(standard.id),
    versionId: String(standard.versionId || "legacy-standard-version"),
    businessCategory: String(standard.businessCategory || ""),
    workType: String(standard.workType || ""),
    productSystem: String(standard.productSystem || ""),
    subtask: String(standard.subtask || ""),
    unit: String(standard.unit || ""),
    coefficient: Number(standard.coefficient),
    remark: String(standard.remark || ""),
    enabled: Boolean(standard.enabled),
    createTime: Number(standard.createTime),
    updateTime: Number(standard.updateTime)
  };
}

function normalizeKnowledgeStatus(input: unknown): KnowledgeAssetStatus {
  const status = String(input || "draft");
  if (status === "published" || status === "archived") return status;
  return "draft";
}

function toMilestone(row: unknown): Milestone {
  const milestone = row as {
    id: unknown;
    name: unknown;
    description: unknown;
    category: unknown;
    targetType: unknown;
    targetValue: unknown;
    currentValue: unknown;
    deadline: unknown;
    enabled: unknown;
    sortOrder: unknown;
    createTime: unknown;
    updateTime: unknown;
  };

  return {
    id: String(milestone.id),
    name: String(milestone.name || ""),
    description: String(milestone.description || ""),
    category: String(milestone.category || ""),
    targetType: String(milestone.targetType || ""),
    targetValue: normalizeNonNegativeNumber(milestone.targetValue),
    currentValue: normalizeNonNegativeNumber(milestone.currentValue),
    deadline: String(milestone.deadline || ""),
    enabled: Boolean(milestone.enabled),
    sortOrder: Number(milestone.sortOrder || 0),
    createTime: Number(milestone.createTime),
    updateTime: Number(milestone.updateTime)
  };
}

function toKnowledgeAsset(row: unknown): KnowledgeAsset {
  const asset = row as {
    id: unknown;
    type: unknown;
    title: unknown;
    summary: unknown;
    sourceRecordId: unknown;
    projectName: unknown;
    productSystem: unknown;
    tags: unknown;
    status: unknown;
    link: unknown;
    remark: unknown;
    createTime: unknown;
    updateTime: unknown;
  };

  return {
    id: String(asset.id),
    type: String(asset.type || ""),
    title: String(asset.title || ""),
    summary: String(asset.summary || ""),
    sourceRecordId: String(asset.sourceRecordId || ""),
    projectName: String(asset.projectName || ""),
    productSystem: String(asset.productSystem || ""),
    tags: String(asset.tags || ""),
    status: normalizeKnowledgeStatus(asset.status),
    link: String(asset.link || ""),
    remark: String(asset.remark || ""),
    createTime: Number(asset.createTime),
    updateTime: Number(asset.updateTime)
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

export function deleteConfigOption(id: string): boolean {
  const result = db.prepare("DELETE FROM config_options WHERE id = ?").run(id);
  return result.changes > 0;
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

function toWorkloadStandardVersion(row: unknown): WorkloadStandardVersion {
  const version = row as Record<string, unknown>;
  return {
    id: String(version.id),
    name: String(version.name),
    year: version.year === null || version.year === undefined ? null : Number(version.year),
    status: String(version.status) as WorkloadStandardVersionStatus,
    sourceType: String(version.sourceType) as WorkloadStandardVersion["sourceType"],
    sourceName: String(version.sourceName || ""),
    createTime: Number(version.createTime),
    updateTime: Number(version.updateTime)
  };
}

export function listWorkloadStandardVersions(): WorkloadStandardVersion[] {
  return db.prepare("SELECT * FROM workload_standard_versions ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, year DESC, createTime DESC")
    .all().map(toWorkloadStandardVersion);
}

export function getWorkloadStandardVersion(id: string): WorkloadStandardVersion | null {
  const row = db.prepare("SELECT * FROM workload_standard_versions WHERE id = ?").get(id);
  return row ? toWorkloadStandardVersion(row) : null;
}

export function getActiveWorkloadStandardVersion(): WorkloadStandardVersion | null {
  const row = db.prepare("SELECT * FROM workload_standard_versions WHERE status = 'active' LIMIT 1").get();
  return row ? toWorkloadStandardVersion(row) : null;
}

export function insertWorkloadStandardVersion(input: WorkloadStandardVersionInput): WorkloadStandardVersion {
  const now = Date.now();
  const id = createId();
  db.prepare(`INSERT INTO workload_standard_versions (id, name, year, status, sourceType, sourceName, createTime, updateTime)
    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`)
    .run(id, normalizeText(input.name), input.year ?? null, input.sourceType ?? "manual", normalizeText(input.sourceName), now, now);
  return getWorkloadStandardVersion(id) as WorkloadStandardVersion;
}

export function activateWorkloadStandardVersion(id: string): WorkloadStandardVersion | null {
  if (!getWorkloadStandardVersion(id)) return null;
  db.exec("BEGIN IMMEDIATE");
  try {
    const now = Date.now();
    db.prepare("UPDATE workload_standard_versions SET status = 'retired', updateTime = ? WHERE status = 'active' AND id != ?").run(now, id);
    db.prepare("UPDATE workload_standard_versions SET status = 'active', updateTime = ? WHERE id = ?").run(now, id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getWorkloadStandardVersion(id);
}

function findWorkloadStandardByKey(
  versionId: string,
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
           WHERE versionId = ? AND businessCategory = ? AND workType = ? AND productSystem = ? AND subtask = ? AND id != ?`
        )
        .get(versionId, businessCategory, workType, productSystem, subtask, excludeId)
    : db
        .prepare(
          `SELECT * FROM workload_standards
           WHERE versionId = ? AND businessCategory = ? AND workType = ? AND productSystem = ? AND subtask = ?`
        )
        .get(versionId, businessCategory, workType, productSystem, subtask);

  return row ? toWorkloadStandard(row) : null;
}

export function listWorkloadStandards(versionId = getActiveWorkloadStandardVersion()?.id): WorkloadStandard[] {
  if (!versionId) return [];
  return db
    .prepare(
      `SELECT * FROM workload_standards
       WHERE versionId = ?
       ORDER BY enabled DESC, businessCategory ASC, workType ASC, productSystem ASC, subtask ASC, createTime ASC`
    )
    .all(versionId)
    .map(toWorkloadStandard);
}

export function getWorkloadStandard(id: string): WorkloadStandard | null {
  const row = db.prepare("SELECT * FROM workload_standards WHERE id = ?").get(id);
  return row ? toWorkloadStandard(row) : null;
}

export function insertWorkloadStandard(input: WorkloadStandardInput): WorkloadStandard {
  const versionId = input.versionId ?? getActiveWorkloadStandardVersion()?.id;
  const businessCategory = normalizeText(input.businessCategory);
  const workType = normalizeText(input.workType);
  const productSystem = normalizeText(input.productSystem);
  const subtask = normalizeText(input.subtask);
  const coefficient = normalizeNumber(input.coefficient);

  if (!versionId || !getWorkloadStandardVersion(versionId)) throw new Error("WORKLOAD_STANDARD_VERSION_NOT_FOUND");
  if (!businessCategory || !workType || coefficient === null) {
    throw new Error("WORKLOAD_STANDARD_INVALID");
  }

  if (findWorkloadStandardByKey(versionId, businessCategory, workType, productSystem, subtask)) {
    throw new Error("WORKLOAD_STANDARD_DUPLICATE");
  }

  const now = Date.now();
  const id = createId();

  db.prepare(
    `INSERT INTO workload_standards (
       id,
       versionId,
       businessCategory,
       workType,
       productSystem,
       subtask,
       unit,
       coefficient,
       remark,
       enabled,
       createTime,
       updateTime
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    versionId,
    businessCategory,
    workType,
    productSystem,
    subtask,
    normalizeText(input.unit),
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

  if (findWorkloadStandardByKey(existing.versionId, businessCategory, workType, productSystem, subtask, id)) {
    throw new Error("WORKLOAD_STANDARD_DUPLICATE");
  }

  db.prepare(
    `UPDATE workload_standards
     SET businessCategory = ?,
         workType = ?,
         productSystem = ?,
         subtask = ?,
         unit = ?,
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
    input.unit === undefined ? existing.unit : normalizeText(input.unit),
    coefficient,
    input.remark === undefined ? existing.remark : normalizeText(input.remark),
    (input.enabled ?? existing.enabled) ? 1 : 0,
    Date.now(),
    id
  );

  return getWorkloadStandard(id);
}

export function deleteWorkloadStandard(id: string): boolean {
  const referenced = Number((db.prepare("SELECT COUNT(*) AS count FROM records WHERE coefficientStandardId = ?").get(id) as { count: number }).count);
  if (referenced > 0) throw new Error("WORKLOAD_STANDARD_IN_USE");
  const result = db.prepare("DELETE FROM workload_standards WHERE id = ?").run(id);
  return result.changes > 0;
}

export interface WorkloadStandardImportRow {
  businessCategory: string;
  workType: string;
  productSystem?: string;
  subtask?: string;
  unit?: string;
  coefficient: number;
  remark?: string;
}

type ImportStatus = "new" | "duplicate" | "conflict" | "invalid";

function normalizeImportRow(input: WorkloadStandardImportRow) {
  const row = {
    businessCategory: normalizeText(input.businessCategory),
    workType: normalizeText(input.workType),
    productSystem: normalizeText(input.productSystem),
    subtask: normalizeText(input.subtask),
    unit: normalizeText(input.unit),
    coefficient: normalizeNumber(input.coefficient),
    remark: normalizeText(input.remark)
  };
  return row;
}

export function previewWorkloadStandardImport(rows: WorkloadStandardImportRow[]) {
  const version = getActiveWorkloadStandardVersion();
  return {
    baseVersionId: version?.id ?? null,
    rows: rows.map((input, index) => {
      const row = normalizeImportRow(input);
      let status: ImportStatus = "invalid";
      if (row.businessCategory && row.workType && row.coefficient !== null && row.coefficient >= 0) {
        const existing = version ? findWorkloadStandardByKey(version.id, row.businessCategory, row.workType, row.productSystem, row.subtask) : null;
        status = !existing ? "new" : existing.coefficient === row.coefficient && existing.unit === row.unit && existing.remark === row.remark ? "duplicate" : "conflict";
      }
      return { rowNumber: index + 1, status, ...row, coefficient: row.coefficient };
    })
  };
}

export function confirmWorkloadStandardImport(input: {
  name: string;
  year?: number | null;
  sourceName?: string;
  rows: WorkloadStandardImportRow[];
  conflictResolutions?: Record<string, "keep_system" | "use_imported">;
}): WorkloadStandardVersion {
  const preview = previewWorkloadStandardImport(input.rows);
  if (preview.rows.some((row) => row.status === "invalid")) throw new Error("WORKLOAD_STANDARD_IMPORT_INVALID");
  if (preview.rows.some((row) => row.status === "conflict" && !input.conflictResolutions?.[String(row.rowNumber)])) {
    throw new Error("WORKLOAD_STANDARD_IMPORT_CONFLICT_UNRESOLVED");
  }
  const active = getActiveWorkloadStandardVersion();
  db.exec("BEGIN IMMEDIATE");
  try {
    const version = insertWorkloadStandardVersion({ name: input.name, year: input.year, sourceType: "excel", sourceName: input.sourceName });
    if (active) {
      for (const standard of listWorkloadStandards(active.id)) {
        insertWorkloadStandard({ ...standard, versionId: version.id });
      }
    }
    for (const row of preview.rows) {
      if (row.status === "duplicate") continue;
      const existing = findWorkloadStandardByKey(version.id, row.businessCategory, row.workType, row.productSystem, row.subtask);
      if (existing && input.conflictResolutions?.[String(row.rowNumber)] === "keep_system") continue;
      if (existing) {
        updateWorkloadStandard(existing.id, { coefficient: row.coefficient as number, unit: row.unit, remark: row.remark });
      } else {
        insertWorkloadStandard({ versionId: version.id, businessCategory: row.businessCategory, workType: row.workType, productSystem: row.productSystem, subtask: row.subtask, unit: row.unit, coefficient: row.coefficient as number, remark: row.remark });
      }
    }
    db.exec("COMMIT");
    return getWorkloadStandardVersion(version.id) as WorkloadStandardVersion;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function matchWorkloadStandard(input: {
  versionId?: string;
  businessCategory?: string;
  workType?: string;
  productSystem?: string;
  subtask?: string;
}): WorkloadStandardMatch | null {
  const businessCategory = normalizeText(input.businessCategory);
  const workType = normalizeText(input.workType);
  const productSystem = normalizeText(input.productSystem);
  const subtask = normalizeText(input.subtask);

  const version = input.versionId ? getWorkloadStandardVersion(input.versionId) : getActiveWorkloadStandardVersion();
  if (!businessCategory || !workType || !version) return null;

  const rows = db
    .prepare(
      `SELECT * FROM workload_standards
       WHERE versionId = ? AND enabled = 1
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
    .all(version.id, businessCategory, workType, productSystem, subtask, productSystem, subtask);

  if (!rows[0]) return null;
  const standard = toWorkloadStandard(rows[0]);
  return {
    standard,
    version,
    matchLevel: standard.productSystem === productSystem && standard.subtask === subtask && standard.productSystem !== "" && standard.subtask !== "" ? "exact" : "general"
  };
}

export function getAppSettings(): AppSettings {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("appSettings") as
    | { value: string }
    | undefined;

  if (!row) return defaultAppSettings;

  try {
    const parsed = JSON.parse(row.value) as AppSettingsInput;
    return normalizeAppSettings(parsed, defaultAppSettings);
  } catch {
    return defaultAppSettings;
  }
}

export function updateAppSettings(input: AppSettingsInput): AppSettings {
  const current = getAppSettings();
  const next = normalizeAppSettings(input, current);

  db.prepare(
    `INSERT INTO app_settings (key, value, updateTime)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updateTime = excluded.updateTime`
  ).run("appSettings", JSON.stringify(next), Date.now());

  return getAppSettings();
}

function getNextMilestoneSortOrder(): number {
  const result = db.prepare("SELECT MAX(sortOrder) AS maxSortOrder FROM milestones").get() as {
    maxSortOrder: number | null;
  };

  return Number(result.maxSortOrder || 0) + 10;
}

export function listMilestones(): Milestone[] {
  return db
    .prepare("SELECT * FROM milestones ORDER BY enabled DESC, sortOrder ASC, createTime ASC")
    .all()
    .map(toMilestone);
}

export function getMilestone(id: string): Milestone | null {
  const row = db.prepare("SELECT * FROM milestones WHERE id = ?").get(id);
  return row ? toMilestone(row) : null;
}

export function insertMilestone(input: MilestoneInput): Milestone {
  const name = normalizeText(input.name);
  if (!name) throw new Error("MILESTONE_INVALID");

  const now = Date.now();
  const id = createId();

  db.prepare(
    `INSERT INTO milestones (
       id,
       name,
       description,
       category,
       targetType,
       targetValue,
       currentValue,
       deadline,
       enabled,
       sortOrder,
       createTime,
       updateTime
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    normalizeText(input.description),
    normalizeText(input.category) || "成长目标",
    normalizeText(input.targetType) || "工作当量",
    normalizeNonNegativeNumber(input.targetValue),
    normalizeNonNegativeNumber(input.currentValue),
    normalizeText(input.deadline),
    input.enabled === false ? 0 : 1,
    input.sortOrder ?? getNextMilestoneSortOrder(),
    now,
    now
  );

  return getMilestone(id) as Milestone;
}

export function updateMilestone(id: string, input: MilestoneUpdateInput): Milestone | null {
  const existing = getMilestone(id);
  if (!existing) return null;

  const name = input.name === undefined ? existing.name : normalizeText(input.name);
  if (!name) throw new Error("MILESTONE_INVALID");

  db.prepare(
    `UPDATE milestones
     SET name = ?,
         description = ?,
         category = ?,
         targetType = ?,
         targetValue = ?,
         currentValue = ?,
         deadline = ?,
         enabled = ?,
         sortOrder = ?,
         updateTime = ?
     WHERE id = ?`
  ).run(
    name,
    input.description === undefined ? existing.description : normalizeText(input.description),
    input.category === undefined ? existing.category : normalizeText(input.category),
    input.targetType === undefined ? existing.targetType : normalizeText(input.targetType),
    input.targetValue === undefined ? existing.targetValue : normalizeNonNegativeNumber(input.targetValue),
    input.currentValue === undefined ? existing.currentValue : normalizeNonNegativeNumber(input.currentValue),
    input.deadline === undefined ? existing.deadline : normalizeText(input.deadline),
    (input.enabled ?? existing.enabled) ? 1 : 0,
    input.sortOrder ?? existing.sortOrder,
    Date.now(),
    id
  );

  return getMilestone(id);
}

export function listKnowledgeAssets(): KnowledgeAsset[] {
  return db
    .prepare("SELECT * FROM knowledge_assets ORDER BY updateTime DESC, createTime DESC")
    .all()
    .map(toKnowledgeAsset);
}

export function getKnowledgeAsset(id: string): KnowledgeAsset | null {
  const row = db.prepare("SELECT * FROM knowledge_assets WHERE id = ?").get(id);
  return row ? toKnowledgeAsset(row) : null;
}

export function insertKnowledgeAsset(input: KnowledgeAssetInput): KnowledgeAsset {
  const title = normalizeText(input.title);
  if (!title) throw new Error("KNOWLEDGE_ASSET_INVALID");

  const now = Date.now();
  const id = createId();

  db.prepare(
    `INSERT INTO knowledge_assets (
       id,
       type,
       title,
       summary,
       sourceRecordId,
       projectName,
       productSystem,
       tags,
       status,
       link,
       remark,
       createTime,
       updateTime
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    normalizeText(input.type) || "复盘",
    title,
    normalizeText(input.summary),
    normalizeText(input.sourceRecordId),
    normalizeText(input.projectName),
    normalizeText(input.productSystem),
    normalizeTags(input.tags || ""),
    normalizeKnowledgeStatus(input.status),
    normalizeText(input.link),
    normalizeText(input.remark),
    now,
    now
  );

  return getKnowledgeAsset(id) as KnowledgeAsset;
}

export function updateKnowledgeAsset(id: string, input: KnowledgeAssetUpdateInput): KnowledgeAsset | null {
  const existing = getKnowledgeAsset(id);
  if (!existing) return null;

  const title = input.title === undefined ? existing.title : normalizeText(input.title);
  if (!title) throw new Error("KNOWLEDGE_ASSET_INVALID");

  db.prepare(
    `UPDATE knowledge_assets
     SET type = ?,
         title = ?,
         summary = ?,
         sourceRecordId = ?,
         projectName = ?,
         productSystem = ?,
         tags = ?,
         status = ?,
         link = ?,
         remark = ?,
         updateTime = ?
     WHERE id = ?`
  ).run(
    input.type === undefined ? existing.type : normalizeText(input.type),
    title,
    input.summary === undefined ? existing.summary : normalizeText(input.summary),
    input.sourceRecordId === undefined ? existing.sourceRecordId : normalizeText(input.sourceRecordId),
    input.projectName === undefined ? existing.projectName : normalizeText(input.projectName),
    input.productSystem === undefined ? existing.productSystem : normalizeText(input.productSystem),
    input.tags === undefined ? existing.tags : normalizeTags(input.tags || ""),
    input.status === undefined ? existing.status : normalizeKnowledgeStatus(input.status),
    input.link === undefined ? existing.link : normalizeText(input.link),
    input.remark === undefined ? existing.remark : normalizeText(input.remark),
    Date.now(),
    id
  );

  return getKnowledgeAsset(id);
}

function splitAbilityNames(value: string): string[] {
  return Array.from(new Set(value.split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean)));
}

function normalizeAbilityAllocations(
  input: AbilityAllocationInput[] | undefined,
  legacyAbilityDimension: string
): Array<Pick<AbilityAllocation, "abilityId" | "abilityName" | "percentage">> {
  if (input?.length) {
    const allocations = input.map((item) => ({
      abilityId: normalizeText(item.abilityId),
      abilityName: normalizeText(item.abilityName),
      percentage: normalizeNumber(item.percentage)
    }));
    const total = allocations.reduce((sum, item) => sum + (item.percentage ?? 0), 0);
    if (allocations.some((item) => !item.abilityId || !item.abilityName || item.percentage === null || item.percentage < 0) || Math.abs(total - 100) > 0.000001) {
      throw new Error("ABILITY_ALLOCATION_INVALID");
    }
    return allocations as Array<Pick<AbilityAllocation, "abilityId" | "abilityName" | "percentage">>;
  }
  const names = splitAbilityNames(legacyAbilityDimension);
  return names.map((abilityName, index) => ({
    abilityId: `legacy:${encodeURIComponent(abilityName)}`,
    abilityName,
    percentage: index === names.length - 1 ? 100 - (100 / names.length) * index : 100 / names.length
  }));
}

function getAbilityAllocations(record: Pick<WorkRecord, "id" | "timeHours" | "workload">): AbilityAllocation[] {
  return db.prepare("SELECT abilityId, abilityName, percentage FROM record_ability_allocations WHERE recordId = ? ORDER BY abilityName ASC")
    .all(record.id).map((row) => {
      const item = row as { abilityId: unknown; abilityName: unknown; percentage: unknown };
      const percentage = Number(item.percentage);
      return {
        abilityId: String(item.abilityId),
        abilityName: String(item.abilityName),
        percentage,
        allocatedTimeHours: record.timeHours === null ? null : Number((record.timeHours * percentage / 100).toFixed(4)),
        allocatedWorkload: record.workload === null ? null : Number((record.workload * percentage / 100).toFixed(4))
      };
    });
}

function replaceAbilityAllocations(recordId: string, allocations: Array<Pick<AbilityAllocation, "abilityId" | "abilityName" | "percentage">>): void {
  db.prepare("DELETE FROM record_ability_allocations WHERE recordId = ?").run(recordId);
  const statement = db.prepare("INSERT INTO record_ability_allocations (recordId, abilityId, abilityName, percentage) VALUES (?, ?, ?, ?)");
  allocations.forEach((allocation) => statement.run(recordId, allocation.abilityId, allocation.abilityName, allocation.percentage));
}

function toRecord(row: unknown): WorkRecord {
  const record = row as WorkRecord;
  const base = {
    id: String(record.id),
    date: String(record.date),
    title: String(record.title),
    content: String(record.content || ""),
    category: String(record.category || "其他"),
    businessCategory: String(record.businessCategory || "其他"),
    workType: String(record.workType || "其他项"),
    abilityDimension: String(record.abilityDimension || ""),
    projectName: String(record.projectName || ""),
    productSystem: String(record.productSystem || ""),
    subtask: String(record.subtask || ""),
    quantity: normalizeOptionalNonNegativeNumber(record.quantity),
    coefficient: normalizeOptionalNonNegativeNumber(record.coefficient),
    workload: normalizeOptionalNonNegativeNumber(record.workload),
    timeHours: normalizeOptionalNonNegativeNumber(record.timeHours),
    tags: String(record.tags || ""),
    workloadUnit: String(record.workloadUnit || ""),
    coefficientSource: String(record.coefficientSource || "none") as CoefficientSource,
    coefficientStandardId: record.coefficientStandardId === null ? null : String(record.coefficientStandardId || "") || null,
    coefficientStandardVersionId: record.coefficientStandardVersionId === null ? null : String(record.coefficientStandardVersionId || "") || null,
    workloadFormulaVersion: "quantity_x_coefficient_v1" as const,
    createTime: Number(record.createTime),
    updateTime: Number(record.updateTime)
  };
  return { ...base, abilityAllocations: getAbilityAllocations(base) };
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
  const quantity = normalizeOptionalNonNegativeNumber(input.quantity);
  const standard = input.coefficientStandardId ? getWorkloadStandard(input.coefficientStandardId) : null;
  if (input.coefficientStandardId && (!standard || !standard.enabled)) throw new Error("WORKLOAD_STANDARD_MISMATCH");
  const coefficient = standard ? standard.coefficient : normalizeOptionalNonNegativeNumber(input.coefficient);
  if (standard && input.coefficient !== undefined && input.coefficient !== null && Number(input.coefficient) !== standard.coefficient) {
    throw new Error("WORKLOAD_STANDARD_MISMATCH");
  }
  const allocations = normalizeAbilityAllocations(input.abilityAllocations, normalizeText(input.abilityDimension));
  const record: WorkRecord = {
    id: createId(),
    date: input.date,
    title: input.title.trim() || "无标题",
    content: input.content.trim(),
    category: input.category || "其他",
    businessCategory: inferBusinessCategory(input),
    workType: inferWorkType(input),
    abilityDimension: allocations.map((item) => item.abilityName).join(","),
    projectName: normalizeText(input.projectName),
    productSystem: normalizeText(input.productSystem),
    subtask: normalizeText(input.subtask),
    quantity,
    coefficient,
    workload: normalizeWorkload(quantity, coefficient, input.workload),
    timeHours: normalizeOptionalNonNegativeNumber(input.timeHours),
    tags: normalizeTags(input.tags || ""),
    workloadUnit: standard?.unit ?? normalizeText(input.workloadUnit),
    coefficientSource: standard ? (standard.productSystem === normalizeText(input.productSystem) && standard.subtask === normalizeText(input.subtask) && standard.productSystem !== "" && standard.subtask !== "" ? "standard_exact" : "standard_general") : coefficient === null ? "none" : "manual",
    coefficientStandardId: standard?.id ?? null,
    coefficientStandardVersionId: standard?.versionId ?? null,
    workloadFormulaVersion: "quantity_x_coefficient_v1",
    abilityAllocations: [],
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
       abilityDimension,
       projectName,
       productSystem,
       subtask,
       quantity,
       coefficient,
       workload,
       timeHours,
       tags,
       workloadUnit, coefficientSource, coefficientStandardId, coefficientStandardVersionId, workloadFormulaVersion,
       createTime,
       updateTime
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.date,
    record.title,
    record.content,
    record.category,
    record.businessCategory,
    record.workType,
    record.abilityDimension,
    record.projectName,
    record.productSystem,
    record.subtask,
    record.quantity,
    record.coefficient,
    record.workload,
    record.timeHours,
    record.tags,
    record.workloadUnit, record.coefficientSource, record.coefficientStandardId, record.coefficientStandardVersionId, record.workloadFormulaVersion,
    record.createTime,
    record.updateTime
  );

  replaceAbilityAllocations(record.id, allocations);
  return getRecord(record.id) as WorkRecord;
}

export function updateRecord(id: string, input: RecordInput): WorkRecord | null {
  const existing = getRecord(id);
  if (!existing) return null;

  const quantity =
    input.quantity === undefined ? existing.quantity : normalizeOptionalNonNegativeNumber(input.quantity);
  const coefficient =
    input.coefficient === undefined ? existing.coefficient : normalizeOptionalNonNegativeNumber(input.coefficient);
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
    abilityDimension:
      input.abilityDimension === undefined ? existing.abilityDimension : normalizeText(input.abilityDimension),
    projectName: input.projectName === undefined ? existing.projectName : normalizeText(input.projectName),
    productSystem: input.productSystem === undefined ? existing.productSystem : normalizeText(input.productSystem),
    subtask: input.subtask === undefined ? existing.subtask : normalizeText(input.subtask),
    quantity,
    coefficient,
    workload: shouldRecalculateWorkload ? normalizeWorkload(quantity, coefficient, input.workload) : existing.workload,
    timeHours:
      input.timeHours === undefined ? existing.timeHours : normalizeOptionalNonNegativeNumber(input.timeHours),
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
       abilityDimension = ?,
       projectName = ?,
       productSystem = ?,
       subtask = ?,
       quantity = ?,
       coefficient = ?,
       workload = ?,
       timeHours = ?,
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
    next.abilityDimension,
    next.projectName,
    next.productSystem,
    next.subtask,
    next.quantity,
    next.coefficient,
    next.workload,
    next.timeHours,
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
