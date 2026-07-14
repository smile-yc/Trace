import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("outcome API supports lifecycle, filters and archive state", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-outcome-api-"));
  const port = 5200 + Math.floor(Math.random() * 300);
  let stderr = "";
  const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: path.resolve(process.cwd(), "backend"),
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, DB_PATH: path.join(dataDir, "report.sqlite") },
    stdio: ["ignore", "ignore", "pipe"]
  });
  child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
  t.after(() => child.kill());

  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, stderr);

  async function request(url: string, init?: RequestInit) {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, init);
    const body = await response.json().catch(() => ({}));
    return { response, body } as { response: Response; body: any };
  }

  const created = await request("/api/outcomes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "stage_progress", status: "planned", title: "阶段推进", startDate: "2026-07-01" })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.outcome.type, "stage_progress");

  const updated = await request(`/api/outcomes/${created.body.outcome.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "stage_result", updateDate: "2026-07-14", statusNote: "形成阶段结论" })
  });
  assert.equal(updated.body.outcome.statusHistory.length, 2);

  const filtered = await request("/api/outcomes?type=stage_progress&status=stage_result&year=2026");
  assert.equal(filtered.body.outcomes.length, 1);
  assert.equal(filtered.body.summary.outcomeCount, 1);

  const archived = await request(`/api/outcomes/${created.body.outcome.id}/archive`, { method: "POST" });
  assert.equal(archived.body.outcome.archived, true);
  const defaultList = await request("/api/outcomes");
  assert.equal(defaultList.body.outcomes.length, 0);
  const allList = await request("/api/outcomes?includeArchived=true");
  assert.equal(allList.body.outcomes.length, 1);

  const invalid = await request("/api/outcomes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "unknown", title: "错误类型" })
  });
  assert.equal(invalid.response.status, 400);
});
