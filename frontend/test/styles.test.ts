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
