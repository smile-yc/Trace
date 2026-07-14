import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import type { RecordInput } from "../src/types.ts";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/records.ts", import.meta.url))],
  bundle: true,
  platform: "node",
  format: "cjs",
  define: { "import.meta.env": JSON.stringify({ VITE_API_BASE: "" }) },
  write: false
});
const compiledModule = {
  exports: {} as typeof import("../src/lib/records.ts")
};
const executeBundle = new Function("require", "module", "exports", result.outputFiles[0].text);
executeBundle(() => undefined, compiledModule, compiledModule.exports);
const { createRecord, sanitizeRecord } = compiledModule.exports;

test("createRecord snapshots manual workload provenance and allocated abilities", () => {
  const input: RecordInput = {
    date: "2026-07-14",
    title: "Foundation integration",
    content: "Keep local record helpers aligned with the API contract.",
    category: "" as RecordInput["category"],
    businessCategory: "Traditional",
    workType: "Commissioning",
    abilityDimension: "Engineering,Documentation",
    projectName: "Trace",
    productSystem: "Trace",
    subtask: "Integration",
    quantity: 2,
    coefficient: 1.5,
    workloadUnit: " item ",
    timeHours: 4,
    abilityAllocations: [
      { abilityId: "engineering", abilityName: "Engineering", percentage: 75 },
      { abilityId: "documentation", abilityName: "Documentation", percentage: 25 }
    ],
    tags: "integration"
  };

  const record = createRecord(input);

  assert.equal(record.workload, 3);
  assert.equal(record.workloadUnit, "item");
  assert.equal(record.coefficientSource, "manual");
  assert.equal(record.coefficientStandardId, null);
  assert.equal(record.coefficientStandardVersionId, null);
  assert.equal(record.workloadFormulaVersion, "quantity_x_coefficient_v1");
  assert.deepEqual(record.abilityAllocations, [
    {
      abilityId: "engineering",
      abilityName: "Engineering",
      percentage: 75,
      allocatedTimeHours: 3,
      allocatedWorkload: 2.25
    },
    {
      abilityId: "documentation",
      abilityName: "Documentation",
      percentage: 25,
      allocatedTimeHours: 1,
      allocatedWorkload: 0.75
    }
  ]);
});

test("sanitizeRecord backfills legacy provenance and equal ability allocations", () => {
  const record = sanitizeRecord({
    id: "legacy-record",
    date: "2025-12-31",
    quantity: 3,
    coefficient: 2,
    timeHours: 5,
    abilityDimension: "Engineering,Documentation"
  });

  assert.ok(record);
  assert.equal(record.workload, 6);
  assert.equal(record.workloadUnit, "");
  assert.equal(record.coefficientSource, "legacy");
  assert.equal(record.coefficientStandardId, null);
  assert.equal(record.coefficientStandardVersionId, null);
  assert.equal(record.workloadFormulaVersion, "quantity_x_coefficient_v1");
  assert.deepEqual(record.abilityAllocations, [
    {
      abilityId: "legacy:Engineering",
      abilityName: "Engineering",
      percentage: 50,
      allocatedTimeHours: 2.5,
      allocatedWorkload: 3
    },
    {
      abilityId: "legacy:Documentation",
      abilityName: "Documentation",
      percentage: 50,
      allocatedTimeHours: 2.5,
      allocatedWorkload: 3
    }
  ]);
});

test("sanitizeRecord preserves an existing standard provenance snapshot", () => {
  const record = sanitizeRecord({
    id: "standard-record",
    date: "2026-07-14",
    quantity: 2,
    coefficient: 4,
    timeHours: 1,
    workloadUnit: "item",
    coefficientSource: "standard_general",
    coefficientStandardId: "standard-1",
    coefficientStandardVersionId: "version-1",
    workloadFormulaVersion: "quantity_x_coefficient_v1",
    abilityAllocations: [
      {
        abilityId: "engineering",
        abilityName: "Engineering",
        percentage: 100,
        allocatedTimeHours: 0,
        allocatedWorkload: 0
      }
    ]
  });

  assert.ok(record);
  assert.equal(record.coefficientSource, "standard_general");
  assert.equal(record.coefficientStandardId, "standard-1");
  assert.equal(record.coefficientStandardVersionId, "version-1");
  assert.deepEqual(record.abilityAllocations, [
    {
      abilityId: "engineering",
      abilityName: "Engineering",
      percentage: 100,
      allocatedTimeHours: 1,
      allocatedWorkload: 8
    }
  ]);
});
