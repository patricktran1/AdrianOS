"use client";

import { useCallback, useEffect, useState } from "react";

export type ChildProfile = {
  id: string;
  name: string;
  age: number;
  emoji: string;
  createdAt: string;
};

export type FamilyState = {
  activeProfileId: string;
  profiles: ChildProfile[];
  parentPinHash: string | null;
};

export type FamilyBackup = {
  version: 1;
  exportedAt: string;
  family: FamilyState;
  progressByProfile: Record<string, unknown>;
  hubByProfile: Record<string, unknown>;
};

const FAMILY_KEY = "adrianos-family-v1";
const FAMILY_EVENT = "adrianos-family-updated";
const PROGRESS_PREFIX = "adrianos-progress-v2:";
const HUB_PREFIX = "adrianos-home-hub-v2:";

const DEFAULT_PROFILES: ChildProfile[] = [
  {
    id: "adrian",
    name: "Adrian",
    age: 7,
    emoji: "🚀",
    createdAt: "2026-07-10T00:00:00.000Z",
  },
  {
    id: "elliot",
    name: "Elliot",
    age: 3,
    emoji: "🦖",
    createdAt: "2026-07-10T00:00:00.000Z",
  },
];

const DEFAULT_FAMILY: FamilyState = {
  activeProfileId: "adrian",
  profiles: DEFAULT_PROFILES,
  parentPinHash: null,
};

function cleanProfile(value: unknown, fallbackIndex: number): ChildProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ChildProfile>;
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 24) : "";
  if (!name) return null;
  const id =
    typeof raw.id === "string" && /^[a-z0-9-]{1,40}$/.test(raw.id)
      ? raw.id
      : `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${fallbackIndex}`;
  return {
    id,
    name,
    age:
      typeof raw.age === "number" && Number.isFinite(raw.age)
        ? Math.max(2, Math.min(18, Math.round(raw.age)))
        : 7,
    emoji: typeof raw.emoji === "string" && raw.emoji ? raw.emoji.slice(0, 8) : "⭐",
    createdAt:
      typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  };
}

function normalizeFamily(value: unknown): FamilyState {
  if (!value || typeof value !== "object") return DEFAULT_FAMILY;
  const raw = value as Partial<FamilyState>;
  const profiles = Array.isArray(raw.profiles)
    ? raw.profiles
        .map((profile, index) => cleanProfile(profile, index))
        .filter((profile): profile is ChildProfile => Boolean(profile))
    : [];
  const safeProfiles = profiles.length > 0 ? profiles : DEFAULT_PROFILES;
  const activeProfileId = safeProfiles.some((profile) => profile.id === raw.activeProfileId)
    ? String(raw.activeProfileId)
    : safeProfiles[0].id;

  return {
    activeProfileId,
    profiles: safeProfiles,
    parentPinHash:
      typeof raw.parentPinHash === "string" && raw.parentPinHash
        ? raw.parentPinHash
        : null,
  };
}

export function readFamilyState(): FamilyState {
  if (typeof window === "undefined") return DEFAULT_FAMILY;
  try {
    const raw = window.localStorage.getItem(FAMILY_KEY);
    const family = raw ? normalizeFamily(JSON.parse(raw)) : DEFAULT_FAMILY;
    if (!raw) window.localStorage.setItem(FAMILY_KEY, JSON.stringify(family));
    return family;
  } catch {
    return DEFAULT_FAMILY;
  }
}

function writeFamilyState(family: FamilyState): FamilyState {
  if (typeof window === "undefined") return family;
  window.localStorage.setItem(FAMILY_KEY, JSON.stringify(family));
  window.dispatchEvent(new Event(FAMILY_EVENT));
  return family;
}

export function getActiveProfile(): ChildProfile {
  const family = readFamilyState();
  return (
    family.profiles.find((profile) => profile.id === family.activeProfileId) ??
    family.profiles[0] ??
    DEFAULT_PROFILES[0]
  );
}

export function hashPin(pin: string): string {
  let hash = 2166136261;
  for (let index = 0; index < pin.length; index += 1) {
    hash ^= pin.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function verifyParentPin(pin: string): boolean {
  const family = readFamilyState();
  return Boolean(family.parentPinHash && hashPin(pin) === family.parentPinHash);
}

export function exportFamilyBackup(): FamilyBackup {
  const family = readFamilyState();
  const progressByProfile: Record<string, unknown> = {};
  const hubByProfile: Record<string, unknown> = {};

  for (const profile of family.profiles) {
    const progress = window.localStorage.getItem(`${PROGRESS_PREFIX}${profile.id}`);
    const hub = window.localStorage.getItem(`${HUB_PREFIX}${profile.id}`);
    if (progress) {
      try {
        progressByProfile[profile.id] = JSON.parse(progress);
      } catch {
        progressByProfile[profile.id] = null;
      }
    }
    if (hub) {
      try {
        hubByProfile[profile.id] = JSON.parse(hub);
      } catch {
        hubByProfile[profile.id] = null;
      }
    }
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    family,
    progressByProfile,
    hubByProfile,
  };
}

export function importFamilyBackup(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const raw = value as Partial<FamilyBackup>;
  if (raw.version !== 1 || !raw.family) return false;
  const family = normalizeFamily(raw.family);

  window.localStorage.setItem(FAMILY_KEY, JSON.stringify(family));
  for (const profile of family.profiles) {
    const progress = raw.progressByProfile?.[profile.id];
    const hub = raw.hubByProfile?.[profile.id];
    if (progress && typeof progress === "object") {
      window.localStorage.setItem(
        `${PROGRESS_PREFIX}${profile.id}`,
        JSON.stringify(progress)
      );
    }
    if (hub && typeof hub === "object") {
      window.localStorage.setItem(`${HUB_PREFIX}${profile.id}`, JSON.stringify(hub));
    }
  }

  window.dispatchEvent(new Event(FAMILY_EVENT));
  window.dispatchEvent(new Event("adrianos-progress-updated"));
  return true;
}

export function useFamilyProfiles() {
  const [family, setFamily] = useState<FamilyState>(DEFAULT_FAMILY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setFamily(readFamilyState());
      setHydrated(true);
    };
    refresh();
    window.addEventListener(FAMILY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(FAMILY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const switchProfile = useCallback((profileId: string) => {
    const current = readFamilyState();
    if (!current.profiles.some((profile) => profile.id === profileId)) return false;
    setFamily(writeFamilyState({ ...current, activeProfileId: profileId }));
    window.dispatchEvent(new Event("adrianos-progress-updated"));
    return true;
  }, []);

  const updateProfile = useCallback(
    (profileId: string, change: Partial<Pick<ChildProfile, "name" | "age" | "emoji">>) => {
      const current = readFamilyState();
      const profiles = current.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              name:
                typeof change.name === "string" && change.name.trim()
                  ? change.name.trim().slice(0, 24)
                  : profile.name,
              age:
                typeof change.age === "number"
                  ? Math.max(2, Math.min(18, Math.round(change.age)))
                  : profile.age,
              emoji:
                typeof change.emoji === "string" && change.emoji
                  ? change.emoji.slice(0, 8)
                  : profile.emoji,
            }
          : profile
      );
      setFamily(writeFamilyState({ ...current, profiles }));
    },
    []
  );

  const setParentPin = useCallback((pin: string) => {
    if (!/^\d{4,6}$/.test(pin)) return false;
    const current = readFamilyState();
    setFamily(writeFamilyState({ ...current, parentPinHash: hashPin(pin) }));
    return true;
  }, []);

  const activeProfile =
    family.profiles.find((profile) => profile.id === family.activeProfileId) ??
    family.profiles[0] ??
    DEFAULT_PROFILES[0];

  return {
    family,
    activeProfile,
    hydrated,
    switchProfile,
    updateProfile,
    setParentPin,
    verifyPin: verifyParentPin,
  };
}
