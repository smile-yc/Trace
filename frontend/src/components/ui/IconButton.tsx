import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  icon: ReactNode;
  label: string;
  variant?: "secondary" | "text" | "danger";
}

export function IconButton({ icon, label, variant = "text", className = "", title, ...props }: IconButtonProps) {
  return (
    <button
      className={`ui-icon-button ui-icon-button-${variant} ${className}`.trim()}
      type="button"
      aria-label={label}
      title={title ?? label}
      {...props}
    >
      {icon}
    </button>
  );
}
