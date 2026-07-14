# Trace 工作报告系统

Trace 是一个个人工作台账与复盘系统，用来记录日报，按周、月、年汇总工作量，并把工作记录沉淀成可用于复盘、年终总结和培养计划跟踪的数据源。

它不是单纯的记事本。系统会围绕工作当量、投入时间、业务分类、能力维度、项目、产品系统等口径做统计，帮助回答：

- 今天、这周、这个月、今年具体做了什么。
- 哪些项目和业务占用了主要精力。
- 工作当量和投入时间如何变化。
- 能力维度投入是否均衡，是否存在查漏补缺提醒。
- 哪些内容已经形成正式成果、问题解决、阶段进展或可复用资产。

## 文档说明

根目录下保留 3 份主要文档：

- `README.md`：项目入口文档。用于快速了解项目是什么、怎么安装、怎么运行、怎么构建、数据存在哪里。
- `PROJECT_ARCHITECTURE.md`：架构说明文档。用于理解前后端分层、目录职责、数据流、数据库和部署结构。
- `REQUIREMENTS.md`：需求与任务文档。用于保存产品目标、功能规划、验收标准和后续迭代事项。

建议这三份都保留。`README.md` 面向使用和启动，`PROJECT_ARCHITECTURE.md` 面向维护代码，`REQUIREMENTS.md` 面向后续开发计划。

## 技术栈

- 前端：React + TypeScript + Vite + lucide-react
- 后端：Node.js + Express + TypeScript
- 数据库：SQLite 单文件数据库
- 校验：zod
- 导出：docx、pdfkit、exceljs
- 包管理：pnpm workspace

## 运行环境

- Node.js：建议 24 或以上
- pnpm：项目声明版本为 11.7.0

后端使用 Node 的 SQLite 能力，低版本 Node 可能无法正常运行。

## 快速启动

第一次拉取项目后安装依赖：

```bash
pnpm install
```

启动前后端开发服务：

```bash
pnpm run dev
```

默认访问地址：

- 前端：http://localhost:5173
- 后端：http://localhost:4100
- 健康检查：http://localhost:4100/api/health

如果 `5173` 被占用，Vite 会自动切换到 `5174`、`5175` 等端口。

Windows 下如果没有全局 Node/pnpm，也可以用项目脚本分别启动：

```powershell
.\scripts\start-dev.ps1 backend
.\scripts\start-dev.ps1 frontend
```

## 常用命令

```bash
pnpm run dev        # 同时启动前端和后端开发服务
pnpm run test       # 运行后端和前端的 node:test 测试
pnpm run typecheck  # TypeScript 类型检查
pnpm run build      # 构建后端 dist 和前端 dist
pnpm run start      # 启动已构建的后端服务
```

## 核心功能

- 日报记录：新增、编辑、删除、按日期查看。
- 工作台账：支持周、月、年、自定义日期及项目、分类、能力、系数来源、成果状态等组合筛选，提供范围统计、紧凑详情、批量成果和数据质量提醒。
- 项目管理：维护项目状态、简称和别名，查看项目投入、当前重点与工作时间线，支持归档、恢复和合并。
- 项目关联：日报明确区分项目事项与非项目事项；历史文本保留为名称快照，不会因项目改名或合并被覆盖。
- 周报、月报、年报：按周期汇总记录、项目、当量和投入时间。
- 数据展板：展示业务分类占比、能力维度占比、工作量趋势、项目排行、产品系统分布、工作中心排行等。
- 配置中心：维护业务分类、工作类型、能力维度、产品系统、子任务、当量标准、分析权重和预警规则。
- 工作当量：支持数量和折算系数，默认按 `数量 × 折算系数` 计算，也可通过当量标准自动匹配系数。
- 能力复盘：按能力维度统计投入，支持目标占比预警。
- 成长地图：维护里程碑目标、当前进度、截止日期和启用状态。
- 成果管理：统一维护正式交付成果、重要问题解决、阶段性进展和可复用资产，并关联项目与多条日报。
- 报告生成：按标签或周期生成文本报告。
- 文件导出：支持 Word、PDF、Excel 和 JSON 备份。

## 数据存储

默认数据库文件：

```text
backend/data/report.sqlite
```

这个 SQLite 文件保存工作记录、项目与别名、成果及关联证据、配置项、当量标准、系统设置和里程碑。备份这个文件，就等于备份系统的主要业务数据。

可以通过环境变量修改数据目录或数据库路径：

```bash
DATA_DIR=/data/trace-report
DB_PATH=/data/trace-report/report.sqlite
PORT=4100
```

## 后端接口概览

```text
GET    /api/health
GET    /api/records
GET    /api/records/:id/impact
POST   /api/records
PUT    /api/records/:id
DELETE /api/records/:id
DELETE /api/records

GET    /api/projects
GET    /api/projects/:id
GET    /api/projects/:id/summary
POST   /api/projects
PATCH  /api/projects/:id
POST   /api/projects/:id/archive
POST   /api/projects/:id/reactivate
GET    /api/projects/:id/merge-preview
POST   /api/projects/:id/merge

GET    /api/config-options
POST   /api/config-options
PUT    /api/config-options/:id
DELETE /api/config-options/:id
POST   /api/config-options/reorder

GET    /api/workload-standards
POST   /api/workload-standards
PUT    /api/workload-standards/:id
DELETE /api/workload-standards/:id
GET    /api/workload-standards/match

GET    /api/settings
PUT    /api/settings

GET    /api/milestones
POST   /api/milestones
PUT    /api/milestones/:id

GET    /api/knowledge-assets

GET    /api/outcomes
GET    /api/outcomes/:id
POST   /api/outcomes
PUT    /api/outcomes/:id
POST   /api/outcomes/:id/archive
POST   /api/outcomes/:id/reactivate

POST   /api/export/docx
POST   /api/export/pdf
POST   /api/export/xlsx
```

## 主要数据模型

```ts
interface WorkRecord {
  id: string;
  date: string;
  title: string;
  content: string;
  category: "三新业务" | "技术支持" | "工程调试" | "售前支持" | "其他";
  businessCategory: string;
  workType: string;
  abilityDimension: string;
  projectId: string | null;
  projectRelation: "project" | "non_project" | "unassigned";
  projectName: string;
  productSystem: string;
  subtask: string;
  quantity: number | null;
  coefficient: number | null;
  workload: number | null;
  timeHours: number | null;
  tags: string;
  createTime: number;
  updateTime: number;
}
```

`projectName` 是记录创建时的项目名称快照。项目改名或合并只更新关联 ID，不改写历史快照。新记录必须明确选择项目事项或非项目事项；迁移后仍未建立关系的旧记录标记为 `unassigned`。

```ts
interface Project {
  id: string;
  name: string;
  shortName: string;
  aliases: string[];
  status: "planned" | "active" | "paused" | "completed" | "archived";
  startDate: string;
  endDate: string;
  personalRole: string;
  goal: string;
  description: string;
  completionSummary: string;
  mergedIntoProjectId: string | null;
}
```

二级标签支持空格、英文逗号、中文逗号和顿号分隔，保存前会自动去重，并统一为英文逗号分隔。

## 项目结构速览

```text
Trace/
├─ backend/                 # Express API、SQLite、导出服务
│  ├─ src/
│  │  ├─ index.ts           # API 入口和路由
│  │  ├─ database.ts        # SQLite 初始化、迁移式补列、数据读写
│  │  ├─ report.ts          # 报告和文件名工具
│  │  └─ exporters/         # Word / PDF / Excel 导出
│  └─ test/                 # 后端测试
├─ frontend/                # React + Vite 前端
│  ├─ src/
│  │  ├─ components/        # 通用组件和报表组件
│  │  ├─ pages/             # 日报、周报、月报、年报等页面
│  │  ├─ lib/               # API、统计、日期、复盘等工具
│  │  └─ styles.css         # 全局样式
│  └─ test/                 # 前端逻辑和样式约束测试
├─ scripts/                 # 本地启动脚本
├─ PROJECT_ARCHITECTURE.md  # 架构说明
├─ REQUIREMENTS.md          # 需求与任务清单
└─ README.md                # 项目入口说明
```

更完整的结构说明见 `PROJECT_ARCHITECTURE.md`。

## 部署提示

生产部署推荐：

- `pnpm run build` 构建前后端。
- 用 Nginx 托管 `frontend/dist`。
- 用 PM2 或系统服务运行 `backend/dist/index.js`。
- Nginx 将 `/api` 反向代理到 `127.0.0.1:4100`。
- 定期备份 `backend/data/report.sqlite` 或自定义 `DB_PATH` 指向的数据库文件。

当前系统没有账号登录。部署到公网前，建议增加登录鉴权，或至少使用 Nginx Basic Auth 做访问保护。
## Data Maintenance

Trace supports year-end data maintenance from Settings:

- Import the annual workload-standard Excel sheet into a new standard version after previewing new, duplicate, conflict, and invalid rows.
- Download a compressed full backup package.
- Preview restore impact before replacing local data from a backup package.
- Create a yearly archive package without deleting source records, outcomes, or report reviews.
