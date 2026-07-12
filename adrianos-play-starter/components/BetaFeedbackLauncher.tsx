"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCloudSyncStatus } from "@/lib/adrian-cloud-sync";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { betaCohortLabel, readBetaCohort } from "@/lib/beta-cohort";
import {
  submitBetaFeedback,
  type BetaFeedbackCategory,
} from "@/lib/beta-feedback";

const CATEGORIES: Array<{ value: BetaFeedbackCategory; label: string }> = [
  { value: "signup", label: "Signup" },
  { value: "school-mode", label: "School Mode" },
  { value: "game", label: "A game" },
  { value: "progress", label: "Progress tracking" },
  { value: "bug", label: "Something broke" },
  { value: "idea", label: "Idea or request" },
  { value: "other", label: "Something else" },
];

export default function BetaFeedbackLauncher() {
  const pathname = usePathname();
  const cloud = useCloudSyncStatus();
  const { activeProfile, hydrated } = useFamilyProfiles();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<BetaFeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [contactAllowed, setContactAllowed] = useState(true);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setReady(true), []);

  const cohort = useMemo(
    () => hydrated ? betaCohortLabel(readBetaCohort()) : "General beta",
    [hydrated, open]
  );

  if (pathname === "/join" || pathname === "/family/setup") return null;

  async function submit() {
    setBusy(true);
    setStatus("");
    const result = await submitBetaFeedback({ rating, category, message, contactAllowed });
    setStatus(result.message);
    setBusy(false);
    if (result.ok) {
      setRating(0);
      setMessage("");
      window.setTimeout(() => setOpen(false), 1400);
    }
  }

  return (
    <aside style={launcherShell} className="beta-feedback-launcher">
      {open && (
        <section
          style={panel}
          className="beta-feedback-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Parent beta feedback"
        >
          <div style={panelHeader}>
            <div>
              <span style={eyebrow}>FAMILY BETA</span>
              <h2 style={title}>How did it go?</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close feedback" style={closeButton}>×</button>
          </div>

          <p style={contextText}>
            {activeProfile.emoji} {activeProfile.name} · {cohort}
          </p>

          <fieldset style={fieldset}>
            <legend style={legend}>Overall experience</legend>
            <div style={ratingRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} out of 5`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                  style={{ ...ratingButton, ...(rating === value ? ratingButtonActive : {}) }}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>

          <label style={label} htmlFor="beta-feedback-category">What is this about?</label>
          <select
            id="beta-feedback-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as BetaFeedbackCategory)}
            style={input}
          >
            {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>

          <label style={label} htmlFor="beta-feedback-message">What happened, or what should we improve?</label>
          <textarea
            id="beta-feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="A sentence or two is perfect."
            rows={5}
            maxLength={4000}
            style={{ ...input, resize: "vertical" }}
          />

          <label style={checkLabel}>
            <input
              type="checkbox"
              checked={contactAllowed}
              onChange={(event) => setContactAllowed(event.target.checked)}
            />
            You may contact me about this feedback.
          </label>

          <div className="beta-feedback-actions">
            {cloud.userEmail ? (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || rating === 0 || !message.trim()}
                style={{ ...submitButton, ...(busy || rating === 0 || !message.trim() ? submitButtonDisabled : {}) }}
              >
                {busy ? "Sending…" : "Send feedback"}
              </button>
            ) : (
              <div style={signInBox}>
                <strong>Parent sign-in required</strong>
                <span>Connect the parent account so feedback can be sent without creating a child login.</span>
                <Link href="/join" className="beta-feedback-signin-button">Sign in to send feedback</Link>
              </div>
            )}
            {status && <p role="status" style={statusText}>{status}</p>}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{ ...launcherButton, ...(!ready ? launcherButtonLoading : {}) }}
        aria-expanded={open}
        disabled={!ready}
      >
        <span aria-hidden="true">💬</span>
        Parent feedback
      </button>
    </aside>
  );
}

const launcherShell: React.CSSProperties = { position: "fixed", left: 14, bottom: "calc(14px + env(safe-area-inset-bottom, 0px))", zIndex: 110, display: "grid", justifyItems: "start", gap: 10 };
const launcherButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "#181d28", color: "#fff", boxShadow: "0 15px 40px rgba(0,0,0,.35)", fontWeight: 900, cursor: "pointer" };
const launcherButtonLoading: React.CSSProperties = { opacity: .72, cursor: "wait" };
const panel: React.CSSProperties = { width: "min(430px,calc(100vw - 28px))", maxHeight: "min(720px,calc(100dvh - 96px - env(safe-area-inset-top, 0px)))", overflowY: "auto", overscrollBehavior: "contain", padding: 20, borderRadius: 24, border: "1px solid rgba(255,255,255,.14)", background: "#181d28", color: "#fff", boxShadow: "0 24px 70px rgba(0,0,0,.52)" };
const panelHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "5px 0 0", fontSize: 30, letterSpacing: "-.045em" };
const closeButton: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#222936", color: "#fff", fontSize: 22, cursor: "pointer" };
const contextText: React.CSSProperties = { color: "#aab1bf", fontSize: 13, fontWeight: 800 };
const fieldset: React.CSSProperties = { border: 0, padding: 0, margin: "17px 0" };
const legend: React.CSSProperties = { color: "#aab1bf", fontSize: 12, fontWeight: 900, marginBottom: 8 };
const ratingRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 7 };
const ratingButton: React.CSSProperties = { minHeight: 45, borderRadius: 14, border: "1px solid rgba(255,255,255,.13)", background: "#10131b", color: "#fff", fontWeight: 950, cursor: "pointer" };
const ratingButtonActive: React.CSSProperties = { borderColor: "#d9ff5b", background: "rgba(217,255,91,.14)", color: "#d9ff5b" };
const label: React.CSSProperties = { display: "block", margin: "14px 0 7px", color: "#aab1bf", fontSize: 12, fontWeight: 900 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "12px 13px", borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", font: "inherit" };
const checkLabel: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, marginTop: 14, color: "#c7ccd5", fontSize: 13, lineHeight: 1.4 };
const submitButton: React.CSSProperties = { width: "100%", minHeight: 46, borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const submitButtonDisabled: React.CSSProperties = { opacity: .48, cursor: "not-allowed" };
const signInBox: React.CSSProperties = { display: "grid", gap: 10, color: "#aab1bf", fontSize: 12, lineHeight: 1.45 };
const statusText: React.CSSProperties = { margin: "10px 0 0", color: "#7fdcff", fontSize: 13, fontWeight: 850, lineHeight: 1.45 };
