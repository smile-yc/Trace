import {
  CalendarDays,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Target,
  Trophy
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TraceModuleId = "records" | "work" | "growth" | "review" | "system";

export interface NavigationChild {
  id: string;
  label: string;
  pageId: string;
}

export interface TraceNavigationItem {
  id: string;
  label: string;
  group: "记录" | "工作" | "成长" | "复盘" | "系统";
  pageId?: string;
  icon: LucideIcon;
  disabled?: boolean;
  children?: ReadonlyArray<NavigationChild>;
}

export const TRACE_NAVIGATION: ReadonlyArray<TraceNavigationItem> = [
  { id: "daily", label: "今日工作台", group: "记录", pageId: "daily", icon: LayoutDashboard },
  { id: "all", label: "工作台账", group: "记录", pageId: "all", icon: FileText },
  { id: "projects", label: "项目管理", group: "工作", pageId: "projects", icon: FolderKanban },
  { id: "knowledge", label: "成果管理", group: "工作", pageId: "knowledge", icon: Trophy },
  {
    id: "growth",
    label: "成长与目标",
    group: "成长",
    pageId: "growth",
    icon: Target,
    children: [
      { id: "growth-overview", label: "目标概览", pageId: "growth" },
      { id: "growth-journal", label: "成长日志", pageId: "growth-journal" },
      { id: "cultivation-report", label: "光子星月报", pageId: "cultivation-report" }
    ]
  },
  {
    id: "reports",
    label: "复盘与汇报",
    group: "复盘",
    pageId: "weekly",
    icon: CalendarDays,
    children: [
      { id: "weekly", label: "周报", pageId: "weekly" },
      { id: "monthly", label: "月报", pageId: "monthly" },
      { id: "yearly", label: "年报", pageId: "yearly" }
    ]
  },
  { id: "settings", label: "配置与数据", group: "系统", pageId: "settings", icon: Settings }
];

export function getNavigationLabel(pageId: string): string {
  for (const item of TRACE_NAVIGATION) {
    if (item.pageId === pageId) return item.label;
    const child = item.children?.find((candidate) => candidate.pageId === pageId);
    if (child) return child.label;
  }

  return "Trace";
}
