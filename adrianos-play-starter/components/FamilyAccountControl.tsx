"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCloudSyncStatus } from "@/lib/adrian-cloud-sync";
import {
  forceSignOutAndEraseDevice,
  signOutAndKeepDeviceData,
  syncSignOutAndEraseDevice,
} from "@/lib/public-device-security";

type PanelStep = "menu" | "confirm-erase" | "force-erase";

export default function FamilyAccountControl() {
  const status = useCloudSyncStatus();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<PanelStep>("menu");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [lastEmail, setLastEmail] = useState("");
  const signedIn = Boolean(status.userEmail) && status.phase !== "signed-out";

  useEffect(() => {
    if (status.userEmail) setLastEmail(status.userEmail);
  }, [status.userEmail]);

  if (!signedIn && !open) return <span data-testid="family-account-control-ready" hidden />;
  const accountEmail = status.userEmail ?? lastEmail;

  async function personalDeviceSignOut() {
    setBusy(true);
    setMessage("");
    try {
      await signOutAndKeepDeviceData();
      window.location.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign out.");
      setBusy(false);
    }
  }

  async function sharedDeviceSignOut() {
    setBusy(true);
    setMessage("Saving the latest family learning to the cloud…");
    try {
      const result = await syncSignOutAndEraseDevice();
      if (!result.ok) {
        setMessage(result.message);
        setStep("force-erase");
        setBusy(false);
        return;
      }
      window.location.replace("/family/setup?public=1");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not finish the shared-computer sign out.");
      setStep("force-erase");
      setBusy(false);
    }
  }

  async function eraseAnyway() {
    setBusy(true);
    setMessage("Removing the local family copy…");
    await forceSignOutAndEraseDevice();
    window.location.replace("/family/setup?public=1");
  }

  function closePanel() {
    if (busy) return;
    setOpen(false);
    setStep("menu");
    setMessage("");
  }

  return (
    <aside style={shell}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={accountButton}
        aria-label={`Family account ${accountEmail}`}
        aria-expanded={open}
      >
        <span aria-hidden="true">☁️</span>
        <span style={emailText}>{accountEmail}</span>
      </button>

      {open && (
        <section style={panel} aria-label="Family account menu">
          <div style={panelHeader}>
            <div>
              <span style={eyebrow}>FAMILY ACCOUNT</span>
              <h2 style={title}>{signedIn ? "Signed in" : "Account safety"}</h2>
            </div>
            <button type="button" onClick={closePanel} style={closeButton} aria-label="Close family account menu">×</button>
          </div>

          <div style={signedInBox}>
            <small>ACCOUNT</small>
            <strong style={{ overflowWrap: "anywhere" }}>{accountEmail}</strong>
            <span>{status.phase === "synced" ? "Cloud learning is up to date." : status.message}</span>
          </div>

          {step === "menu" && (
            <>
              <Link href="/parent" style={parentLink} onClick={closePanel}>Open Parent Mode</Link>
              <button type="button" disabled={busy} onClick={() => void personalDeviceSignOut()} style={secondaryButton}>
                Sign out on this device
              </button>
              <button type="button" disabled={busy} onClick={() => setStep("confirm-erase")} style={dangerButton}>
                Shared computer: sign out + erase
              </button>
              <p style={finePrint}>Normal sign out keeps the local family copy for offline use. Use the shared-computer option when someone else may use this browser.</p>
            </>
          )}

          {step === "confirm-erase" && (
            <div style={warningBox}>
              <span style={warningLabel}>SHARED COMPUTER EXIT</span>
              <h3 style={warningTitle}>Remove this family from the browser?</h3>
              <p style={finePrint}>AdrianOS will sync first, sign out only this browser session, then remove local profiles, progress, reports, the parent PIN, and rewards. The cloud family copy stays safe.</p>
              <button type="button" disabled={busy} onClick={() => void sharedDeviceSignOut()} style={dangerButton}>
                {busy ? "Syncing and erasing…" : "Sync, sign out, and erase"}
              </button>
              <button type="button" disabled={busy} onClick={() => setStep("menu")} style={secondaryButton}>Cancel</button>
            </div>
          )}

          {step === "force-erase" && (
            <div style={warningBox}>
              <span style={warningLabel}>BACKUP NOT CONFIRMED</span>
              <h3 style={warningTitle}>Nothing has been erased.</h3>
              <p style={finePrint}>{message} Erasing anyway may remove changes that have not reached the cloud.</p>
              <button type="button" disabled={busy} onClick={() => void eraseAnyway()} style={dangerButton}>
                {busy ? "Erasing local copy…" : "Erase this device anyway"}
              </button>
              <button type="button" disabled={busy} onClick={() => { setStep("menu"); setMessage(""); }} style={secondaryButton}>Keep this device signed in</button>
            </div>
          )}

          {message && step !== "force-erase" && <p role="status" style={statusMessage}>{message}</p>}
        </section>
      )}
    </aside>
  );
}

const shell: React.CSSProperties = { position: "fixed", top: "max(12px,env(safe-area-inset-top))", right: 14, zIndex: 180, display: "grid", justifyItems: "end", gap: 9 };
const accountButton: React.CSSProperties = { maxWidth: "min(320px,calc(100vw - 28px))", display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "rgba(24,29,40,.96)", color: "#fff", boxShadow: "0 12px 34px rgba(0,0,0,.28)", fontWeight: 900, cursor: "pointer" };
const emailText: React.CSSProperties = { maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const panel: React.CSSProperties = { width: "min(390px,calc(100vw - 28px))", maxHeight: "calc(100vh - 80px)", overflowY: "auto", padding: 20, borderRadius: 24, border: "1px solid rgba(255,255,255,.14)", background: "#181d28", color: "#fff", boxShadow: "0 24px 70px rgba(0,0,0,.5)" };
const panelHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontWeight: 950, fontSize: 11, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "5px 0 0", fontSize: 29, letterSpacing: "-.045em" };
const closeButton: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#222936", color: "#fff", fontSize: 22, cursor: "pointer" };
const signedInBox: React.CSSProperties = { display: "grid", gap: 5, margin: "16px 0", padding: 14, borderRadius: 17, background: "#10131b", color: "#aab1bf" };
const parentLink: React.CSSProperties = { display: "block", marginBottom: 9, padding: "12px 15px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textAlign: "center", textDecoration: "none", fontWeight: 950 };
const secondaryButton: React.CSSProperties = { width: "100%", marginTop: 8, padding: "11px 13px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
const dangerButton: React.CSSProperties = { width: "100%", marginTop: 8, padding: "12px 14px", borderRadius: 999, border: "1px solid rgba(255,181,191,.45)", background: "rgba(255,181,191,.12)", color: "#ffccd3", fontWeight: 950, cursor: "pointer" };
const finePrint: React.CSSProperties = { margin: "12px 0 0", color: "#aab1bf", fontSize: 12, lineHeight: 1.55 };
const warningBox: React.CSSProperties = { padding: 15, borderRadius: 18, border: "1px solid rgba(255,181,191,.28)", background: "rgba(255,181,191,.06)" };
const warningLabel: React.CSSProperties = { color: "#ffb5bf", fontSize: 10, fontWeight: 950, letterSpacing: ".14em" };
const warningTitle: React.CSSProperties = { margin: "7px 0", fontSize: 22 };
const statusMessage: React.CSSProperties = { margin: "12px 0 0", color: "#c6b8ff", fontSize: 13, lineHeight: 1.5, fontWeight: 800 };
