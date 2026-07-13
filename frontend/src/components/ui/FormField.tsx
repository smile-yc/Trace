import type { ReactNode } from "react";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, hint, error, required = false, children, className = "" }: FormFieldProps) {
  return (
    <div className={`ui-field ${error ? "has-error" : ""} ${className}`.trim()}>
      <label className="ui-field-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ui-field-required" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? <div className="ui-field-error" role="alert">{error}</div> : hint && <div className="ui-field-hint">{hint}</div>}
    </div>
  );
}
