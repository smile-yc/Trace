import { Route, X } from "lucide-react";
import type { ReactNode } from "react";
import type { TraceNavigationItem } from "../navigation";

interface SidebarProps {
  activePageId: string;
  isOpen: boolean;
  navigation: ReadonlyArray<TraceNavigationItem>;
  footer?: ReactNode;
  onNavigate: (pageId: string) => void;
  onClose: () => void;
}

const GROUPS: ReadonlyArray<TraceNavigationItem["group"]> = ["记录", "工作", "成长", "复盘", "系统"];

export function Sidebar({ activePageId, isOpen, navigation, footer, onNavigate, onClose }: SidebarProps) {
  return (
    <aside id="app-navigation" className={`app-sidebar sidebar ${isOpen ? "is-open" : ""}`} aria-label="主导航">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark" aria-hidden="true">
          <Route size={21} />
        </div>
        <div className="sidebar-brand-copy">
          <strong>Trace</strong>
          <span>2026</span>
        </div>
        <button className="sidebar-close ui-icon-button" type="button" aria-label="关闭导航" title="关闭导航" onClick={onClose}>
          <X aria-hidden="true" size={20} />
        </button>
      </div>

      <nav className="sidebar-navigation" aria-label="Trace 模块">
        {GROUPS.map((group) => {
          const items = navigation.filter((item) => item.group === group);
          if (!items.length) return null;

          return (
            <section className={`nav-group ${group === "系统" ? "nav-group-system" : ""}`} key={group} aria-labelledby={`nav-${group}`}>
              <h2 id={`nav-${group}`} className="nav-group-label">
                {group}
              </h2>
              <div className="nav-group-items">
                {items.map((item) => {
                  const Icon = item.icon;
                  const childActive = item.children?.some((child) => child.pageId === activePageId) ?? false;
                  const active = item.pageId === activePageId || childActive;

                  return (
                    <div className="nav-entry" key={item.id}>
                      <button
                        className={`nav-item ${active ? "active" : ""}`}
                        type="button"
                        disabled={item.disabled}
                        aria-current={item.pageId === activePageId ? "page" : undefined}
                        onClick={() => item.pageId && onNavigate(item.pageId)}
                      >
                        <Icon aria-hidden="true" size={18} />
                        <span>{item.label}</span>
                      </button>
                      {item.children && (
                        <div className="nav-children">
                          {item.children.map((child) => (
                            <button
                              className={`nav-child ${activePageId === child.pageId ? "active" : ""}`}
                              type="button"
                              key={child.id}
                              aria-current={activePageId === child.pageId ? "page" : undefined}
                              onClick={() => onNavigate(child.pageId)}
                            >
                              {child.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>

      {footer && <div className="sidebar-summary">{footer}</div>}
    </aside>
  );
}
