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

function getLoadedStylesheets(): Array<{ path: string; source: string }> {
  const main = readSource("../src/main.tsx");
  const imports = [...main.matchAll(/import\s+["'](\.\/styles(?:\.css|\/[^"']+\.css))["'];/g)];
  return imports.map((match) => ({
    path: match[1],
    source: readSource(`../src/${match[1].replace(/^\.\//, "")}`)
  }));
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

test("loaded styles reserve round geometry for semantic data marks and indicators", () => {
  const stylesheets = getLoadedStylesheets();
  const semanticRoundSelectors = new Set([".nav-item::before", ".relation-bubble"]);

  assert.ok(stylesheets.length >= 8, "foundation and three domain style entries must all be loaded");
  for (const stylesheet of stylesheets) {
    assert.ok(stylesheet.source.length > 0, `${stylesheet.path} must resolve to a stylesheet`);
    assert.equal(/(?:linear|radial|conic)-gradient\s*\(/i.test(stylesheet.source), false, `${stylesheet.path} contains a gradient`);
    assert.equal(/prefers-color-scheme\s*:\s*dark/i.test(stylesheet.source), false, `${stylesheet.path} contains fake dark mode`);
    for (const block of stylesheet.source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = block[1].trim();
      const radiusDeclarations = [...block[2].matchAll(/border-radius\s*:\s*([^;]+)/gi)];
      for (const declaration of radiusDeclarations) {
        const fixedRadii = [...declaration[1].matchAll(/(\d+)px/gi)].map((match) => Number(match[1]));
        const usesSemanticRoundGeometry = declaration[1].includes("50%") || fixedRadii.some((radius) => radius > 8);
        if (usesSemanticRoundGeometry) {
          assert.equal(semanticRoundSelectors.has(selector), true, `${stylesheet.path} uses round geometry on ${selector}`);
        }
      }
    }
  }
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

test("system navigation group stays close to the review group", () => {
  const components = readSource("../src/styles/components.css");

  assert.doesNotMatch(components, /\.nav-group-system\s*\{[^}]*margin-top:\s*auto\s*;/);
  assert.match(components, /\.nav-group-system\s*\{[^}]*margin-top:\s*4px\s*;/);
});

test("all mobile navigation and compact action targets are at least 44px square", () => {
  const components = readSource("../src/styles/components.css");
  const mobileBlock = components.match(/@media \(max-width: 800px\) \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(mobileBlock, /button,[\s\S]*a\[href\],[\s\S]*\[role="button"\][\s\S]*min-width: var\(--touch-target\);/);
  assert.match(mobileBlock, /button,[\s\S]*a\[href\],[\s\S]*\[role="button"\][\s\S]*min-height: var\(--touch-target\) !important;/);

  for (const selector of [".nav-item", ".nav-child", ".ui-select-option", ".ui-filter-chip button", ".ui-filter-clear"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(mobileBlock, new RegExp(`${escaped}[\\s\\S]*min-height: var\\(--touch-target\\);`), `${selector} needs 44px height`);
    assert.match(mobileBlock, new RegExp(`${escaped}[\\s\\S]*min-width: var\\(--touch-target\\);`), `${selector} needs 44px width`);
  }
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

test("page registry composes strongly typed domain page packages", async () => {
  type RegistryModule = {
    createPageRegistry: <Context>(options: {
      packages: ReadonlyArray<{
        id: string;
        pages: ReadonlyArray<{ id: string; label: string; group: "records"; render: (context: Context) => unknown }>;
      }>;
      defaultPageId: string;
    }) => { pages: ReadonlyArray<{ id: string }> };
  };
  const module = await importSource<RegistryModule>("../src/navigation/pageRegistry.ts");

  const createPageRegistry = module.createPageRegistry!;
  const registry = createPageRegistry({
    packages: [
      { id: "records", pages: [{ id: "daily", label: "今日工作台", group: "records", render: () => "daily" }] },
      { id: "ledger", pages: [{ id: "all", label: "工作台账", group: "records", render: () => "all" }] }
    ],
    defaultPageId: "daily"
  });

  assert.deepEqual(registry.pages.map((page) => page.id), ["daily", "all"]);
});

test("page navigation state keeps visited pages mounted and remembers scroll positions", async () => {
  type NavigationStateModule = {
    createPageNavigationState: (defaultPageId: string) => {
      activePageId: string;
      visitedPageIds: ReadonlyArray<string>;
      scrollPositions: Readonly<Record<string, number>>;
    };
    navigateToPage: (
      state: { activePageId: string; visitedPageIds: ReadonlyArray<string>; scrollPositions: Readonly<Record<string, number>> },
      nextPageId: string,
      currentScrollTop: number
    ) => { activePageId: string; visitedPageIds: ReadonlyArray<string>; scrollPositions: Readonly<Record<string, number>> };
    getPageScrollTop: (state: { scrollPositions: Readonly<Record<string, number>> }, pageId: string) => number;
  };
  const module = await importSource<NavigationStateModule>("../src/navigation/pageNavigationState.ts");

  assert.equal(typeof module.createPageNavigationState, "function");
  const initial = module.createPageNavigationState!("daily");
  const ledger = module.navigateToPage!(initial, "all", 320);
  const returned = module.navigateToPage!(ledger, "daily", 88);

  assert.deepEqual(returned.visitedPageIds, ["daily", "all"]);
  assert.equal(returned.activePageId, "daily");
  assert.equal(module.getPageScrollTop!(returned, "daily"), 320);
  assert.equal(module.getPageScrollTop!(returned, "all"), 88);
});

test("focus-cycle logic wraps Tab and Shift+Tab inside an open surface", async () => {
  type FocusModule = {
    getWrappedFocusIndex: (currentIndex: number, focusableCount: number, backwards: boolean) => number;
  };
  const module = await importSource<FocusModule>("../src/components/ui/focusScope.ts");

  assert.equal(typeof module.getWrappedFocusIndex, "function");
  assert.equal(module.getWrappedFocusIndex!(2, 3, false), 0);
  assert.equal(module.getWrappedFocusIndex!(0, 3, true), 2);
  assert.equal(module.getWrappedFocusIndex!(-1, 3, false), 0);
  assert.equal(module.getWrappedFocusIndex!(-1, 0, false), -1);
});

test("closed mobile drawer renders inert as an empty attribute and removes it when open", () => {
  const sidebar = readSource("../src/components/Sidebar.tsx");

  assert.match(sidebar, /const inertAttribute = mobileHidden \? \{ inert: "" \} : \{\};/, "closed drawers must render inert=\"\" without a React boolean-attribute warning");
  assert.match(sidebar, /<aside \{\.\.\.inertAttribute\}/, "open drawers must omit the inert attribute");
});

test("nested navigation exposes only the most specific current page", () => {
  const sidebar = readSource("../src/components/Sidebar.tsx");

  assert.match(sidebar, /const parentCurrent = item\.pageId === activePageId && !childActive;/);
  assert.match(sidebar, /aria-current=\{parentCurrent \? "page" : undefined\}/);
});

test("drawer, modal and detail panel use the shared focus scope and modal aria contract", () => {
  const appShell = readSource("../src/components/layout/AppShell.tsx");
  const mobileTopBar = readSource("../src/components/layout/MobileTopBar.tsx");
  const sidebar = readSource("../src/components/Sidebar.tsx");
  const modal = readSource("../src/components/ui/ModalDialog.tsx");
  const detail = readSource("../src/components/ui/DetailPanel.tsx");

  assert.match(appShell, /useFocusScope/);
  assert.match(mobileTopBar, /aria-expanded=\{open\}/);
  assert.match(mobileTopBar, /aria-controls="app-navigation"/);
  assert.match(sidebar, /aria-hidden=\{mobileHidden\}/);
  assert.match(modal, /useFocusScope/);
  assert.match(modal, /createPortal/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(detail, /useFocusScope/);
  assert.match(detail, /createPortal/);
  assert.match(detail, /aria-modal="true"/);
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
  const pagePackage = readSource("../src/navigation/corePagePackage.tsx");

  for (const pageId of ["daily", "all", "projects", "weekly", "monthly", "yearly", "growth", "knowledge", "settings"]) {
    assert.match(pagePackage, new RegExp(`id: ["']${pageId}["']`));
  }
  assert.match(app, /createPageRegistry/);
  assert.match(app, /AppPageContext/);
  assert.equal(app.includes("./pages/"), false);
});

test("domain page style entries are stable and imported after the foundation", () => {
  const main = readSource("../src/main.tsx");

  assert.match(main, /import "\.\/styles\/work-outcomes\.css";/);
  assert.match(main, /import "\.\/styles\/growth-reports\.css";/);
  assert.match(main, /import "\.\/styles\/settings-data\.css";/);
});

test("form field aria state links labels, descriptions, errors and required controls", async () => {
  type FieldAriaModule = {
    buildFieldAria: (options: {
      controlId: string;
      hintId: string;
      errorId: string;
      hasHint: boolean;
      hasError: boolean;
      required: boolean;
      describedBy?: string;
    }) => Record<string, unknown>;
  };
  const module = await importSource<FieldAriaModule>("../src/components/ui/formFieldAria.ts");

  assert.equal(typeof module.buildFieldAria, "function");
  assert.deepEqual(
    module.buildFieldAria!({
      controlId: "hours",
      hintId: "hours-hint",
      errorId: "hours-error",
      hasHint: true,
      hasError: true,
      required: true,
      describedBy: "external-help"
    }),
    {
      id: "hours",
      "aria-describedby": "external-help hours-hint hours-error",
      "aria-invalid": true,
      "aria-required": true,
      required: true
    }
  );
});

test("form field accepts exactly one aria-capable React element", () => {
  const formField = readSource("../src/components/ui/FormField.tsx");

  assert.match(formField, /children: ReactElement<FieldControlProps>;/);
  assert.equal(formField.includes("children: ReactNode;"), false);
  assert.equal(formField.includes("isValidElement"), false);
});
