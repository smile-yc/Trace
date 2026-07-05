import {
  Archive,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Database,
  Download,
  SlidersHorizontal,
  Tags,
  Trash2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { VIEWS } from "../constants";
import type { ViewMode } from "../types";

interface LayoutProps {
  activeView: ViewMode;
  totalRecords: number;
  totalTags: number;
  children: ReactNode;
  onViewChange: (view: ViewMode) => void;
  onExportJson: () => void;
  onClearAll: () => void;
}

const viewIcons: Record<ViewMode, LucideIcon> = {
  daily: CalendarDays,
  weekly: CalendarRange,
  monthly: Calendar,
  yearly: CalendarClock,
  all: Archive,
  settings: SlidersHorizontal
};

export function Layout({
  activeView,
  totalRecords,
  totalTags,
  children,
  onViewChange,
  onExportJson,
  onClearAll
}: LayoutProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Database size={22} />
          </div>
          <div>
            <div className="brand-title">报告台</div>
            <div className="brand-subtitle">Work trace</div>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {VIEWS.map((view) => {
            const Icon = viewIcons[view.key];
            return (
              <button
                key={view.key}
                type="button"
                className={`nav-item ${activeView === view.key ? "active" : ""}`}
                onClick={() => onViewChange(view.key)}
              >
                <Icon size={18} />
                <span>{view.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="mini-stats">
            <div>
              <strong>{totalRecords}</strong>
              <span>记录</span>
            </div>
            <div>
              <strong>{totalTags}</strong>
              <span>标签</span>
            </div>
          </div>

          <div className="sidebar-actions">
            <button type="button" className="icon-action" title="导出 JSON" onClick={onExportJson}>
              <Download size={17} />
            </button>
            <button type="button" className="icon-action" title="标签" onClick={() => onViewChange("all")}>
              <Tags size={17} />
            </button>
            <button type="button" className="icon-action danger" title="清空数据" onClick={onClearAll}>
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
