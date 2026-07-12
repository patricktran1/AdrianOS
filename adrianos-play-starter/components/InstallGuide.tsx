"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const agent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(agent)) return "ios";
  if (/android/.test(agent)) return "android";
  return "desktop";
}

function standalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

const STEPS: Record<Platform, Array<{ title: string; description: string }>> = {
  ios: [
    { title: "Open this page in Safari", description: "Apple installs websites from Safari. If you opened a Facebook link, tap the browser menu and choose Open in Safari first." },
    { title: "Tap the Share button", description: "Look for the square with an upward arrow in Safari’s toolbar." },
    { title: "Choose Add to Home Screen", description: "Scroll the share sheet if needed, then keep the name AdrianOS and tap Add." },
    { title: "Open the AdrianOS icon", description: "The installed app opens directly into School Mode for the active learner." },
  ],
  android: [
    { title: "Open this page in Chrome", description: "Use Chrome rather than an in-app Facebook browser for the most reliable install flow." },
    { title: "Open Chrome’s menu", description: "Tap the three-dot menu near the address bar." },
    { title: "Choose Install app", description: "Some phones label this Add to Home screen. Confirm the installation." },
    { title: "Open AdrianOS", description: "The home-screen icon opens directly into School Mode." },
  ],
  desktop: [
    { title: "Open AdrianOS in Chrome or Edge", description: "Keep the family signed in before installing so cloud progress is ready on this computer." },
    { title: "Use the install icon", description: "Look at the right side of the address bar for a screen or download-shaped install icon." },
    { title: "Confirm Install", description: "AdrianOS opens in its own app window and can be pinned to the dock or taskbar." },
    { title: "Start with School Mode", description: "The installed app resumes the active child with fewer parent setup taps." },
  ],
};

export default function InstallGuide() {
  const { activeProfile, family, switchProfile, hydrated } = useFamilyProfiles();
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(standalone());
  }, []);

  return (
    <main style={page}>
      <div style={shell}>
        <header style={header}>
          <Link href="/" style={brand}>ADRIANOS</Link>
          <span style={chip}>{platform === "ios" ? "IPHONE / IPAD" : platform === "android" ? "ANDROID" : "COMPUTER"}</span>
        </header>

        <section style={hero}>
          <div style={appIcon}>A</div>
          <div>
            <span style={eyebrow}>HOME-SCREEN APP</span>
            <h1 style={heading}>{installed ? "AdrianOS is installed." : "Give learning its own front door."}</h1>
            <p style={lead}>
              Install AdrianOS once, then a child can tap one icon and continue their guided route. The parent account and separate child progress remain intact.
            </p>
          </div>
        </section>

        {hydrated && (
          <section style={learnerCard} aria-label="Choose the learner who opens first">
            <div>
              <span style={eyebrow}>ACTIVE LEARNER</span>
              <h2 style={learnerTitle}>{activeProfile.emoji} {activeProfile.name}</h2>
              <p style={muted}>The app opens School Mode using whichever child profile was active most recently on this device.</p>
            </div>
            <div style={profileRow}>
              {family.profiles.map((profile) => (
                <button
                  type="button"
                  key={profile.id}
                  onClick={() => switchProfile(profile.id)}
                  aria-pressed={profile.id === activeProfile.id}
                  style={{ ...profileButton, ...(profile.id === activeProfile.id ? profileButtonActive : {}) }}
                >
                  {profile.emoji} {profile.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {!installed && (
          <section style={stepsSection}>
            <span style={eyebrow}>INSTALL IN ABOUT A MINUTE</span>
            <div style={stepsGrid}>
              {STEPS[platform].map((step, index) => (
                <article style={stepCard} key={step.title}>
                  <strong style={stepNumber}>{index + 1}</strong>
                  <div>
                    <h2 style={stepTitle}>{step.title}</h2>
                    <p style={muted}>{step.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section style={actions}>
          <Link href="/school?source=install-guide" style={primary}>
            {activeProfile?.emoji ?? "🚀"} Open School Mode
          </Link>
          <Link href="/join" style={secondary}>Family account setup</Link>
        </section>

        <p style={privacy}>Installing does not create a new child account. Children still use parent-managed profiles, and signed-in family progress continues syncing through Supabase.</p>
      </div>
    </main>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", padding: "24px 16px 70px", background: "#10131b", color: "#fff" };
const shell: React.CSSProperties = { width: "min(980px,100%)", margin: "0 auto", display: "grid", gap: 24 };
const header: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const brand: React.CSSProperties = { color: "#fff", textDecoration: "none", fontWeight: 1000, letterSpacing: ".1em" };
const chip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#222936", color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".1em" };
const hero: React.CSSProperties = { display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", alignItems: "center", gap: 24, padding: "34px", borderRadius: 30, border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(145deg,#1b2130,#151923)" };
const appIcon: React.CSSProperties = { width: 110, height: 110, borderRadius: 30, display: "grid", placeItems: "center", background: "#d9ff5b", color: "#10131b", fontSize: 62, fontWeight: 1000, boxShadow: "0 18px 45px rgba(0,0,0,.34)" };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const heading: React.CSSProperties = { margin: "7px 0 10px", fontSize: "clamp(34px,7vw,64px)", lineHeight: .94, letterSpacing: "-.055em" };
const lead: React.CSSProperties = { margin: 0, maxWidth: 680, color: "#b6bdc9", fontSize: 17, lineHeight: 1.55 };
const learnerCard: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 20, alignItems: "center", padding: 24, borderRadius: 24, background: "#181d28", border: "1px solid rgba(255,255,255,.1)" };
const learnerTitle: React.CSSProperties = { margin: "6px 0", fontSize: 28 };
const profileRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 };
const profileButton: React.CSSProperties = { minHeight: 42, padding: "9px 13px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#10131b", color: "#fff", fontWeight: 900, cursor: "pointer" };
const profileButtonActive: React.CSSProperties = { borderColor: "#d9ff5b", color: "#d9ff5b", background: "rgba(217,255,91,.08)" };
const stepsSection: React.CSSProperties = { display: "grid", gap: 13 };
const stepsGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 };
const stepCard: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px minmax(0,1fr)", gap: 12, padding: 20, borderRadius: 22, border: "1px solid rgba(255,255,255,.1)", background: "#181d28" };
const stepNumber: React.CSSProperties = { width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: "#222936", color: "#d9ff5b", fontSize: 19 };
const stepTitle: React.CSSProperties = { margin: "1px 0 7px", fontSize: 17 };
const muted: React.CSSProperties = { margin: 0, color: "#aab1bf", fontSize: 13, lineHeight: 1.5 };
const actions: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10 };
const primary: React.CSSProperties = { minHeight: 48, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "11px 18px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950 };
const secondary: React.CSSProperties = { minHeight: 48, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "11px 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", color: "#fff", textDecoration: "none", fontWeight: 900 };
const privacy: React.CSSProperties = { margin: 0, color: "#7e8796", fontSize: 12, lineHeight: 1.5 };
