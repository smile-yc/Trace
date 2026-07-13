import { Menu } from "lucide-react";
import { forwardRef, type RefObject } from "react";

interface MobileTopBarProps {
  open: boolean;
  title: string;
  menuButtonRef: RefObject<HTMLButtonElement>;
  onMenuOpen: () => void;
}

export const MobileTopBar = forwardRef<HTMLElement, MobileTopBarProps>(function MobileTopBar({ open, title, menuButtonRef, onMenuOpen }, ref) {
  return (
    <header ref={ref} className="mobile-topbar no-print">
      <button ref={menuButtonRef} className="ui-icon-button" type="button" aria-label="打开导航" title="打开导航" aria-expanded={open} aria-controls="app-navigation" onClick={onMenuOpen}>
        <Menu aria-hidden="true" size={20} />
      </button>
      <span className="mobile-topbar-title">{title}</span>
    </header>
  );
});
