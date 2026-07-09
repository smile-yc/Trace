export function getInitialOptionFieldValue(recordValue: string | null | undefined): string {
  return recordValue ?? "";
}

export function getPostSubmitCoefficientValue({
  coefficientTouched,
  matchedCoefficient
}: {
  coefficientTouched: boolean;
  matchedCoefficient: number | null | undefined;
}): number | null {
  if (matchedCoefficient === null || matchedCoefficient === undefined) return null;

  const coefficient = Number(matchedCoefficient);
  if (coefficientTouched || !Number.isFinite(coefficient) || coefficient < 0) return null;
  return coefficient;
}
