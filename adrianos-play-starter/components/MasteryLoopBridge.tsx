"use client";

import { useEffect } from "react";
import { runMasteryLoopForProfile } from "@/lib/adrian-mastery-runtime";
import { readFamilyState } from "@/lib/adrian-profiles";

const SOURCE_EVENTS = [
  "adrianos-learning-updated",
  "adrianos-family-updated",
  "adrianos-progress-updated",
  "adrianos-coach-updated",
];

export default function MasteryLoopBridge() {
  useEffect(() => {
    let timer: number | null = null;
    let stopped = false;

    const run = () => {
      if (stopped) return;
      const family = readFamilyState();
      for (const profile of family.profiles) runMasteryLoopForProfile(profile.id);
    };

    const schedule = (delay = 180) => {
      if (stopped) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        run();
      }, delay);
    };

    const onSourceEvent = () => schedule();
    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule(80);
    };

    schedule(320);
    for (const eventName of SOURCE_EVENTS) window.addEventListener(eventName, onSourceEvent);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => schedule(0), 60_000);

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      window.clearInterval(interval);
      for (const eventName of SOURCE_EVENTS) window.removeEventListener(eventName, onSourceEvent);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
