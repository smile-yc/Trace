# Agent 2：UI 系统与应用骨架

## 角色定位

设计系统与前端架构工程师。

## 当前波次

第一波实施角色。可以与 Agent 1 并列存在，但只负责前端视觉基础和应用外壳。

## 具体目标

将 Trace UI 设计规范转换为设计变量、基础控件、分组导航、响应式应用外壳和可插拔页面入口，使后续业务页面不再各自定义颜色、按钮、圆角和布局。

## 允许修改

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

## 禁止修改

- `backend/**`
- `frontend/src/pages/**` 的业务内容
- `frontend/src/lib/*Api.ts`
- 工作当量、成长和报告计算逻辑
- `.gitignore`

## 依赖与输出

开始前阅读根目录 `AGENT.md` 和 UI 设计规范。必须提供稳定的页面注册接口和业务域样式入口，使 Agent 3、Agent 4 无需共同修改 `App.tsx` 或全局样式。

## 验收标准

- 桌面为 `216px` 分组侧边栏，移动端为顶部栏和抽屉导航。
- 七模块导航、统一标题区和基础交互组件可复用。
- 品牌色、字体、间距、圆角、状态和响应式规则由设计变量统一管理。
- 旧页面在新外壳下仍可访问。
- 前端定向测试、类型检查和生产构建通过。
- 桌面和移动端无导航、文字或按钮重叠。
- 按 `AGENT.md` 交接格式提交报告。
