import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { IconButton } from "./IconButton";

export interface DetailPanelProps {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "narrow" | "wide";
  onClose: () => void;
}

export function DetailPanel({ open, title, children, footer, width = "narrow", onClose }: DetailPanelProps) {
  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-detail-layer">
      <button className="ui-detail-scrim" type="button" aria-label="关闭详情" onClick={onClose} />
      <aside className={`ui-detail-panel ui-detail-${width}`} role="dialog" aria-modal="true" aria-labelledby="detail-panel-title">
        <header className="ui-overlay-header">
          <h2 id="detail-panel-title">{title}</h2>
          <IconButton icon={<X size={20} />} label="关闭详情" onClick={onClose} />
        </header>
        <div className="ui-overlay-body">{children}</div>
        {footer && <footer className="ui-overlay-footer">{footer}</footer>}
      </aside>
    </div>
  );
}
