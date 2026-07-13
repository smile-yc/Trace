import type { ReactNode } from "react";

export type PageGroupId = "records" | "work" | "growth" | "review" | "system";

export interface PageRegistration<Context, PageId extends string = string> {
  id: PageId;
  label: string;
  group: PageGroupId;
  render: (context: Context) => ReactNode;
}

export interface DomainPagePackage<Context, PageId extends string = string> {
  id: string;
  pages: ReadonlyArray<PageRegistration<Context, PageId>>;
}

export interface PageRegistry<Context, PageId extends string = string> {
  pages: ReadonlyArray<PageRegistration<Context, PageId>>;
  getPage: (id: string) => PageRegistration<Context, PageId> | undefined;
  getDefaultPage: () => PageRegistration<Context, PageId>;
  getPagesByGroup: (group: PageGroupId) => ReadonlyArray<PageRegistration<Context, PageId>>;
}

interface CreatePageRegistryOptions<Context, PageId extends string> {
  pages?: ReadonlyArray<PageRegistration<Context, PageId>>;
  packages?: ReadonlyArray<DomainPagePackage<Context, PageId>>;
  defaultPageId: PageId;
}

export function createPageRegistry<Context, PageId extends string = string>({
  pages: directPages,
  packages = [],
  defaultPageId
}: CreatePageRegistryOptions<Context, PageId>): PageRegistry<Context, PageId> {
  const pages = directPages ?? packages.flatMap((pagePackage) => pagePackage.pages);
  const pageMap = new Map<PageId, PageRegistration<Context, PageId>>();

  for (const page of pages) {
    if (pageMap.has(page.id)) {
      throw new Error(`Duplicate page id: ${page.id}`);
    }
    pageMap.set(page.id, page);
  }

  const defaultPage = pageMap.get(defaultPageId);
  if (!defaultPage) {
    throw new Error(`Default page is not registered: ${defaultPageId}`);
  }

  const registeredPages = Object.freeze([...pages]);

  return {
    pages: registeredPages,
    getPage: (id) => pageMap.get(id as PageId),
    getDefaultPage: () => defaultPage,
    getPagesByGroup: (group) => registeredPages.filter((page) => page.group === group)
  };
}
