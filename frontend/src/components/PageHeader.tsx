import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  context?: ReactNode;
  description?: string;
  status?: ReactNode;
  controls?: ReactNode;
  primaryAction?: ReactNode;
  /** Legacy bridge for existing pages. Prefer context. */
  eyebrow?: string;
  /** Legacy bridge for existing pages. Prefer controls and primaryAction. */
  actions?: ReactNode;
}

export function PageHeader({
  title,
  context,
  description,
  status,
  controls,
  primaryAction,
  actions
}: PageHeaderProps) {
  const pageContext = context;
  const pageControls = controls ?? actions;

  return (
    <header className="page-header">
      <div className="page-heading">
        {pageContext && <div className="page-context">{pageContext}</div>}
        <div className="page-title-row">
          <h1>{title}</h1>
          {status && <div className="page-status">{status}</div>}
        </div>
        {description && <p>{description}</p>}
      </div>
      {(pageControls || primaryAction) && (
        <div className="page-actions no-print">
          {pageControls && <div className="page-controls">{pageControls}</div>}
          {primaryAction && <div className="page-primary-action">{primaryAction}</div>}
        </div>
      )}
    </header>
  );
}
