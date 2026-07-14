export interface AbilityAllocationDraft {
  abilityId: string;
  abilityName: string;
  percentage: number;
}

export function buildEqualAbilityAllocations(
  abilities: Array<Pick<AbilityAllocationDraft, "abilityId" | "abilityName">>
): AbilityAllocationDraft[] {
  if (!abilities.length) return [];
  const base = Math.floor(10000 / abilities.length) / 100;
  return abilities.map((ability, index) => ({
    ...ability,
    percentage: index === abilities.length - 1
      ? Number((100 - base * (abilities.length - 1)).toFixed(2))
      : base
  }));
}

export function validateAbilityAllocations(allocations: AbilityAllocationDraft[]): string | null {
  if (!allocations.length) return null;
  if (allocations.some((item) => !item.abilityId || !item.abilityName || !Number.isFinite(item.percentage) || item.percentage <= 0)) {
    return "每项能力投入比例必须大于 0%";
  }
  const total = Number(allocations.reduce((sum, item) => sum + item.percentage, 0).toFixed(2));
  return Math.abs(total - 100) <= 0.01 ? null : `能力投入比例合计需为 100%，当前为 ${total}%`;
}
