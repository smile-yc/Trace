import assert from "node:assert/strict";
import test from "node:test";
import { buildReportInsights } from "../src/lib/reportInsights.ts";
import type { Outcome, WorkRecord } from "../src/types.ts";

function record(id: string, projectName: string, workload: number, timeHours: number): WorkRecord {
  return { id, title: id, date: "2026-07-01", projectName, workload, timeHours } as WorkRecord;
}

test("report insights compare periods and expose concentrated source records", () => {
  const current = [record("a", "Alpha", 8, 6), record("b", "Alpha", 2, 2), record("c", "Beta", 2, 1)];
  const previous = [record("old", "Alpha", 6, 4)];
  const outcomes = [{ id: "outcome", status: "completed" }] as Outcome[];

  const insights = buildReportInsights(current, previous, outcomes);

  assert.equal(insights.comparison.find((item) => item.key === "workload")?.deltaPercent, 100);
  assert.equal(insights.concentration.projectName, "Alpha");
  assert.equal(insights.concentration.records.length, 2);
  assert.equal(insights.output.completedOutcomeCount, 1);
});

test("high input without completed output produces an action reminder", () => {
  const insights = buildReportInsights([record("a", "Alpha", 10, 8)], [], []);
  assert.ok(insights.reminders.some((message) => message.includes("成果")));
});
