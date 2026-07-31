import { useEffect, useRef } from "react";

const getScrollBehavior = () => {
  if (typeof window === "undefined") return "auto";

  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ? "auto"
    : "smooth";
};

const isComfortablyVisible = (element) => {
  const rect = element.getBoundingClientRect();
  const topOffset = 96;
  const bottomOffset = 28;

  return (
    rect.top >= topOffset &&
    rect.bottom <= window.innerHeight - bottomOffset
  );
};

/**
 * Moves the viewport to the newly active task after a booking workflow changes.
 * It also runs for the first actionable task loaded on the page, which is useful
 * when a customer or garage opens a long tracking/workspace page mid-flow.
 */
export default function useAutoScrollToNextTask(
  taskKey,
  targetRef,
  { ready = true, delay = 260 } = {},
) {
  const previousTaskKeyRef = useRef("");
  const scheduledScrollRef = useRef(null);

  useEffect(() => {
    if (!ready || !taskKey || !targetRef) return undefined;
    if (previousTaskKeyRef.current === taskKey) return undefined;

    previousTaskKeyRef.current = taskKey;

    if (scheduledScrollRef.current) {
      window.clearTimeout(scheduledScrollRef.current);
    }

    scheduledScrollRef.current = window.setTimeout(() => {
      const element = targetRef.current;
      if (!element || isComfortablyVisible(element)) return;

      element.scrollIntoView({
        behavior: getScrollBehavior(),
        block: "start",
        inline: "nearest",
      });
    }, delay);

    return () => {
      if (scheduledScrollRef.current) {
        window.clearTimeout(scheduledScrollRef.current);
        scheduledScrollRef.current = null;
      }
    };
  }, [delay, ready, targetRef, taskKey]);
}
