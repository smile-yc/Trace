import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

test("FormField renders a labelled control with hint and error relationships", async () => {
  const frontendRoot = fileURLToPath(new URL("..", import.meta.url));
  const result = await build({
    stdin: {
      contents: `
        import React from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import { FormField } from "./src/components/ui/FormField.tsx";

        export function renderFixture() {
          return renderToStaticMarkup(
            React.createElement(
              FormField,
              {
                label: "Work hours",
                htmlFor: "hours",
                hint: "Enter actual hours",
                error: "Enter valid hours",
                required: true
              },
              React.createElement("input", { "aria-describedby": "external-help", defaultValue: "8" })
            )
          );
        }
      `,
      resolveDir: frontendRoot,
      sourcefile: "form-field-render-entry.tsx",
      loader: "tsx"
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false
  });
  const compiledModule = { exports: {} as { renderFixture: () => string } };
  const executeBundle = new Function("require", "module", "exports", result.outputFiles[0].text);
  executeBundle(createRequire(import.meta.url), compiledModule, compiledModule.exports);
  const markup = compiledModule.exports.renderFixture();

  assert.match(markup, /<label[^>]*for="hours"[^>]*>Work hours/);
  assert.match(markup, /<input[^>]*id="hours"/);
  assert.match(markup, /<input[^>]*aria-describedby="external-help hours-hint hours-error"/);
  assert.match(markup, /<input[^>]*aria-invalid="true"/);
  assert.match(markup, /<input[^>]*aria-required="true"/);
  assert.match(markup, /<input[^>]*required=""/);
  assert.match(markup, /id="hours-hint">Enter actual hours<\/div>/);
  assert.match(markup, /id="hours-error" role="alert">Enter valid hours<\/div>/);
});
