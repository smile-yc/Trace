# Trace 工作台账与数据质量 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将全部记录页升级为支持长期检索、批量沉淀和可追溯数据质量检查的工作台账。

**Architecture:** 记录筛选、范围汇总和质量诊断集中在前端纯函数模块，页面只负责状态和交互；删除影响由后端基于现有关系表实时查询。项目、成果与记录继续使用现有领域对象，不新增质量持久化表。

**Tech Stack:** React 18、TypeScript、Express、SQLite、Node test runner、Vite、Lucide React。

## Global Constraints

- 不改变工作当量、能力分配和成果去重口径。
- 质量提醒不自动修改数据。
- 不新增附件、外部链接、审批或主观评分。
- 不推送 GitHub；不得提交主工作区已有的 `.gitignore` 修改。
- 所有生产行为先写失败测试，再写最小实现。

---

### Task 1: 台账筛选、汇总与质量纯函数

**Files:**
- Create: `frontend/src/lib/ledger.ts`
- Create: `frontend/test/ledger.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `LedgerFilters`、`LedgerQualityCode`、`filterLedgerRecords()`、`summarizeLedger()`、`analyzeLedgerQuality()`、`findNormalizedDuplicateGroups()`。
- Consumes: `WorkRecord`、`Outcome`、`Project` 现有类型及 `getArchiveRange()`。

- [ ] **Step 1: 写失败测试**

覆盖当前周/显式周期/自定义日期、关键词和所有维度交集、成果状态、范围汇总去重、五类记录质量问题、手动系数比例及归一化重复组。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `pnpm exec node --test --experimental-strip-types --experimental-specifier-resolution=node frontend/test/ledger.test.ts`

Expected: FAIL，原因是 `frontend/src/lib/ledger.ts` 不存在。

- [ ] **Step 3: 实现最小纯函数模块**

实现明确的过滤状态、日期范围校验、派生索引和去重统计；不得依赖 React 或浏览器全局。

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `pnpm exec node --test --experimental-strip-types --experimental-specifier-resolution=node frontend/test/ledger.test.ts`

Expected: PASS。

### Task 2: 删除影响预览接口

**Files:**
- Modify: `backend/src/types.ts`
- Modify: `backend/src/database.ts`
- Modify: `backend/src/index.ts`
- Create: `backend/test/record-impact.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `RecordDeleteImpact`、`getRecordDeleteImpact(id)`、`GET /api/records/:id/impact`。
- Returns: `{ impact: { recordId, title, project, outcomes } }`；不存在记录返回 404。

- [ ] **Step 1: 写失败的仓储与 HTTP 测试**

测试无关联、项目快照、多个成果、删除后关系变化和 404。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `pnpm exec node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/record-impact.test.ts`

Expected: FAIL，原因是影响查询和路由不存在。

- [ ] **Step 3: 实现查询、类型和只读路由**

使用参数化 SQL 查询 `records`、`projects`、`outcome_records` 和 `outcomes`；不修改删除事务和现有关联外键行为。

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `pnpm exec node --test --experimental-strip-types --experimental-specifier-resolution=node backend/test/record-impact.test.ts`

Expected: PASS。

### Task 3: 工作台账页面和批量流程

**Files:**
- Create: `frontend/src/lib/recordImpactApi.ts`
- Create: `frontend/src/components/LedgerRecordList.tsx`
- Modify: `frontend/src/pages/AllRecordsPage.tsx`
- Modify: `frontend/src/navigation/appPageContext.ts`
- Modify: `frontend/src/navigation/corePagePackage.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/test/ledgerPage.test.ts`
- Modify: `package.json`

**Interfaces:**
- `AllRecordsPage` consumes records plus按需加载的项目/成果数据，输出编辑、带影响删除、批量成果种子和报告记录集合。
- `LedgerRecordList` consumes `records`、质量索引和选择集合，produces selection、expand、edit、delete events。

- [ ] **Step 1: 写失败页面契约测试**

测试组合筛选控件、质量提醒、紧凑展开、多选、批量成果、报告范围及删除影响调用。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `pnpm exec node --test --experimental-strip-types --experimental-specifier-resolution=node frontend/test/ledgerPage.test.ts`

Expected: FAIL，原因是新页面结构和 API 模块不存在。

- [ ] **Step 3: 实现页面和数据加载**

复用现有搜索选择、按钮、标签和通知模式；项目/成果加载失败时保留记录筛选能力并显示非阻塞错误。

- [ ] **Step 4: 实现选择一致性与批量动作**

筛选变化时清除不可见选择；多项目记录不预填成果项目；报告无选择时使用全部可见记录。

- [ ] **Step 5: 运行页面和相关回归测试**

Run: `pnpm exec node --test --experimental-strip-types --experimental-specifier-resolution=node frontend/test/ledgerPage.test.ts frontend/test/recordFilters.test.ts frontend/test/outcomeManagement.test.ts`

Expected: PASS。

### Task 4: 样式、文档与完整验收

**Files:**
- Modify: `frontend/src/styles/work-outcomes.css`
- Modify: `frontend/test/styles.test.ts`
- Modify: `REQUIREMENTS.md`
- Modify: `PROJECT_ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-13-trace-product-roadmap.md`

**Interfaces:**
- Produces: 稳定的桌面表格式台账和移动堆叠行，不改变全局 Trace 设计令牌。

- [ ] **Step 1: 写失败样式测试**

断言台账列采用稳定网格、移动端切换单列、操作目标不少于 44px、质量色使用现有语义令牌。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `pnpm exec node --test --experimental-strip-types --experimental-specifier-resolution=node frontend/test/styles.test.ts`

Expected: FAIL，原因是台账专用样式不存在。

- [ ] **Step 3: 添加响应式样式并更新文档**

保持紧凑、全宽、无嵌套卡片；路线图阶段 3 仅在全部验收通过后标记完成。

- [ ] **Step 4: 完整验证**

Run: `pnpm run test`

Run: `pnpm run typecheck`

Run: `pnpm run build`

Expected: 全部退出码为 0。

- [ ] **Step 5: 运行本地服务和关键流程验收**

验证桌面与移动视口、空状态、组合筛选、质量定位、展开详情、批量成果、报告和删除影响。

