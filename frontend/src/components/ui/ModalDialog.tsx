import { X } from "lucide-react";
import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { useFocusScope } from "./focusScope";

export interface ModalDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "small" | "medium" | "large";
  closeOnBackdrop?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  returnFocusRef?: RefObject<HTMLElement>;
  onClose: () => void;
}

export function ModalDialog({
  open,
  title,
  children,
  footer,
  size = "medium",
  closeOnBackdrop = true,
  initialFocusRef,
  returnFocusRef,
  onClose
}: ModalDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useFocusScope({
    open,
    containerRef: dialogRef,
    onEscape: onClose,
    initialFocusRef,
    returnFocusRef,
    inertAppRoot: true,
    lockBodyScroll: true
  });

  if (!open) return null;

  return createPortal(
    <div className="ui-modal-layer" role="presentation" onMouseDown={(event) => {
      if (closeOnBackdrop && event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} className={`ui-modal ui-modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="ui-overlay-header">
          <h2 id={titleId}>{title}</h2>
          <IconButton icon={<X size={20} />} label="关闭弹窗" data-focus-initial="true" onClick={onClose} />
        </header>
        <div className="ui-overlay-body">{children}</div>
        {footer && <footer className="ui-overlay-footer">{footer}</footer>}
      </section>
    </div>,
    document.body
  );
}
