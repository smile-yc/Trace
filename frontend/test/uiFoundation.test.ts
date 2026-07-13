import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSource(path: string): string {
  try {
    return readFileSync(resolve(__dirname, path), "utf8");
  } catch {
    return "";
  }
}

async function importSource<T>(path: string): Promise<Partial<T>> {
  try {
    return (await import(pathToFileURL(resolve(__dirname, path)).href)) as T;
  } catch {
    return {};
  }
}

test("design tokens use the approved light Trace palette and compact geometry", () => {
  const tokens = readSource("../src/styles/tokens.css");

  assert.match(tokens, /--color-brand: #176b68;/i);
  assert.match(tokens, /--color-brand-hover: #125a57;/i);
  assert.match(tokens, /--color-brand-selected: #e7f2f0;/i);
  assert.match(tokens, /--color-page: #f5f6f7;/i);
  assert.match(tokens, /--color-sidebar: #fafbfb;/i);
  assert.match(tokens, /--color-surface: #ffffff;/i);
  assert.match(tokens, /--color-border: #d9e0e3;/i);
  assert.match(tokens, /--radius-control: 6px;/i);
  assert.match(tokens, /--radius-surface: 8px;/i);
  assert.match(tokens, /--sidebar-width: 216px;/i);
  assert.equal(tokens.includes("linear-gradient"), false);
  assert.equal(tokens.includes("radial-gradient"), false);
  assert.equal(tokens.includes("prefers-color-scheme: dark"), false);
});

test("layout provides a 216px desktop sidebar and a mobile top bar with drawer", () => {
  const layout = readSource("../src/styles/layout.css");

  assert.match(layout, /\.app-sidebar\s*\{[\s\S]*width: var\(--sidebar-width\);/);
  assert.match(layout, /\.app-workspace\s*\{[\s\S]*margin-left: var\(--sidebar-width\);/);
  assert.match(layout, /\.mobile-topbar\s*\{[\s\S]*display: none;/);
  assert.match(layout, /@media \(max-width: 800px\)[\s\S]*\.mobile-topbar\s*\{[\s\S]*display: flex;/);
  assert.match(layout, /@media \(max-width: 800px\)[\s\S]*\.app-sidebar\s*\{[\s\S]*transform: translateX\(-100%\);/);
  assert.match(layout, /\.app-sidebar\.is-open\s*\{[\s\S]*transform: translateX\(0\);/);
});

test("the shared UI surface exports every first-wave foundation component", () => {
  const uiIndex = readSource("../src/components/ui/index.ts");

  for (const component of [
    "Button",
    "IconButton",
    "FormField",
    "SearchSelect",
    "FilterBar",
    "StatusBadge",
    "DataTable",
    "DetailPanel",
    "ModalDialog",
    "EmptyState",
    "ErrorState"
  ]) {
    assert.match(uiIndex, new RegExp(`export \\{ ${component} \\}`));
  }
});

test("page header supports context, status, controls and one primary action slot", () => {
  const pageHeader = readSource("../src/components/PageHeader.tsx");

  assert.match(pageHeader, /context\?: ReactNode/);
  assert.match(pageHeader, /status\?: ReactNode/);
  assert.match(pageHeader, /controls\?: ReactNode/);
  assert.match(pageHeader, /primaryAction\?: ReactNode/);
  assert.equal(pageHeader.includes("eyebrow:"), false);
  assert.match(pageHeader, /const pageContext = context;/);
});

test("the drawer close control stays hidden on desktop and appears at the mobile breakpoint", () => {
  const components = readSource("../src/styles/components.css");
  const layout = readSource("../src/styles/layout.css");

  assert.match(components, /\.sidebar-close\.ui-icon-button\s*\{[\s\S]*display: none;/);
  assert.match(components, /@media \(max-width: 800px\)[\s\S]*\.sidebar-close\.ui-icon-button\s*\{[\s\S]*display: inline-flex;/);
  assert.match(components, /@media \(max-width: 800px\)[\s\S]*\.nav-item span\s*\{[\s\S]*display: inline;/);
  assert.match(layout, /@media \(max-width: 800px\)[\s\S]*\.app-sidebar\s*\{[\s\S]*z-index: 60;/);
});

test("page registry preserves order, resolves pages and rejects duplicate ids", async () => {
  type RegistryModule = {
    createPageRegistry: <Context>(options: {
      pages: Array<{
        id: string;
        label: string;
        group: "records";
        render: (context: Context) => unknown;
      }>;
      defaultPageId: string;
    }) => {
      pages: ReadonlyArray<{ id: string }>;
      getPage: (id: string) => { id: string } | undefined;
      getDefaultPage: () => { id: string };
      getPagesByGroup: (group: "records") => ReadonlyArray<{ id: string }>;
    };
  };
  const module = await importSource<RegistryModule>("../src/navigation/pageRegistry.ts");

  assert.equal(typeof module.createPageRegistry, "function");
  const createPageRegistry = module.createPageRegistry!;
  const pages = [
    { id: "daily", label: "今日工作台", group: "records" as const, render: () => "daily" },
    { id: "ledger", label: "工作台账", group: "records" as const, render: () => "ledger" }
  ];
  const registry = createPageRegistry({ pages, defaultPageId: "daily" });

  assert.deepEqual(registry.pages.map((page) => page.id), ["daily", "ledger"]);
  assert.equal(registry.getPage("ledger")?.id, "ledger");
  assert.equal(registry.getDefaultPage().id, "daily");
  assert.deepEqual(registry.getPagesByGroup("records").map((page) => page.id), ["daily", "ledger"]);
  assert.throws(
    () => createPageRegistry({ pages: [pages[0], pages[0]], defaultPageId: "daily" }),
    /duplicate page id/i
  );
});

test("navigation exposes the seven confirmed product modules in grouped order", async () => {
  type NavigationModule = {
    TRACE_NAVIGATION: ReadonlyArray<{ id: string; label: string; group: string }>;
  };
  const module = await importSource<NavigationModule>("../src/navigation/traceNavigation.ts");

  assert.deepEqual(
    module.TRACE_NAVIGATION?.map((item) => item.label),
    ["今日工作台", "工作台账", "项目管理", "成果管理", "成长与目标", "复盘与汇报", "配置与数据"]
  );
  assert.deepEqual(module.TRACE_NAVIGATION?.map((item) => item.group), ["记录", "记录", "工作", "工作", "成长", "复盘", "系统"]);
});

test("navigation does not expose implementation-stage copy in the product UI", () => {
  const sidebar = readSource("../src/components/Sidebar.tsx");

  assert.equal(sidebar.includes("页面将在下一阶段接入"), false);
});

test("search options match labels and keywords without changing source order", async () => {
  type SearchModule = {
    filterSearchOptions: (
      options: ReadonlyArray<{ value: string; label: string; keywords?: ReadonlyArray<string> }>,
      query: string
    ) => ReadonlyArray<{ value: string }>;
  };
  const module = await importSource<SearchModule>("../src/components/ui/searchOptions.ts");

  assert.equal(typeof module.filterSearchOptions, "function");
  const options = [
    { value: "gm1000", label: "GM1000", keywords: ["牵引"] },
    { value: "phm", label: "PHM", keywords: ["状态监测"] },
    { value: "inspection", label: "智能巡检" }
  ];

  assert.deepEqual(module.filterSearchOptions!(options, "  状态  ").map((option) => option.value), ["phm"]);
  assert.deepEqual(module.filterSearchOptions!(options, "m").map((option) => option.value), ["gm1000", "phm"]);
  assert.deepEqual(module.filterSearchOptions!(options, "").map((option) => option.value), ["gm1000", "phm", "inspection"]);
});

test("application keeps every legacy page reachable through registered ids", () => {
  const app = readSource("../src/App.tsx");

  for (const pageId of ["daily", "all", "weekly", "monthly", "yearly", "growth", "knowledge", "settings"]) {
    assert.match(app, new RegExp(`id: ["']${pageId}["']`));
  }
  assert.match(app, /createPageRegistry/);
});
