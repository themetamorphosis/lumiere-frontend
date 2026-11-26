import { useEffect, useRef, useCallback } from "react";

let scrollLocks = 0;
let previousBodyOverflow = "";

const focusableSelector = 'button, a[href], input, select, textarea, iframe, [tabindex]';

function focusableControls(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0 &&
      !element.closest("[inert], [aria-hidden=true]") && getComputedStyle(element).visibility === "visible",
  );
}

export function useModalA11y(onClose: () => void, isOpen = true) {
  const onCloseRef = useRef(onClose);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = containerRef.current;
    if (!isOpen || !dialog) return;
    const previousFocus = document.activeElement;
    if (scrollLocks === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    scrollLocks++;

    const frame = requestAnimationFrame(() => {
      const controls = focusableControls(dialog);
      const initial = controls.find((element) => element.hasAttribute("data-dialog-autofocus"));
      (initial ?? controls[0] ?? dialog).focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      scrollLocks--;
      if (scrollLocks === 0) document.body.style.overflow = previousBodyOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  const trapFocus = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    const dialog = containerRef.current;
    if (event.key !== "Tab" || !dialog) return;
    const controls = focusableControls(dialog);
    const first = controls[0];
    const last = controls.at(-1);
    const current = document.activeElement;
    if (!first || !controls.includes(current as HTMLElement) ||
      (event.shiftKey ? current === first : current === last)) {
      event.preventDefault();
      (event.shiftKey ? last ?? dialog : first ?? dialog).focus();
    }
  }, []);

  return { containerRef, trapFocus };
}
