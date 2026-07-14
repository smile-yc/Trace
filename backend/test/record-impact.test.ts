import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("record impact API explains project and outcome relationships before deletion", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-record-impact-"));
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

  const project = await request("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "影响预览项目" })
  });
  assert.equal(project.response.status, 201);

  const linkedRecord = await request("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "2026-07-14",
      title: "需要确认影响的记录",
      content: "形成两个成果",
      category: "其他",
      businessCategory: "数字化业务",
      workType: "系统开发",
      projectId: project.body.project.id,
      projectRelation: "project",
      quantity: 1,
      coefficient: 2,
      timeHours: 3,
      tags: "重点"
    })
  });
  assert.equal(linkedRecord.response.status, 201);

  for (const [title, type] of [["正式交付", "deliverable"], ["问题闭环", "problem_resolution"]]) {
    const created = await request("/api/outcomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, type, status: "completed", projectId: project.body.project.id, recordIds: [linkedRecord.body.record.id] })
    });
    assert.equal(created.response.status, 201);
  }

  const impact = await request(`/api/records/${linkedRecord.body.record.id}/impact`);
  assert.equal(impact.response.status, 200);
  assert.deepEqual(impact.body.impact.project, { id: project.body.project.id, name: "影响预览项目" });
  assert.deepEqual(impact.body.impact.outcomes.map((item: { title: string }) => item.title), ["正式交付", "问题闭环"]);
  assert.deepEqual(impact.body.impact.outcomes.map((item: { status: string }) => item.status), ["completed", "completed"]);

  const unlinkedRecord = await request("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "2026-07-14",
      title: "非项目记录",
      content: "例行事项",
      category: "其他",
      projectId: null,
      projectRelation: "non_project",
      tags: ""
    })
  });
  const unlinkedImpact = await request(`/api/records/${unlinkedRecord.body.record.id}/impact`);
  assert.equal(unlinkedImpact.response.status, 200);
  assert.equal(unlinkedImpact.body.impact.project, null);
  assert.deepEqual(unlinkedImpact.body.impact.outcomes, []);

  const missing = await request("/api/records/missing-record/impact");
  assert.equal(missing.response.status, 404);

  const removed = await request(`/api/records/${linkedRecord.body.record.id}`, { method: "DELETE" });
  assert.equal(removed.response.status, 204);
  const afterDelete = await request(`/api/records/${linkedRecord.body.record.id}/impact`);
  assert.equal(afterDelete.response.status, 404);
});

