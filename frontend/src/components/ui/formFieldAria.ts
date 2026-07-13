interface BuildFieldAriaOptions {
  controlId: string;
  hintId: string;
  errorId: string;
  hasHint: boolean;
  hasError: boolean;
  required: boolean;
  describedBy?: string;
}

export interface FieldAriaProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
  required?: true;
}

export function buildFieldAria({
  controlId,
  hintId,
  errorId,
  hasHint,
  hasError,
  required,
  describedBy
}: BuildFieldAriaOptions): FieldAriaProps {
  const descriptionIds = [describedBy, hasHint ? hintId : undefined, hasError ? errorId : undefined].filter(Boolean).join(" ");

  return {
    id: controlId,
    ...(descriptionIds ? { "aria-describedby": descriptionIds } : {}),
    ...(hasError ? { "aria-invalid": true as const } : {}),
    ...(required ? { "aria-required": true as const, required: true as const } : {})
  };
}
