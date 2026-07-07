import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(__dirname, "../src/styles.css"), "utf8");

test("combo toggle styles do not leak into menu option buttons", () => {
  assert.equal(styles.includes(".combo-input-wrap button {"), false);
  assert.equal(styles.includes(".combo-input-wrap > button {"), true);
});

test("dashboard ledger palette and shell tokens are present", () => {
  assert.equal(styles.includes("--bg: #f6efe3;"), true);
  assert.equal(styles.includes("--navy: #0c0c24;"), true);
  assert.equal(styles.includes("--purple: #7a3e8e;"), true);
  assert.equal(styles.includes("--cyan: #5dbac0;"), true);
  assert.equal(styles.includes("--orange: #f2764b;"), true);
  assert.equal(styles.includes("--green: #78a943;"), true);
  assert.equal(styles.includes(".app-shell {"), true);
  assert.equal(styles.includes("width: min(1420px, calc(100vw - 32px));"), true);
});
