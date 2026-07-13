import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { buildFieldAria } from "./formFieldAria";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

type FieldControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
  required?: true;
};

export function FormField({ label, htmlFor, hint, error, required = false, children, className = "" }: FormFieldProps) {
  const generatedId = useId().replace(/:/g, "");
  const control = isValidElement(children) ? children as ReactElement<FieldControlProps> : null;
  const controlId = htmlFor ?? (typeof control?.props.id === "string" ? control.props.id : `field-${generatedId}`);
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const fieldControl = control
    ? cloneElement(control, buildFieldAria({
        controlId,
        hintId,
        errorId,
        hasHint: Boolean(hint),
        hasError: Boolean(error),
        required,
        describedBy: typeof control.props["aria-describedby"] === "string" ? control.props["aria-describedby"] : undefined
      }))
    : children;

  return (
    <div className={`ui-field ${error ? "has-error" : ""} ${className}`.trim()}>
      <label className="ui-field-label" htmlFor={controlId}>
        {label}
        {required && <span className="ui-field-required" aria-hidden="true">*</span>}
      </label>
      {fieldControl}
      {hint && <div className="ui-field-hint" id={hintId}>{hint}</div>}
      {error && <div className="ui-field-error" id={errorId} role="alert">{error}</div>}
    </div>
  );
}
