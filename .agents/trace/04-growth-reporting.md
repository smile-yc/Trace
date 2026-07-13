# Agent 4：成长、汇报与图表

## 角色定位

成长分析与报告体验全栈工程师。

## 当前波次

第二波实施角色。必须等待 Agent 1、Agent 2 通过第一次集成门禁后再开始生产代码。

## 具体目标

实现目标、能力、成长里程碑、周报、月报、年度总结、职业复盘、行动型数据展板、打印和导出体验。

## 允许修改

- `frontend/src/pages/GrowthPage.tsx`
- `frontend/src/pages/WeeklyPage.tsx`
- `frontend/src/pages/MonthlyPage.tsx`
- `frontend/src/pages/YearlyPage.tsx`
- `frontend/src/pages/ReportsPage.tsx`
- `frontend/src/components/ReportDashboard.tsx`
- `frontend/src/components/ReportModal.tsx`
- `frontend/src/components/SummaryGroups.tsx`
- `frontend/src/components/SummaryList.tsx`
- `frontend/src/components/ExportPanel.tsx`
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

## 禁止修改

- 今日工作台、台账、项目、成果和设置页面
- `frontend/src/App.tsx`
- `frontend/src/navigation/**`
- Agent 2 建立的全局设计变量和基础组件内部实现
- `backend/src/index.ts`
- `backend/src/database.ts`
- `.gitignore`

## 依赖与输出

只消费 Agent 1 冻结的 `EvidencePeriodSnapshot`，不得直接依赖 Agent 3 的数据库或组件。并行开发时使用契约 fixture，集成后由 Agent 3 的真实接口供数。

## 验收标准

- 多能力分摊不重复增加原始工作量。
- 目标进度由完成标准和证据表达，不允许任意百分比。
- 周报、月报、年报默认图表符合 UI 规范。
- 能力投入气泡图的轴、面积、颜色和描边语义正确。
- 数据视图和报告内容视图分离，报告草稿手动保存。
- 年度临时折算不写回原始数据。
- A4 打印版隐藏应用控件且分页稳定。
- 相关测试、类型检查和构建通过。
- 按 `AGENT.md` 交接格式提交报告。
