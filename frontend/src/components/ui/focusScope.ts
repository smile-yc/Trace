import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function getWrappedFocusIndex(currentIndex: number, focusableCount: number, backwards: boolean): number {
  if (focusableCount <= 0) return -1;
  if (currentIndex < 0) return backwards ? focusableCount - 1 : 0;
  return backwards
    ? (currentIndex - 1 + focusableCount) % focusableCount
    : (currentIndex + 1) % focusableCount;
}

export interface UseFocusScopeOptions {
  open: boolean;
  containerRef: RefObject<HTMLElement>;
  onEscape: () => void;
  initialFocusRef?: RefObject<HTMLElement>;
  returnFocusRef?: RefObject<HTMLElement>;
  backgroundRefs?: ReadonlyArray<RefObject<HTMLElement>>;
  inertAppRoot?: boolean;
  lockBodyScroll?: boolean;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

function disableBackground(element: HTMLElement): () => void {
  const previousAriaHidden = element.getAttribute("aria-hidden");
  const previousInert = element.inert;
  element.inert = true;
  element.setAttribute("aria-hidden", "true");

  return () => {
    element.inert = previousInert;
    if (previousAriaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", previousAriaHidden);
  };
}

export function useFocusScope({
  open,
  containerRef,
  onEscape,
  initialFocusRef,
  returnFocusRef,
  backgroundRefs = [],
  inertAppRoot = false,
  lockBodyScroll = false
}: UseFocusScopeOptions): void {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;
    const focusContainer: HTMLElement = container;

    const returnTarget = returnFocusRef?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const backgrounds = backgroundRefs.map((ref) => ref.current).filter((element): element is HTMLElement => Boolean(element));
    if (inertAppRoot) {
      const appRoot = document.getElementById("root");
      if (appRoot) backgrounds.push(appRoot);
    }
    const restoreBackground = [...new Set(backgrounds)].map(disableBackground);
    const previousOverflow = document.body.style.overflow;
    if (lockBodyScroll) document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const initialTarget = initialFocusRef?.current
        ?? focusContainer.querySelector<HTMLElement>("[data-focus-initial='true']")
        ?? getFocusableElements(focusContainer)[0]
        ?? focusContainer;
      initialTarget.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(focusContainer);
      if (!focusable.length) {
        event.preventDefault();
        focusContainer.focus();
        return;
      }

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = getWrappedFocusIndex(currentIndex, focusable.length, event.shiftKey);
      event.preventDefault();
      focusable[nextIndex].focus();
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      restoreBackground.forEach((restore) => restore());
      if (lockBodyScroll) document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => returnTarget?.focus());
    };
  }, [backgroundRefs, containerRef, inertAppRoot, initialFocusRef, lockBodyScroll, open, returnFocusRef]);
}
