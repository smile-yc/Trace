import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync("frontend/src/App.tsx", "utf8");

test("showToast clears the previous timer before scheduling a new one", () => {
  assert.match(appSource, /useRef<number \| null>/);
  assert.match(appSource, /if \(toastTimerRef\.current\) \{/);
  assert.match(appSource, /window\.clearTimeout\(toastTimerRef\.current\);/);
  assert.match(appSource, /toastTimerRef\.current = window\.setTimeout/);
});
