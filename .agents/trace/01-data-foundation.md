# Agent 1：数据与契约基础

## 角色定位

数据架构与接口契约工程师。

## 当前波次

第一波实施角色。可以与 Agent 2 并列存在，但不得修改 Agent 2 的前端外壳文件。

## 具体目标

建立历史稳定的工作记录、工作当量来源、标准版本、多能力分配、Excel 标准导入和模块化后端入口，并冻结供项目、成果、成长和报告共同消费的证据快照契约。

## 允许修改

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
- 对应纯逻辑测试

## 禁止修改

- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/styles.css`
- `frontend/src/styles/**`
- `frontend/src/components/**`
- `frontend/src/pages/**`
- `backend/src/exporters/**`
- `.gitignore`

## 依赖与输出

开始前阅读根目录 `AGENT.md` 和两份设计规范。必须冻结 `EvidencePeriodSnapshot`、`ProjectEvidenceSummary`、`OutcomeEvidenceSummary` 和 `AbilityEvidenceSummary` 的前后端一致类型；后续 Agent 3 实现真实数据，Agent 4 仅消费该契约。

## 验收标准

- 数据迁移兼容现有 SQLite 数据。
- 记录保存实际系数、来源和标准版本。
- 多能力分配合计校验为 `100%`，默认平均分配。
- 标准版本变化不重算历史。
- Excel 导入支持预览、重复与冲突识别、确认写入和失败回滚。
- 后端定向测试、类型检查和构建通过。
- 按 `AGENT.md` 交接格式提交报告。
