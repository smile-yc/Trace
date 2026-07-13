import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { IconButton } from "./IconButton";

export interface ModalDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "small" | "medium" | "large";
  closeOnBackdrop?: boolean;
  onClose: () => void;
}

export function ModalDialog({
  open,
  title,
  children,
  footer,
  size = "medium",
  closeOnBackdrop = true,
  onClose
}: ModalDialogProps) {
  const titleId = useId();

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
    <div className="ui-modal-layer" role="presentation" onMouseDown={(event) => {
      if (closeOnBackdrop && event.target === event.currentTarget) onClose();
    }}>
      <section className={`ui-modal ui-modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="ui-overlay-header">
          <h2 id={titleId}>{title}</h2>
          <IconButton icon={<X size={20} />} label="关闭弹窗" onClick={onClose} />
        </header>
        <div className="ui-overlay-body">{children}</div>
        {footer && <footer className="ui-overlay-footer">{footer}</footer>}
      </section>
    </div>
  );
}
