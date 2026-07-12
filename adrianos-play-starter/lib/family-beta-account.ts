"use client";

import { pullCloudNow, syncCloudNow } from "@/lib/adrian-cloud-sync";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

const SNAPSHOT_TABLE = "adrianos_family_snapshots";
const SETUP_PENDING_KEY = "adrianos-family-setup-pending-v1";

export type FamilyCloudInspection = {
  state: "not-configured" | "signed-out" | "new-family" | "existing-family" | "error";
  email: string | null;
  message: string;
};

export function isFamilySetupPending(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SETUP_PENDING_KEY) === "yes";
}

export function markFamilySetupPending(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETUP_PENDING_KEY, "yes");
}

export function clearFamilySetupPending(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SETUP_PENDING_KEY);
}

function redirectUrl(): string {
  return `${window.location.origin}/family/setup`;
}

export async function beginGoogleFamilySignIn(): Promise<{ ok: boolean; message: string }> {
  const client = getSupabaseBrowserClient();
  if (!client || !isSupabaseConfigured()) {
    return { ok: false, message: "Cloud accounts are not configured on this deployment yet." };
  }

  markFamilySetupPending();
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectUrl() },
  });

  if (error) {
    clearFamilySetupPending();
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Opening Google sign-in…" };
}

export async function beginEmailFamilySignIn(email: string): Promise<{ ok: boolean; message: string }> {
  const client = getSupabaseBrowserClient();
  const cleanEmail = email.trim();
  if (!client || !cleanEmail || !isSupabaseConfigured()) {
    return { ok: false, message: "Enter a valid parent email." };
  }

  markFamilySetupPending();
  const { error } = await client.auth.signInWithOtp({
    email: cleanEmail,
    options: { emailRedirectTo: redirectUrl() },
  });
  if (error) {
    clearFamilySetupPending();
    return { ok: false, message: error.message };
  }
  return { ok: true, message: `Sign-in link sent to ${cleanEmail}.` };
}

export async function inspectFamilyCloudAccount(): Promise<FamilyCloudInspection> {
  if (!isSupabaseConfigured()) {
    return {
      state: "not-configured",
      email: null,
      message: "Cloud accounts are not configured on this deployment yet.",
    };
  }

  const client = getSupabaseBrowserClient();
  if (!client) {
    return { state: "error", email: null, message: "Could not open the cloud account client." };
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    return { state: "error", email: null, message: sessionError.message };
  }
  const session = sessionData.session;
  if (!session) {
    return { state: "signed-out", email: null, message: "Sign in with a parent account to continue." };
  }

  const { data, error } = await client
    .from(SNAPSHOT_TABLE)
    .select("updated_at")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) {
    return { state: "error", email: session.user.email ?? null, message: error.message };
  }

  return data
    ? {
        state: "existing-family",
        email: session.user.email ?? null,
        message: "A family profile already exists. Restoring it to this device…",
      }
    : {
        state: "new-family",
        email: session.user.email ?? null,
        message: "Create the child profiles for this family account.",
      };
}

export async function restoreExistingFamily(): Promise<{ ok: boolean; message: string }> {
  const ok = await pullCloudNow();
  if (ok) clearFamilySetupPending();
  return {
    ok,
    message: ok ? "Family learning restored." : "The family cloud copy could not be restored.",
  };
}

export async function finishFamilyCloudSetup(): Promise<{ ok: boolean; message: string }> {
  const ok = await syncCloudNow();
  if (ok) clearFamilySetupPending();
  return {
    ok,
    message: ok ? "Family account created and synced." : "Profiles were saved locally, but cloud sync did not finish.",
  };
}
