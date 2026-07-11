"use client";

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  exportFamilyBackup,
  importFamilyBackup,
  type ChildProfile,
  type FamilyBackup,
} from "@/lib/adrian-profiles";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase-browser";

const SNAPSHOT_TABLE = "adrianos_family_snapshots";
const CLOUD_EVENT = "adrianos-cloud-status";

type UnknownRecord = Record<string, unknown>;
type CloudRow = { payload: FamilyBackup; updated_at: string };

export type CloudSyncPhase =
  | "not-configured"
  | "signed-out"
  | "sending-link"
  | "syncing"
  | "synced"
  | "offline"
  | "error";

export type CloudSyncStatus = {
  phase: CloudSyncPhase;
  message: string;
  userEmail: string | null;
  lastSyncedAt: string | null;
};

let currentStatus: CloudSyncStatus = {
  phase: isSupabaseConfigured() ? "signed-out" : "not-configured",
  message: isSupabaseConfigured()
    ? "Sign in to turn on cloud sync."
    : "Supabase environment variables have not been added yet.",
  userEmail: null,
  lastSyncedAt: null,
};

function publishStatus(change: Partial<CloudSyncStatus>): CloudSyncStatus {
  currentStatus = { ...currentStatus, ...change };
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<CloudSyncStatus>(CLOUD_EVENT, { detail: currentStatus })
    );
  }
  return currentStatus;
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return currentStatus;
}

export function useCloudSyncStatus(): CloudSyncStatus {
  const [status, setStatus] = useState(currentStatus);
  useEffect(() => {
    const refresh = (event: Event) => {
      setStatus((event as CustomEvent<CloudSyncStatus>).detail ?? currentStatus);
    };
    window.addEventListener(CLOUD_EVENT, refresh);
    setStatus(currentStatus);
    return () => window.removeEventListener(CLOUD_EVENT, refresh);
  }, []);
  return status;
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function latestString(left: unknown, right: unknown): string | null {
  const a = typeof left === "string" ? left : null;
  const b = typeof right === "string" ? right : null;
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function mergeGameProgress(left: unknown, right: unknown): UnknownRecord {
  const a = asRecord(left);
  const b = asRecord(right);
  return {
    plays: Math.max(safeNumber(a.plays), safeNumber(b.plays)),
    completions: Math.max(safeNumber(a.completions), safeNumber(b.completions)),
    bestScore: Math.max(safeNumber(a.bestScore), safeNumber(b.bestScore)),
    lastPlayed: latestString(a.lastPlayed, b.lastPlayed),
  };
}

function mergeActivity(left: unknown, right: unknown): UnknownRecord[] {
  const rows = new Map<string, UnknownRecord>();
  const add = (source: unknown) => {
    if (!Array.isArray(source)) return;
    for (const value of source) {
      const row = asRecord(value);
      const date = typeof row.date === "string" ? row.date : "";
      if (!date) continue;
      const current = rows.get(date) ?? {};
      rows.set(date, {
        date,
        plays: Math.max(safeNumber(current.plays), safeNumber(row.plays)),
        completions: Math.max(safeNumber(current.completions), safeNumber(row.completions)),
        xp: Math.max(safeNumber(current.xp), safeNumber(row.xp)),
        coins: Math.max(safeNumber(current.coins), safeNumber(row.coins)),
      });
    }
  };
  add(left);
  add(right);
  return [...rows.values()]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-30);
}

function mergeProgress(left: unknown, right: unknown): UnknownRecord {
  const a = asRecord(left);
  const b = asRecord(right);
  const gamesA = asRecord(a.games);
  const gamesB = asRecord(b.games);
  const games: UnknownRecord = {};
  for (const slug of new Set([...Object.keys(gamesA), ...Object.keys(gamesB)])) {
    games[slug] = mergeGameProgress(gamesA[slug], gamesB[slug]);
  }
  const xp = Math.max(safeNumber(a.xp), safeNumber(b.xp));
  return {
    xp,
    coins: Math.max(safeNumber(a.coins), safeNumber(b.coins)),
    level: Math.floor(xp / 200) + 1,
    games,
    activity: mergeActivity(a.activity, b.activity),
  };
}

function mergeHub(left: unknown, right: unknown): UnknownRecord {
  const a = asRecord(left);
  const b = asRecord(right);
  const dayA = typeof a.day === "string" ? a.day : "";
  const dayB = typeof b.day === "string" ? b.day : "";
  const newest = dayB > dayA ? b : a;
  const claimed = new Set<string>();
  const unlocked = new Set<string>(["rocket"]);
  for (const source of [a.claimedMissions, b.claimedMissions]) {
    if (Array.isArray(source)) source.forEach((item) => typeof item === "string" && claimed.add(item));
  }
  for (const source of [a.unlockedAvatars, b.unlockedAvatars]) {
    if (Array.isArray(source)) source.forEach((item) => typeof item === "string" && unlocked.add(item));
  }
  return {
    ...newest,
    day: dayA > dayB ? dayA : dayB,
    baselinePlays: Math.max(safeNumber(a.baselinePlays), safeNumber(b.baselinePlays)),
    baselineCompletions: Math.max(safeNumber(a.baselineCompletions), safeNumber(b.baselineCompletions)),
    claimedMissions: [...claimed],
    unlockedAvatars: [...unlocked],
    avatarId:
      (typeof a.avatarId === "string" ? a.avatarId : null) ??
      (typeof b.avatarId === "string" ? b.avatarId : null) ??
      "rocket",
  };
}

function mergeNewestState(left: unknown, right: unknown): unknown {
  const a = asRecord(left);
  const b = asRecord(right);
  const updatedA = typeof a.updatedAt === "string" ? a.updatedAt : "";
  const updatedB = typeof b.updatedAt === "string" ? b.updatedAt : "";
  if (!updatedA) return Object.keys(b).length ? b : a;
  if (!updatedB) return a;
  return updatedB > updatedA ? b : a;
}

function mergeProfiles(cloud: ChildProfile[], local: ChildProfile[]): ChildProfile[] {
  const profiles = new Map<string, ChildProfile>();
  cloud.forEach((profile) => profiles.set(profile.id, profile));
  local.forEach((profile) => profiles.set(profile.id, profile));
  return [...profiles.values()];
}

function hasMeaningfulData(backup: FamilyBackup): boolean {
  const progress = Object.values(backup.progressByProfile).some((value) => {
    const row = asRecord(value);
    return safeNumber(row.xp) > 0 || safeNumber(row.coins) > 0 || Object.keys(asRecord(row.games)).length > 0;
  });
  const learning = Object.values(backup.learningByProfile ?? {}).some((value) => {
    const row = asRecord(value);
    return Object.keys(asRecord(row.skills)).length > 0 || (Array.isArray(row.reviewQueue) && row.reviewQueue.length > 0);
  });
  const coach = Object.values(backup.coachByProfile ?? {}).some((value) => {
    const row = asRecord(value);
    return Array.isArray(row.interactions) && row.interactions.length > 0;
  });
  return progress || learning || coach;
}

function sanitizeForCloud(backup: FamilyBackup): FamilyBackup {
  return {
    ...backup,
    family: { ...backup.family, parentPinHash: null },
  };
}

function preserveLocalPin(backup: FamilyBackup): FamilyBackup {
  const local = exportFamilyBackup();
  return {
    ...backup,
    family: { ...backup.family, parentPinHash: local.family.parentPinHash },
  };
}

function mergeBackups(local: FamilyBackup, cloud: FamilyBackup): FamilyBackup {
  if (!hasMeaningfulData(local)) return preserveLocalPin(cloud);
  const profiles = mergeProfiles(cloud.family.profiles, local.family.profiles);
  const activeProfileId = profiles.some((profile) => profile.id === local.family.activeProfileId)
    ? local.family.activeProfileId
    : cloud.family.activeProfileId;
  const progressByProfile: Record<string, unknown> = {};
  const hubByProfile: Record<string, unknown> = {};
  const learningByProfile: Record<string, unknown> = {};
  const coachByProfile: Record<string, unknown> = {};
  for (const profile of profiles) {
    progressByProfile[profile.id] = mergeProgress(
      local.progressByProfile[profile.id],
      cloud.progressByProfile[profile.id]
    );
    hubByProfile[profile.id] = mergeHub(
      local.hubByProfile[profile.id],
      cloud.hubByProfile[profile.id]
    );
    learningByProfile[profile.id] = mergeNewestState(
      local.learningByProfile?.[profile.id],
      cloud.learningByProfile?.[profile.id]
    );
    coachByProfile[profile.id] = mergeNewestState(
      local.coachByProfile?.[profile.id],
      cloud.coachByProfile?.[profile.id]
    );
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    family: {
      activeProfileId,
      profiles,
      parentPinHash: local.family.parentPinHash,
    },
    progressByProfile,
    hubByProfile,
    learningByProfile,
    coachByProfile,
  };
}

async function currentSession(): Promise<Session | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

async function fetchCloudRow(user: User): Promise<CloudRow | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client
    .from(SNAPSHOT_TABLE)
    .select("payload, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? data as CloudRow : null;
}

async function writeCloudRow(user: User, payload: FamilyBackup): Promise<string> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase is not configured.");
  const updatedAt = new Date().toISOString();
  const { error } = await client.from(SNAPSHOT_TABLE).upsert(
    {
      user_id: user.id,
      payload: sanitizeForCloud(payload),
      updated_at: updatedAt,
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
  return updatedAt;
}

export async function sendCloudMagicLink(email: string): Promise<boolean> {
  const client = getSupabaseBrowserClient();
  const cleanEmail = email.trim();
  if (!client || !cleanEmail) return false;
  publishStatus({ phase: "sending-link", message: "Sending a secure sign-in link…" });
  const { error } = await client.auth.signInWithOtp({
    email: cleanEmail,
    options: { emailRedirectTo: `${window.location.origin}/parent` },
  });
  if (error) {
    publishStatus({ phase: "error", message: error.message });
    return false;
  }
  publishStatus({
    phase: "signed-out",
    message: `Sign-in link sent to ${cleanEmail}.`,
    userEmail: cleanEmail,
  });
  return true;
}

export async function signOutCloud(): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (client) await client.auth.signOut();
  publishStatus({
    phase: "signed-out",
    message: "Cloud sync is signed out.",
    userEmail: null,
  });
}

export async function syncCloudNow(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    publishStatus({ phase: "not-configured", message: "Supabase environment variables have not been added yet." });
    return false;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    publishStatus({ phase: "offline", message: "Offline. Changes remain saved locally." });
    return false;
  }
  const session = await currentSession();
  if (!session) {
    publishStatus({ phase: "signed-out", message: "Sign in to turn on cloud sync.", userEmail: null });
    return false;
  }
  publishStatus({ phase: "syncing", message: "Syncing family learning…", userEmail: session.user.email ?? null });
  try {
    const local = exportFamilyBackup();
    const cloudRow = await fetchCloudRow(session.user);
    const merged = cloudRow ? mergeBackups(local, cloudRow.payload) : local;
    importFamilyBackup(preserveLocalPin(merged));
    const syncedAt = await writeCloudRow(session.user, merged);
    publishStatus({
      phase: "synced",
      message: "Cloud sync is up to date.",
      userEmail: session.user.email ?? null,
      lastSyncedAt: syncedAt,
    });
    return true;
  } catch (error) {
    publishStatus({ phase: "error", message: error instanceof Error ? error.message : "Cloud sync failed." });
    return false;
  }
}

export async function pullCloudNow(): Promise<boolean> {
  const session = await currentSession();
  if (!session) return false;
  publishStatus({ phase: "syncing", message: "Downloading cloud learning…", userEmail: session.user.email ?? null });
  try {
    const cloudRow = await fetchCloudRow(session.user);
    if (!cloudRow) {
      publishStatus({ phase: "error", message: "No cloud backup exists for this account yet." });
      return false;
    }
    importFamilyBackup(preserveLocalPin(cloudRow.payload));
    publishStatus({
      phase: "synced",
      message: "Cloud learning downloaded to this device.",
      userEmail: session.user.email ?? null,
      lastSyncedAt: cloudRow.updated_at,
    });
    return true;
  } catch (error) {
    publishStatus({ phase: "error", message: error instanceof Error ? error.message : "Cloud download failed." });
    return false;
  }
}

export async function refreshCloudAuthStatus(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const session = await currentSession();
  if (!session) {
    publishStatus({ phase: "signed-out", message: "Sign in to turn on cloud sync.", userEmail: null });
    return;
  }
  publishStatus({ phase: "syncing", message: "Connecting to cloud sync…", userEmail: session.user.email ?? null });
}
