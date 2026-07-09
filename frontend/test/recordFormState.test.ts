import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  getInitialOptionFieldValue,
  getPostSubmitCoefficientValue
} from "../src/lib/recordFormState.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const recordFormSource = readFileSync(resolve(__dirname, "../src/components/RecordForm.tsx"), "utf8");

test("new record form leaves configurable fields empty until config defaults load", () => {
  assert.equal(getInitialOptionFieldValue(undefined), "");
  assert.equal(getInitialOptionFieldValue("传统业务"), "传统业务");
  assert.match(
    recordFormSource,
    /useState<BusinessCategory>\([\s\S]*getInitialOptionFieldValue\(record\?\.businessCategory\)[\s\S]*\)/
  );
  assert.equal(recordFormSource.includes("useState(getInitialOptionFieldValue(record?.workType))"), true);
});

test("new record reset keeps matched standard coefficient for continuous entry", () => {
  assert.equal(
    getPostSubmitCoefficientValue({ coefficientTouched: false, matchedCoefficient: 1.5 }),
    1.5
  );
  assert.equal(getPostSubmitCoefficientValue({ coefficientTouched: true, matchedCoefficient: 1.5 }), null);
  assert.equal(getPostSubmitCoefficientValue({ coefficientTouched: false, matchedCoefficient: null }), null);
  assert.equal(recordFormSource.includes("getPostSubmitCoefficientValue({"), true);
  assert.equal(recordFormSource.includes("setCoefficientTouched(false)"), true);
});
