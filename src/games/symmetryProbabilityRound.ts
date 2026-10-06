// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
/** Yield to the event loop between bounded generator batches. Aborting clears queued work. */
export function runLabSearch<T>(
  steps: Generator<void, T>,
  signal: AbortSignal,
): Promise<T | null> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      steps.return?.(value as T);
      resolve(value);
    };
    const cancel = () => finish(null);
    const tick = () => {
      if (signal.aborted) {
        finish(null);
        return;
      }
      const result = steps.next();
      if (result.done) finish(result.value);
      else timer = setTimeout(tick, 0);
    };
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) finish(null);
    else timer = setTimeout(tick, 0);
  });
}
/** Stable host survives keyed resets. Never steal focus from shell/external controls. */
export function useLabFocus(host: RefObject<HTMLDivElement | null>): void {
  const remembered = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const focused = (event: FocusEvent) => {
      remembered.current =
        event.target === el ? null : (event.target as HTMLElement);
    };
    const blurred = (event: FocusEvent) => {
      const control = event.target as HTMLElement;
      if (
        event.relatedTarget ||
        (!control.matches(":disabled") && !control.closest("[hidden]"))
      )
        remembered.current = null;
    };
    el.addEventListener("focusin", focused);
    el.addEventListener("focusout", blurred);
    return () => {
      el.removeEventListener("focusin", focused);
      el.removeEventListener("focusout", blurred);
    };
  }, [host]);
  useLayoutEffect(
    () => () => {
      const el = host.current;
      if (
        el &&
        el !== document.activeElement &&
        el.contains(document.activeElement)
      )
        el.focus({ preventScroll: true });
    },
    [host],
  );
  useLayoutEffect(() => {
    const el = host.current,
      active = document.activeElement;
    const control =
      active instanceof HTMLElement && el?.contains(active) && active !== el
        ? active
        : remembered.current;
    if (
      el &&
      control &&
      el.contains(control) &&
      (control.matches(":disabled") || control.closest("[hidden]")) &&
      (active === control || active === document.body)
    ) {
      remembered.current = null;
      el.focus({ preventScroll: true });
    }
  });
}
