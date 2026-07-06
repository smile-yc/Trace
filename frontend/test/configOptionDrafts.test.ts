import assert from "node:assert/strict";
import test from "node:test";
import type { ConfigOption } from "../src/types.ts";
import {
  collectPersistedConfigOptionInputs,
  getConfigOptionMenuChoices,
  getConfigOptionDraftState
} from "../src/lib/configOptionDrafts.ts";

const baseOption = {
  id: "id",
  enabled: true,
  sortOrder: 10,
  isDefault: false,
  isSystem: false,
  createTime: 1,
  updateTime: 1
};

const options: ConfigOption[] = [
  { ...baseOption, id: "business-1", type: "businessCategory", label: "传统业务" },
  { ...baseOption, id: "work-1", type: "workType", label: "工程调试" },
  { ...baseOption, id: "product-1", type: "productSystem", label: "GM1000" },
  { ...baseOption, id: "subtask-1", type: "subtask", label: "开闭所" },
  { ...baseOption, id: "product-disabled", type: "productSystem", label: "GM6000", enabled: false }
];

test("existing enabled config values are not treated as custom drafts", () => {
  const state = getConfigOptionDraftState(options, "productSystem", " GM1000 ");

  assert.equal(state.isCustom, false);
  assert.equal(state.key, null);
});

test("business category custom value defaults to not persisted", () => {
  const state = getConfigOptionDraftState(options, "businessCategory", "临时分类");

  assert.equal(state.isCustom, true);
  assert.equal(state.defaultPersist, false);
  assert.equal(state.key, "businessCategory:临时分类");
});

test("work detail custom values default to persisted and collect selected inputs", () => {
  const values = {
    businessCategory: "临时分类",
    workType: "现场复核",
    productSystem: "GM6000",
    subtask: "专项排查"
  };
  const selections = {
    "businessCategory:临时分类": true,
    "subtask:专项排查": false
  };

  assert.deepEqual(collectPersistedConfigOptionInputs(options, values, selections), [
    { type: "businessCategory", label: "临时分类" },
    { type: "workType", label: "现场复核" },
    { type: "productSystem", label: "GM6000" }
  ]);
});

test("menu choices keep all candidates visible when current value is a default label", () => {
  const businessOptions: ConfigOption[] = [
    { ...baseOption, id: "business-1", type: "businessCategory", label: "三新业务" },
    { ...baseOption, id: "business-2", type: "businessCategory", label: "传统业务" },
    { ...baseOption, id: "business-3", type: "businessCategory", label: "其他" }
  ];

  assert.deepEqual(
    getConfigOptionMenuChoices(businessOptions, "businessCategory", "其他", ["三新业务", "传统业务", "其他"]),
    ["三新业务", "传统业务", "其他"]
  );
});

test("ability dimension custom values default to persisted", () => {
  const state = getConfigOptionDraftState(options, "abilityDimension", "solution-design");
  const values = {
    businessCategory: "传统业务",
    workType: "工程调试",
    productSystem: "GM1000",
    subtask: "开闭所",
    abilityDimension: "solution-design"
  };

  assert.equal(state.isCustom, true);
  assert.equal(state.defaultPersist, true);
  assert.deepEqual(collectPersistedConfigOptionInputs(options, values, {}), [
    { type: "abilityDimension", label: "solution-design" }
  ]);
});
