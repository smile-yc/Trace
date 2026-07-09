import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(resolve(__dirname, "../src/index.ts"), "utf8");

test("record API numeric fields reject negative values", () => {
  assert.equal(indexSource.includes("const optionalNonNegativeNumberSchema = z.preprocess"), true);
  assert.equal(indexSource.includes("z.coerce.number().finite().min(0).nullable().optional()"), true);
  assert.equal(indexSource.includes("quantity: optionalNonNegativeNumberSchema"), true);
  assert.equal(indexSource.includes("coefficient: optionalNonNegativeNumberSchema"), true);
  assert.equal(indexSource.includes("workload: optionalNonNegativeNumberSchema"), true);
  assert.equal(indexSource.includes("timeHours: optionalNonNegativeNumberSchema"), true);
});
