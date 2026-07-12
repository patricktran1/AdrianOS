"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";

const DISMISSED_KEY = "adrianos-install-prompt-dismissed-v1";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export default function InstallAppPrompt() {
  const pathname = usePathname();
  const { activeProfile, hydrated, hasProfiles } = useFamilyProfiles();
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  const allowedPath = (pathname === "/" || pathname === "/parent") && hasProfiles;

  useEffect(() => {
    if (!allowedPath || isStandaloneMode()) return;
    if (window.localStorage.getItem(DISMISSED_KEY) === "yes") return;

    const revealTimer = window.setTimeout(() => setVisible(true), 1800);
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    const installed = () => {
      setVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.clearTimeout(revealTimer);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, [allowedPath]);

  if (!allowedPath || !visible || !hydrated || !hasProfiles) return null;

  async function install() {
    if (!installEvent) return;
    setInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
        setInstallEvent(null);
      }
    } finally {
      setInstalling(false);
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "yes");
    setVisible(false);
  }

  return (
    <aside style={shell} aria-label="Install AdrianOS">
      <button type="button" onClick={dismiss} aria-label="Dismiss install prompt" style={close}>×</button>
      <div style={icon} aria-hidden="true">A</div>
      <div style={copy}>
        <strong style={title}>Put AdrianOS on this device</strong>
        <span style={description}>
          {activeProfile.emoji} {activeProfile.name} can open School Mode from the home screen and resume with fewer taps.
        </span>
      </div>
      {installEvent ? (
        <button type="button" onClick={() => void install()} disabled={installing} style={primary}>
          {installing ? "Installing…" : "Install app"}
        </button>
      ) : (
        <Link href="/install" style={primary}>How to install</Link>
      )}
    </aside>
  );
}

const shell: React.CSSProperties = {
  position: "fixed",
  right: 14,
  bottom: 14,
  zIndex: 109,
  width: "min(470px,calc(100vw - 28px))",
  display: "grid",
  gridTemplateColumns: "54px minmax(0,1fr) auto",
  alignItems: "center",
  gap: 12,
  padding: "14px 14px",
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,.15)",
  background: "#181d28",
  color: "#fff",
  boxShadow: "0 20px 60px rgba(0,0,0,.42)",
};
const close: React.CSSProperties = { position: "absolute", top: -9, right: -7, width: 28, height: 28, borderRadius: 999, border: "1px solid rgba(255,255,255,.18)", background: "#10131b", color: "#fff", fontSize: 18, cursor: "pointer" };
const icon: React.CSSProperties = { width: 54, height: 54, borderRadius: 17, display: "grid", placeItems: "center", background: "#d9ff5b", color: "#10131b", fontSize: 29, fontWeight: 1000 };
const copy: React.CSSProperties = { display: "grid", gap: 4, minWidth: 0 };
const title: React.CSSProperties = { fontSize: 15, lineHeight: 1.15 };
const description: React.CSSProperties = { color: "#aab1bf", fontSize: 12, lineHeight: 1.4 };
const primary: React.CSSProperties = { minHeight: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 14px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950, whiteSpace: "nowrap", cursor: "pointer" };
