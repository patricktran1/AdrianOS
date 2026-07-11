"use client";

import { useState } from "react";
import {
  pullCloudNow,
  sendCloudMagicLink,
  signOutCloud,
  syncCloudNow,
  useCloudSyncStatus,
} from "@/lib/adrian-cloud-sync";
import { isSupabaseConfigured } from "@/lib/supabase-browser";

export default function CloudSyncPanel() {
  const status = useCloudSyncStatus();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const configured = isSupabaseConfigured();
  const signedIn = Boolean(status.userEmail) && status.phase !== "signed-out";

  return (
    <aside style={shell}>
      <button onClick={() => setOpen((value) => !value)} style={toggleButton}>
        <span>{status.phase === "synced" ? "☁️" : status.phase === "error" ? "⚠️" : "☁︎"}</span>
        <span>Cloud sync</span>
      </button>

      {open && (
        <div style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <span style={eyebrow}>SUPABASE CLOUD</span>
              <h2 style={title}>Family sync</h2>
            </div>
            <button onClick={() => setOpen(false)} style={closeButton} aria-label="Close cloud sync panel">
              ×
            </button>
          </div>

          <p style={messageStyle}>{status.message}</p>

          {!configured ? (
            <div style={setupBox}>
              <strong>One-time setup required</strong>
              <p style={smallText}>
                Run the included Supabase migration, then add
                <code style={code}> NEXT_PUBLIC_SUPABASE_URL </code>
                and
                <code style={code}> NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY </code>
                to the Vercel project.
              </p>
            </div>
          ) : !signedIn ? (
            <>
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
                onClick={() => void sendCloudMagicLink(email)}
                disabled={!email.trim() || status.phase === "sending-link"}
                style={primaryButton}
              >
                Email me a sign-in link
              </button>
              <p style={smallText}>
                The same parent email on another device restores Adrian and Elliot’s shared family data.
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
              <div style={buttonGrid}>
                <button onClick={() => void syncCloudNow()} style={primaryButton}>
                  Sync now
                </button>
                <button onClick={() => void pullCloudNow()} style={secondaryButton}>
                  Download cloud copy
                </button>
                <button onClick={() => void signOutCloud()} style={secondaryButton}>
                  Sign out
                </button>
              </div>
              <p style={smallText}>
                AdrianOS remains local-first. Offline changes stay on this device and merge when it reconnects.
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
const code: React.CSSProperties = { color: "#fff", fontSize: 11 };
const label: React.CSSProperties = { display: "block", marginBottom: 7, color: "#aab1bf", fontSize: 12, fontWeight: 850 };
const input: React.CSSProperties = { width: "100%", padding: "12px 13px", borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontWeight: 800 };
const primaryButton: React.CSSProperties = { width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
const accountBox: React.CSSProperties = { display: "grid", gap: 5, padding: 13, borderRadius: 16, background: "#222936" };
const buttonGrid: React.CSSProperties = { display: "grid", gap: 8, marginTop: 10 };
