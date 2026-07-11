"use client";

import { useEffect } from "react";
import {
  getCloudSyncStatus,
  refreshCloudAuthStatus,
  syncCloudNow,
} from "@/lib/adrian-cloud-sync";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase-browser";

const LOCAL_EVENTS = [
  "adrianos-progress-updated",
  "adrianos-family-updated",
  "adrianos-hub-updated",
  "adrianos-learning-updated",
];

export default function CloudSyncBridge() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;

    let timer: number | null = null;
    let stopped = false;

    const scheduleSync = (delay = 1400) => {
      if (stopped) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        void syncCloudNow();
      }, delay);
    };

    const handleLocalChange = () => {
      if (getCloudSyncStatus().phase === "syncing") return;
      scheduleSync();
    };
    const handleOnline = () => scheduleSync(250);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleSync(500);
    };

    void refreshCloudAuthStatus().then(() => scheduleSync(300));

    for (const eventName of LOCAL_EVENTS) {
      window.addEventListener(eventName, handleLocalChange);
    }
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = window.setInterval(() => scheduleSync(0), 60_000);
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        void refreshCloudAuthStatus();
        return;
      }
      scheduleSync(250);
    });

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      window.clearInterval(interval);
      data.subscription.unsubscribe();
      for (const eventName of LOCAL_EVENTS) {
        window.removeEventListener(eventName, handleLocalChange);
      }
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
