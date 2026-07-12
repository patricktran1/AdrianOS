"use client";

import Link from "next/link";
import { useState } from "react";
import {
  pullCloudNow,
  syncCloudNow,
  useCloudSyncStatus,
} from "@/lib/adrian-cloud-sync";
import {
  beginEmailFamilySignIn,
  beginGoogleFamilySignIn,
} from "@/lib/family-beta-account";
import { signOutAndKeepDeviceData } from "@/lib/public-device-security";
import { isSupabaseConfigured } from "@/lib/supabase-browser";

export default function CloudSyncPanel() {
  const status = useCloudSyncStatus();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const configured = isSupabaseConfigured();
  const signedIn = Boolean(status.userEmail) && status.phase !== "signed-out";

  async function googleSignIn() {
    const result = await beginGoogleFamilySignIn();
    setActionMessage(result.message);
  }

  async function emailSignIn() {
    const result = await beginEmailFamilySignIn(email);
    setActionMessage(result.message);
  }

  async function signOut() {
    setActionMessage("Signing out this browser session…");
    try {
      await signOutAndKeepDeviceData();
      window.location.replace("/");
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  return (
    <aside style={shell}>
      <button onClick={() => setOpen((value) => !value)} style={toggleButton}>
        <span>{status.phase === "synced" ? "☁️" : status.phase === "error" ? "⚠️" : "☁︎"}</span>
        <span>Family account</span>
      </button>

      {open && (
        <div style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <span style={eyebrow}>PARENT ACCOUNT</span>
              <h2 style={title}>Family sync</h2>
            </div>
            <button onClick={() => setOpen(false)} style={closeButton} aria-label="Close family account panel">
              ×
            </button>
          </div>

          <p style={messageStyle}>{actionMessage || status.message}</p>

          {!configured ? (
            <div style={setupBox}>
              <strong>Cloud setup required</strong>
              <p style={smallText}>
                Add the Supabase project URL and publishable key to this deployment. Local family profiles continue to work without cloud access.
              </p>
            </div>
          ) : !signedIn ? (
            <>
              <button onClick={() => void googleSignIn()} style={googleButton}>
                <span style={googleMark}>G</span>
                Continue with Google
              </button>
              <div style={divider}><span>or use a parent email link</span></div>
              <label style={label} htmlFor="cloud-email">Parent email</label>
              <input
                id="cloud-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                style={input}
              />
              <button
                onClick={() => void emailSignIn()}
                disabled={!email.trim()}
                style={secondaryButton}
              >
                Email me a sign-in link
              </button>
              <p style={smallText}>
                One parent account can hold multiple child profiles. Children do not need an email or Google account.
              </p>
            </>
          ) : (
            <>
              <div style={accountBox}>
                <span style={smallText}>SIGNED IN AS</span>
                <strong>{status.userEmail}</strong>
                {status.lastSyncedAt && (
                  <span style={smallText}>
                    Last synced {new Date(status.lastSyncedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <Link href="/family/setup?manage=1" style={manageLink}>Manage child profiles</Link>
              <div style={buttonGrid}>
                <button onClick={() => void syncCloudNow()} style={primaryButton}>
                  Sync now
                </button>
                <button onClick={() => void pullCloudNow()} style={secondaryButton}>
                  Restore this device
                </button>
                <button onClick={() => void signOut()} style={secondaryButton}>
                  Sign out on this device
                </button>
              </div>
              <p style={smallText}>
                AdrianOS remains local-first. Offline changes stay on this device and merge after it reconnects. On a shared computer, use the account button at the top right to sign out and erase the local family copy.
              </p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

const shell: React.CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  zIndex: 100,
  display: "grid",
  justifyItems: "end",
  gap: 10,
};
const toggleButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  padding: "11px 15px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,.16)",
  background: "#181d28",
  color: "#fff",
  boxShadow: "0 15px 40px rgba(0,0,0,.35)",
  fontWeight: 900,
  cursor: "pointer",
};
const panel: React.CSSProperties = {
  width: "min(390px,calc(100vw - 32px))",
  maxHeight: "min(720px,calc(100vh - 90px))",
  overflowY: "auto",
  padding: 20,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,.14)",
  background: "#181d28",
  boxShadow: "0 24px 70px rgba(0,0,0,.5)",
};
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontWeight: 950, fontSize: 11, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "5px 0 0", fontSize: 28, letterSpacing: "-.04em" };
const closeButton: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#222936", color: "#fff", fontSize: 22, cursor: "pointer" };
const messageStyle: React.CSSProperties = { color: "#c6b8ff", lineHeight: 1.5, fontWeight: 800 };
const setupBox: React.CSSProperties = { padding: 14, borderRadius: 16, background: "#222936", border: "1px solid rgba(255,255,255,.09)" };
const smallText: React.CSSProperties = { color: "#aab1bf", fontSize: 12, lineHeight: 1.5 };
const label: React.CSSProperties = { display: "block", marginBottom: 7, color: "#aab1bf", fontSize: 12, fontWeight: 850 };
const input: React.CSSProperties = { width: "100%", padding: "12px 13px", borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontWeight: 800 };
const primaryButton: React.CSSProperties = { width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
const googleButton: React.CSSProperties = { ...primaryButton, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 };
const googleMark: React.CSSProperties = { width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 999, background: "#fff", color: "#4285f4" };
const divider: React.CSSProperties = { margin: "16px 0", display: "grid", placeItems: "center", color: "#7f8898", fontSize: 11 };
const accountBox: React.CSSProperties = { display: "grid", gap: 5, padding: 13, borderRadius: 16, background: "#222936" };
const buttonGrid: React.CSSProperties = { display: "grid", gap: 8, marginTop: 10 };
const manageLink: React.CSSProperties = { display: "block", marginTop: 10, padding: "11px 13px", borderRadius: 999, border: "1px solid rgba(127,220,255,.25)", background: "rgba(127,220,255,.08)", color: "#7fdcff", textAlign: "center", textDecoration: "none", fontWeight: 900 };
