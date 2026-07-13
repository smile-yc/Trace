# Workload Provenance Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transactional schema migrations, versioned workload standards, and immutable coefficient provenance without breaking the current Trace record, report, settings, or export flows.

**Architecture:** Keep the existing Express + SQLite application and API paths, but move schema evolution into an explicit migration runner. Standard matching becomes version-aware, while each saved record snapshots the coefficient source and standard identity so later standard edits cannot change historical workload. Frontend changes consume the enriched contracts and expose standard-version selection and coefficient-source labels while preserving the current daily-entry workflow.

**Tech Stack:** Node.js 24+, TypeScript 5.7, Express 4, Zod 3, `node:sqlite`, React 18, Vite 5, Node test runner, pnpm 11.7.

## Global Constraints

- Preserve all existing SQLite data and keep migrations idempotent and transactional.
- Existing records retain stored `coefficient` and `workload`; migrations never recalculate them.
- Existing records with no trustworthy source metadata use `legacy`, not a guessed standard.
- Traditional business receives no automatic discount.
- A missing standard match yields no coefficient; never substitute `0`, `1`, or a recent coefficient.
- Blank product or subtask matches only an explicitly stored general rule.
- Only one workload-standard version can be active at a time.
- Existing API paths remain available; response shapes may only gain fields.
- Add no attachment or external-link storage and no new runtime dependency.
- Keep the user's unrelated `.gitignore` modification out of every commit.
- Run `pnpm run test`, `pnpm run typecheck`, and `pnpm run build` before completion.

---

## File Structure

**New backend files**

- `backend/src/db/migrations.ts`: migration registry, transaction runner, schema-version queries.
- `backend/src/workloadProvenance.ts`: pure coefficient-source derivation.
- `backend/test/migrations.test.ts`: migration idempotence and rollback.
- `backend/test/workloadStandardVersions.test.ts`: version lifecycle and matching.
- `backend/test/workloadProvenance.test.ts`: immutable record snapshots.

**Modified backend files**

- `backend/src/database.ts`: run migrations and persist/query versions and provenance.
- `backend/src/types.ts`: version, match, provenance, and record contracts.
- `backend/src/index.ts`: schemas and version-aware routes.
- `backend/src/exporters/excel.ts`: provenance columns in raw export.
- `package.json`: add the new test files to the explicit test command.

**New frontend files**

- `frontend/src/lib/workloadProvenance.ts`: source labels and version sorting.
- `frontend/src/components/WorkloadStandardVersionPanel.tsx`: version controls.
- `frontend/test/workloadProvenance.test.ts`: frontend helper coverage.

**Modified frontend files**

- `frontend/src/types.ts`: mirror backend contracts.
- `frontend/src/lib/workloadApi.ts`: version and match API functions.
- `frontend/src/components/RecordForm.tsx`: submit matched standard identity.
- `frontend/src/pages/SettingsPage.tsx`: scope standards to a selected version.
- `frontend/src/styles.css`: version toolbar and source hint.
- `frontend/test/recordFormState.test.ts`: automatic-to-manual regression.

---

### Task 1: Add a Transactional Migration Runner

**Files:**
- Create: `backend/src/db/migrations.ts`
- Create: `backend/test/migrations.test.ts`
- Modify: `backend/src/database.ts:1-176`
- Modify: `package.json:12-14`

**Interfaces:**
- Produces: `Migration`, `runMigrations(db, migrations?)`, `getAppliedMigrationVersions(db)`.
- Consumes: Node's `DatabaseSync`.
- Later tasks append built-in entries through `BUILT_IN_MIGRATIONS`.

- [ ] **Step 1: Write the failing migration tests**

Create `backend/test/migrations.test.ts`:

```typescript
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  getAppliedMigrationVersions,
  runMigrations,
  type Migration
} from "../src/db/migrations.ts";

function createDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "trace-migrations-"));
  return {
    db: new DatabaseSync(path.join(directory, "test.sqlite")),
    directory
  };
}

test("runMigrations applies each migration exactly once", () => {
  const { db, directory } = createDatabase();
  const migrations: Migration[] = [{
    version: 1,
    name: "create example",
    up(database) {
      database.exec("CREATE TABLE example (id TEXT PRIMARY KEY);");
    }
  }];

  runMigrations(db, migrations);
  runMigrations(db, migrations);

  assert.deepEqual(getAppliedMigrationVersions(db), [1]);
  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'example'"
  ).get() as { count: number };
  assert.equal(Number(row.count), 1);

  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test("runMigrations rolls back schema and ledger when a migration fails", () => {
  const { db, directory } = createDatabase();
  const migrations: Migration[] = [{
    version: 2,
    name: "broken migration",
    up(database) {
      database.exec("CREATE TABLE should_rollback (id TEXT PRIMARY KEY);");
      throw new Error("EXPECTED_FAILURE");
    }
  }];

  assert.throws(() => runMigrations(db, migrations), /EXPECTED_FAILURE/);
  assert.deepEqual(getAppliedMigrationVersions(db), []);
  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'should_rollback'"
  ).get() as { count: number };
  assert.equal(Number(row.count), 0);

  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
```

- [ ] **Step 2: Add the test to the root runner and verify failure**

Append `backend/test/migrations.test.ts` to the root `test` script.

Run:

```powershell
pnpm run test
```

Expected: FAIL because `backend/src/db/migrations.ts` does not exist.

- [ ] **Step 3: Implement the migration runner**

Create `backend/src/db/migrations.ts`:

```typescript
import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

export const BUILT_IN_MIGRATIONS: readonly Migration[] = [];

function ensureMigrationLedger(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      appliedTime INTEGER NOT NULL
    );
  `);
}

export function getAppliedMigrationVersions(db: DatabaseSync): number[] {
  ensureMigrationLedger(db);
  return db
    .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
    .all()
    .map((row) => Number((row as { version: unknown }).version));
}

export function runMigrations(
  db: DatabaseSync,
  migrations: readonly Migration[] = BUILT_IN_MIGRATIONS
): void {
  ensureMigrationLedger(db);
  const applied = new Set(getAppliedMigrationVersions(db));
  const ordered = [...migrations].sort((left, right) => left.version - right.version);

  for (const migration of ordered) {
    if (applied.has(migration.version)) continue;

    db.exec("BEGIN IMMEDIATE;");
    try {
      migration.up(db);
      db.prepare(
        "INSERT INTO schema_migrations (version, name, appliedTime) VALUES (?, ?, ?)"
      ).run(migration.version, migration.name, Date.now());
      db.exec("COMMIT;");
      applied.add(migration.version);
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
  }
}
```

Import and invoke it in `backend/src/database.ts` after the current baseline `CREATE TABLE IF NOT EXISTS` block and before seeds:

```typescript
import { runMigrations } from "./db/migrations.js";

runMigrations(db);
```

Keep the baseline table creation in place; it initializes new databases while migrations evolve both new and old databases.

- [ ] **Step 4: Verify**

Run:

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/migrations.test.ts
pnpm run test
pnpm run typecheck
```

Expected: focused and full tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/db/migrations.ts backend/test/migrations.test.ts backend/src/database.ts package.json
git commit -m "feat: add transactional database migrations"
```

### Task 2: Migrate Workload Standards Into Versions

**Files:**
- Modify: `backend/src/db/migrations.ts`
- Modify: `backend/src/types.ts:32-74`
- Modify: `backend/src/database.ts:434-825`
- Create: `backend/test/workloadStandardVersions.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `WorkloadStandardVersionStatus`, `WorkloadStandardVersion`, and `WorkloadStandardVersionInput`.
- Produces `listWorkloadStandardVersions()`, `getActiveWorkloadStandardVersion()`, `insertWorkloadStandardVersion(input)`, and `activateWorkloadStandardVersion(id)`.
- Adds `versionId` and `unit` to `WorkloadStandard`.
- Migrates current rows into `legacy-standard-version`.
- `listWorkloadStandards(versionId?)` scopes to the supplied version and defaults to the active version.

- [ ] **Step 1: Write failing repository tests**

Create `backend/test/workloadStandardVersions.test.ts`:

```typescript
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-standard-versions-"));
process.env.DATA_DIR = dataDir;
process.env.DB_PATH = path.join(dataDir, "report.sqlite");

const database = await import("../src/database.ts");

test("initial database has one active legacy standard version", () => {
  const versions = database.listWorkloadStandardVersions();
  assert.equal(versions.length, 1);
  assert.equal(versions[0].id, "legacy-standard-version");
  assert.equal(versions[0].status, "active");
});

test("activating a draft retires the previous active version", () => {
  const created = database.insertWorkloadStandardVersion({
    name: "2026 工作当量标准",
    year: 2026,
    sourceType: "manual",
    sourceName: "Trace 配置"
  });

  assert.equal(created.status, "draft");
  const active = database.activateWorkloadStandardVersion(created.id);

  assert.equal(active?.status, "active");
  assert.equal(database.getActiveWorkloadStandardVersion()?.id, created.id);
  assert.equal(
    database.listWorkloadStandardVersions()
      .find((item) => item.id === "legacy-standard-version")?.status,
    "retired"
  );
});
```

Add this test to the root test script.

- [ ] **Step 2: Verify failure**

Run the new test directly. Expected: FAIL because the version functions do not exist.

- [ ] **Step 3: Add migration `2026071301`**

Append a built-in migration that performs these actions inside the runner's transaction:

1. Create `workload_standard_versions`.
2. Insert `legacy-standard-version` as active.
3. Rename `workload_standards` to `workload_standards_legacy`.
4. Create the replacement table.
5. Copy every row without changing coefficients.
6. Drop the old table.
7. Recreate lookup indexes.

Use these schemas:

```sql
CREATE TABLE workload_standard_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER DEFAULT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'active', 'retired')),
  sourceType TEXT NOT NULL DEFAULT 'manual',
  sourceName TEXT NOT NULL DEFAULT '',
  createTime INTEGER NOT NULL,
  updateTime INTEGER NOT NULL
);

CREATE TABLE workload_standards_next (
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
```

Insert the version with a prepared statement:

```typescript
const now = Date.now();
db.prepare(`
  INSERT INTO workload_standard_versions (
    id, name, year, status, sourceType, sourceName, createTime, updateTime
  ) VALUES (?, ?, NULL, 'active', 'legacy', ?, ?, ?)
`).run("legacy-standard-version", "迁移前标准", "现有 Trace 数据", now, now);
```

Rename `workload_standards_next` only after the data copy succeeds.

- [ ] **Step 4: Add version types and repository functions**

Add to `backend/src/types.ts`:

```typescript
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
```

Add `versionId` and `unit` to `WorkloadStandard`. Add optional `versionId` and `unit` to `WorkloadStandardInput`; add optional `unit` to updates. Do not allow an existing row to move between versions.

Implement the interfaces above. Activation must update the active and selected versions in one transaction:

```typescript
export function activateWorkloadStandardVersion(
  id: string
): WorkloadStandardVersion | null {
  const existing = getWorkloadStandardVersion(id);
  if (!existing) return null;

  db.exec("BEGIN IMMEDIATE;");
  try {
    const now = Date.now();
    db.prepare(
      "UPDATE workload_standard_versions SET status = 'retired', updateTime = ? WHERE status = 'active' AND id != ?"
    ).run(now, id);
    db.prepare(
      "UPDATE workload_standard_versions SET status = 'active', updateTime = ? WHERE id = ?"
    ).run(now, id);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }

  return getWorkloadStandardVersion(id);
}
```

Update row conversion, insert, update, duplicate detection, and list queries for `versionId` and `unit`. An old client that omits `versionId` uses the active version for both listing and insertion.

- [ ] **Step 5: Verify**

Run:

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/migrations.test.ts backend/test/workloadStandardVersions.test.ts
pnpm run test
pnpm run typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/db/migrations.ts backend/src/types.ts backend/src/database.ts backend/test/workloadStandardVersions.test.ts package.json
git commit -m "feat: version workload standards"
```

### Task 3: Make Matching Version-Aware and Explicit

**Files:**
- Modify: `backend/src/types.ts`
- Modify: `backend/src/database.ts:656-825`
- Modify: `backend/test/workloadStandardVersions.test.ts`

**Interfaces:**
- Produces `WorkloadStandardMatchLevel = "exact" | "general"`.
- Produces `WorkloadStandardMatch { standard, version, matchLevel }`.
- Changes `matchWorkloadStandard(input)` to return `WorkloadStandardMatch | null`.
- Input accepts optional `versionId`; omission selects the active version.

- [ ] **Step 1: Add failing match tests**

Append:

```typescript
test("matching prefers the most specific rule inside one version", () => {
  const version = database.getActiveWorkloadStandardVersion();
  assert.ok(version);

  const general = database.insertWorkloadStandard({
    versionId: version.id,
    businessCategory: "传统业务",
    workType: "工程调试",
    coefficient: 1,
    unit: "项"
  });
  const exact = database.insertWorkloadStandard({
    versionId: version.id,
    businessCategory: "传统业务",
    workType: "工程调试",
    productSystem: "Trace",
    subtask: "接口开发",
    coefficient: 2,
    unit: "项"
  });

  const exactMatch = database.matchWorkloadStandard({
    versionId: version.id,
    businessCategory: "传统业务",
    workType: "工程调试",
    productSystem: "Trace",
    subtask: "接口开发"
  });
  const generalMatch = database.matchWorkloadStandard({
    versionId: version.id,
    businessCategory: "传统业务",
    workType: "工程调试",
    productSystem: "其他",
    subtask: "其他"
  });

  assert.equal(exactMatch?.standard.id, exact.id);
  assert.equal(exactMatch?.matchLevel, "exact");
  assert.equal(generalMatch?.standard.id, general.id);
  assert.equal(generalMatch?.matchLevel, "general");
});
```

Also add a separate-version rule and assert an active-version lookup returns `null`.

- [ ] **Step 2: Verify failure**

Run the version test. Expected: FAIL because the current match returns a standard directly and ignores versions.

- [ ] **Step 3: Implement deterministic matching**

Add:

```typescript
export type WorkloadStandardMatchLevel = "exact" | "general";

export interface WorkloadStandardMatch {
  standard: WorkloadStandard;
  version: WorkloadStandardVersion;
  matchLevel: WorkloadStandardMatchLevel;
}
```

Update the query to restrict `versionId`, business category, work type, enabled rows, and product/subtask exact-or-blank values. Order by exact product plus exact subtask specificity. Return:

```typescript
return {
  standard,
  version,
  matchLevel:
    standard.productSystem !== "" &&
    standard.subtask !== "" &&
    standard.productSystem === productSystem &&
    standard.subtask === subtask
      ? "exact"
      : "general"
};
```

Do not search retired or alternate versions when `versionId` is omitted.

- [ ] **Step 4: Verify and commit**

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/workloadStandardVersions.test.ts
pnpm run test
pnpm run typecheck
git add backend/src/types.ts backend/src/database.ts backend/test/workloadStandardVersions.test.ts
git commit -m "feat: make workload matching version aware"
```

### Task 4: Snapshot Coefficient Provenance on Records

**Files:**
- Modify: `backend/src/db/migrations.ts`
- Create: `backend/src/workloadProvenance.ts`
- Modify: `backend/src/types.ts:1-31,142-164`
- Modify: `backend/src/database.ts:134-199,1047-1227`
- Create: `backend/test/workloadProvenance.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `CoefficientSource = "none" | "legacy" | "manual" | "standard_exact" | "standard_general"`.
- Adds `workloadUnit`, `coefficientSource`, `coefficientStandardId`, `coefficientStandardVersionId`, and `workloadFormulaVersion` to `WorkRecord`.
- Adds optional `workloadUnit` and `coefficientStandardId` to `RecordInput`.
- Produces `resolveCoefficientProvenance(input, standard)`.

- [ ] **Step 1: Write failing persistence tests**

Create a temporary-database test that verifies:

```typescript
test("manual coefficient stores no standard identity", () => {
  const record = database.insertRecord(baseRecord());
  assert.equal(record.coefficientSource, "manual");
  assert.equal(record.coefficientStandardId, null);
  assert.equal(record.coefficientStandardVersionId, null);
  assert.equal(record.workload, 3);
});

test("matched coefficient snapshots standard and version identity", () => {
  const record = database.insertRecord({
    ...baseRecord(),
    coefficientStandardId: standard.id
  });
  assert.equal(record.coefficientSource, "standard_exact");
  assert.equal(record.coefficientStandardId, standard.id);
  assert.equal(record.coefficientStandardVersionId, version.id);
  assert.equal(record.workloadUnit, "项");
});

test("editing a standard never changes an existing record snapshot", () => {
  database.updateWorkloadStandard(standard.id, { coefficient: 8 });
  const unchanged = database.getRecord(record.id);
  assert.equal(unchanged?.coefficient, 2);
  assert.equal(unchanged?.workload, 4);
});
```

Add a fourth test: changing a saved coefficient and passing `coefficientStandardId: null` converts the record to `manual` and clears both standard IDs.

Add a fifth test: a standard referenced by a record cannot be deleted. Update `deleteWorkloadStandard` so only an unreferenced standard in a draft version can be deleted; active and retired standards must be disabled or retained. Use errors `WORKLOAD_STANDARD_IN_USE` and `WORKLOAD_STANDARD_VERSION_READ_ONLY` for the two rejection cases.

Add the test file to the root runner.

- [ ] **Step 2: Verify failure**

Run the focused test. Expected: FAIL because provenance fields do not exist.

- [ ] **Step 3: Add migration `2026071302`**

Add columns with a `hasColumn(db, table, column)` guard:

```sql
ALTER TABLE records ADD COLUMN workloadUnit TEXT NOT NULL DEFAULT '';
ALTER TABLE records ADD COLUMN coefficientSource TEXT NOT NULL DEFAULT 'none';
ALTER TABLE records ADD COLUMN coefficientStandardId TEXT DEFAULT NULL;
ALTER TABLE records ADD COLUMN coefficientStandardVersionId TEXT DEFAULT NULL;
ALTER TABLE records ADD COLUMN workloadFormulaVersion TEXT NOT NULL DEFAULT 'quantity_x_coefficient_v1';
```

Classify old rows without inference:

```sql
UPDATE records
SET coefficientSource = CASE
  WHEN coefficient IS NULL THEN 'none'
  ELSE 'legacy'
END
WHERE coefficientSource = 'none';
```

- [ ] **Step 4: Implement provenance resolution**

Create `backend/src/workloadProvenance.ts`:

```typescript
import type {
  CoefficientSource,
  RecordInput,
  WorkloadStandard
} from "./types.js";

export interface CoefficientProvenance {
  workloadUnit: string;
  coefficientSource: CoefficientSource;
  coefficientStandardId: string | null;
  coefficientStandardVersionId: string | null;
  workloadFormulaVersion: "quantity_x_coefficient_v1";
}

export function resolveCoefficientProvenance(
  input: RecordInput,
  standard: WorkloadStandard | null
): CoefficientProvenance {
  if (standard) {
    const exact =
      standard.productSystem !== "" &&
      standard.subtask !== "" &&
      standard.productSystem === (input.productSystem ?? "") &&
      standard.subtask === (input.subtask ?? "");
    return {
      workloadUnit: standard.unit,
      coefficientSource: exact ? "standard_exact" : "standard_general",
      coefficientStandardId: standard.id,
      coefficientStandardVersionId: standard.versionId,
      workloadFormulaVersion: "quantity_x_coefficient_v1"
    };
  }

  return {
    workloadUnit: input.workloadUnit?.trim() ?? "",
    coefficientSource: input.coefficient == null ? "none" : "manual",
    coefficientStandardId: null,
    coefficientStandardVersionId: null,
    workloadFormulaVersion: "quantity_x_coefficient_v1"
  };
}
```

When `coefficientStandardId` is supplied, `insertRecord` and `updateRecord` must reject `WORKLOAD_STANDARD_MISMATCH` unless the enabled standard's classification accepts the record and its coefficient equals the submitted coefficient.

Preserve provenance when only quantity changes. Re-resolve it when coefficient or standard ID changes. Extend `selectSql`, `toRecord`, insert SQL, and update SQL with all five fields.

- [ ] **Step 5: Verify and commit**

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/workloadProvenance.test.ts
pnpm run test
pnpm run typecheck
git add backend/src/db/migrations.ts backend/src/workloadProvenance.ts backend/src/types.ts backend/src/database.ts backend/test/workloadProvenance.test.ts package.json
git commit -m "feat: snapshot workload coefficient provenance"
```

### Task 5: Expose Version and Provenance APIs

**Files:**
- Modify: `backend/src/index.ts:1-239,319-365,440-464`
- Modify: `backend/test/validation.test.ts`

**Interfaces:**
- Adds `GET /api/workload-standard-versions`.
- Adds `POST /api/workload-standard-versions`.
- Adds `POST /api/workload-standard-versions/:id/activate`.
- Extends `GET /api/workload-standards?versionId=...`.
- Returns `{ match: WorkloadStandardMatch | null }` from matching.
- Accepts `workloadUnit` and nullable `coefficientStandardId` in records.

- [ ] **Step 1: Add failing API source assertions**

```typescript
test("workload provenance API validates version and standard identifiers", () => {
  assert.equal(indexSource.includes('app.get("/api/workload-standard-versions"'), true);
  assert.equal(indexSource.includes('app.post("/api/workload-standard-versions"'), true);
  assert.equal(indexSource.includes('app.post("/api/workload-standard-versions/:id/activate"'), true);
  assert.equal(
    indexSource.includes("coefficientStandardId: z.string().trim().nullable().optional()"),
    true
  );
  assert.equal(
    indexSource.includes("workloadUnit: z.string().trim().max(40).optional()"),
    true
  );
});
```

Run the focused test and expect FAIL.

- [ ] **Step 2: Add schemas**

```typescript
const workloadStandardVersionInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  year: z.coerce.number().int().min(2000).max(2200).nullable().optional(),
  sourceType: z.enum(["manual", "excel"]).optional(),
  sourceName: z.string().trim().max(200).optional()
});
```

Extend standard input with `versionId` and `unit`. Extend record input with:

```typescript
workloadUnit: z.string().trim().max(40).optional(),
coefficientStandardId: z.string().trim().nullable().optional()
```

- [ ] **Step 3: Add routes and error mapping**

Create the three version routes. Return `201` on create and `404` for a missing activation target.

Scope standard list by query:

```typescript
app.get("/api/workload-standards", (req, res) => {
  const versionId =
    typeof req.query.versionId === "string" ? req.query.versionId : undefined;
  res.json({ standards: listWorkloadStandards(versionId) });
});
```

Change matching to:

```typescript
res.json({ match: matchWorkloadStandard(input) });
```

Map these repository errors to `400` with clear Chinese messages:

- `WORKLOAD_STANDARD_INVALID`
- `WORKLOAD_STANDARD_DUPLICATE`
- `WORKLOAD_STANDARD_VERSION_NOT_FOUND`
- `WORKLOAD_STANDARD_MISMATCH`
- `WORKLOAD_STANDARD_IN_USE`
- `WORKLOAD_STANDARD_VERSION_READ_ONLY`

- [ ] **Step 4: Verify and commit**

```powershell
pnpm run test
pnpm --filter @trace-report/backend typecheck
pnpm --filter @trace-report/backend build
git add backend/src/index.ts backend/test/validation.test.ts
git commit -m "feat: expose workload standard versions"
```

### Task 6: Show Coefficient Source in Daily Entry

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/lib/workloadApi.ts`
- Create: `frontend/src/lib/workloadProvenance.ts`
- Modify: `frontend/src/components/RecordForm.tsx:22-31,303-387,471-515,641-665`
- Modify: `frontend/test/recordFormState.test.ts`
- Create: `frontend/test/workloadProvenance.test.ts`
- Modify: `package.json`

**Interfaces:**
- Frontend mirrors backend types.
- `matchWorkloadStandard(input)` returns `Promise<WorkloadStandardMatch | null>`.
- Produces `getCoefficientSourceLabel(source, versionName?)`.
- Produces `getMatchedStandardId({ coefficientTouched, match })`.

- [ ] **Step 1: Write failing frontend tests**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import {
  getCoefficientSourceLabel,
  getMatchedStandardId
} from "../src/lib/workloadProvenance.ts";

test("matched standard id clears after manual editing", () => {
  assert.equal(getMatchedStandardId({ coefficientTouched: false, match }), "standard-1");
  assert.equal(getMatchedStandardId({ coefficientTouched: true, match }), null);
});

test("source labels are explicit", () => {
  assert.equal(getCoefficientSourceLabel("standard_exact", "2026 标准"), "精确匹配 · 2026 标准");
  assert.equal(getCoefficientSourceLabel("standard_general", "2026 标准"), "通用规则 · 2026 标准");
  assert.equal(getCoefficientSourceLabel("manual"), "手动填写");
  assert.equal(getCoefficientSourceLabel("legacy"), "历史数据");
  assert.equal(getCoefficientSourceLabel("none"), "未填写");
});
```

Define `match` as a complete `WorkloadStandardMatch` fixture. Add the test to the root runner and verify failure.

- [ ] **Step 2: Implement frontend helpers**

Mirror backend contracts in `frontend/src/types.ts`.

Create:

```typescript
import type {
  CoefficientSource,
  WorkloadStandardMatch,
  WorkloadStandardVersion
} from "../types";

export function getMatchedStandardId({
  coefficientTouched,
  match
}: {
  coefficientTouched: boolean;
  match: WorkloadStandardMatch | null;
}): string | null {
  return coefficientTouched ? null : match?.standard.id ?? null;
}

export function getCoefficientSourceLabel(
  source: CoefficientSource,
  versionName = ""
): string {
  if (source === "standard_exact") {
    return `精确匹配${versionName ? ` · ${versionName}` : ""}`;
  }
  if (source === "standard_general") {
    return `通用规则${versionName ? ` · ${versionName}` : ""}`;
  }
  if (source === "manual") return "手动填写";
  if (source === "legacy") return "历史数据";
  return "未填写";
}

export function sortWorkloadStandardVersions(
  versions: WorkloadStandardVersion[]
): WorkloadStandardVersion[] {
  const rank = { active: 0, draft: 1, retired: 2 };
  return versions.slice().sort((left, right) =>
    rank[left.status] - rank[right.status] ||
    (right.year ?? 0) - (left.year ?? 0) ||
    right.createTime - left.createTime
  );
}
```

Update `workloadApi.ts` to read `{ match }` and add typed fetch/create/activate functions for versions, following the existing `readJson` handling.

- [ ] **Step 3: Integrate `RecordForm`**

Use:

```typescript
const [matchedStandard, setMatchedStandard] =
  useState<WorkloadStandardMatch | null>(null);
```

Populate coefficient from `match.standard.coefficient`. Submit:

```typescript
coefficientStandardId: getMatchedStandardId({
  coefficientTouched,
  match: matchedStandard
}),
workloadUnit:
  matchedStandard?.standard.unit ?? record?.workloadUnit ?? ""
```

Show exactly one hint under coefficient:

- untouched exact match: `精确匹配 · <版本名>`
- untouched general match: `通用规则 · <版本名>`
- touched coefficient: `手动填写`
- editing old data: label from `record.coefficientSource`

Do not persist a standard ID in manual drafts; restored drafts re-run matching.

Extend `recordFormState.test.ts` to prove touched coefficients submit no standard ID.

- [ ] **Step 4: Verify and commit**

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node frontend/test/workloadProvenance.test.ts frontend/test/recordFormState.test.ts
pnpm run test
pnpm run typecheck
pnpm run build
git add frontend/src/types.ts frontend/src/lib/workloadApi.ts frontend/src/lib/workloadProvenance.ts frontend/src/components/RecordForm.tsx frontend/test/workloadProvenance.test.ts frontend/test/recordFormState.test.ts package.json
git commit -m "feat: display workload coefficient provenance"
```

### Task 7: Add Standard Version Controls to Settings

**Files:**
- Create: `frontend/src/components/WorkloadStandardVersionPanel.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx:1-33,46-76,148-230,248-380,640-847`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/test/workloadProvenance.test.ts`

**Interfaces:**
- Component props:
  - `versions: WorkloadStandardVersion[]`
  - `selectedVersionId: string`
  - `busy: boolean`
  - `onSelect(id): void`
  - `onCreate(input): Promise<void>`
  - `onActivate(id): Promise<void>`
- `SettingsPage` scopes standard CRUD to `selectedVersionId`.

- [ ] **Step 1: Add sorting coverage**

Add a test with retired, draft, and active fixtures and expect the order `active`, `draft`, `retired`. Run it before wiring the helper and verify it fails.

- [ ] **Step 2: Build the version panel**

The component must provide:

- A select showing name, year, and status.
- A `Plus` icon button opening an inline create row.
- Required name, optional year, source type `manual`.
- An activate button disabled for the active version.
- Confirmation text: `启用该版本后，原启用版本将转为历史版本。继续吗？`
- No delete action.

Keep fetch calls in `SettingsPage`; the component only invokes props.

- [ ] **Step 3: Scope settings to versions**

Load options, versions, settings, and active-version standards. Select the active version initially. Refetch standards when selection changes.

Add `unit` to `WorkloadStandardDraft`. Create standards with:

```typescript
{
  versionId: selectedVersionId,
  businessCategory,
  workType,
  productSystem,
  subtask,
  unit,
  coefficient,
  remark,
  enabled
}
```

Display the selected version name in the section header. Retired versions are read-only. Active versions allow coefficient edits and enable/disable actions but no deletion. Draft versions allow creation, editing, and deletion of unreferenced rows. After activation, reload versions and retain the activated ID.

- [ ] **Step 4: Style and verify**

Add `.standard-version-toolbar`, `.standard-version-select`, `.standard-version-create`, and `.coefficient-source-hint` using existing variables and spacing. Controls wrap below 720px; no gradients or decorative cards.

Run:

```powershell
pnpm run test
pnpm run typecheck
pnpm run build
pnpm run dev
```

Verify settings version lifecycle, version isolation, exact/general/manual daily hints, and unchanged report rendering. Stop the server after inspection.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/components/WorkloadStandardVersionPanel.tsx frontend/src/pages/SettingsPage.tsx frontend/src/styles.css frontend/test/workloadProvenance.test.ts
git commit -m "feat: manage workload standard versions"
```

### Task 8: Extend Raw Export and Complete Verification

**Files:**
- Modify: `backend/src/exporters/excel.ts`
- Modify: `README.md`
- Modify: `PROJECT_ARCHITECTURE.md`
- Modify: `REQUIREMENTS.md`

**Interfaces:**
- Excel raw records gain provenance columns.
- Word/PDF narrative content is unchanged in this phase.
- Documentation records migration and historical stability rules.

- [ ] **Step 1: Add export columns**

Add:

```typescript
{ header: "计量单位", key: "workloadUnit", width: 12 },
{ header: "系数来源", key: "coefficientSource", width: 16 },
{ header: "标准ID", key: "coefficientStandardId", width: 24 },
{ header: "标准版本ID", key: "coefficientStandardVersionId", width: 24 },
{ header: "计算公式版本", key: "workloadFormulaVersion", width: 24 }
```

Map source values:

```typescript
const coefficientSourceLabels = {
  none: "未填写",
  legacy: "历史数据",
  manual: "手动填写",
  standard_exact: "精确匹配",
  standard_general: "通用规则"
} as const;
```

Do not add discounted workload columns.

- [ ] **Step 2: Update documentation**

Document:

- `schema_migrations` records completed versions.
- Existing standards migrate to `legacy-standard-version`.
- Existing records retain coefficient/workload and use `legacy`.
- New matched records snapshot standard and version IDs.
- Standard edits affect future matches only.
- Traditional business remains undiscounted.

Mark only this foundation complete in `REQUIREMENTS.md`.

- [ ] **Step 3: Run the complete quality gate**

```powershell
pnpm run test
pnpm run typecheck
pnpm run build
git diff --check
git status --short
```

Expected: all checks PASS; status contains only phase files plus the pre-existing unstaged `.gitignore`.

- [ ] **Step 4: Verify both database shapes**

Use two temporary directories:

1. Start once with an empty database and verify all tables plus one active legacy version.
2. Start with a copy of the current database and compare record count, stored workload total, standard count, milestone count, and knowledge-asset count before and after.

Start each database twice. The second startup applies no migration and changes no count or workload total.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/exporters/excel.ts README.md PROJECT_ARCHITECTURE.md REQUIREMENTS.md
git commit -m "docs: document workload provenance foundation"
```

- [ ] **Step 6: Review phase history**

```powershell
git log --oneline -8
git status --short
```

Expected: eight focused commits are visible; the only unrelated entry remains `M .gitignore`.
