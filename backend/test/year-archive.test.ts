import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function withServer(t: test.TestContext, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-year-archive-"));
  const port = 5600 + Math.floor(Math.random() * 1000);
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

test("year archive creates a file and leaves source records untouched", async (t) => {
  await withServer(t, async (baseUrl) => {
    const created = await readJson<{ record: { id: string } }>(
      await fetch(`${baseUrl}/api/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-03-01",
          title: "Archive source record",
          content: "",
          category: "其他",
          businessCategory: "传统业务",
          workType: "工程调试",
          abilityDimension: "工程技术",
          projectId: null,
          projectRelation: "non_project",
          productSystem: "GM1000",
          subtask: "现场调试",
          quantity: 1,
          coefficient: 2,
          workload: 2,
          timeHours: 3,
          tags: ""
        })
      })
    );

    const preview = await readJson<{ preview: { year: number; recordCount: number } }>(
      await fetch(`${baseUrl}/api/year-archives/2026/preview`)
    );
    assert.equal(preview.preview.year, 2026);
    assert.equal(preview.preview.recordCount, 1);

    const archived = await readJson<{ archive: { filePath: string; recordCount: number } }>(
      await fetch(`${baseUrl}/api/year-archives/2026`, { method: "POST" })
    );
    assert.equal(archived.archive.recordCount, 1);
    assert.equal(fs.existsSync(archived.archive.filePath), true);

    const records = await readJson<{ records: Array<{ id: string }> }>(await fetch(`${baseUrl}/api/records`));
    assert.equal(records.records.some((record) => record.id === created.record.id), true);
  });
});
