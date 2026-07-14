import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readExporter(file: string): string {
  return readFileSync(resolve(__dirname, `../src/exporters/${file}`), "utf8");
}

test("Excel raw records export project identity, relation label and immutable name snapshot", () => {
  const source = readExporter("excel.ts");

  assert.match(source, /\{ header: "项目ID", key: "projectId", width: 24 \}/);
  assert.match(source, /\{ header: "项目关联状态", key: "projectRelation", width: 16 \}/);
  assert.match(source, /\{ header: "项目名称快照", key: "projectName", width: 24 \}/);
  assert.match(source, /project:\s*"项目事项"/);
  assert.match(source, /non_project:\s*"非项目事项"/);
  assert.match(source, /unassigned:\s*"历史未关联"/);
  assert.match(source, /projectId: record\.projectId/);
  assert.match(source, /projectRelation: projectRelationLabels\[record\.projectRelation\]/);
  assert.match(source, /projectName: record\.projectName/);
  assert.equal(source.includes("adjustedWorkload"), false);
  assert.equal(source.includes("discount"), false);
});

test("Word and PDF reports keep snapshot and original totals", () => {
  for (const file of ["word.ts", "pdf.ts"]) {
    const source = readExporter(file);
    assert.match(source, /record\.projectName/);
    assert.match(source, /analysis\.totalWorkload/);
    assert.match(source, /analysis\.totalTimeHours/);
    assert.equal(source.includes("adjustedWorkload"), false);
    assert.equal(source.includes("discount"), false);
  }
});
