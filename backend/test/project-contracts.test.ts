import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProjectDateRange,
  isProjectSelectable,
  normalizeProjectIdentity
} from "../src/core/projects.ts";

test("project identity only trims surrounding whitespace", () => {
  assert.equal(normalizeProjectIdentity("  Trace  "), "Trace");
  assert.notEqual(normalizeProjectIdentity("Trace"), normalizeProjectIdentity("trace"));
  assert.notEqual(normalizeProjectIdentity("Trace  项目"), normalizeProjectIdentity("Trace 项目"));
});

test("project date ranges reject an end before the start", () => {
  assert.throws(
    () => assertProjectDateRange("2026-07-20", "2026-07-19"),
    /PROJECT_INVALID_DATE_RANGE/
  );
  assert.doesNotThrow(() => assertProjectDateRange("2026-07-20", ""));
});

test("merged sources are not selectable", () => {
  assert.equal(isProjectSelectable({ status: "archived", mergedIntoProjectId: "target" }), false);
  assert.equal(isProjectSelectable({ status: "archived", mergedIntoProjectId: null }), true);
});
