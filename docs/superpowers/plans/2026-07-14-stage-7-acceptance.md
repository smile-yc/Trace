# Stage 7 Acceptance

Stage 7 closes the staged Trace roadmap by checking that the product is integrated as seven stable modules:

1. 今日工作台
2. 工作台账
3. 项目管理
4. 成果管理
5. 成长与目标
6. 复盘与汇报
7. 配置与数据

## Acceptance Scope

- Navigation exposes the seven confirmed product modules in order.
- Weekly, monthly, and yearly report pages remain grouped under 复盘与汇报.
- Settings owns configuration, workload standards, analysis rules, Excel import, backup, restore preview, and year archive in one tab group.
- Data maintenance does not create a duplicate top-level navigation entry.
- Stage 6 backup and year archive flows are covered by API tests.

## Verification

- `pnpm run test`
- `pnpm run build`
- Local frontend and backend smoke checks after merge when a dev server is running.
