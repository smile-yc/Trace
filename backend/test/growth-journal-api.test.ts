import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function startServer(t: test.TestContext) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-growth-api-"));
  const port = 5500 + Math.floor(Math.random() * 300);
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

  return { request };
}

test("growth journal API captures lightweight entries without changing formal records", async (t) => {
  const { request } = await startServer(t);

  const beforeRecords = await request("/api/records");
  assert.equal(beforeRecords.body.records.length, 0);

  const created = await request("/api/growth-journal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "2026-07-30",
      title: "Learn virtual power plant basics",
      activityType: "learning",
      sourceContext: "after_hours",
      abilityDimension: "New business",
      reportScopes: ["monthly", "cultivation"],
      notes: "Read core concepts and drafted a short framework note."
    })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.entry.title, "Learn virtual power plant basics");
  assert.deepEqual(created.body.entry.reportScopes, ["monthly", "cultivation"]);
  assert.equal(created.body.entry.links.projects.length, 0);

  const afterRecords = await request("/api/records");
  assert.equal(afterRecords.body.records.length, 0);

  const filtered = await request("/api/growth-journal?startDate=2026-07-01&endDate=2026-07-31&reportScope=cultivation");
  assert.equal(filtered.body.entries.length, 1);

  const updated = await request(`/api/growth-journal/${created.body.entry.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...created.body.entry,
      outputType: "note",
      outputTitle: "Virtual power plant framework note",
      tags: "new-business,learning"
    })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.entry.outputType, "note");
  assert.equal(updated.body.entry.outputTitle, "Virtual power plant framework note");

  const deleted = await request(`/api/growth-journal/${created.body.entry.id}`, { method: "DELETE" });
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.body.ok, true);
});

test("cultivation report draft stores selected evidence and regenerates editable text", async (t) => {
  const { request } = await startServer(t);

  const record = await request("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "2026-07-30",
      title: "Malaysia project debugging",
      content: "Closed a message-service configuration issue.",
      category: "工程调试",
      projectRelation: "non_project",
      projectId: null,
      tags: "cultivation",
      timeHours: 2
    })
  });
  assert.equal(record.response.status, 201);

  const growth = await request("/api/growth-journal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "2026-07-30",
      title: "Trace after-hours iteration",
      activityType: "side_project",
      sourceContext: "after_hours",
      reportScopes: ["cultivation"],
      notes: "Practiced product thinking through a personal tool iteration."
    })
  });
  assert.equal(growth.response.status, 201);

  const saved = await request("/api/cultivation-reports/2026-07", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      evidence: [
        { sourceType: "record", sourceId: record.body.record.id, module: "key_project_practice" },
        { sourceType: "growth_journal", sourceId: growth.body.entry.id, module: "independent_practice" }
      ],
      workItems: [
        { module: "key_project_practice", title: "Malaysia project debugging", summary: "Closed a message-service issue." }
      ],
      growthGains: [
        { summary: "Through debugging, improved log-analysis and root-cause thinking.", evidenceIds: [record.body.record.id] }
      ],
      supportRequests: [
        { supportType: "materials", need: "Need one delivered new-business solution sample.", reason: "To improve solution framing.", expectedOutput: "Produce one analysis note.", followUpPlan: "Review next month." }
      ],
      draftText: "Manual draft",
      manualEdited: true
    })
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.report.month, "2026-07");
  assert.equal(saved.body.report.evidence.length, 2);
  assert.equal(saved.body.report.manualEdited, true);

  const generated = await request("/api/cultivation-reports/2026-07/generate", { method: "POST" });
  assert.equal(generated.response.status, 200);
  assert.equal(generated.body.previewOnly, true);
  assert.match(generated.body.draftText, /一、本月工作内容/);
  assert.match(generated.body.draftText, /二、本月成长收获/);
  assert.match(generated.body.draftText, /三、需支持事项/);

  const records = await request("/api/records");
  assert.equal(records.body.records.length, 1);
});
