# Trace Project Entity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade free-text project names into durable project entities with conservative legacy migration, explicit non-project records, searchable daily selection, project review pages, aliases, archiving, reactivation, and transactional merging.

**Architecture:** Keep SQLite ownership in `backend/src/database.ts`, add pure project identity rules in `backend/src/core/projects.ts`, and expose typed REST endpoints from the existing Express app. The React frontend mirrors the contracts, keeps project fetching inside focused API/components, preserves `projectName` as a historical snapshot, and adds a registered `projects` page without changing existing report calculations.

**Tech Stack:** TypeScript, Node.js 24 `node:sqlite`, Express, Zod, React 18, Vite 5, Lucide React, Node test runner.

## Global Constraints

- Implement for a single user; do not add team members, assignments, approvals, permissions, attachments, or external links.
- Preserve `records.projectName` as an immutable saved-name snapshot when a project is renamed or merged.
- Legacy blank project names become `unassigned`; new records must use `project` or `non_project`.
- Only trimmed exact project names auto-deduplicate during migration; similar names remain separate until a manual merge.
- Project business categories and products are derived from linked records, not maintained as duplicate project fields.
- Project views and exports use original workload; never apply an automatic traditional-business discount.
- Use the existing migration transaction and make all new migrations idempotent.
- Follow TDD: every behavior change starts with a failing focused test.
- Keep the user's pre-existing `.gitignore` modification unstaged and unchanged.
- Create local commits only. Do not push GitHub until the user explicitly approves after complete verification.

---

## File Structure

**Backend contracts and rules**

- Create `backend/src/core/projects.ts`: project identity normalization, date validation, selectability, and stable error helpers.
- Modify `backend/src/types.ts`: project, alias, relation, summary, merge, and record contracts.
- Modify `backend/src/database.ts`: migration, project repository, merge transaction, project summaries, and record relation persistence.
- Modify `backend/src/index.ts`: Zod schemas, project routes, record relation validation, and project error mapping.

**Frontend contracts and behavior**

- Modify `frontend/src/types.ts`: mirror project and record relation contracts.
- Create `frontend/src/lib/projectApi.ts`: all project HTTP calls.
- Create `frontend/src/lib/projectPresentation.ts`: status labels, search options, and default visibility rules.
- Modify `frontend/src/lib/recordDraft.ts`: version 2 project-aware drafts and version 1 upgrade.
- Create `frontend/src/components/ProjectSelectField.tsx`: project/non-project mode, searchable selection, and quick create.
- Create `frontend/src/components/ProjectEditor.tsx`: shared create/edit form.
- Create `frontend/src/components/ProjectMergeDialog.tsx`: impact preview and confirmation.
- Create `frontend/src/pages/ProjectsPage.tsx`: project list, filters, detail panel, actions, metrics, and timeline.
- Modify `frontend/src/components/RecordForm.tsx`: project loading, validation, draft integration, and relation submission.
- Modify `frontend/src/navigation/corePagePackage.tsx` and `frontend/src/navigation/traceNavigation.ts`: register and enable the page.
- Modify `frontend/src/styles/work-outcomes.css`: project workspace and responsive layout.

**Tests and documentation**

- Create `backend/test/project-contracts.test.ts`.
- Create `backend/test/project-migration.test.ts`.
- Create `backend/test/project-repository.test.ts`.
- Create `backend/test/project-api.test.ts`.
- Create `frontend/test/projectManagement.test.ts`.
- Modify existing record fixtures and draft/UI tests for required project relation fields.
- Modify `backend/src/exporters/excel.ts`, `README.md`, `PROJECT_ARCHITECTURE.md`, and `REQUIREMENTS.md` after behavior is complete.

---

### Task 1: Define Project Contracts and Pure Rules

**Files:**
- Create: `backend/src/core/projects.ts`
- Modify: `backend/src/types.ts`
- Create: `backend/test/project-contracts.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `ProjectStatus`, `ProjectRelation`, `Project`, `ProjectInput`, `ProjectUpdateInput`, `ProjectSummary`, `ProjectMergePreview`.
- Produces `normalizeProjectIdentity(value)`, `assertProjectDateRange(startDate, endDate)`, and `isProjectSelectable(project)`.

- [ ] **Step 1: Write failing contract tests**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProjectDateRange,
  isProjectSelectable,
  normalizeProjectIdentity
} from "../src/core/projects.ts";

test("project identity only trims surrounding whitespace", () => {
  assert.equal(normalizeProjectIdentity("  Trace  "), "Trace");
  assert.notEqual(normalizeProjectIdentity("Trace"), normalizeProjectIdentity("trace"));
  assert.notEqual(normalizeProjectIdentity("Trace  项目"), normalizeProjectIdentity("Trace 项目"));
});

test("project date ranges reject an end before the start", () => {
  assert.throws(() => assertProjectDateRange("2026-07-20", "2026-07-19"), /PROJECT_INVALID_DATE_RANGE/);
  assert.doesNotThrow(() => assertProjectDateRange("2026-07-20", ""));
});

test("merged sources are not selectable", () => {
  assert.equal(isProjectSelectable({ status: "archived", mergedIntoProjectId: "target" }), false);
  assert.equal(isProjectSelectable({ status: "archived", mergedIntoProjectId: null }), true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/project-contracts.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `backend/src/core/projects.ts`.

- [ ] **Step 3: Add the exact backend contracts**

```typescript
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
```

Extend `WorkRecord` with required `projectId: string | null` and `projectRelation: ProjectRelation`. Extend `RecordInput` with required `projectRelation` and optional nullable `projectId`.

- [ ] **Step 4: Implement pure rules**

```typescript
import type { ProjectStatus } from "../types.js";

export function normalizeProjectIdentity(value: string): string {
  return value.trim();
}

export function assertProjectDateRange(startDate = "", endDate = ""): void {
  if (startDate && endDate && endDate < startDate) throw new Error("PROJECT_INVALID_DATE_RANGE");
}

export function isProjectSelectable(project: {
  status: ProjectStatus;
  mergedIntoProjectId: string | null;
}): boolean {
  return project.mergedIntoProjectId === null;
}
```

- [ ] **Step 5: Add the test to the root runner and verify GREEN**

Add `backend/test/project-contracts.test.ts` to the root `test` script, then run the focused test. Expected: 3 tests PASS.

- [ ] **Step 6: Commit locally**

```powershell
git add backend/src/core/projects.ts backend/src/types.ts backend/test/project-contracts.test.ts package.json
git commit -m "feat: define project entity contracts"
```

---

### Task 2: Add Idempotent Project Migration and Conservative Backfill

**Files:**
- Modify: `backend/src/database.ts:32-281`
- Create: `backend/test/project-migration.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes `normalizeProjectIdentity` and `ProjectRelation` from Task 1.
- Produces migration `2026071401` with `projects`, `project_aliases`, `records.projectId`, and `records.projectRelation`.

- [ ] **Step 1: Write a failing legacy migration test**

Create a temporary legacy database containing records with project names `"Trace"`, `" Trace "`, `"trace"`, `"Trace  项目"`, `"Trace 项目"`, and `""`. Start the backend database module in a child process, then assert:

```typescript
assert.equal(projectCount, 4);
assert.equal(linkedTraceRecords, 2);
assert.equal(unassignedCount, 1);
assert.equal(recordCountAfter, recordCountBefore);
assert.equal(workloadAfter, workloadBefore);
```

Run startup twice and assert that `projectCount`, alias count, record count, and total workload are unchanged on the second startup.

- [ ] **Step 2: Run the migration test and verify RED**

Run:

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/project-migration.test.ts
```

Expected: FAIL because `projects` does not exist.

- [ ] **Step 3: Add migration `2026071401`**

Append this migration after `2026071302`:

```typescript
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
        status TEXT NOT NULL CHECK(status IN ('planned','active','paused','completed','archived')),
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
      database.exec("ALTER TABLE records ADD COLUMN projectRelation TEXT NOT NULL DEFAULT 'unassigned'");
    }

    const names = database.prepare("SELECT DISTINCT trim(projectName) AS name FROM records WHERE trim(projectName) <> ''").all();
    const now = Date.now();
    for (const row of names as Array<{ name: string }>) {
      const normalizedName = normalizeProjectIdentity(row.name);
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
      UPDATE records SET projectId = NULL, projectRelation = 'unassigned'
      WHERE trim(projectName) = '';
    `);
  }
}
```

- [ ] **Step 4: Verify rollback behavior**

In the migration test, copy the migration runner pattern into a temporary database with a migration that inserts one project and throws. Assert no project row and no migration version remain after rollback.

- [ ] **Step 5: Run focused and migration suites**

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/project-migration.test.ts backend/test/migration-foundation.test.ts
```

Expected: all tests PASS and the original migration test retains record/workload totals.

- [ ] **Step 6: Commit locally**

```powershell
git add backend/src/database.ts backend/test/project-migration.test.ts package.json
git commit -m "feat: migrate legacy project names"
```

---

### Task 3: Implement Project CRUD, Aliases, Status, and Search

**Files:**
- Modify: `backend/src/database.ts:680-1160`
- Create: `backend/test/project-repository.test.ts`

**Interfaces:**
- Produces `listProjects(filter?)`, `getProject(id)`, `insertProject(input)`, `updateProject(id, input)`, `archiveProject(id)`, and `reactivateProject(id)`.
- `listProjects` accepts `{ query?: string; statuses?: ProjectStatus[]; includeArchived?: boolean }`.

- [ ] **Step 1: Write failing repository tests**

Cover these behaviors with a temporary database:

```typescript
const project = database.insertProject({ name: "Trace", shortName: "TR", aliases: ["工作复盘系统"] });
assert.equal(database.listProjects({ query: "复盘" })[0].id, project.id);

const renamed = database.updateProject(project.id, { name: "Trace 个人工作系统" });
assert.deepEqual(renamed?.aliases.sort(), ["Trace", "工作复盘系统"].sort());

assert.throws(() => database.insertProject({ name: "Trace" }), /PROJECT_ALIAS_CONFLICT|PROJECT_NAME_CONFLICT/);
assert.equal(database.archiveProject(project.id)?.status, "archived");
assert.equal(database.reactivateProject(project.id)?.status, "active");
```

Also assert that a merged source cannot be reactivated.

- [ ] **Step 2: Run focused test and verify RED**

Expected: FAIL because `insertProject` and related functions are undefined.

- [ ] **Step 3: Implement row mapping and conflict checks**

```typescript
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
    aliases: db.prepare("SELECT alias FROM project_aliases WHERE projectId = ? ORDER BY createTime").all(id)
      .map((alias) => String((alias as { alias: unknown }).alias)),
    mergedIntoProjectId: item.mergedIntoProjectId == null ? null : String(item.mergedIntoProjectId),
    archiveTime: item.archiveTime == null ? null : Number(item.archiveTime),
    createTime: Number(item.createTime),
    updateTime: Number(item.updateTime)
  };
}
```

Before writes, reject any normalized name/short name/alias found in another project name or alias with `PROJECT_NAME_CONFLICT` or `PROJECT_ALIAS_CONFLICT`. Use `assertProjectDateRange` before insert/update.

- [ ] **Step 4: Implement status operations and search**

Search against `name`, `shortName`, and `project_aliases.alias`. Default list excludes `archived`; explicit query searches all non-merged projects so completed and archived projects remain discoverable.

Archive sets `status = 'archived'` and `archiveTime = Date.now()`. Reactivation sets `status = 'active'`, clears `archiveTime`, and rejects rows with `mergedIntoProjectId`.

- [ ] **Step 5: Verify repository tests and typecheck**

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/project-repository.test.ts
pnpm --filter @trace-report/backend typecheck
```

Expected: all focused tests PASS and TypeScript reports no errors.

- [ ] **Step 6: Commit locally**

```powershell
git add backend/src/database.ts backend/test/project-repository.test.ts
git commit -m "feat: add project repository"
```

---

### Task 4: Enforce Project Relations on Work Records

**Files:**
- Modify: `backend/src/database.ts:308-340,1425-1670`
- Modify: `backend/test/data-foundation.test.ts`
- Modify: `backend/test/validation.test.ts`
- Modify: `backend/test/configDeletion.test.ts`

**Interfaces:**
- Consumes project repository from Task 3.
- Produces `resolveRecordProject(input)` returning `{ projectId, projectRelation, projectName }`.

- [ ] **Step 1: Write failing record relation tests**

```typescript
const project = database.insertProject({ name: "Trace" });
const linked = database.insertRecord(recordInput({ projectId: project.id, projectRelation: "project" }));
assert.equal(linked.projectId, project.id);
assert.equal(linked.projectName, "Trace");

database.updateProject(project.id, { name: "Trace 个人工作系统" });
assert.equal(database.getRecord(linked.id)?.projectName, "Trace");

const nonProject = database.insertRecord(recordInput({ projectId: null, projectRelation: "non_project" }));
assert.equal(nonProject.projectName, "");

assert.throws(() => database.insertRecord(recordInput({ projectId: null, projectRelation: "project" })), /PROJECT_RELATION_INVALID/);
assert.throws(() => database.insertRecord(recordInput({ projectId: null, projectRelation: "unassigned" })), /PROJECT_RELATION_INVALID/);
```

- [ ] **Step 2: Run focused tests and verify RED**

Expected: FAIL because records do not persist `projectId` or `projectRelation`.

- [ ] **Step 3: Add the resolver**

```typescript
function resolveRecordProject(input: Pick<RecordInput, "projectId" | "projectRelation">): {
  projectId: string | null;
  projectRelation: ProjectRelation;
  projectName: string;
} {
  if (input.projectRelation === "non_project" && !input.projectId) {
    return { projectId: null, projectRelation: "non_project", projectName: "" };
  }
  if (input.projectRelation !== "project" || !input.projectId) throw new Error("PROJECT_RELATION_INVALID");
  const project = getProject(input.projectId);
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  if (!isProjectSelectable(project)) throw new Error("PROJECT_NOT_SELECTABLE");
  return { projectId: project.id, projectRelation: "project", projectName: project.name };
}
```

- [ ] **Step 4: Extend persistence**

Add `projectId` and `projectRelation` to `selectSql`, `toRecord`, insert SQL, and update SQL. On every record create/update, use `resolveRecordProject`; never trust `input.projectName` for new writes.

Update every backend test fixture that creates a new record to include `projectId: null` and `projectRelation: "non_project"`. Legacy migration fixtures remain unchanged to exercise `unassigned` backfill.

- [ ] **Step 5: Run record and full backend tests**

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/project-repository.test.ts backend/test/data-foundation.test.ts backend/test/validation.test.ts
pnpm --filter @trace-report/backend typecheck
```

Expected: all tests PASS.

- [ ] **Step 6: Commit locally**

```powershell
git add backend/src/database.ts backend/test/data-foundation.test.ts backend/test/validation.test.ts backend/test/configDeletion.test.ts
git commit -m "feat: link records to projects"
```

---

### Task 5: Add Project Summary and Transactional Merge

**Files:**
- Modify: `backend/src/database.ts`
- Modify: `backend/test/project-repository.test.ts`

**Interfaces:**
- Produces `getProjectSummary(projectId): ProjectSummary | null`.
- Produces `getProjectMergePreview(sourceId, targetId): ProjectMergePreview | null`.
- Produces `mergeProjects(sourceId, targetId): Project`.

- [ ] **Step 1: Write failing summary and merge tests**

Create two projects and linked records. Assert project summary totals count each source record once, `currentFocus` uses the three most common work types from the latest 30 project-active days, and the timeline is date-descending.

Then merge source into target and assert:

```typescript
assert.deepEqual(preview, {
  sourceProject: source,
  targetProject: target,
  recordCount: 2,
  timeHours: 5,
  workload: 8
});
const mergedTarget = database.mergeProjects(source.id, target.id);
assert.equal(database.getProject(source.id)?.mergedIntoProjectId, target.id);
assert.equal(database.getProject(source.id)?.status, "archived");
assert.equal(database.listRecords().filter((record) => record.projectId === target.id).length, 3);
assert.equal(database.getRecord(sourceRecord.id)?.projectName, source.name);
assert.ok(mergedTarget.aliases.includes(source.name));
```

Add a conflict case where a source alias belongs to a third project; assert the merge throws and source record IDs remain unchanged.

- [ ] **Step 2: Run focused tests and verify RED**

Expected: FAIL because summary and merge functions are undefined.

- [ ] **Step 3: Implement summary aggregation**

Use records selected by `projectId`. Compute totals from original `timeHours` and `workload`, derive unique active dates, group business/product/ability values, and keep full `WorkRecord[]` for drill-down. Split multi-ability strings and allocate a record's original metrics according to `abilityAllocations`; do not duplicate the project total.

- [ ] **Step 4: Implement preview and merge transaction**

```typescript
export function mergeProjects(sourceId: string, targetId: string): Project {
  if (sourceId === targetId) throw new Error("PROJECT_MERGE_TARGET_INVALID");
  const source = getProject(sourceId);
  const target = getProject(targetId);
  if (!source || !target || source.mergedIntoProjectId || target.mergedIntoProjectId) {
    throw new Error("PROJECT_MERGE_TARGET_INVALID");
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const alias of [source.name, source.shortName, ...source.aliases].filter(Boolean)) {
      insertProjectAlias(target.id, alias, source.id);
    }
    db.prepare("UPDATE records SET projectId = ? WHERE projectId = ?").run(target.id, source.id);
    db.prepare(`UPDATE projects SET status = 'archived', mergedIntoProjectId = ?, archiveTime = ?, updateTime = ? WHERE id = ?`)
      .run(target.id, Date.now(), Date.now(), source.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getProject(target.id) as Project;
}
```

- [ ] **Step 5: Verify focused and full tests**

Run project repository tests, then `pnpm run test`. Expected: all tests PASS.

- [ ] **Step 6: Commit locally**

```powershell
git add backend/src/database.ts backend/test/project-repository.test.ts
git commit -m "feat: summarize and merge projects"
```

---

### Task 6: Expose Project and Record Relation APIs

**Files:**
- Modify: `backend/src/index.ts`
- Create: `backend/test/project-api.test.ts`
- Modify: `package.json`

**Interfaces:**
- Exposes all project endpoints defined in the design.
- Extends record input with required `projectRelation` and nullable `projectId`.

- [ ] **Step 1: Write failing HTTP tests**

Start the backend on a random port and verify:

```typescript
const created = await post("/api/projects", { name: "Trace", shortName: "TR" });
assert.equal(created.status, 201);
assert.equal((await get("/api/projects?query=TR")).projects[0].id, created.body.project.id);
assert.equal((await get(`/api/projects/${created.body.project.id}`)).project.name, "Trace");

const recordResponse = await post("/api/records", {
  ...baseRecord,
  projectId: created.body.project.id,
  projectRelation: "project"
});
assert.equal(recordResponse.body.record.projectName, "Trace");
```

Cover archive, reactivation, merge preview, merge, project summary, invalid relation, duplicate name, invalid dates, and an invalid merge target.

- [ ] **Step 2: Run the HTTP test and verify RED**

Expected: project endpoints return 404.

- [ ] **Step 3: Add Zod schemas**

```typescript
const projectStatuses = ["planned", "active", "paused", "completed", "archived"] as const;
const projectRelations = ["project", "non_project", "unassigned"] as const;

const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  shortName: z.string().trim().max(80).optional(),
  status: z.enum(projectStatuses).optional(),
  startDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  endDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  personalRole: z.string().trim().max(160).optional(),
  goal: z.string().trim().max(1200).optional(),
  description: z.string().trim().max(2000).optional(),
  completionSummary: z.string().trim().max(2000).optional(),
  aliases: z.array(z.string().trim().min(1).max(160)).max(50).optional()
});
const projectUpdateSchema = projectInputSchema.partial();
const projectMergeSchema = z.object({ targetId: z.string().trim().min(1) });
```

Extend `recordInputSchema` with:

```typescript
projectId: z.string().trim().nullable(),
projectRelation: z.enum(projectRelations).refine((value) => value !== "unassigned", {
  message: "新记录必须选择项目或明确标记为非项目事项。"
})
```

- [ ] **Step 4: Add routes**

Implement:

```text
GET    /api/projects
GET    /api/projects/:id
GET    /api/projects/:id/summary
POST   /api/projects
PATCH  /api/projects/:id
POST   /api/projects/:id/archive
POST   /api/projects/:id/reactivate
GET    /api/projects/:id/merge-preview?targetId=...
POST   /api/projects/:id/merge
```

Return `404` for missing projects, `201` for create, and JSON wrappers `{ project }`, `{ projects }`, `{ summary }`, or `{ preview }`.

- [ ] **Step 5: Map stable project errors**

Map the design error codes to `400`, `404`, or `409` with these Chinese messages:

```typescript
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
```

- [ ] **Step 6: Verify API, typecheck, and build**

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/project-api.test.ts
pnpm --filter @trace-report/backend typecheck
pnpm --filter @trace-report/backend build
```

Expected: all commands PASS.

- [ ] **Step 7: Commit locally**

```powershell
git add backend/src/index.ts backend/test/project-api.test.ts package.json
git commit -m "feat: expose project APIs"
```

---

### Task 7: Add Frontend Project Contracts, API, and Search Rules

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/lib/projectApi.ts`
- Create: `frontend/src/lib/projectPresentation.ts`
- Modify: `frontend/src/components/ui/searchOptions.ts`
- Modify: `frontend/src/components/ui/SearchSelect.tsx`
- Create: `frontend/test/projectManagement.test.ts`
- Modify: `package.json`

**Interfaces:**
- Mirrors all backend project contracts.
- Produces project API functions and `toProjectSearchOptions(projects)`.
- Adds `hiddenUntilSearch?: boolean` to `SearchOption`.

- [ ] **Step 1: Write failing frontend helper tests**

```typescript
test("project options hide completed and archived rows until search", () => {
  const options = toProjectSearchOptions([activeProject, completedProject, archivedProject]);
  assert.deepEqual(filterSearchOptions(options, "").map((item) => item.value), [activeProject.id]);
  assert.deepEqual(filterSearchOptions(options, "历史").map((item) => item.value), [archivedProject.id]);
});

```

Also add source/API assertions for every project endpoint.

- [ ] **Step 2: Run focused tests and verify RED**

Expected: FAIL because project helpers and API functions do not exist.

- [ ] **Step 3: Mirror contracts and add API functions**

`projectApi.ts` must export:

```typescript
fetchProjects(filter?): Promise<Project[]>
fetchProject(id): Promise<Project>
fetchProjectSummary(id): Promise<ProjectSummary>
createProject(input): Promise<Project>
updateProject(id, input): Promise<Project>
archiveProject(id): Promise<Project>
reactivateProject(id): Promise<Project>
fetchProjectMergePreview(sourceId, targetId): Promise<ProjectMergePreview>
mergeProjects(sourceId, targetId): Promise<Project>
```

Use the same `readJson` error behavior as existing API modules.

- [ ] **Step 4: Implement default visibility and alias search**

```typescript
export function filterSearchOptions<T extends SearchOption>(options: ReadonlyArray<T>, query: string): ReadonlyArray<T> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const candidates = normalizedQuery ? options : options.filter((option) => !option.hiddenUntilSearch);
  if (!normalizedQuery) return candidates;
  return candidates.filter((option) =>
    [option.label, option.value, ...(option.keywords ?? [])]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  );
}
```

`toProjectSearchOptions` sets `keywords` to short name plus aliases and sets `hiddenUntilSearch` for `completed` or `archived`.

- [ ] **Step 5: Verify focused tests and frontend typecheck**

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node frontend/test/projectManagement.test.ts frontend/test/uiFoundation.test.ts
pnpm --filter @trace-report/frontend typecheck
```

Expected: all commands PASS.

- [ ] **Step 6: Commit locally**

```powershell
git add frontend/src/types.ts frontend/src/lib/projectApi.ts frontend/src/lib/projectPresentation.ts frontend/src/components/ui/searchOptions.ts frontend/src/components/ui/SearchSelect.tsx frontend/test/projectManagement.test.ts package.json
git commit -m "feat: add frontend project foundation"
```

---

### Task 8: Replace Free-Text Project Entry with a Searchable Relation Field

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/lib/records.ts`
- Modify: `frontend/src/lib/recordDraft.ts`
- Create: `frontend/src/components/ProjectEditor.tsx`
- Create: `frontend/src/components/ProjectSelectField.tsx`
- Modify: `frontend/src/components/RecordForm.tsx`
- Modify: `frontend/src/styles/work-outcomes.css`
- Modify: `frontend/test/recordDraft.test.ts`
- Modify: `frontend/test/projectManagement.test.ts`
- Modify: `frontend/test/recordFormState.test.ts`
- Modify: `frontend/test/recordsCompatibility.test.ts`
- Modify: `frontend/test/dashboard.test.ts`
- Modify: `frontend/test/growthReview.test.ts`
- Modify: `frontend/test/recordFilters.test.ts`

**Interfaces:**
- `ProjectEditor` accepts optional `project`, `busy`, `onCancel`, and `onSubmit(input)`.
- `ProjectSelectField` accepts `projects`, `projectId`, `relation`, `busy`, `error`, `onChange`, and `onQuickCreate`.
- `RecordForm` submits required `projectId` and `projectRelation`.
- Produces project-aware `RecordDraft` version 2 and deterministic version 1 upgrade.

- [ ] **Step 1: Add failing interaction contract tests**

Assert source and pure behavior for:

- segmented `项目事项 / 非项目事项` controls;
- `SearchSelect` project selection;
- quick-create action;
- version 2 draft fields;
- blocking `unassigned` submission;
- submitting `projectId` with `projectRelation: "project"`;
- submitting `null` with `projectRelation: "non_project"`.

Add a draft test:

```typescript
storage.setItem(KEY, JSON.stringify(versionOneDraft));
assert.deepEqual(loadRecordDraft(storage), {
  ...versionOneDraft,
  version: 2,
  projectId: "",
  projectRelation: "unassigned"
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Expected: FAIL because `ProjectSelectField` does not exist and `RecordForm` still sends `projectName`.

- [ ] **Step 3: Build the editor and relation field**

Use existing `FormField`, `SearchSelect`, `Button`, and `ModalDialog`. The mode control must be a segmented control, not two unrelated text buttons. Quick create opens `ProjectEditor` with required name and optional short name, role, dates, goal, and description; default status is `active`.

Before wiring the components, extend frontend `WorkRecord` with required `projectId` and `projectRelation`, extend `RecordInput` with required relation plus nullable ID, and update `records.ts` compatibility defaults. Upgrade `RecordDraft` to version 2; loading version 1 returns `projectId: ""` and `projectRelation: "unassigned"`.

Display these states exactly:

```text
项目事项：必须选择一个项目
非项目事项：无需项目
历史未关联：请选择项目或改为非项目事项
项目读取失败：<API message>
```

- [ ] **Step 4: Integrate RecordForm**

On mount, fetch projects. Initialize from `record.projectId/projectRelation` or the upgraded draft. When a selected project has merged, clear the selection and show a validation message. Submit:

```typescript
projectId: projectRelation === "project" ? selectedProjectId : null,
projectRelation
```

Do not send editable `projectName`. After quick create, append the returned project, select it, and close the editor. Draft save/clear must include/reset both project fields.

- [ ] **Step 5: Add compact responsive styles**

Add `.project-relation-toggle`, `.project-select-row`, and `.project-quick-create`. Use existing tokens, 6px controls, 8px-or-less surfaces, 44px mobile targets, no gradients, and wrapping below 720px.

- [ ] **Step 6: Verify focused tests, typecheck, and build**

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node frontend/test/projectManagement.test.ts frontend/test/recordDraft.test.ts frontend/test/recordFormState.test.ts frontend/test/recordsCompatibility.test.ts frontend/test/dashboard.test.ts frontend/test/growthReview.test.ts frontend/test/recordFilters.test.ts
pnpm --filter @trace-report/frontend typecheck
pnpm --filter @trace-report/frontend build
```

Expected: all commands PASS.

- [ ] **Step 7: Commit locally**

```powershell
git add frontend/src/types.ts frontend/src/lib/records.ts frontend/src/lib/recordDraft.ts frontend/src/components/ProjectEditor.tsx frontend/src/components/ProjectSelectField.tsx frontend/src/components/RecordForm.tsx frontend/src/styles/work-outcomes.css frontend/test/recordDraft.test.ts frontend/test/projectManagement.test.ts frontend/test/recordFormState.test.ts frontend/test/recordsCompatibility.test.ts frontend/test/dashboard.test.ts frontend/test/growthReview.test.ts frontend/test/recordFilters.test.ts
git commit -m "feat: select projects in daily records"
```

---

### Task 9: Enable the Project Management Workspace

**Files:**
- Create: `frontend/src/components/ProjectMergeDialog.tsx`
- Create: `frontend/src/pages/ProjectsPage.tsx`
- Modify: `frontend/src/navigation/corePagePackage.tsx`
- Modify: `frontend/src/navigation/traceNavigation.ts`
- Modify: `frontend/src/styles/work-outcomes.css`
- Modify: `frontend/test/projectManagement.test.ts`
- Modify: `frontend/test/uiFoundation.test.ts`

**Interfaces:**
- `ProjectsPage({ onNotify })` owns list/detail refresh and project actions.
- `ProjectMergeDialog` loads preview for `sourceId/targetId` and confirms once.
- Registers page ID `projects` in group `work`.

- [ ] **Step 1: Write failing page and navigation tests**

Assert that:

```typescript
assert.match(pagePackageSource, /id: "projects"/);
assert.match(navigationSource, /id: "projects"[\s\S]*pageId: "projects"/);
assert.equal(navigationSource.includes('id: "projects", label: "项目管理", group: "工作", icon: FolderKanban, disabled: true'), false);
```

Add page source contracts for keyword/status filters, create/edit, archive/reactivate, merge preview, metrics, current focus, timeline, and the stage 2成果 empty state.

- [ ] **Step 2: Run focused tests and verify RED**

Expected: FAIL because the navigation item is disabled and `ProjectsPage` is missing.

- [ ] **Step 3: Build the project list and detail workspace**

Use `PageHeader`, `FilterBar`, `DataTable`, `StatusBadge`, `DetailPanel`, `EmptyState`, `ErrorState`, `Button`, and `IconButton`.

Default list request includes planned/active/paused. Columns:

```text
项目 | 状态 | 个人角色 | 工时 | 原始工作当量 | 最近活跃 | 当前重点 | 操作
```

Selecting a row opens a wide detail panel with metadata, four metrics, business/product/ability summaries, current-focus text, and date-descending records. The成果 section uses the domain empty state `尚无关联成果`, without exposing implementation-stage copy.

- [ ] **Step 4: Add actions and merge confirmation**

Create/edit uses `ProjectEditor`. Archive and reactivate require confirmation and refresh the list. Merge requires a target selector, loads preview, displays record count/time/workload, then requires the exact confirmation text:

```text
合并后，来源项目的工作记录将关联到目标项目，历史项目名称快照保持不变。确认继续吗？
```

- [ ] **Step 5: Register and enable navigation**

Add `ProjectsPage` to `CORE_PAGE_PACKAGES` and change the navigation item to:

```typescript
{ id: "projects", label: "项目管理", group: "工作", pageId: "projects", icon: FolderKanban }
```

Extend the legacy-page reachability test to include `projects`.

- [ ] **Step 6: Add responsive project styles**

Use an unframed page band with a compact table and detail panel. Keep columns bounded, use internal horizontal scroll below 980px, and switch filter/action rows to wrapping layouts below 720px. Do not add decorative cards, gradients, or oversized headings.

- [ ] **Step 7: Verify frontend suite and production build**

```powershell
node --test --experimental-strip-types --experimental-specifier-resolution=node frontend/test/projectManagement.test.ts frontend/test/uiFoundation.test.ts frontend/test/styles.test.ts
pnpm --filter @trace-report/frontend typecheck
pnpm --filter @trace-report/frontend build
```

Expected: all commands PASS.

- [ ] **Step 8: Commit locally**

```powershell
git add frontend/src/components/ProjectMergeDialog.tsx frontend/src/pages/ProjectsPage.tsx frontend/src/navigation/corePagePackage.tsx frontend/src/navigation/traceNavigation.ts frontend/src/styles/work-outcomes.css frontend/test/projectManagement.test.ts frontend/test/uiFoundation.test.ts
git commit -m "feat: add project management workspace"
```

---

### Task 10: Extend Raw Export, Update Documentation, and Complete Verification

**Files:**
- Modify: `backend/src/exporters/excel.ts`
- Modify: `README.md`
- Modify: `PROJECT_ARCHITECTURE.md`
- Modify: `REQUIREMENTS.md`
- Modify: `backend/test/project-migration.test.ts`
- Modify: `frontend/test/projectManagement.test.ts`

**Interfaces:**
- Excel raw records include project ID and relation while preserving project name snapshot.
- Documents describe migration, merge, non-project, and historical snapshot rules.

- [ ] **Step 1: Add failing export assertions**

Assert the raw-record worksheet includes:

```typescript
{ header: "项目ID", key: "projectId", width: 24 }
{ header: "项目关联状态", key: "projectRelation", width: 16 }
{ header: "项目名称快照", key: "projectName", width: 24 }
```

Verify Word/PDF report output still uses `projectName` and existing total workload/time values.

- [ ] **Step 2: Implement raw export columns**

Map relation labels exactly:

```typescript
const projectRelationLabels = {
  project: "项目事项",
  non_project: "非项目事项",
  unassigned: "历史未关联"
} as const;
```

Do not add discount or adjusted-workload columns.

- [ ] **Step 3: Update project documentation**

Document:

- `projects` and `project_aliases` ownership;
- migration `2026071401` and exact-name-only backfill;
- `projectId`, `projectRelation`, and immutable `projectName` snapshots;
- archive/reactivate/merge behavior;
- project page and daily selection flow;
- stage 2成果 integration remains pending.

Mark stage 1B complete in `REQUIREMENTS.md` only after all automated and browser verification passes.

- [ ] **Step 4: Run the full automated gate**

```powershell
pnpm run test
pnpm run typecheck
pnpm run build
git diff --check
```

Expected: all tests PASS, both typechecks PASS, both builds PASS, and diff check emits no errors.

- [ ] **Step 5: Verify both database shapes twice**

Use two temporary directories:

1. Empty database: start twice; assert one migration row for `2026071401` and no duplicate projects/aliases.
2. Copy of the current database: capture record count, total workload, total time, standard count, milestone count, and knowledge asset count; start twice; assert every captured value remains unchanged.

Also force a migration failure in a temporary database and assert no project table data or migration marker survives the rollback.

- [ ] **Step 6: Run browser acceptance**

Start `pnpm run dev` and verify at desktop `1440x900` and mobile `390x844`:

1. Project navigation opens and preserves other page state.
2. Create and quick-create projects.
3. Search by name, short name, and alias.
4. Create project and non-project records.
5. Edit a historical unassigned record only after resolving its relation.
6. Archive, search an archived project, select it explicitly, and reactivate it.
7. Preview and confirm a merge; verify totals and unchanged record name snapshots.
8. Check loading, error, empty, long-name, focus, Escape, and mobile drawer behavior.
9. Confirm no console errors, horizontal overflow, or overlapping controls.

Stop the development server after inspection.

- [ ] **Step 7: Review local scope and commit**

```powershell
git status --short
git diff --check
git log --oneline -12
git add backend/src/exporters/excel.ts README.md PROJECT_ARCHITECTURE.md REQUIREMENTS.md backend/test/project-migration.test.ts frontend/test/projectManagement.test.ts
git commit -m "docs: complete project entity phase"
```

Expected: the only unrelated working-tree entry remains the user's unstaged `M .gitignore`. Do not push GitHub.
