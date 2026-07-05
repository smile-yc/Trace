import {
  CalendarDays,
  CalendarRange,
  Database,
  FileStack,
  Layers,
  ListFilter,
  SlidersHorizontal,
  type LucideIcon
} from "lucide-react";
import { VIEWS } from "../constants";
import type { ViewMode, WorkRecord } from "../types";

const icons: Record<ViewMode, LucideIcon> = {
  daily: CalendarDays,
  weekly: CalendarRange,
  monthly: FileStack,
  yearly: Layers,
  all: ListFilter,
  settings: SlidersHorizontal
};

interface SidebarProps {
  activeView: ViewMode;
  records: WorkRecord[];
  onViewChange: (view: ViewMode) => void;
}

export function Sidebar({ activeView, records, onViewChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Database size={22} />
        </div>
        <div>
          <strong>工作报告</strong>
          <span>Trace Report</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="报告视图">
        {VIEWS.map((view) => {
          const Icon = icons[view.key];
          const isActive = activeView === view.key;
          return (
            <button
              className={`nav-item ${isActive ? "active" : ""}`}
              key={view.key}
              onClick={() => onViewChange(view.key)}
              type="button"
            >
              <Icon size={18} />
              <span>{view.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span>数据库记录</span>
        <strong>{records.length}</strong>
      </div>
    </aside>
  );
}
