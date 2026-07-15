import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function getFreePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(port: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail("backend startup timeout");
}

test("duplicate backend startup exits with an actionable port message", async (t) => {
  const port = await getFreePort();
  const firstDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-runtime-first-"));
  const secondDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-runtime-second-"));
  const spawnBackend = (dataDir: string) => spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: path.resolve("backend"),
    env: { ...process.env, DATA_DIR: dataDir, DB_PATH: path.join(dataDir, "report.sqlite"), PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const first = spawnBackend(firstDataDir);
  t.after(async () => {
    first.kill();
    if (first.exitCode === null) {
      await new Promise<void>((resolve) => first.once("exit", () => resolve()));
    }
    fs.rmSync(firstDataDir, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
    fs.rmSync(secondDataDir, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
  });
  await waitForHealth(port);

  const second = spawnBackend(secondDataDir);
  let output = "";
  second.stdout.on("data", (chunk) => { output += String(chunk); });
  second.stderr.on("data", (chunk) => { output += String(chunk); });
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timeout = setTimeout(() => {
      second.kill();
      reject(new Error("duplicate backend did not exit"));
    }, 8000);
    second.on("exit", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  assert.equal(exitCode, 1);
  assert.match(output, new RegExp(`端口 ${port} 已被占用`));
  assert.doesNotMatch(output, /Unhandled 'error' event/);
});
