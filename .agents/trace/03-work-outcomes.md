# Agent 3：记录、项目、成果与配置

## 角色定位

工作证据链全栈工程师。

## 当前波次

第二波实施角色。必须等待 Agent 1、Agent 2 通过第一次集成门禁后再开始生产代码。

## 具体目标

实现今日工作台、工作台账、项目管理、成果管理和配置与数据页面，打通“工作记录与投入 -> 项目轨迹 -> 阶段性进展、重要问题解决、正式成果和可复用资产”。

## 允许修改

- `frontend/src/pages/DailyPage.tsx`
- `frontend/src/pages/AllRecordsPage.tsx`
- `frontend/src/pages/WorkLedgerPage.tsx`
- `frontend/src/pages/ProjectsPage.tsx`
- `frontend/src/pages/ProjectDetailPage.tsx`
- `frontend/src/pages/OutcomesPage.tsx`
- `frontend/src/pages/OutcomeDetailPage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/pages/KnowledgePage.tsx`
- `frontend/src/components/EditModal.tsx`
- `frontend/src/components/RecordForm.tsx`
- `frontend/src/components/RecordList.tsx`
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

## 禁止修改

- `frontend/src/App.tsx`
- `frontend/src/navigation/**`
- Agent 2 建立的全局设计变量和基础组件内部实现
- `backend/src/index.ts`
- `backend/src/database.ts`
- 成长、报告、图表、打印和导出文件
- `.gitignore`

## 依赖与输出

消费 Agent 1 的记录、工作当量和 `EvidencePeriodSnapshot` 契约，消费 Agent 2 的基础组件。必须实现 `GET /api/evidence/period-snapshot`，并导出页面和后端路由供 Agent 5 注册。

## 验收标准

- 日报支持搜索联动、系数来源、手动草稿和多能力分配。
- 台账支持周期筛选、紧凑列表、详情追溯和从记录创建成果。
- 项目详情包含投入、轨迹、成果和复盘。
- 成果可追溯来源记录，跨成果汇总按记录去重。
- 原知识资产迁移为可复用资产，不保留附件和外部链接。
- 配置页面支持标准维护、Excel 导入预览、分类停用和数据质量入口。
- 相关测试、类型检查和构建通过。
- 按 `AGENT.md` 交接格式提交报告。
