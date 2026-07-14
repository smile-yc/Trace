import assert from "node:assert/strict";
import test from "node:test";
import { buildGoalWarnings } from "../src/lib/growthGoals.ts";
import type { GrowthGoal, Milestone } from "../src/types.ts";

test("goal warnings identify overdue goals and high input without outcomes", () => {
  const goal = { id: "goal-1", title: "Grow", status: "active", endDate: "2026-06-30", updateTime: Date.parse("2026-07-01") } as GrowthGoal;
  const milestone = {
    id: "milestone-1", goalId: goal.id, name: "Practice", enabled: true, metricType: "input",
    startDate: "2026-01-01", deadline: "2026-12-31",
    progressDetail: { progress: 60, outcomeRequirementMet: false }
  } as Milestone;
  assert.deepEqual(
    buildGoalWarnings([goal], [milestone], new Date("2026-07-14T00:00:00Z")).map((warning) => warning.type),
    ["overdue", "high-input-low-output"]
  );
});
