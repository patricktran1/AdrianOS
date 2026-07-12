"use client";

import {
  refreshCloudAuthStatus,
  syncCloudNow,
} from "@/lib/adrian-cloud-sync";
import { lockParentSession } from "@/lib/parent-session-security";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const APP_STORAGE_PREFIX = "adrianos-";

export type DeviceSignOutResult = {
  ok: boolean;
  erased: boolean;
  message: string;
};

function removeAppKeys(storage: Storage): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(APP_STORAGE_PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

async function signOutCurrentBrowserSession(): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (client) {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
  }
  await refreshCloudAuthStatus();
}

export function eraseAdrianOsDeviceData(): void {
  if (typeof window === "undefined") return;
  removeAppKeys(window.localStorage);
  removeAppKeys(window.sessionStorage);
  window.dispatchEvent(new Event("adrianos-family-updated"));
  window.dispatchEvent(new Event("adrianos-progress-updated"));
  window.dispatchEvent(new Event("adrianos-learning-updated"));
  window.dispatchEvent(new Event("adrianos-coach-updated"));
}

export async function signOutAndKeepDeviceData(): Promise<DeviceSignOutResult> {
  lockParentSession();
  await signOutCurrentBrowserSession();
  return {
    ok: true,
    erased: false,
    message: "Signed out. This device still keeps its local family copy.",
  };
}

export async function syncSignOutAndEraseDevice(): Promise<DeviceSignOutResult> {
  const synced = await syncCloudNow();
  if (!synced) {
    return {
      ok: false,
      erased: false,
      message: "Cloud backup could not be confirmed, so nothing was erased from this device.",
    };
  }

  lockParentSession();
  await signOutCurrentBrowserSession();
  eraseAdrianOsDeviceData();
  return {
    ok: true,
    erased: true,
    message: "Signed out and removed AdrianOS family data from this device.",
  };
}

export async function forceSignOutAndEraseDevice(): Promise<DeviceSignOutResult> {
  lockParentSession();
  try {
    await signOutCurrentBrowserSession();
  } catch {
    // Local family data must still be removable from a shared device when offline.
  }
  eraseAdrianOsDeviceData();
  return {
    ok: true,
    erased: true,
    message: "Signed out and removed the local AdrianOS family copy.",
  };
}
