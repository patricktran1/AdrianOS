"use client";

export const PARENT_SESSION_KEYS = [
  "adrianos-parent-unlocked",
  "adrianos-weekly-report-unlocked",
  "adrianos-placement-report-unlocked",
  "adrianos-coach-report-unlocked",
  "adrianos-skill-goals-unlocked",
] as const;

export const PARENT_ACCESS_EVENT = "adrianos-parent-access-updated";
const LAST_ACTIVITY_KEY = "adrianos-parent-last-activity";
const LOCK_NOTICE_KEY = "adrianos-parent-lock-notice";

export function isParentSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(PARENT_SESSION_KEYS[0]) === "yes";
}

export function markParentActivity(at = Date.now()): void {
  if (typeof window === "undefined" || !isParentSessionUnlocked()) return;
  window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(at));
}

export function parentLastActivity(): number | null {
  if (typeof window === "undefined") return null;
  const value = Number(window.sessionStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function setParentSessionAccess(unlocked: boolean): void {
  if (typeof window === "undefined") return;
  for (const key of PARENT_SESSION_KEYS) {
    if (unlocked) window.sessionStorage.setItem(key, "yes");
    else window.sessionStorage.removeItem(key);
  }
  if (unlocked) markParentActivity();
  else window.sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  window.dispatchEvent(new Event(PARENT_ACCESS_EVENT));
}

export function lockParentSession(notice?: string): void {
  setParentSessionAccess(false);
  if (typeof window === "undefined") return;
  if (notice) window.sessionStorage.setItem(LOCK_NOTICE_KEY, notice);
}

export function consumeParentLockNotice(): string {
  if (typeof window === "undefined") return "";
  const notice = window.sessionStorage.getItem(LOCK_NOTICE_KEY) ?? "";
  window.sessionStorage.removeItem(LOCK_NOTICE_KEY);
  return notice;
}
