import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function withServer(t: test.TestContext, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-backup-api-"));
  const port = 4600 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: path.resolve("backend"),
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      DB_PATH: path.join(dataDir, "report.sqlite"),
      PORT: String(port)
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  t.after(() => child.kill());
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("server timeout")), 8000);
    child.stderr.on("data", (chunk) => {
      if (String(chunk).includes("EADDRINUSE")) reject(new Error("port in use"));
    });
    const ping = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/records`);
        if (response.ok) {
          clearTimeout(timeout);
          resolve();
          return;
        }
      } catch {
        // wait for server
      }
      setTimeout(ping, 100);
    };
    void ping();
  });

  await run(`http://127.0.0.1:${port}`);
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) assert.fail(await response.text());
  return response.json() as Promise<T>;
}

test("backup API previews restore impact and replaces current rows after confirmation", async (t) => {
  await withServer(t, async (baseUrl) => {
    const createKeep = await fetch(`${baseUrl}/api/config-options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "productSystem", label: "Keep After Restore" })
    });
    const keep = await readJson<{ option: { id: string } }>(createKeep);

    const backupResponse = await fetch(`${baseUrl}/api/backup`);
    assert.equal(backupResponse.ok, true);
    const backupBase64 = Buffer.from(await backupResponse.arrayBuffer()).toString("base64");

    const createRemove = await fetch(`${baseUrl}/api/config-options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "productSystem", label: "Remove After Restore" })
    });
    const remove = await readJson<{ option: { id: string } }>(createRemove);

    const preview = await readJson<{ preview: { currentCounts: Record<string, number>; incomingCounts: Record<string, number>; tables: Array<{ name: string; action: string }> } }>(
      await fetch(`${baseUrl}/api/backup/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupBase64 })
      })
    );
    assert.equal(preview.preview.currentCounts.config_options, preview.preview.incomingCounts.config_options + 1);
    assert.equal(preview.preview.tables.find((table) => table.name === "config_options")?.action, "replace");

    const restored = await readJson<{ result: { restoredTables: string[] } }>(
      await fetch(`${baseUrl}/api/backup/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupBase64 })
      })
    );
    assert.equal(restored.result.restoredTables.includes("config_options"), true);

    const options = await readJson<{ options: Array<{ id: string }> }>(await fetch(`${baseUrl}/api/config-options`));
    assert.equal(options.options.some((option) => option.id === keep.option.id), true);
    assert.equal(options.options.some((option) => option.id === remove.option.id), false);
  });
});
