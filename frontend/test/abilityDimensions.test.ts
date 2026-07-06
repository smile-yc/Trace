import assert from "node:assert/strict";
import test from "node:test";
import { formatAbilitySelectionSummary } from "../src/lib/abilityDimensions.ts";

test("formatAbilitySelectionSummary describes empty and selected abilities", () => {
  assert.equal(formatAbilitySelectionSummary(""), "未选择能力");
  assert.equal(formatAbilitySelectionSummary("工程技术,知识沉淀"), "已选：工程技术、知识沉淀");
});
