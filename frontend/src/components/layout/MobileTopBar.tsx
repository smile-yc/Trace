import { Menu } from "lucide-react";

interface MobileTopBarProps {
  title: string;
  onMenuOpen: () => void;
}

export function MobileTopBar({ title, onMenuOpen }: MobileTopBarProps) {
  return (
    <header className="mobile-topbar no-print">
      <button className="ui-icon-button" type="button" aria-label="打开导航" title="打开导航" onClick={onMenuOpen}>
        <Menu aria-hidden="true" size={20} />
      </button>
      <span className="mobile-topbar-title">{title}</span>
    </header>
  );
}
