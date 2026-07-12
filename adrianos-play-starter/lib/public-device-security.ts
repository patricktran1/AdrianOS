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

function isAdrianOsStorageKey(key: string): boolean {
  return key.startsWith(APP_STORAGE_PREFIX);
}

function isSupabaseAuthStorageKey(key: string): boolean {
  return key.startsWith("sb-") && (key.includes("-auth-token") || key.includes("code-verifier"));
}

function removeMatchingKeys(storage: Storage, matches: (key: string) => boolean): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && matches(key)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

async function signOutCurrentBrowserSession(): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (client) {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error && !/auth session missing/i.test(error.message)) throw error;
  }
  await refreshCloudAuthStatus();
}

export function eraseAdrianOsDeviceData(): void {
  if (typeof window === "undefined") return;
  removeMatchingKeys(window.localStorage, (key) => isAdrianOsStorageKey(key) || isSupabaseAuthStorageKey(key));
  removeMatchingKeys(window.sessionStorage, (key) => isAdrianOsStorageKey(key) || isSupabaseAuthStorageKey(key));
  void window.navigator.credentials?.preventSilentAccess?.();
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
    // Local family data and auth state must still be removable from a shared device when offline.
  }
  eraseAdrianOsDeviceData();
  return {
    ok: true,
    erased: true,
    message: "Signed out and removed the local AdrianOS family copy.",
  };
}
