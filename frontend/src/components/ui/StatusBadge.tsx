import { AlertTriangle, CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  icon?: ReactNode;
}

const defaultIcons: Record<Exclude<StatusTone, "neutral">, ReactNode> = {
  info: <Info size={14} />,
  success: <CircleCheck size={14} />,
  warning: <AlertTriangle size={14} />,
  danger: <CircleAlert size={14} />
};

export function StatusBadge({ children, tone = "neutral", icon }: StatusBadgeProps) {
  const statusIcon = icon ?? (tone === "neutral" ? null : defaultIcons[tone]);
  return (
    <span className={`ui-status ui-status-${tone}`}>
      {statusIcon && <span aria-hidden="true">{statusIcon}</span>}
      <span>{children}</span>
    </span>
  );
}
