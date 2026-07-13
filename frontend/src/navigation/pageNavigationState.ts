export interface PageNavigationState {
  activePageId: string;
  visitedPageIds: ReadonlyArray<string>;
  scrollPositions: Readonly<Record<string, number>>;
}

export function createPageNavigationState(defaultPageId: string): PageNavigationState {
  return {
    activePageId: defaultPageId,
    visitedPageIds: [defaultPageId],
    scrollPositions: {}
  };
}

export function navigateToPage(
  state: PageNavigationState,
  nextPageId: string,
  currentScrollTop: number
): PageNavigationState {
  const visitedPageIds = state.visitedPageIds.includes(nextPageId)
    ? state.visitedPageIds
    : [...state.visitedPageIds, nextPageId];

  return {
    activePageId: nextPageId,
    visitedPageIds,
    scrollPositions: {
      ...state.scrollPositions,
      [state.activePageId]: Math.max(0, currentScrollTop)
    }
  };
}

export function getPageScrollTop(state: Pick<PageNavigationState, "scrollPositions">, pageId: string): number {
  return state.scrollPositions[pageId] ?? 0;
}
