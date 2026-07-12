"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  isParentSessionUnlocked,
  lockParentSession,
  PARENT_ACCESS_EVENT,
} from "@/lib/parent-session-security";

const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

type SecurityWindow = Window & { __ADRIANOS_PARENT_IDLE_TIMEOUT_MS?: number };

function idleTimeout(): number {
  const testValue = (window as SecurityWindow).__ADRIANOS_PARENT_IDLE_TIMEOUT_MS;
  return typeof testValue === "number" && testValue >= 50
    ? testValue
    : DEFAULT_IDLE_TIMEOUT_MS;
}

export default function ParentSessionSecurityBridge() {
  const pathname = usePathname();

  useEffect(() => {
    let timer: number | null = null;
    let lastActivity = Date.now();

    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    const lock = () => {
      if (!isParentSessionUnlocked()) return;
      lockParentSession("Parent tools locked after 10 minutes without activity.");
      if (pathname === "/parent" || pathname.startsWith("/parent/")) {
        window.location.replace("/parent?locked=idle");
      }
    };

    const arm = () => {
      clearTimer();
      if (!isParentSessionUnlocked()) return;
      const remaining = idleTimeout() - (Date.now() - lastActivity);
      if (remaining <= 0) {
        lock();
        return;
      }
      timer = window.setTimeout(lock, remaining);
    };

    const activity = () => {
      if (!isParentSessionUnlocked()) return;
      lastActivity = Date.now();
      arm();
    };

    const accessChanged = () => {
      lastActivity = Date.now();
      arm();
    };

    const visibility = () => {
      if (document.visibilityState === "visible") arm();
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, activity, { passive: true });
    }
    window.addEventListener(PARENT_ACCESS_EVENT, accessChanged);
    document.addEventListener("visibilitychange", visibility);
    arm();

    return () => {
      clearTimer();
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, activity);
      }
      window.removeEventListener(PARENT_ACCESS_EVENT, accessChanged);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [pathname]);

  return null;
}
