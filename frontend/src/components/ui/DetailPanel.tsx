import { X } from "lucide-react";
import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { useFocusScope } from "./focusScope";

export interface DetailPanelProps {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "narrow" | "wide";
  initialFocusRef?: RefObject<HTMLElement>;
  returnFocusRef?: RefObject<HTMLElement>;
  onClose: () => void;
}

export function DetailPanel({ open, title, children, footer, width = "narrow", initialFocusRef, returnFocusRef, onClose }: DetailPanelProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useFocusScope({
    open,
    containerRef: panelRef,
    onEscape: onClose,
    initialFocusRef,
    returnFocusRef,
    inertAppRoot: true,
    lockBodyScroll: true
  });

  if (!open) return null;

  return createPortal(
    <div className="ui-detail-layer">
      <button className="ui-detail-scrim" type="button" aria-label="关闭详情" onClick={onClose} />
      <aside ref={panelRef} className={`ui-detail-panel ui-detail-${width}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="ui-overlay-header">
          <h2 id={titleId}>{title}</h2>
          <IconButton icon={<X size={20} />} label="关闭详情" data-focus-initial="true" onClick={onClose} />
        </header>
        <div className="ui-overlay-body">{children}</div>
        {footer && <footer className="ui-overlay-footer">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}
