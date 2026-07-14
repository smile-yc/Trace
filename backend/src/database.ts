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
  Outcome,
  OutcomeAbility,
  OutcomeInput,
  OutcomeStatus,
  OutcomeSummary,
  OutcomeType,
  OutcomeUpdateInput,
  Project,
  ProjectInput,
  ProjectMergePreview,
  ProjectRelation,
  ProjectSummary,
  ProjectStatus,
  ProjectUpdateInput,
  RecordDeleteImpact,
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
  },
  {
    version: 2026071401,
    name: "materialize projects",
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          normalizedName TEXT NOT NULL UNIQUE,
          shortName TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL CHECK(status IN ('planned', 'active', 'paused', 'completed', 'archived')),
          startDate TEXT NOT NULL DEFAULT '',
          endDate TEXT NOT NULL DEFAULT '',
          personalRole TEXT NOT NULL DEFAULT '',
          goal TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          completionSummary TEXT NOT NULL DEFAULT '',
          mergedIntoProjectId TEXT DEFAULT NULL,
          archiveTime INTEGER DEFAULT NULL,
          createTime INTEGER NOT NULL,
          updateTime INTEGER NOT NULL,
          FOREIGN KEY(mergedIntoProjectId) REFERENCES projects(id) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS project_aliases (
          id TEXT PRIMARY KEY,
          projectId TEXT NOT NULL,
          alias TEXT NOT NULL,
          normalizedAlias TEXT NOT NULL UNIQUE,
          createTime INTEGER NOT NULL,
          FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status, updateTime);
        CREATE INDEX IF NOT EXISTS idx_project_aliases_project ON project_aliases(projectId);
      `);

      const columns = new Set(database.prepare("PRAGMA table_info(records)").all()
        .map((row) => String((row as { name: unknown }).name)));
      if (!columns.has("projectId")) {
        database.exec("ALTER TABLE records ADD COLUMN projectId TEXT DEFAULT NULL REFERENCES projects(id) ON DELETE RESTRICT");
      }
      if (!columns.has("projectRelation")) {
        database.exec("ALTER TABLE records ADD COLUMN projectRelation TEXT NOT NULL DEFAULT 'unassigned' CHECK(projectRelation IN ('project', 'non_project', 'unassigned'))");
      }

      const names = database.prepare(
        "SELECT DISTINCT trim(projectName) AS name FROM records WHERE trim(projectName) <> ''"
      ).all() as Array<{ name: string }>;
      const now = Date.now();
      for (const row of names) {
        const normalizedName = row.name.trim();
        database.prepare(`INSERT OR IGNORE INTO projects
          (id, name, normalizedName, status, createTime, updateTime)
          VALUES (?, ?, ?, 'active', ?, ?)`)
          .run(createId(), row.name, normalizedName, now, now);
      }

      database.exec(`
        UPDATE records
        SET projectId = (SELECT id FROM projects WHERE normalizedName = trim(records.projectName)),
            projectRelation = 'project'
        WHERE trim(projectName) <> '';

        UPDATE records
        SET projectId = NULL,
            projectRelation = 'unassigned'
        WHERE trim(projectName) = '';
      `);
    }
  },
  {
    version: 2026071402,
    name: "unify work outcomes",
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS outcomes (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK(type IN ('deliverable', 'problem_resolution', 'stage_progress', 'reusable_asset')),
          status TEXT NOT NULL CHECK(status IN ('planned', 'in_progress', 'stage_result', 'completed')),
          title TEXT NOT NULL,
          projectId TEXT DEFAULT NULL,
          projectName TEXT NOT NULL DEFAULT '',
          startDate TEXT NOT NULL DEFAULT '',
          updateDate TEXT NOT NULL DEFAULT '',
          completedDate TEXT NOT NULL DEFAULT '',
          backgroundGoal TEXT NOT NULL DEFAULT '',
          completedWork TEXT NOT NULL DEFAULT '',
          valueImpact TEXT NOT NULL DEFAULT '',
          personalRole TEXT NOT NULL DEFAULT '',
          contribution TEXT NOT NULL DEFAULT '',
          reportSummary TEXT NOT NULL DEFAULT '',
          productSystem TEXT NOT NULL DEFAULT '',
          tags TEXT NOT NULL DEFAULT '',
          remark TEXT NOT NULL DEFAULT '',
          archived INTEGER NOT NULL DEFAULT 0,
          archiveTime INTEGER DEFAULT NULL,
          createTime INTEGER NOT NULL,
          updateTime INTEGER NOT NULL,
          FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS outcome_records (
          outcomeId TEXT NOT NULL,
          recordId TEXT NOT NULL,
          PRIMARY KEY (outcomeId, recordId),
          FOREIGN KEY(outcomeId) REFERENCES outcomes(id) ON DELETE CASCADE,
          FOREIGN KEY(recordId) REFERENCES records(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS outcome_abilities (
          outcomeId TEXT NOT NULL,
          abilityId TEXT NOT NULL,
          abilityName TEXT NOT NULL,
          PRIMARY KEY (outcomeId, abilityId),
          FOREIGN KEY(outcomeId) REFERENCES outcomes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS outcome_milestones (
          outcomeId TEXT NOT NULL,
          milestoneId TEXT NOT NULL,
          PRIMARY KEY (outcomeId, milestoneId),
          FOREIGN KEY(outcomeId) REFERENCES outcomes(id) ON DELETE CASCADE,
          FOREIGN KEY(milestoneId) REFERENCES milestones(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS outcome_status_history (
          id TEXT PRIMARY KEY,
          outcomeId TEXT NOT NULL,
          fromStatus TEXT DEFAULT NULL,
          toStatus TEXT NOT NULL CHECK(toStatus IN ('planned', 'in_progress', 'stage_result', 'completed')),
          note TEXT NOT NULL DEFAULT '',
          changedTime INTEGER NOT NULL,
          FOREIGN KEY(outcomeId) REFERENCES outcomes(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_outcomes_project ON outcomes(projectId, archived, updateTime);
        CREATE INDEX IF NOT EXISTS idx_outcomes_filter ON outcomes(type, status, archived, updateTime);
        CREATE INDEX IF NOT EXISTS idx_outcome_records_record ON outcome_records(recordId, outcomeId);
        CREATE INDEX IF NOT EXISTS idx_outcome_history_outcome ON outcome_status_history(outcomeId, changedTime);
      `);

      database.exec(`
        INSERT OR IGNORE INTO outcomes (
          id, type, status, title, projectId, projectName, startDate, updateDate, completedDate, completedWork, reportSummary,
          productSystem, tags, remark, archived, archiveTime, createTime, updateTime
        )
        SELECT
          asset.id,
          'reusable_asset',
          CASE WHEN asset.status IN ('published', 'archived') THEN 'completed' ELSE 'planned' END,
          asset.title,
          (SELECT project.id FROM projects project WHERE project.normalizedName = trim(asset.projectName) LIMIT 1),
          asset.projectName,
          date(asset.createTime / 1000, 'unixepoch', 'localtime'),
          date(asset.updateTime / 1000, 'unixepoch', 'localtime'),
          CASE WHEN asset.status IN ('published', 'archived') THEN date(asset.updateTime / 1000, 'unixepoch', 'localtime') ELSE '' END,
          asset.summary,
          asset.summary,
          asset.productSystem,
          asset.tags,
          asset.remark,
          CASE WHEN asset.status = 'archived' THEN 1 ELSE 0 END,
          CASE WHEN asset.status = 'archived' THEN asset.updateTime ELSE NULL END,
          asset.createTime,
          asset.updateTime
        FROM knowledge_assets asset;

        INSERT OR IGNORE INTO outcome_records (outcomeId, recordId)
        SELECT asset.id, asset.sourceRecordId
        FROM knowledge_assets asset
        WHERE trim(asset.sourceRecordId) <> ''
          AND EXISTS (SELECT 1 FROM records record WHERE record.id = asset.sourceRecordId);

        INSERT OR IGNORE INTO outcome_status_history (id, outcomeId, fromStatus, toStatus, note, changedTime)
        SELECT 'legacy-' || asset.id, asset.id, NULL,
          CASE WHEN asset.status IN ('published', 'archived') THEN 'completed' ELSE 'planned' END,
          '由知识资产迁移', asset.createTime
        FROM knowledge_assets asset;
      `);
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
    projectId,
    projectRelation,
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

const projectStatuses = new Set<ProjectStatus>(["planned", "active", "paused", "completed", "archived"]);

function normalizeProjectName(value: string | undefined): string {
  return String(value || "").trim();
}

function assertProjectDates(startDate = "", endDate = ""): void {
  if (startDate && endDate && endDate < startDate) throw new Error("PROJECT_INVALID_DATE_RANGE");
}

function getProjectAliases(projectId: string): string[] {
  return db.prepare("SELECT alias FROM project_aliases WHERE projectId = ? ORDER BY createTime, alias")
    .all(projectId)
    .map((row) => String((row as { alias: unknown }).alias));
}

function toProject(row: unknown): Project {
  const item = row as Record<string, unknown>;
  const id = String(item.id);
  return {
    id,
    name: String(item.name),
    normalizedName: String(item.normalizedName),
    shortName: String(item.shortName || ""),
    status: String(item.status) as ProjectStatus,
    startDate: String(item.startDate || ""),
    endDate: String(item.endDate || ""),
    personalRole: String(item.personalRole || ""),
    goal: String(item.goal || ""),
    description: String(item.description || ""),
    completionSummary: String(item.completionSummary || ""),
    aliases: getProjectAliases(id),
    mergedIntoProjectId: item.mergedIntoProjectId == null ? null : String(item.mergedIntoProjectId),
    archiveTime: item.archiveTime == null ? null : Number(item.archiveTime),
    createTime: Number(item.createTime),
    updateTime: Number(item.updateTime)
  };
}

function assertProjectIdentityAvailable(input: {
  name: string;
  shortName: string;
  aliases: string[];
}, excludeProjectIds: string[] = []): void {
  const normalizedName = normalizeProjectName(input.name);
  if (!normalizedName) throw new Error("PROJECT_NAME_CONFLICT");
  const candidateIdentities = new Set(
    [normalizedName, normalizeProjectName(input.shortName), ...input.aliases.map(normalizeProjectName)].filter(Boolean)
  );
  const excluded = new Set(excludeProjectIds);
  const projects = (db.prepare("SELECT id, normalizedName, shortName FROM projects").all() as Array<{
    id: string;
    normalizedName: string;
    shortName: string;
  }>).filter((project) => !excluded.has(project.id));
  const aliases = (db.prepare("SELECT projectId, normalizedAlias FROM project_aliases").all() as Array<{
    projectId: string;
    normalizedAlias: string;
  }>).filter((alias) => !excluded.has(alias.projectId));

  if (projects.some((project) => project.normalizedName === normalizedName)) {
    throw new Error("PROJECT_NAME_CONFLICT");
  }

  const occupied = new Set<string>();
  projects.forEach((project) => {
    occupied.add(project.normalizedName);
    const shortName = normalizeProjectName(project.shortName);
    if (shortName) occupied.add(shortName);
  });
  aliases.forEach((alias) => occupied.add(alias.normalizedAlias));
  if ([...candidateIdentities].some((identity) => occupied.has(identity))) {
    throw new Error("PROJECT_ALIAS_CONFLICT");
  }
}

function replaceProjectAliases(projectId: string, aliases: string[]): void {
  db.prepare("DELETE FROM project_aliases WHERE projectId = ?").run(projectId);
  const seen = new Set<string>();
  const insert = db.prepare(`INSERT INTO project_aliases (id, projectId, alias, normalizedAlias, createTime)
    VALUES (?, ?, ?, ?, ?)`);
  for (const value of aliases) {
    const alias = normalizeProjectName(value);
    if (!alias || seen.has(alias)) continue;
    seen.add(alias);
    insert.run(createId(), projectId, alias, alias, Date.now());
  }
}

export function listProjects(filter: {
  query?: string;
  statuses?: ProjectStatus[];
  includeArchived?: boolean;
} = {}): Project[] {
  const query = normalizeProjectName(filter.query).toLocaleLowerCase();
  const statuses = filter.statuses?.length ? new Set(filter.statuses) : null;
  const statusRank: Record<ProjectStatus, number> = { active: 0, planned: 1, paused: 2, completed: 3, archived: 4 };
  return (db.prepare("SELECT * FROM projects ORDER BY updateTime DESC").all().map(toProject) as Project[])
    .filter((project) => project.mergedIntoProjectId === null)
    .filter((project) => statuses ? statuses.has(project.status) : true)
    .filter((project) => query || filter.includeArchived ? true : project.status !== "archived")
    .filter((project) => {
      if (!query) return true;
      return [project.name, project.shortName, ...project.aliases]
        .some((value) => value.toLocaleLowerCase().includes(query));
    })
    .sort((left, right) => statusRank[left.status] - statusRank[right.status] || right.updateTime - left.updateTime);
}

export function getProject(id: string): Project | null {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  return row ? toProject(row) : null;
}

export function insertProject(input: ProjectInput): Project {
  const name = normalizeProjectName(input.name);
  const shortName = normalizeProjectName(input.shortName);
  const aliases = (input.aliases ?? []).map(normalizeProjectName).filter(Boolean);
  const status = input.status ?? "active";
  const startDate = normalizeProjectName(input.startDate);
  const endDate = normalizeProjectName(input.endDate);
  if (!projectStatuses.has(status)) throw new Error("PROJECT_INVALID_STATUS");
  assertProjectDates(startDate, endDate);
  assertProjectIdentityAvailable({ name, shortName, aliases });

  const now = Date.now();
  const id = createId();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`INSERT INTO projects
      (id, name, normalizedName, shortName, status, startDate, endDate, personalRole, goal, description, completionSummary, mergedIntoProjectId, archiveTime, createTime, updateTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`)
      .run(
        id,
        name,
        name,
        shortName,
        status,
        startDate,
        endDate,
        normalizeProjectName(input.personalRole),
        normalizeProjectName(input.goal),
        normalizeProjectName(input.description),
        normalizeProjectName(input.completionSummary),
        status === "archived" ? now : null,
        now,
        now
      );
    replaceProjectAliases(id, aliases.filter((alias) => alias !== name && alias !== shortName));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getProject(id) as Project;
}

export function updateProject(id: string, input: ProjectUpdateInput): Project | null {
  const existing = getProject(id);
  if (!existing) return null;
  const name = input.name === undefined ? existing.name : normalizeProjectName(input.name);
  const shortName = input.shortName === undefined ? existing.shortName : normalizeProjectName(input.shortName);
  const status = input.status ?? existing.status;
  const startDate = input.startDate === undefined ? existing.startDate : normalizeProjectName(input.startDate);
  const endDate = input.endDate === undefined ? existing.endDate : normalizeProjectName(input.endDate);
  const aliases = input.aliases === undefined ? existing.aliases.slice() : input.aliases.map(normalizeProjectName).filter(Boolean);
  if (name !== existing.name) aliases.push(existing.name);
  if (!projectStatuses.has(status)) throw new Error("PROJECT_INVALID_STATUS");
  assertProjectDates(startDate, endDate);
  assertProjectIdentityAvailable({ name, shortName, aliases }, [id]);

  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`UPDATE projects SET
      name = ?, normalizedName = ?, shortName = ?, status = ?, startDate = ?, endDate = ?, personalRole = ?, goal = ?,
      description = ?, completionSummary = ?, archiveTime = ?, updateTime = ? WHERE id = ?`)
      .run(
        name,
        name,
        shortName,
        status,
        startDate,
        endDate,
        input.personalRole === undefined ? existing.personalRole : normalizeProjectName(input.personalRole),
        input.goal === undefined ? existing.goal : normalizeProjectName(input.goal),
        input.description === undefined ? existing.description : normalizeProjectName(input.description),
        input.completionSummary === undefined ? existing.completionSummary : normalizeProjectName(input.completionSummary),
        status === "archived" ? existing.archiveTime ?? now : null,
        now,
        id
      );
    replaceProjectAliases(id, aliases.filter((alias) => alias !== name && alias !== shortName));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getProject(id);
}

export function archiveProject(id: string): Project | null {
  const project = getProject(id);
  if (!project) return null;
  return updateProject(id, { status: "archived" });
}

export function reactivateProject(id: string): Project | null {
  const project = getProject(id);
  if (!project) return null;
  if (project.mergedIntoProjectId) throw new Error("PROJECT_NOT_SELECTABLE");
  return updateProject(id, { status: "active" });
}

function buildProjectBreakdown(
  records: WorkRecord[],
  labelsForRecord: (record: WorkRecord) => Array<{ label: string; share: number }>
) {
  const values = new Map<string, { recordIds: Set<string>; timeHours: number; workload: number }>();
  for (const record of records) {
    for (const { label, share } of labelsForRecord(record)) {
      if (!label) continue;
      const current = values.get(label) ?? { recordIds: new Set<string>(), timeHours: 0, workload: 0 };
      current.recordIds.add(record.id);
      current.timeHours += (record.timeHours ?? 0) * share;
      current.workload += (record.workload ?? 0) * share;
      values.set(label, current);
    }
  }
  return [...values.entries()]
    .map(([label, value]) => ({
      label,
      recordCount: value.recordIds.size,
      timeHours: value.timeHours,
      workload: value.workload
    }))
    .sort((left, right) => right.workload - left.workload || right.timeHours - left.timeHours || left.label.localeCompare(right.label));
}

export function getProjectSummary(projectId: string): ProjectSummary | null {
  if (!getProject(projectId)) return null;
  const records = listRecords().filter((record) => record.projectId === projectId);
  const activeDates = new Set(records.map((record) => record.date));
  const lastActiveDate = records[0]?.date ?? "";
  const latest = lastActiveDate ? new Date(`${lastActiveDate}T00:00:00`) : null;
  const focusStart = latest ? new Date(latest) : null;
  if (focusStart) focusStart.setDate(focusStart.getDate() - 29);
  const recentRecords = focusStart
    ? records.filter((record) => new Date(`${record.date}T00:00:00`) >= focusStart)
    : [];
  const focusCounts = new Map<string, { count: number; latestDate: string }>();
  recentRecords.forEach((record) => {
    const label = record.workType || "其他项";
    const current = focusCounts.get(label) ?? { count: 0, latestDate: "" };
    focusCounts.set(label, { count: current.count + 1, latestDate: current.latestDate > record.date ? current.latestDate : record.date });
  });

  return {
    recordCount: records.length,
    activeDays: activeDates.size,
    timeHours: records.reduce((sum, record) => sum + (record.timeHours ?? 0), 0),
    workload: records.reduce((sum, record) => sum + (record.workload ?? 0), 0),
    lastActiveDate,
    currentFocus: [...focusCounts.entries()]
      .sort((left, right) => right[1].count - left[1].count || right[1].latestDate.localeCompare(left[1].latestDate))
      .slice(0, 3)
      .map(([label]) => label),
    businessCategories: buildProjectBreakdown(records, (record) => [{ label: record.businessCategory || "其他", share: 1 }]),
    products: buildProjectBreakdown(records, (record) => [{ label: record.productSystem || "未填写产品", share: 1 }]),
    abilities: buildProjectBreakdown(records, (record) => {
      if (record.abilityAllocations.length) {
        return record.abilityAllocations.map((allocation) => ({
          label: allocation.abilityName,
          share: allocation.percentage / 100
        }));
      }
      const labels = record.abilityDimension.split(",").map((value) => value.trim()).filter(Boolean);
      return labels.length
        ? labels.map((label) => ({ label, share: 1 / labels.length }))
        : [{ label: "未填写能力", share: 1 }];
    }),
    outcomes: listOutcomes({ projectId }),
    records
  };
}

export function getProjectMergePreview(sourceId: string, targetId: string): ProjectMergePreview | null {
  const sourceProject = getProject(sourceId);
  const targetProject = getProject(targetId);
  if (!sourceProject || !targetProject || sourceId === targetId || sourceProject.mergedIntoProjectId || targetProject.mergedIntoProjectId) {
    return null;
  }
  const summary = getProjectSummary(sourceId) as ProjectSummary;
  return {
    sourceProject,
    targetProject,
    recordCount: summary.recordCount,
    timeHours: summary.timeHours,
    workload: summary.workload
  };
}

export function mergeProjects(sourceId: string, targetId: string): Project {
  const preview = getProjectMergePreview(sourceId, targetId);
  if (!preview) throw new Error("PROJECT_MERGE_TARGET_INVALID");
  const { sourceProject, targetProject } = preview;
  const aliases = [
    ...targetProject.aliases,
    sourceProject.name,
    sourceProject.shortName,
    ...sourceProject.aliases
  ].map(normalizeProjectName).filter(Boolean);
  assertProjectIdentityAvailable(
    { name: targetProject.name, shortName: targetProject.shortName, aliases },
    [sourceProject.id, targetProject.id]
  );

  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM project_aliases WHERE projectId = ?").run(sourceProject.id);
    replaceProjectAliases(
      targetProject.id,
      aliases.filter((alias) => alias !== targetProject.name && alias !== targetProject.shortName)
    );
    db.prepare("UPDATE records SET projectId = ? WHERE projectId = ?").run(targetProject.id, sourceProject.id);
    db.prepare("UPDATE outcomes SET projectId = ?, updateTime = ? WHERE projectId = ?").run(targetProject.id, now, sourceProject.id);
    db.prepare(`UPDATE projects
      SET status = 'archived', mergedIntoProjectId = ?, archiveTime = ?, updateTime = ?
      WHERE id = ?`).run(targetProject.id, now, now, sourceProject.id);
    db.prepare("UPDATE projects SET updateTime = ? WHERE id = ?").run(now, targetProject.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getProject(targetProject.id) as Project;
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
  coefficient: number | null;
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
  const previewRows = rows.map((input, index) => {
    const row = normalizeImportRow(input);
    let status: ImportStatus = "invalid";
    if (row.businessCategory && row.workType && row.coefficient !== null && row.coefficient >= 0) {
      const existing = version ? findWorkloadStandardByKey(version.id, row.businessCategory, row.workType, row.productSystem, row.subtask) : null;
      status = !existing ? "new" : existing.coefficient === row.coefficient && existing.unit === row.unit && existing.remark === row.remark ? "duplicate" : "conflict";
    }
    return { rowNumber: index + 1, status, ...row, coefficient: row.coefficient };
  });
  const keyRows = new Map<string, number[]>();
  previewRows.forEach((row) => {
    if (row.status === "invalid") return;
    const key = [row.businessCategory, row.workType, row.productSystem, row.subtask].join("\u0000");
    keyRows.set(key, [...(keyRows.get(key) ?? []), row.rowNumber]);
  });
  const duplicateKeyRowNumbers = Array.from(keyRows.values()).filter((numbers) => numbers.length > 1).flat();
  const conflictingRows = new Set(duplicateKeyRowNumbers);
  previewRows.forEach((row) => {
    if (conflictingRows.has(row.rowNumber)) row.status = "conflict";
  });
  return { baseVersionId: version?.id ?? null, duplicateKeyRowNumbers, rows: previewRows };
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
  if (preview.duplicateKeyRowNumbers.length > 0) throw new Error("WORKLOAD_STANDARD_IMPORT_DUPLICATE_KEYS");
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

const outcomeTypes = new Set<OutcomeType>(["deliverable", "problem_resolution", "stage_progress", "reusable_asset"]);
const outcomeStatuses = new Set<OutcomeStatus>(["planned", "in_progress", "stage_result", "completed"]);

function normalizeOutcomeDate(input: unknown): string {
  const value = normalizeText(input);
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("OUTCOME_INVALID_DATE");
  return value;
}

function assertOutcomeDates(startDate: string, updateDate: string, completedDate: string): void {
  if (startDate && updateDate && updateDate < startDate) throw new Error("OUTCOME_INVALID_DATE");
  if (startDate && completedDate && completedDate < startDate) throw new Error("OUTCOME_INVALID_DATE");
}

function normalizeOutcomeRelations(input: Pick<OutcomeInput, "recordIds" | "abilities" | "milestoneIds">) {
  const recordIds = Array.from(new Set((input.recordIds ?? []).map(normalizeText).filter(Boolean)));
  const abilities = (input.abilities ?? []).map((ability) => ({
    abilityId: normalizeText(ability.abilityId),
    abilityName: normalizeText(ability.abilityName)
  }));
  const milestoneIds = Array.from(new Set((input.milestoneIds ?? []).map(normalizeText).filter(Boolean)));
  if (recordIds.some((id) => !getRecord(id)) || milestoneIds.some((id) => !getMilestone(id))) {
    throw new Error("OUTCOME_RELATION_INVALID");
  }
  if (abilities.some((ability) => !ability.abilityId || !ability.abilityName)
    || new Set(abilities.map((ability) => ability.abilityId)).size !== abilities.length) {
    throw new Error("OUTCOME_RELATION_INVALID");
  }
  return { recordIds, abilities, milestoneIds };
}

function replaceOutcomeRelations(
  outcomeId: string,
  relations: { recordIds: string[]; abilities: OutcomeAbility[]; milestoneIds: string[] }
): void {
  db.prepare("DELETE FROM outcome_records WHERE outcomeId = ?").run(outcomeId);
  db.prepare("DELETE FROM outcome_abilities WHERE outcomeId = ?").run(outcomeId);
  db.prepare("DELETE FROM outcome_milestones WHERE outcomeId = ?").run(outcomeId);
  const recordInsert = db.prepare("INSERT INTO outcome_records (outcomeId, recordId) VALUES (?, ?)");
  relations.recordIds.forEach((recordId) => recordInsert.run(outcomeId, recordId));
  const abilityInsert = db.prepare("INSERT INTO outcome_abilities (outcomeId, abilityId, abilityName) VALUES (?, ?, ?)");
  relations.abilities.forEach((ability) => abilityInsert.run(outcomeId, ability.abilityId, ability.abilityName));
  const milestoneInsert = db.prepare("INSERT INTO outcome_milestones (outcomeId, milestoneId) VALUES (?, ?)");
  relations.milestoneIds.forEach((milestoneId) => milestoneInsert.run(outcomeId, milestoneId));
}

function toOutcome(row: unknown): Outcome {
  const item = row as Record<string, unknown>;
  const id = String(item.id);
  const recordIds = (db.prepare("SELECT recordId FROM outcome_records WHERE outcomeId = ? ORDER BY rowid").all(id) as Array<{ recordId: string }>)
    .map((entry) => String(entry.recordId));
  const records = recordIds.map(getRecord).filter((record): record is WorkRecord => Boolean(record));
  const abilities = (db.prepare("SELECT abilityId, abilityName FROM outcome_abilities WHERE outcomeId = ? ORDER BY abilityName").all(id) as unknown as OutcomeAbility[])
    .map((ability) => ({ abilityId: String(ability.abilityId), abilityName: String(ability.abilityName) }));
  const milestoneIds = (db.prepare("SELECT milestoneId FROM outcome_milestones WHERE outcomeId = ? ORDER BY rowid").all(id) as Array<{ milestoneId: string }>)
    .map((entry) => String(entry.milestoneId));
  const milestones = milestoneIds.map(getMilestone).filter((milestone): milestone is Milestone => Boolean(milestone));
  const statusHistory = (db.prepare("SELECT * FROM outcome_status_history WHERE outcomeId = ? ORDER BY changedTime, rowid").all(id) as Array<Record<string, unknown>>)
    .map((history) => ({
      id: String(history.id),
      fromStatus: history.fromStatus === null ? null : String(history.fromStatus) as OutcomeStatus,
      toStatus: String(history.toStatus) as OutcomeStatus,
      note: String(history.note || ""),
      changedTime: Number(history.changedTime)
    }));
  return {
    id,
    type: String(item.type) as OutcomeType,
    status: String(item.status) as OutcomeStatus,
    title: String(item.title),
    projectId: item.projectId === null ? null : String(item.projectId),
    projectName: String(item.projectName || ""),
    startDate: String(item.startDate || ""),
    updateDate: String(item.updateDate || ""),
    completedDate: String(item.completedDate || ""),
    backgroundGoal: String(item.backgroundGoal || ""),
    completedWork: String(item.completedWork || ""),
    valueImpact: String(item.valueImpact || ""),
    personalRole: String(item.personalRole || ""),
    contribution: String(item.contribution || ""),
    reportSummary: String(item.reportSummary || ""),
    productSystem: String(item.productSystem || ""),
    tags: String(item.tags || ""),
    remark: String(item.remark || ""),
    archived: Boolean(item.archived),
    archiveTime: item.archiveTime === null ? null : Number(item.archiveTime),
    recordIds,
    records,
    abilities,
    milestoneIds,
    milestones,
    recordCount: records.length,
    timeHours: records.reduce((sum, record) => sum + (record.timeHours ?? 0), 0),
    workload: records.reduce((sum, record) => sum + (record.workload ?? 0), 0),
    statusHistory,
    createTime: Number(item.createTime),
    updateTime: Number(item.updateTime)
  };
}

export function getOutcome(id: string): Outcome | null {
  const row = db.prepare("SELECT * FROM outcomes WHERE id = ?").get(id);
  return row ? toOutcome(row) : null;
}

export function listOutcomes(filter: {
  type?: OutcomeType;
  status?: OutcomeStatus;
  projectId?: string;
  abilityId?: string;
  year?: string;
  query?: string;
  includeArchived?: boolean;
} = {}): Outcome[] {
  const query = normalizeText(filter.query).toLocaleLowerCase();
  return db.prepare("SELECT * FROM outcomes ORDER BY COALESCE(NULLIF(completedDate, ''), NULLIF(updateDate, ''), NULLIF(startDate, '')) DESC, updateTime DESC")
    .all()
    .map(toOutcome)
    .filter((outcome) => filter.includeArchived ? true : !outcome.archived)
    .filter((outcome) => filter.type ? outcome.type === filter.type : true)
    .filter((outcome) => filter.status ? outcome.status === filter.status : true)
    .filter((outcome) => filter.projectId ? outcome.projectId === filter.projectId : true)
    .filter((outcome) => filter.abilityId ? outcome.abilities.some((ability) => ability.abilityId === filter.abilityId) : true)
    .filter((outcome) => {
      if (!filter.year) return true;
      const date = outcome.completedDate || outcome.updateDate || outcome.startDate || new Date(outcome.createTime).toISOString().slice(0, 10);
      return date.startsWith(filter.year);
    })
    .filter((outcome) => !query || [
      outcome.title, outcome.backgroundGoal, outcome.completedWork, outcome.valueImpact,
      outcome.contribution, outcome.reportSummary, outcome.projectName, outcome.tags
    ].some((value) => value.toLocaleLowerCase().includes(query)));
}

export function summarizeOutcomes(outcomes: Outcome[]): OutcomeSummary {
  const recordIds = Array.from(new Set(outcomes.flatMap((outcome) => outcome.recordIds)));
  const records = recordIds.map(getRecord).filter((record): record is WorkRecord => Boolean(record));
  const byType: OutcomeSummary["byType"] = { deliverable: 0, problem_resolution: 0, stage_progress: 0, reusable_asset: 0 };
  const byStatus: OutcomeSummary["byStatus"] = { planned: 0, in_progress: 0, stage_result: 0, completed: 0 };
  outcomes.forEach((outcome) => { byType[outcome.type] += 1; byStatus[outcome.status] += 1; });
  return {
    outcomeCount: outcomes.length,
    recordCount: records.length,
    timeHours: records.reduce((sum, record) => sum + (record.timeHours ?? 0), 0),
    workload: records.reduce((sum, record) => sum + (record.workload ?? 0), 0),
    byType,
    byStatus
  };
}

export function insertOutcome(input: OutcomeInput): Outcome {
  const type = input.type;
  const status = input.status ?? "planned";
  const title = normalizeText(input.title);
  if (!outcomeTypes.has(type) || !outcomeStatuses.has(status) || !title) throw new Error("OUTCOME_INVALID");
  const project = input.projectId ? getProject(input.projectId) : null;
  if (input.projectId && (!project || project.mergedIntoProjectId)) throw new Error("OUTCOME_RELATION_INVALID");
  const startDate = normalizeOutcomeDate(input.startDate);
  const updateDate = normalizeOutcomeDate(input.updateDate);
  const completedDate = normalizeOutcomeDate(input.completedDate);
  assertOutcomeDates(startDate, updateDate, completedDate);
  const relations = normalizeOutcomeRelations(input);
  const id = createId();
  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`INSERT INTO outcomes (
      id, type, status, title, projectId, projectName, startDate, updateDate, completedDate,
      backgroundGoal, completedWork, valueImpact, personalRole, contribution, reportSummary,
      productSystem, tags, remark, archived, archiveTime, createTime, updateTime
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`)
      .run(
        id, type, status, title, project?.id ?? null, project?.name ?? "", startDate, updateDate, completedDate,
        normalizeText(input.backgroundGoal), normalizeText(input.completedWork), normalizeText(input.valueImpact),
        normalizeText(input.personalRole), normalizeText(input.contribution), normalizeText(input.reportSummary),
        normalizeText(input.productSystem), normalizeTags(input.tags || ""), normalizeText(input.remark), now, now
      );
    replaceOutcomeRelations(id, relations);
    db.prepare("INSERT INTO outcome_status_history (id, outcomeId, fromStatus, toStatus, note, changedTime) VALUES (?, ?, NULL, ?, ?, ?)")
      .run(createId(), id, status, normalizeText(input.statusNote), now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getOutcome(id) as Outcome;
}

export function updateOutcome(id: string, input: OutcomeUpdateInput): Outcome | null {
  const existing = getOutcome(id);
  if (!existing) return null;
  const type = input.type ?? existing.type;
  const status = input.status ?? existing.status;
  const title = input.title === undefined ? existing.title : normalizeText(input.title);
  if (!outcomeTypes.has(type) || !outcomeStatuses.has(status) || !title) throw new Error("OUTCOME_INVALID");
  const projectId = input.projectId === undefined ? existing.projectId : input.projectId;
  const project = projectId ? getProject(projectId) : null;
  if (projectId && (!project || project.mergedIntoProjectId)) throw new Error("OUTCOME_RELATION_INVALID");
  const startDate = input.startDate === undefined ? existing.startDate : normalizeOutcomeDate(input.startDate);
  const updateDate = input.updateDate === undefined ? existing.updateDate : normalizeOutcomeDate(input.updateDate);
  const completedDate = input.completedDate === undefined ? existing.completedDate : normalizeOutcomeDate(input.completedDate);
  assertOutcomeDates(startDate, updateDate, completedDate);
  const relations = normalizeOutcomeRelations({
    recordIds: input.recordIds ?? existing.recordIds,
    abilities: input.abilities ?? existing.abilities,
    milestoneIds: input.milestoneIds ?? existing.milestoneIds
  });
  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`UPDATE outcomes SET
      type = ?, status = ?, title = ?, projectId = ?, projectName = ?, startDate = ?, updateDate = ?, completedDate = ?,
      backgroundGoal = ?, completedWork = ?, valueImpact = ?, personalRole = ?, contribution = ?, reportSummary = ?,
      productSystem = ?, tags = ?, remark = ?, updateTime = ? WHERE id = ?`)
      .run(
        type, status, title, project?.id ?? null,
        projectId === existing.projectId ? existing.projectName : project?.name ?? "",
        startDate, updateDate, completedDate,
        input.backgroundGoal === undefined ? existing.backgroundGoal : normalizeText(input.backgroundGoal),
        input.completedWork === undefined ? existing.completedWork : normalizeText(input.completedWork),
        input.valueImpact === undefined ? existing.valueImpact : normalizeText(input.valueImpact),
        input.personalRole === undefined ? existing.personalRole : normalizeText(input.personalRole),
        input.contribution === undefined ? existing.contribution : normalizeText(input.contribution),
        input.reportSummary === undefined ? existing.reportSummary : normalizeText(input.reportSummary),
        input.productSystem === undefined ? existing.productSystem : normalizeText(input.productSystem),
        input.tags === undefined ? existing.tags : normalizeTags(input.tags),
        input.remark === undefined ? existing.remark : normalizeText(input.remark), now, id
      );
    replaceOutcomeRelations(id, relations);
    if (status !== existing.status) {
      db.prepare("INSERT INTO outcome_status_history (id, outcomeId, fromStatus, toStatus, note, changedTime) VALUES (?, ?, ?, ?, ?, ?)")
        .run(createId(), id, existing.status, status, normalizeText(input.statusNote), now);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getOutcome(id);
}

export function archiveOutcome(id: string): Outcome | null {
  if (!getOutcome(id)) return null;
  const now = Date.now();
  db.prepare("UPDATE outcomes SET archived = 1, archiveTime = ?, updateTime = ? WHERE id = ?").run(now, now, id);
  return getOutcome(id);
}

export function reactivateOutcome(id: string): Outcome | null {
  if (!getOutcome(id)) return null;
  db.prepare("UPDATE outcomes SET archived = 0, archiveTime = NULL, updateTime = ? WHERE id = ?").run(Date.now(), id);
  return getOutcome(id);
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
    const abilityIds = new Set(allocations.map((item) => item.abilityId));
    if (abilityIds.size !== allocations.length || allocations.some((item) => !item.abilityId || !item.abilityName || item.percentage === null || item.percentage < 0) || Math.abs(total - 100) > 0.000001) {
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

function resolveRecordStandard(
  standardId: string | null | undefined,
  fields: Pick<WorkRecord, "businessCategory" | "workType" | "productSystem" | "subtask">,
  submittedCoefficient: number | null | undefined,
  workloadUnit: string
): Pick<WorkRecord, "coefficient" | "workloadUnit" | "coefficientSource" | "coefficientStandardId" | "coefficientStandardVersionId" | "workloadFormulaVersion"> {
  if (!standardId) {
    const coefficient = normalizeOptionalNonNegativeNumber(submittedCoefficient);
    return {
      coefficient,
      workloadUnit: normalizeText(workloadUnit),
      coefficientSource: coefficient === null ? "none" : "manual",
      coefficientStandardId: null,
      coefficientStandardVersionId: null,
      workloadFormulaVersion: "quantity_x_coefficient_v1"
    };
  }

  const standard = getWorkloadStandard(standardId);
  const match = standard?.enabled
    ? matchWorkloadStandard({ versionId: standard.versionId, ...fields })
    : null;
  if (!standard || match?.standard.id !== standard.id) throw new Error("WORKLOAD_STANDARD_MISMATCH");
  if (submittedCoefficient !== undefined && submittedCoefficient !== null && Number(submittedCoefficient) !== standard.coefficient) {
    throw new Error("WORKLOAD_STANDARD_MISMATCH");
  }
  return {
    coefficient: standard.coefficient,
    workloadUnit: standard.unit,
    coefficientSource: match.matchLevel === "exact" ? "standard_exact" : "standard_general",
    coefficientStandardId: standard.id,
    coefficientStandardVersionId: standard.versionId,
    workloadFormulaVersion: "quantity_x_coefficient_v1"
  };
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
    projectId: record.projectId == null ? null : String(record.projectId),
    projectRelation: String(record.projectRelation || "unassigned") as ProjectRelation,
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

function resolveRecordProject(
  input: Pick<RecordInput, "projectId" | "projectRelation">,
  existing?: Pick<WorkRecord, "projectId" | "projectRelation" | "projectName">
): Pick<WorkRecord, "projectId" | "projectRelation" | "projectName"> {
  if (input.projectRelation === "non_project" && !input.projectId) {
    return { projectId: null, projectRelation: "non_project", projectName: "" };
  }
  if (input.projectRelation !== "project" || !input.projectId) {
    throw new Error("PROJECT_RELATION_INVALID");
  }
  const project = getProject(input.projectId);
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  if (project.mergedIntoProjectId) throw new Error("PROJECT_NOT_SELECTABLE");
  return {
    projectId: project.id,
    projectRelation: "project",
    projectName:
      existing?.projectRelation === "project" && existing.projectId === project.id
        ? existing.projectName
        : project.name
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

export function getRecordDeleteImpact(id: string): RecordDeleteImpact | null {
  const record = getRecord(id);
  if (!record) return null;
  const outcomes = db.prepare(`
    SELECT outcomes.id, outcomes.title, outcomes.type, outcomes.status
    FROM outcome_records
    JOIN outcomes ON outcomes.id = outcome_records.outcomeId
    WHERE outcome_records.recordId = ?
    ORDER BY outcomes.createTime, outcomes.id
  `).all(id) as Array<{ id: string; title: string; type: OutcomeType; status: OutcomeStatus }>;

  return {
    recordId: record.id,
    title: record.title,
    project: record.projectId ? { id: record.projectId, name: record.projectName } : null,
    outcomes
  };
}

export function insertRecord(input: RecordInput): WorkRecord {
  const now = Date.now();
  const quantity = normalizeOptionalNonNegativeNumber(input.quantity);
  const allocations = normalizeAbilityAllocations(input.abilityAllocations, normalizeText(input.abilityDimension));
  const fields = {
    businessCategory: inferBusinessCategory(input),
    workType: inferWorkType(input),
    productSystem: normalizeText(input.productSystem),
    subtask: normalizeText(input.subtask)
  };
  const provenance = resolveRecordStandard(input.coefficientStandardId, fields, input.coefficient, input.workloadUnit ?? "");
  const project = resolveRecordProject(input);
  const record: WorkRecord = {
    id: createId(),
    date: input.date,
    title: input.title.trim() || "无标题",
    content: input.content.trim(),
    category: input.category || "其他",
    businessCategory: fields.businessCategory,
    workType: fields.workType,
    abilityDimension: allocations.map((item) => item.abilityName).join(","),
    projectName: project.projectName,
    projectId: project.projectId,
    projectRelation: project.projectRelation,
    productSystem: fields.productSystem,
    subtask: fields.subtask,
    quantity,
    coefficient: provenance.coefficient,
    workload: normalizeWorkload(quantity, provenance.coefficient, input.workload),
    timeHours: normalizeOptionalNonNegativeNumber(input.timeHours),
    tags: normalizeTags(input.tags || ""),
    workloadUnit: provenance.workloadUnit,
    coefficientSource: provenance.coefficientSource,
    coefficientStandardId: provenance.coefficientStandardId,
    coefficientStandardVersionId: provenance.coefficientStandardVersionId,
    workloadFormulaVersion: provenance.workloadFormulaVersion,
    abilityAllocations: [],
    createTime: now,
    updateTime: now
  };

  db.exec("BEGIN IMMEDIATE");
  try {
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
       projectId,
       projectRelation,
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    record.projectId,
    record.projectRelation,
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
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getRecord(record.id) as WorkRecord;
}

export function updateRecord(id: string, input: RecordInput): WorkRecord | null {
  const existing = getRecord(id);
  if (!existing) return null;

  const quantity = input.quantity === undefined ? existing.quantity : normalizeOptionalNonNegativeNumber(input.quantity);
  const fields = {
    businessCategory: input.businessCategory ? inferBusinessCategory(input) : existing.businessCategory,
    workType: input.workType ? inferWorkType(input) : existing.workType,
    productSystem: input.productSystem === undefined ? existing.productSystem : normalizeText(input.productSystem),
    subtask: input.subtask === undefined ? existing.subtask : normalizeText(input.subtask)
  };
  const refreshProvenance = input.coefficient !== undefined || input.coefficientStandardId !== undefined || input.workloadUnit !== undefined || input.businessCategory !== undefined || input.workType !== undefined || input.productSystem !== undefined || input.subtask !== undefined;
  const provenance = refreshProvenance
    ? resolveRecordStandard(input.coefficientStandardId === undefined ? existing.coefficientStandardId : input.coefficientStandardId, fields, input.coefficient === undefined ? existing.coefficient : input.coefficient, input.workloadUnit === undefined ? existing.workloadUnit : input.workloadUnit)
    : {
      coefficient: existing.coefficient,
      workloadUnit: existing.workloadUnit,
      coefficientSource: existing.coefficientSource,
      coefficientStandardId: existing.coefficientStandardId,
      coefficientStandardVersionId: existing.coefficientStandardVersionId,
      workloadFormulaVersion: existing.workloadFormulaVersion
    };
  const refreshAllocations = input.abilityAllocations !== undefined || input.abilityDimension !== undefined;
  const allocations = refreshAllocations
    ? normalizeAbilityAllocations(input.abilityAllocations, input.abilityDimension === undefined ? existing.abilityDimension : normalizeText(input.abilityDimension))
    : existing.abilityAllocations.map(({ abilityId, abilityName, percentage }) => ({ abilityId, abilityName, percentage }));
  const shouldRecalculateWorkload = input.workload !== undefined || input.quantity !== undefined || refreshProvenance;
  const project = resolveRecordProject(input, existing);
  const next: WorkRecord = {
    ...existing,
    date: input.date,
    title: input.title.trim() || "无标题",
    content: input.content.trim(),
    category: input.category || "其他",
    businessCategory: fields.businessCategory,
    workType: fields.workType,
    abilityDimension: allocations.map((item) => item.abilityName).join(","),
    projectName: project.projectName,
    projectId: project.projectId,
    projectRelation: project.projectRelation,
    productSystem: fields.productSystem,
    subtask: fields.subtask,
    quantity,
    coefficient: provenance.coefficient,
    workload: shouldRecalculateWorkload ? normalizeWorkload(quantity, provenance.coefficient, input.workload) : existing.workload,
    timeHours:
      input.timeHours === undefined ? existing.timeHours : normalizeOptionalNonNegativeNumber(input.timeHours),
    tags: normalizeTags(input.tags || ""),
    workloadUnit: provenance.workloadUnit,
    coefficientSource: provenance.coefficientSource,
    coefficientStandardId: provenance.coefficientStandardId,
    coefficientStandardVersionId: provenance.coefficientStandardVersionId,
    workloadFormulaVersion: provenance.workloadFormulaVersion,
    abilityAllocations: [],
    updateTime: Date.now()
  };

  db.exec("BEGIN IMMEDIATE");
  try {
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
       projectId = ?,
       projectRelation = ?,
       productSystem = ?,
       subtask = ?,
       quantity = ?,
       coefficient = ?,
       workload = ?,
       timeHours = ?,
       tags = ?,
       workloadUnit = ?, coefficientSource = ?, coefficientStandardId = ?, coefficientStandardVersionId = ?, workloadFormulaVersion = ?,
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
    next.projectId,
    next.projectRelation,
    next.productSystem,
    next.subtask,
    next.quantity,
    next.coefficient,
    next.workload,
    next.timeHours,
    next.tags,
    next.workloadUnit, next.coefficientSource, next.coefficientStandardId, next.coefficientStandardVersionId, next.workloadFormulaVersion,
    next.updateTime,
    id
    );
    replaceAbilityAllocations(id, allocations);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getRecord(id);
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
