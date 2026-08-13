import { useEffect, useRef, useState } from "react";

/**
 * Ticks `elapsed` up once per second (wall-clock-derived) while `running`, and
 * fires `onComplete` exactly once when `elapsed` reaches `totalSeconds`.
 *
 * Elapsed is computed from wall-clock time anchored at resume (`baseRef`), not
 * by counting setInterval ticks — so background-tab throttling or a locked
 * phone screen can't stretch the countdown. Completion is re-checked whenever
 * the tab becomes visible again, guaranteeing an app-switch won't swallow the
 * `onComplete` for a session that already ran its full length.
 */
export function useCountdown(
  totalSeconds: number,
  running: boolean,
  onComplete: () => void,
  resetKey?: unknown,
  initialElapsedSeconds = 0
) {
  const [elapsed, setElapsed] = useState(initialElapsedSeconds);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // baseRef = the wall-clock ms at which this run's elapsed should read 0.
  const baseRef = useRef<number>(Date.now());

  const syncElapsed = () => {
    setElapsed(Math.max(0, Math.floor((Date.now() - baseRef.current) / 1000)));
  };

  // Reset for a new session/length; also clears the completion latch.
  useEffect(() => {
    setElapsed(initialElapsedSeconds);
    completedRef.current = false;
    baseRef.current = Date.now() - initialElapsedSeconds * 1000;
  }, [totalSeconds, resetKey, initialElapsedSeconds]);

  // While running, anchor the base to resume-from-pause and recompute from the
  // clock (fast tick keeps the display smooth; visibilitychange covers the
  // case where the tab was hidden past the end of the timer).
  useEffect(() => {
    if (!running) return;
    baseRef.current = Date.now() - elapsed * 1000;
    const id = setInterval(syncElapsed, 250);
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncElapsed();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // elapsed intentionally read once (at resume) to set the base — refetching
    // it via the hook's public API would re-anchor on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    if (!running || completedRef.current || totalSeconds <= 0) return;
    if (elapsed >= totalSeconds) {
      completedRef.current = true;
      onCompleteRef.current();
    }
  }, [elapsed, totalSeconds, running]);

  return { elapsed, remaining: Math.max(0, totalSeconds - elapsed) };
}
