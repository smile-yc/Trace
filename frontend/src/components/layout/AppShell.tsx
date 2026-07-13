import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "../Sidebar";
import type { TraceNavigationItem } from "../../navigation";
import { MobileTopBar } from "./MobileTopBar";

interface AppShellProps {
  activePageId: string;
  activePageLabel: string;
  navigation: ReadonlyArray<TraceNavigationItem>;
  footer?: ReactNode;
  children: ReactNode;
  onNavigate: (pageId: string) => void;
}

export function AppShell({ activePageId, activePageLabel, navigation, footer, children, onNavigate }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [drawerOpen]);

  function handleNavigate(pageId: string) {
    onNavigate(pageId);
    setDrawerOpen(false);
  }

  return (
    <div className="app-shell">
      <MobileTopBar title={activePageLabel} onMenuOpen={() => setDrawerOpen(true)} />
      <Sidebar
        activePageId={activePageId}
        isOpen={drawerOpen}
        navigation={navigation}
        footer={footer}
        onNavigate={handleNavigate}
        onClose={() => setDrawerOpen(false)}
      />
      {drawerOpen && <button className="drawer-scrim no-print" type="button" aria-label="关闭导航" onClick={() => setDrawerOpen(false)} />}
      <main className="app-workspace workspace">
        <div className="app-workspace-inner">{children}</div>
      </main>
    </div>
  );
}
