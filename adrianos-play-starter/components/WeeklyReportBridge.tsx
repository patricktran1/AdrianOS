"use client";

import { useEffect } from "react";
import { readProgressForProfile } from "@/lib/adrian-progress";
import { readFamilyState } from "@/lib/adrian-profiles";
import { games } from "@/lib/generated-games";
import { refreshWeeklyReport } from "@/lib/adrian-weekly-report";

const SOURCE_EVENTS = [
  "adrianos-progress-updated",
  "adrianos-learning-updated",
  "adrianos-coach-updated",
  "adrianos-placement-updated",
  "adrianos-family-updated",
];

export default function WeeklyReportBridge() {
  useEffect(() => {
    let timer: number | null = null;
    let stopped = false;

    const refresh = () => {
      if (stopped) return;
      const family = readFamilyState();
      const profile = family.profiles.find((item) => item.id === family.activeProfileId) ?? family.profiles[0];
      if (!profile) return;
      refreshWeeklyReport(profile, readProgressForProfile(profile.id), games);
    };

    const schedule = (delay = 500) => {
      if (stopped) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        refresh();
      }, delay);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") schedule(300);
    };

    schedule(900);
    for (const eventName of SOURCE_EVENTS) window.addEventListener(eventName, schedule);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      for (const eventName of SOURCE_EVENTS) window.removeEventListener(eventName, schedule);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
