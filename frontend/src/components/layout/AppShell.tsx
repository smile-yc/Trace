import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sidebar } from "../Sidebar";
import { useFocusScope } from "../ui/focusScope";
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
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const drawerBackgroundRefs = useMemo(() => [topbarRef, workspaceRef], []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const handleChange = () => setMobile(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useFocusScope({
    open: mobile && drawerOpen,
    containerRef: sidebarRef,
    onEscape: closeDrawer,
    returnFocusRef: menuButtonRef,
    backgroundRefs: drawerBackgroundRefs,
    lockBodyScroll: true
  });

  function handleNavigate(pageId: string) {
    onNavigate(pageId);
    setDrawerOpen(false);
  }

  return (
    <div className="app-shell">
      <MobileTopBar ref={topbarRef} menuButtonRef={menuButtonRef} open={drawerOpen} title={activePageLabel} onMenuOpen={() => setDrawerOpen(true)} />
      <Sidebar
        ref={sidebarRef}
        activePageId={activePageId}
        isOpen={drawerOpen}
        mobileHidden={mobile && !drawerOpen}
        navigation={navigation}
        footer={footer}
        onNavigate={handleNavigate}
        onClose={closeDrawer}
      />
      {drawerOpen && <button className="drawer-scrim no-print" type="button" aria-label="关闭导航" onClick={closeDrawer} />}
      <main ref={workspaceRef} className="app-workspace workspace">
        <div className="app-workspace-inner">{children}</div>
      </main>
    </div>
  );
}
