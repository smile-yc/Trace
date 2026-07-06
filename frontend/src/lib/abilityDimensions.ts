export function parseAbilityDimensions(value: string | null | undefined): string[] {
  const seen = new Set<string>();

  return String(value || "")
    .split(/[,，、;；\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

export function formatAbilityDimensions(values: string[]): string {
  return parseAbilityDimensions(values.join(",")).join(",");
}

export function formatAbilitySelectionSummary(value: string | null | undefined): string {
  const abilities = parseAbilityDimensions(value);
  return abilities.length ? `已选：${abilities.join("、")}` : "未选择能力";
}
