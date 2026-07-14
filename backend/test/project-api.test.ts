import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("project API supports lifecycle, summaries, record relations and merging", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-project-api-"));
  const port = 4800 + Math.floor(Math.random() * 400);
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
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, stderr);

  async function request(url: string, init?: RequestInit) {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, init);
    const body = await response.json().catch(() => ({}));
    return { response, body } as { response: Response; body: any };
  }

  const create = async (name: string, extra: Record<string, unknown> = {}) => request("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, ...extra })
  });

  const source = await create("API 来源", { shortName: "来源", aliases: ["接口项目"] });
  const target = await create("API 目标");
  assert.equal(source.response.status, 201);
  assert.equal(target.response.status, 201);

  const searched = await request("/api/projects?query=接口");
  assert.equal(searched.body.projects[0].id, source.body.project.id);

  const record = await request("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "2026-07-14",
      title: "API 项目记录",
      content: "",
      category: "其他",
      businessCategory: "传统业务",
      workType: "工程调试",
      abilityDimension: "工程技术",
      projectId: source.body.project.id,
      projectRelation: "project",
      productSystem: "Trace",
      subtask: "API",
      quantity: 2,
      coefficient: 2,
      timeHours: 3,
      tags: ""
    })
  });
  assert.equal(record.response.status, 201);
  assert.equal(record.body.record.projectName, "API 来源");

  const summary = await request(`/api/projects/${source.body.project.id}/summary`);
  assert.equal(summary.body.summary.recordCount, 1);
  assert.equal(summary.body.summary.workload, 4);

  const archived = await request(`/api/projects/${source.body.project.id}/archive`, { method: "POST" });
  assert.equal(archived.body.project.status, "archived");
  const reactivated = await request(`/api/projects/${source.body.project.id}/reactivate`, { method: "POST" });
  assert.equal(reactivated.body.project.status, "active");

  const preview = await request(`/api/projects/${source.body.project.id}/merge-preview?targetId=${target.body.project.id}`);
  assert.equal(preview.body.preview.recordCount, 1);
  const merged = await request(`/api/projects/${source.body.project.id}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId: target.body.project.id })
  });
  assert.equal(merged.body.project.id, target.body.project.id);

  const duplicate = await create("API 目标");
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.message, "已存在同名项目。");

  const invalidDate = await create("日期错误", { startDate: "2026-07-20", endDate: "2026-07-19" });
  assert.equal(invalidDate.response.status, 400);
  assert.equal(invalidDate.body.message, "项目结束日期不能早于开始日期。");

  const invalidRelation = await request("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: "2026-07-14", title: "无关系", content: "", category: "其他", projectId: null, projectRelation: "project", tags: "" })
  });
  assert.equal(invalidRelation.response.status, 400);
  assert.equal(invalidRelation.body.message, "请选择项目或明确标记为非项目事项。");
});
