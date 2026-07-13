import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "text" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  leadingIcon?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "secondary",
  leadingIcon,
  loading = false,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-button ui-button-${variant} ${className}`.trim()}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {leadingIcon && <span className="ui-button-icon" aria-hidden="true">{leadingIcon}</span>}
      <span>{loading ? "处理中..." : children}</span>
    </button>
  );
}
