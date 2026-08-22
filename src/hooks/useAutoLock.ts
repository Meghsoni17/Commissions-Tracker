import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'] as const;

/** Calls `onTimeout` after `timeoutMs` of no mouse/keyboard/touch activity, while `active` is true. */
export function useAutoLock(active: boolean, onTimeout: () => void, timeoutMs: number): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!active) return;

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onTimeoutRef.current(), timeoutMs);
    }

    reset();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, reset, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, reset);
      }
    };
  }, [active, timeoutMs]);
}
