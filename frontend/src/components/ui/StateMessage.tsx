import { AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface StateMessageProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ title, description, action, compact = false }: StateMessageProps) {
  return (
    <div className={`ui-state-message ${compact ? "is-compact" : ""}`}>
      <Inbox aria-hidden="true" size={22} />
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, description, action, compact = false }: StateMessageProps) {
  return (
    <div className={`ui-state-message ui-state-error ${compact ? "is-compact" : ""}`} role="alert">
      <AlertCircle aria-hidden="true" size={22} />
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}
