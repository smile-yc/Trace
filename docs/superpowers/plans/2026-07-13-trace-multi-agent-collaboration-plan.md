# Trace Multi-Agent Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过四个实施 agent 和一个集成检查 agent，分阶段完成 Trace 的数据基础、统一 UI、工作成果链路、成长汇报和最终集成。

**Architecture:** 采用“共享基础先行、业务域并行、中心化集成”的两波协作方式。Agent 1 和 Agent 2 从同一基线分别建立数据契约与 UI 骨架；合并并通过门禁后，Agent 3 和 Agent 4 基于新的统一基线并行交付两个互不重叠的业务域；Agent 5 负责每波集成、共享入口接线、冲突检查和最终验收。

**Tech Stack:** React 18、TypeScript 5.7、Vite 5、Express 4、SQLite、Zod、Lucide React、Node test runner、pnpm 11.7。

## Global Constraints

- 产品范围以 `docs/superpowers/specs/2026-07-13-trace-top-level-product-design.md` 为准。
- UI 规则以 `docs/superpowers/specs/2026-07-13-trace-ui-design.md` 为准。
- 不增加团队协作、审批、附件、外部链接、绩效评分、排行榜或游戏化功能。
- 原始工时和原始工作当量只计算一次；多能力只分摊分析口径。
- 传统业务不自动打折；年度汇报折算为本次报告临时参数，默认 `100%`。
- 日报和报告草稿采用手动保存，不使用自动保存。
- 品牌色使用 `#176B68`，圆角为 `6px` 至 `8px`，少阴影，无渐变，首轮不做深色模式。
- 所有长选项支持搜索，工作类型、产品和子任务采用联动选择。
- 每个 agent 必须在自己的隔离工作区工作，不得直接修改主工作区中的用户未提交内容。
- 每个 agent 必须使用测试驱动方式完成自己的任务，并在交付前运行相关测试、类型检查和构建。
- 根级完整门禁为 `pnpm run test`、`pnpm run typecheck`、`pnpm run build`。

---

## 1. 为什么采用五个 Agent

完整升级涉及数据模型、接口、设计系统、日常工作流、项目成果链、成长分析、报告、导出和响应式验收，一个 agent 可以完成，但周期长、上下文容易失真。

这些工作存在两个适合并行的边界：

1. 数据基础与 UI 基础可以在文件所有权明确后并行。
2. 工作与成果域、成长与汇报域可以在共享基础合并后并行。

不能把四个实施 agent 从当前提交同时启动。项目当前的 `frontend/src/App.tsx`、`frontend/src/types.ts`、`frontend/src/styles.css`、`backend/src/index.ts` 和 `backend/src/database.ts` 都是共享热点；若不先拆分接口和样式边界，所谓并行会变成集中解决冲突。

## 2. 协作拓扑

```mermaid
flowchart LR
    O["主协调者：冻结范围与基线"] --> A1["Agent 1：数据与契约基础"]
    O --> A2["Agent 2：UI 系统与应用骨架"]
    A1 --> G1["Agent 5：第一波集成门禁"]
    A2 --> G1
    G1 --> B["统一基础提交"]
    B --> A3["Agent 3：记录、项目与成果"]
    B --> A4["Agent 4：成长、汇报与图表"]
    A3 --> G2["Agent 5：第二波集成与接线"]
    A4 --> G2
    G2 --> V["完整测试、桌面/移动端、打印验收"]
```

所有 agent 只向主协调者交付提交和结构化交接说明，agent 之间不直接合并代码。共享契约发生变化时，由主协调者判断是否重新冻结基线。

## 3. 基线与分支规则

- 当前设计基线提交为 `c92526e`。
- 执行前先处理或隔离主工作区中未提交的 `.gitignore`，不得覆盖或带入任何 agent 提交。
- Agent 1 与 Agent 2 从同一个干净基线创建独立 worktree。
- 第一波通过后，由 Agent 5 形成新的“基础集成提交”。
- Agent 3 与 Agent 4 必须从该基础集成提交创建新的 worktree，不得继续基于 `c92526e` 开发。
- 每个 agent 至少提交一个可独立回退的提交；禁止一个提交同时混入其他 agent 的职责。
- agent 不执行 merge、rebase 或 push；这些操作由主协调者或 Agent 5 统一完成。

建议分支名：

| Agent | 分支 |
| --- | --- |
| Agent 1 | `yc_codex/trace-data-foundation` |
| Agent 2 | `yc_codex/trace-ui-foundation` |
| Agent 3 | `yc_codex/trace-work-outcomes` |
| Agent 4 | `yc_codex/trace-growth-reporting` |
| Agent 5 | 使用主协调分支，不单独开发业务功能 |

## 4. Agent 1：数据与契约基础

### 角色

数据架构与接口契约工程师。

### 目标

建立历史稳定的工作记录、工作当量来源、标准版本、多能力分配、Excel 标准导入和模块化后端入口，为后续项目、成果、成长和报告域提供稳定接口。

### 文件所有权

允许修改：

- `backend/src/database.ts`
- `backend/src/types.ts`
- `backend/src/index.ts`
- `backend/src/core/**`
- `backend/src/routes/records.ts`
- `backend/src/routes/workload.ts`
- `backend/src/routes/config.ts`
- `backend/src/routes/import.ts`
- `backend/test/**foundation*.test.ts`
- `backend/test/validation.test.ts`
- `frontend/src/types.ts`
- `frontend/src/types/domain/**`
- `frontend/src/lib/recordsApi.ts`
- `frontend/src/lib/workloadApi.ts`
- `frontend/src/lib/configApi.ts`
- `frontend/src/lib/settingsApi.ts`
- 对应的纯逻辑测试文件

禁止修改：

- `frontend/src/App.tsx`
- `frontend/src/styles.css`
- `frontend/src/components/**`
- `frontend/src/pages/**`
- 报告导出器和任何页面视觉样式

### 必须产出的共享契约

- 工作记录保存实际系数、系数来源和标准版本。
- 多能力分配合计为 `100%`，默认平均分配。
- 原始工作当量与能力分摊值使用不同字段和类型。
- 后端路由支持按域注册，使后续 agent 可以新增独立路由文件而不共同编辑大型处理函数。
- 前端领域类型与页面状态类型分离，后续 agent 不再共同修改单一 `types.ts`。
- 在 `frontend/src/types/domain/evidence.ts` 和 `backend/src/core/evidenceContracts.ts` 冻结跨域只读契约 `EvidencePeriodSnapshot`，至少包含周期、去重来源记录、项目摘要、成果摘要和能力证据；Agent 3 负责提供真实数据，Agent 4 只消费该契约。

跨域契约使用以下稳定形状，字段名在第二波不得自行改名：

```ts
export interface EvidencePeriodSnapshot {
  startDate: string;
  endDate: string;
  sourceRecordIds: string[];
  projects: ProjectEvidenceSummary[];
  outcomes: OutcomeEvidenceSummary[];
  abilities: AbilityEvidenceSummary[];
}

export interface ProjectEvidenceSummary {
  id: string;
  name: string;
  status: string;
  role: string;
  timeHours: number;
  workload: number;
  recordCount: number;
  outcomeCount: number;
  lastActivityDate: string;
}

export interface OutcomeEvidenceSummary {
  id: string;
  projectId: string | null;
  type: string;
  status: string;
  title: string;
  summary: string;
  value: string;
  completionDate: string | null;
  sourceRecordIds: string[];
  abilityIds: string[];
}

export interface AbilityEvidenceSummary {
  abilityId: string;
  abilityName: string;
  timeHours: number;
  workload: number;
  outcomeIds: string[];
  milestoneIds: string[];
}
```

### 交付门禁

- 数据迁移兼容现有 SQLite 数据。
- Excel 标准导入具备预览、冲突识别、确认写入和失败回滚测试。
- 新增计算和校验具有失败测试、通过测试及边界测试。
- `pnpm --filter @trace-report/backend typecheck` 通过。
- 相关 Node 测试通过。
- 提交交接说明，列出表结构、字段、接口路径、返回类型和历史兼容策略。

## 5. Agent 2：UI 系统与应用骨架

### 角色

设计系统与前端架构工程师。

### 目标

把已确认的视觉规范转换为稳定的设计变量、基础控件、分组导航、响应式应用外壳和可插拔页面入口，供两个业务 agent 复用。

### 文件所有权

允许修改：

- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/styles.css`
- `frontend/src/styles/tokens.css`
- `frontend/src/styles/base.css`
- `frontend/src/styles/layout.css`
- `frontend/src/styles/components.css`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/PageHeader.tsx`
- `frontend/src/components/PeriodNavigator.tsx`
- `frontend/src/components/StatCards.tsx`
- `frontend/src/components/TagPill.tsx`
- `frontend/src/components/ui/**`
- `frontend/src/components/layout/**`
- `frontend/src/navigation/**`
- `frontend/test/styles.test.ts`
- 新增的 UI 纯逻辑测试

禁止修改：

- `backend/**`
- `frontend/src/pages/**` 的业务内容
- 工作记录、工作当量、成长和报告计算逻辑
- `frontend/src/lib/*Api.ts`

### 必须产出的共享契约

- `216px` 桌面侧边栏及移动端顶部栏和抽屉导航。
- 七模块分组导航与统一页面标题区。
- 主要、次要、文字、危险按钮和图标按钮。
- 表单字段、搜索选择器、状态标签、筛选条、表格、详情栏、弹窗、空状态和错误状态基础组件。
- 页面级样式入口分离：工作成果域和成长汇报域拥有各自样式文件，避免共同修改全局样式。
- 页面注册接口稳定，Agent 3 和 Agent 4 只导出页面，不直接争用 `App.tsx`。

### 交付门禁

- 旧页面在新外壳下仍可访问，不要求此阶段完成业务重构。
- 设计变量覆盖已确认颜色、字体、间距、圆角、阴影和响应式规则。
- `pnpm --filter @trace-report/frontend typecheck` 通过。
- `pnpm --filter @trace-report/frontend build` 通过。
- 桌面与移动端外壳无导航、文字和按钮重叠。
- 提交交接说明，列出可复用组件及其 props。

## 6. Agent 5 第一次介入：基础集成门禁

Agent 5 不是等到最后才工作。第一波结束后，它负责：

1. 先合并 Agent 1，验证数据迁移和类型契约。
2. 再合并 Agent 2，解决前端类型导入和应用入口冲突。
3. 检查 `App.tsx`、`frontend/src/types.ts`、`styles.css`、`backend/src/index.ts` 和 `database.ts` 是否已经从共享热点转为稳定入口。
4. 运行完整测试、类型检查和构建。
5. 形成新的基础集成提交，并将准确提交号交给 Agent 3 和 Agent 4。

第一波任一完整门禁失败，都不得启动第二波业务开发。

## 7. Agent 3：记录、项目与成果

### 角色

工作证据链全栈工程师。

### 目标

实现今日工作台、工作台账、项目管理和成果管理，打通“记录与投入 -> 项目轨迹 -> 阶段进展、问题解决和正式成果”的核心链路。

### 文件所有权

允许修改：

- `frontend/src/pages/DailyPage.tsx`
- `frontend/src/pages/AllRecordsPage.tsx`
- `frontend/src/pages/WorkLedgerPage.tsx`
- `frontend/src/pages/ProjectsPage.tsx`
- `frontend/src/pages/ProjectDetailPage.tsx`
- `frontend/src/pages/OutcomesPage.tsx`
- `frontend/src/pages/OutcomeDetailPage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/pages/KnowledgePage.tsx`
- `frontend/src/components/RecordForm.tsx`
- `frontend/src/components/RecordList.tsx`
- `frontend/src/components/EditModal.tsx`
- `frontend/src/components/records/**`
- `frontend/src/components/projects/**`
- `frontend/src/components/outcomes/**`
- `frontend/src/components/settings/**`
- `frontend/src/lib/projectApi.ts`
- `frontend/src/lib/outcomeApi.ts`
- `frontend/src/styles/work-outcomes.css`
- `frontend/src/styles/settings-data.css`
- 对应前端测试
- `backend/src/domains/projects/**`
- `backend/src/domains/outcomes/**`
- 对应后端测试

禁止修改：

- Agent 2 建立的全局设计变量和基础 UI 组件内部实现
- `frontend/src/App.tsx`
- `frontend/src/navigation/**`
- `backend/src/index.ts`
- `backend/src/database.ts`
- 成长、报告、导出和打印文件

### 接口规则

- 只消费 Agent 1 冻结的工作记录和工作当量契约。
- 新的项目与成果类型放在各自领域目录，不回填到共享巨型类型文件。
- 实现 `GET /api/evidence/period-snapshot?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`，返回 Agent 1 冻结的 `EvidencePeriodSnapshot`，其中 `sourceRecordIds` 必须去重。
- 只导出页面入口和后端路由，不自行修改全局注册文件；由 Agent 5 接线。
- 样式只写入 `work-outcomes.css`，不得重定义品牌色、按钮或全局表格规则。

### 交付门禁

- 日报支持搜索联动、系数来源、手动草稿和多能力分配。
- 台账支持周期筛选、紧凑表格、详情追溯和从记录创建成果。
- 项目可查看投入、轨迹、成果和复盘。
- 成果可追溯来源记录，多成果汇总按记录去重。
- 原知识资产入口迁移为成果中的可复用资产，不保留附件和外部链接字段。
- 配置与数据页面支持标准维护、Excel 导入预览、分类停用、数据质量检查入口和备份恢复入口。
- 相关单元测试、接口测试、类型检查和前端构建通过。
- 提交交接说明，列出页面入口、路由导出、数据迁移和待集成接线点。

## 8. Agent 4：成长、汇报与图表

### 角色

成长分析与报告体验全栈工程师。

### 目标

实现目标、能力、成长里程碑、周报、月报、年报、职业复盘、行动型数据展板和汇报打印体验。

### 文件所有权

允许修改：

- `frontend/src/pages/GrowthPage.tsx`
- `frontend/src/pages/WeeklyPage.tsx`
- `frontend/src/pages/MonthlyPage.tsx`
- `frontend/src/pages/YearlyPage.tsx`
- `frontend/src/pages/ReportsPage.tsx`
- `frontend/src/components/ReportDashboard.tsx`
- `frontend/src/components/SummaryGroups.tsx`
- `frontend/src/components/SummaryList.tsx`
- `frontend/src/components/ExportPanel.tsx`
- `frontend/src/components/ReportModal.tsx`
- `frontend/src/components/growth/**`
- `frontend/src/components/reports/**`
- `frontend/src/components/charts/**`
- `frontend/src/lib/growthReview.ts`
- `frontend/src/lib/dashboard.ts`
- `frontend/src/lib/report.ts`
- `frontend/src/styles/growth-reports.css`
- 对应前端测试
- `backend/src/domains/growth/**`
- `backend/src/domains/reports/**`
- `backend/src/report.ts`
- `backend/src/exporters/**`
- 对应后端测试

禁止修改：

- 今日工作台、台账、项目和成果页面
- Agent 2 建立的全局设计变量和基础组件内部实现
- `frontend/src/App.tsx`
- `frontend/src/navigation/**`
- `backend/src/index.ts`
- `backend/src/database.ts`

### 接口规则

- 只消费 Agent 1 冻结的 `EvidencePeriodSnapshot`，不直接依赖 Agent 3 的数据库或组件实现。
- 并行开发期间使用符合 `EvidencePeriodSnapshot` 的 fixture；集成后改由 Agent 3 的 `GET /api/evidence/period-snapshot` 提供真实数据。
- 能力投入气泡图固定使用时间为横轴、能力为纵轴、气泡面积为分摊工作当量、颜色深浅为分摊工时、特殊描边为成果或里程碑。
- 不使用双坐标轴、雷达图、排行榜、综合个人评分或大面积饼图。
- 只导出页面入口和后端路由，由 Agent 5 统一注册。

### 交付门禁

- 多能力分摊不重复增加原始工作量。
- 目标进度有完成标准和证据，不允许任意百分比。
- 周报、月报和年报默认图表符合 UI 规范。
- 报告草稿手动保存，数据视图和报告内容视图分离。
- 年度折算不写回原始记录。
- A4 打印版隐藏应用控件且图表不被无意义截断。
- 相关单元测试、接口测试、类型检查和构建通过。
- 提交交接说明，列出页面入口、路由导出、图表数据接口和打印验收方式。

## 9. Agent 5：集成检查 Agent

### 角色

集成负责人、冲突审查者和最终质量门禁。

### 目标

在不重写业务实现的前提下合并各 agent 交付，完成共享入口接线、跨域口径检查、回归测试和真实界面验收。

### 允许修改

- `frontend/src/App.tsx`
- `frontend/src/navigation/**`
- `frontend/src/main.tsx`
- `backend/src/index.ts`
- 必要的共享类型入口和样式导入入口
- 根级测试脚本和确有必要的集成测试
- 由冲突直接导致的小范围修正

### 禁止修改

- 未经问题复现就大规模重写 Agent 3 或 Agent 4 的业务页面。
- 为通过测试而删除断言、跳过测试或降低类型约束。
- 顺手修改与本次升级无关的用户文件。
- 擅自改变产品边界、统计口径、颜色和图表定义。

### 最终工作顺序

- [ ] **Step 1: 核对交付范围**

确认每个 agent 的提交只包含允许文件，并阅读全部交接说明。

- [ ] **Step 2: 合并 Agent 3**

注册项目与成果后端路由、页面入口和导航项，运行其领域测试。

- [ ] **Step 3: 合并 Agent 4**

注册成长与报告后端路由、页面入口和导航项，运行其领域测试。

- [ ] **Step 4: 运行完整自动门禁**

Run: `pnpm run test`

Expected: 所有 Node 测试通过，无失败和跳过。

Run: `pnpm run typecheck`

Expected: 前后端 TypeScript 检查通过，无类型错误。

Run: `pnpm run build`

Expected: 前后端生产构建成功。

- [ ] **Step 5: 检查核心数据口径**

使用包含多能力、多成果、人工系数、历史标准版本和年度临时折算的固定数据，确认原始工作量只统计一次，图表与导出结果一致。

- [ ] **Step 6: 检查桌面与移动端**

启动本地应用，至少检查宽桌面、普通桌面和移动端视口。确认导航、表单、表格、侧栏、标签页、气泡图和热力图无重叠、溢出或空白渲染。

- [ ] **Step 7: 检查报告与打印**

检查周报、月报、年报的数据追溯、草稿保存、A4 打印分页、Excel 工作当量明细和年度临时折算。

- [ ] **Step 8: 完成回归审查**

确认旧数据可读取、标准变更不重算历史、停用分类仍可显示历史记录、删除操作提示影响范围。

- [ ] **Step 9: 形成集成提交**

只在所有门禁通过后创建最终集成提交，并在交付说明中列出测试结果、视觉检查视口和仍存在的非阻塞风险。

## 10. 每个 Agent 的交接格式

每个实施 agent 必须返回以下六项，不接受只回复“已完成”：

1. 提交号和提交标题。
2. 实际修改文件清单。
3. 新增或变更的数据结构与接口。
4. 已运行的测试命令及结果。
5. 需要 Agent 5 注册或接线的入口。
6. 已知限制、未实现内容和潜在冲突。

若 agent 需要修改禁止文件，应停止修改并把需求写入第 5 项，由 Agent 5 统一处理。

## 11. 冲突处理原则

- 文件冲突不采用“保留两边全部内容”的机械处理，先根据文件所有权判断责任方。
- 类型契约冲突以 Agent 1 的冻结版本为基础，由 Agent 5 补充兼容层。
- 视觉冲突以 Agent 2 的设计变量和基础组件为准，业务 agent 删除重复定义。
- 业务口径冲突以顶层产品设计为准，视觉呈现冲突以 UI 设计规范为准。
- Agent 3 与 Agent 4 之间只通过已发布接口交换数据，不直接读取对方组件内部状态。
- 集成失败必须先复现并定位，再决定退回责任 agent 或由 Agent 5 小范围修复。

## 12. 推荐执行方式

推荐使用 Subagent-Driven 执行：主协调者按波次启动 agent，每个任务使用新 agent，并在提交后进行需求符合性和代码质量两阶段检查。

不推荐一次启动四个实施 agent。正确顺序是：

1. 并行启动 Agent 1 和 Agent 2。
2. Agent 5 完成第一波集成门禁。
3. 从新的基础集成提交并行启动 Agent 3 和 Agent 4。
4. Agent 5 完成最终集成、自动测试和真实界面验收。

该流程最多同时运行两个实施 agent，能够获得并行收益，同时控制共享文件冲突和统计口径漂移。
