import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const startupBudgetMs = Number(process.env.TRACE_STARTUP_BUDGET_MS || 6000);
const apiP95BudgetMs = Number(process.env.TRACE_API_P95_BUDGET_MS || 500);
const sampleSize = Number(process.env.TRACE_RUNTIME_SAMPLES || 15);
const seedCount = Number(process.env.TRACE_RUNTIME_RECORDS || 250);

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(baseUrl, startedAt, output) {
  while (performance.now() - startedAt < startupBudgetMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return performance.now() - startedAt;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`后端未在 ${startupBudgetMs}ms 内启动。${output()}`);
}

async function seedRecords(baseUrl) {
  for (let offset = 0; offset < seedCount; offset += 25) {
    const requests = Array.from({ length: Math.min(25, seedCount - offset) }, (_, index) => {
      const itemIndex = offset + index;
      const day = String(itemIndex % 28 + 1).padStart(2, "0");
      return fetch(`${baseUrl}/api/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: `2026-07-${day}`,
          title: `运行验证记录 ${itemIndex + 1}`,
          content: "仅写入临时数据库的运行验证数据",
          category: "工程调试",
          businessCategory: itemIndex % 2 ? "传统业务" : "三新业务",
          workType: "工程调试",
          abilityDimension: "工程技术",
          abilityAllocations: [{ abilityId: "runtime-engineering", abilityName: "工程技术", percentage: 100 }],
          projectId: null,
          projectRelation: "non_project",
          productSystem: `验证产品 ${itemIndex % 8 + 1}`,
          subtask: "运行验证",
          quantity: 1,
          coefficient: 1.2,
          workload: 1.2,
          timeHours: 2,
          tags: "运行验证"
        })
      });
    });
    const responses = await Promise.all(requests);
    if (responses.some((response) => !response.ok)) throw new Error("临时性能数据写入失败。");
  }
}

function percentile(values, ratio) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

async function measureEndpoint(baseUrl, endpoint) {
  await fetch(`${baseUrl}${endpoint}`);
  const durations = [];
  for (let index = 0; index < sampleSize; index += 1) {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${endpoint}`);
    if (!response.ok) throw new Error(`${endpoint} 返回 ${response.status}`);
    await response.arrayBuffer();
    durations.push(performance.now() - startedAt);
  }
  return {
    endpoint,
    p50: percentile(durations, 0.5),
    p95: percentile(durations, 0.95)
  };
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-runtime-verify-"));
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
let child;
let processOutput = "";

try {
  const startedAt = performance.now();
  child = spawn(process.execPath, [path.resolve("backend/dist/index.js")], {
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      DB_PATH: path.join(dataDir, "report.sqlite"),
      PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { processOutput += String(chunk); });
  child.stderr.on("data", (chunk) => { processOutput += String(chunk); });

  const startupMs = await waitForHealth(baseUrl, startedAt, () => processOutput);
  await seedRecords(baseUrl);
  const results = [];
  for (const endpoint of ["/api/health", "/api/records", "/api/projects?includeArchived=true", "/api/outcomes", "/api/settings"]) {
    results.push(await measureEndpoint(baseUrl, endpoint));
  }

  console.log(`Trace 运行验证：${seedCount} 条临时日报，${sampleSize} 次接口采样`);
  console.log(`启动耗时：${startupMs.toFixed(1)}ms / 预算 ${startupBudgetMs}ms`);
  for (const result of results) {
    console.log(`${result.endpoint}  P50 ${result.p50.toFixed(1)}ms  P95 ${result.p95.toFixed(1)}ms`);
  }

  const overBudget = results.filter((result) => result.p95 > apiP95BudgetMs);
  if (overBudget.length) {
    throw new Error(`接口 P95 超过 ${apiP95BudgetMs}ms：${overBudget.map((item) => item.endpoint).join(", ")}`);
  }
  console.log(`运行验证通过：所有接口 P95 均低于 ${apiP95BudgetMs}ms。`);
} finally {
  if (child && child.exitCode === null) {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
  fs.rmSync(dataDir, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
}
