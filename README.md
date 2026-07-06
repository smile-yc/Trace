# 工作报告系统

一个前后端分离的日报、周报、月报、年报管理系统。当前版本已经改为服务端 SQLite 数据库存储，不再用浏览器 `localStorage` 保存业务记录。

## 技术栈

- 前端：React + TypeScript + Vite + lucide-react
- 后端：Node.js + Express + TypeScript
- 数据库：SQLite 单文件数据库
- 导出：docx、pdfkit、exceljs

## 快速启动

```bash
pnpm install
pnpm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:4100

如果 5173 被占用，Vite 会自动换成 5174、5175 等端口。

## 数据库存储位置

默认数据库文件：

```text
backend/data/report.sqlite
```

部署到云服务器后，业务数据就在这个 SQLite 文件里。备份这个文件，就等于备份系统里的记录数据。

也可以用环境变量指定位置：

```bash
DATA_DIR=/data/trace-report
DB_PATH=/data/trace-report/report.sqlite
```

## 常用脚本

```bash
pnpm run typecheck
pnpm run build
pnpm run start
```

Windows 下如果 PowerShell 没有全局 Node/pnpm，也可以使用：

```powershell
.\scripts\start-dev.ps1 backend
.\scripts\start-dev.ps1 frontend
```

## 核心功能

- 记录增删改查，写入即保存到服务端 SQLite
- 日报按日期切换，支持新增、编辑、删除和统计
- 周报、月报、年报按周期汇总
- 支持能力维度和投入时间记录，用于分析个人成长方向和真实精力投入
- 基础数据展板支持能力维度分布、投入时间趋势和工作重心排行
- 全部记录按日期倒序展示
- 二级标签筛选
- 按标签分组生成文本报告
- 报告弹窗预览和复制
- 导出 Word、PDF、Excel：Word/PDF 先显示统计摘要再显示明细；Excel 包含原始明细、业务分类、工作类型、项目、产品系统、当量统计、配置项备份和当量标准备份
- 周报、月报、年报支持当前周期导出，并支持按项目、按业务分类导出
- 导出 JSON 备份
- 一键清空全部记录，带二次确认
- 暗色模式、响应式布局、打印样式优化

## 后端接口

```text
GET    /api/health
GET    /api/records
POST   /api/records
PUT    /api/records/:id
DELETE /api/records/:id
DELETE /api/records
POST   /api/export/docx
POST   /api/export/pdf
POST   /api/export/xlsx
```

## 数据模型

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

二级标签输入支持空格、英文逗号、中文逗号和顿号分隔，保存前会自动去重，并统一为英文逗号分隔。

工作当量默认按 `数量 × 折算系数` 计算；折算系数可由配置中心的当量标准自动匹配，也可以在日报中手动调整。

## 部署提示

云服务器推荐：

- Node.js 24 或以上
- PM2 管理后端进程
- Nginx 托管前端静态文件，并把 `/api` 转发到 `127.0.0.1:4100`

当前系统没有账号登录。部署到公网后，如果不希望别人访问，需要加登录鉴权或至少用 Nginx Basic Auth 做一层保护。
