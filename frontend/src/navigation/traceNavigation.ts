import {
  BookOpenCheck,
  BriefcaseBusiness,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  Settings2,
  TrendingUp,
  type LucideIcon
} from "lucide-react";

export type TraceModuleId = "daily" | "ledger" | "projects" | "outcomes" | "growth" | "reviews" | "settings";

export interface NavigationChild {
  id: string;
  label: string;
  pageId: string;
}

export interface TraceNavigationItem {
  id: TraceModuleId;
  label: string;
  group: "记录" | "工作" | "成长" | "复盘" | "系统";
  pageId?: string;
  icon: LucideIcon;
  disabled?: boolean;
  children?: ReadonlyArray<NavigationChild>;
}

export const TRACE_NAVIGATION: ReadonlyArray<TraceNavigationItem> = [
  { id: "daily", label: "今日工作台", group: "记录", pageId: "daily", icon: LayoutDashboard },
  { id: "ledger", label: "工作台账", group: "记录", pageId: "all", icon: ClipboardList },
  { id: "projects", label: "项目管理", group: "工作", icon: FolderKanban, disabled: true },
  { id: "outcomes", label: "成果管理", group: "工作", pageId: "knowledge", icon: BriefcaseBusiness },
  { id: "growth", label: "成长与目标", group: "成长", pageId: "growth", icon: TrendingUp },
  {
    id: "reviews",
    label: "复盘与汇报",
    group: "复盘",
    pageId: "monthly",
    icon: BookOpenCheck,
    children: [
      { id: "weekly", label: "周报", pageId: "weekly" },
      { id: "monthly", label: "月报", pageId: "monthly" },
      { id: "yearly", label: "年报", pageId: "yearly" }
    ]
  },
  { id: "settings", label: "配置与数据", group: "系统", pageId: "settings", icon: Settings2 }
];

export function getNavigationLabel(pageId: string): string {
  for (const item of TRACE_NAVIGATION) {
    if (item.pageId === pageId) return item.label;
    const child = item.children?.find((entry) => entry.pageId === pageId);
    if (child) return child.label;
  }
  return "Trace";
}
