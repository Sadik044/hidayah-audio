import { useEffect, useState, useRef, useCallback } from 'react';

export interface UseAdminInactivityOptions {
  /**
   * Inactivity timeout duration in milliseconds.
   * Default: 30 minutes (30 * 60 * 1000).
   */
  timeoutMs?: number;
  /**
   * Warning duration in milliseconds before timeout.
   * Default: 2 minutes (2 * 60 * 1000).
   */
  warningMs?: number;
  /**
   * Callback fired when timeout has been reached.
   */
  onTimeout: () => void;
  /**
   * Whether the timer is enabled (active only when authenticated as admin).
   */
  enabled?: boolean;
}

const STORAGE_KEY = 'hidayah_admin_last_activity';

export function useAdminInactivity({
  timeoutMs = 30 * 60 * 1000,
  warningMs = 2 * 60 * 1000,
  onTimeout,
  enabled = true,
}: UseAdminInactivityOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(Math.ceil(warningMs / 1000));

  // Store last activity timestamp locally and in ref
  const lastActivityRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  // One-time timeout guard to prevent duplicate sign-out calls
  const hasTimedOutRef = useRef(false);

  // Initialize or read last activity timestamp on mount
  useEffect(() => {
    if (!enabled) return;
    hasTimedOutRef.current = false;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now()) {
          lastActivityRef.current = parsed;
        } else {
          lastActivityRef.current = Date.now();
          sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
        }
      } else {
        lastActivityRef.current = Date.now();
        sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
      }
    } catch {
      lastActivityRef.current = Date.now();
    }
  }, [enabled]);

  // Method to manually or automatically record meaningful activity
  const recordActivity = useCallback(() => {
    // Terminal guard: if timeout has already triggered, do not record activity
    if (hasTimedOutRef.current) return;

    const now = Date.now();
    lastActivityRef.current = now;
    setShowWarning(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, now.toString());
    } catch {
      // Ignore sessionStorage access errors
    }
  }, []);

  // Method to keep session active from warning modal
  const keepActive = useCallback(() => {
    // Terminal guard: Keep Alive cannot reverse an already-triggered timeout
    if (hasTimedOutRef.current) return;
    recordActivity();
  }, [recordActivity]);

  useEffect(() => {
    if (!enabled) return;

    let throttleTimer: number | null = null;
    const handleUserActivity = () => {
      // Terminal guard: clicks/activity during in-flight sign-out cannot reset guard
      if (hasTimedOutRef.current) return;

      // Throttle activity updates to once per 1 second to avoid performance overhead
      const now = Date.now();
      if (!throttleTimer) {
        lastActivityRef.current = now;
        try {
          sessionStorage.setItem(STORAGE_KEY, now.toString());
        } catch {
          // Ignore
        }
        throttleTimer = window.setTimeout(() => {
          throttleTimer = null;
        }, 1000);
      }
    };

    // Meaningful user interaction events
    const events: (keyof WindowEventMap)[] = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    // Check inactivity status periodically (every 1 second for accurate warning countdown)
    const checkInterval = window.setInterval(() => {
      // Read latest timestamp in case another tab updated it
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > lastActivityRef.current) {
            lastActivityRef.current = parsed;
          }
        }
      } catch {
        // Ignore
      }

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const timeLeft = timeoutMs - elapsed;

      if (timeLeft <= 0) {
        // Truly timed out! Ensure only one timeout execution occurs
        if (!hasTimedOutRef.current) {
          hasTimedOutRef.current = true;
          setShowWarning(false);
          try {
            sessionStorage.removeItem(STORAGE_KEY);
          } catch {
            // Ignore
          }
          onTimeoutRef.current();
        }
      } else if (!hasTimedOutRef.current) {
        if (timeLeft <= warningMs) {
          setShowWarning(true);
          setRemainingSeconds(Math.max(1, Math.ceil(timeLeft / 1000)));
        } else {
          setShowWarning(false);
        }
      }
    }, 1000);

    // Evaluate elapsed time when tab visibility changes (prevents background-tab false logouts)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const elapsed = now - lastActivityRef.current;
        const timeLeft = timeoutMs - elapsed;

        if (timeLeft <= 0) {
          if (!hasTimedOutRef.current) {
            hasTimedOutRef.current = true;
            setShowWarning(false);
            try {
              sessionStorage.removeItem(STORAGE_KEY);
            } catch {
              // Ignore
            }
            onTimeoutRef.current();
          }
        } else if (!hasTimedOutRef.current) {
          if (timeLeft <= warningMs) {
            setShowWarning(true);
            setRemainingSeconds(Math.max(1, Math.ceil(timeLeft / 1000)));
          } else {
            setShowWarning(false);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (throttleTimer) {
        window.clearTimeout(throttleTimer);
      }
      window.clearInterval(checkInterval);
    };
  }, [enabled, timeoutMs, warningMs]);

  return {
    showWarning,
    remainingSeconds,
    keepActive,
  };
}
