"use client";

import { useEffect } from "react";

import { clearSessionCrypto } from "@/lib/crypto";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Drops the in-memory AES key after a stretch of inactivity. `minutes <= 0`
 * disables it; the caller passes `active: false` while already locked so an
 * idle vault screen does not keep a timer alive.
 */
export function useAutoLock(minutes: number, active: boolean): void {
  useEffect(() => {
    if (!active || minutes <= 0) return;

    const timeout = minutes * 60_000;
    let timer = window.setTimeout(lock, timeout);

    function lock() {
      clearSessionCrypto();
    }

    function restart() {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, timeout);
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, restart, { passive: true });
    }

    return () => {
      window.clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, restart);
      }
    };
  }, [minutes, active]);
}
