import type { BusinessCategory, Category, ViewMode, WorkType } from "./types";

export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export const CATEGORIES: Category[] = ["三新业务", "技术支持", "工程调试", "售前支持", "其他"];

export const BUSINESS_CATEGORIES: BusinessCategory[] = ["三新业务", "传统业务", "其他"];

export const WORK_TYPES: WorkType[] = [
  "工程设计",
  "工程测试",
  "工程调试",
  "售前方案",
  "新产品导入",
  "问题处理",
  "现场支持",
  "现场质量检查",
  "其他项"
];

export const PRODUCT_SYSTEMS = ["GM1000", "GM2000", "GM6000", "GM7000", "PHM", "智能巡检", "其他"];

export const SUBTASK_TEMPLATES = [
  "牵引变电所",
  "分区所",
  "开闭所",
  "AT所",
  "配电所",
  "箱变/信号变",
  "综合变",
  "规约测试",
  "软件测试发布",
  "方案编制",
  "科研方案编制",
  "询价编制成本",
  "相关配合工作及测试实验",
  "现场支持",
  "其他"
];

export const VIEWS: Array<{ key: ViewMode; label: string }> = [
  { key: "daily", label: "日报" },
  { key: "weekly", label: "周报" },
  { key: "monthly", label: "月报" },
  { key: "yearly", label: "年报" },
  { key: "all", label: "全部记录" },
  { key: "settings", label: "配置中心" }
];
