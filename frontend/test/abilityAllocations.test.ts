import assert from "node:assert/strict";
import test from "node:test";
import { buildEqualAbilityAllocations, validateAbilityAllocations } from "../src/lib/abilityAllocations.ts";

test("equal ability allocations always total 100 percent", () => {
  const allocations = buildEqualAbilityAllocations([
    { abilityId: "a", abilityName: "A" },
    { abilityId: "b", abilityName: "B" },
    { abilityId: "c", abilityName: "C" }
  ]);
  assert.deepEqual(allocations.map((item) => item.percentage), [33.33, 33.33, 33.34]);
  assert.equal(validateAbilityAllocations(allocations), null);
});

test("manual ability allocation reports an actionable total error", () => {
  assert.equal(validateAbilityAllocations([
    { abilityId: "a", abilityName: "A", percentage: 60 },
    { abilityId: "b", abilityName: "B", percentage: 30 }
  ]), "能力投入比例合计需为 100%，当前为 90%");
});
