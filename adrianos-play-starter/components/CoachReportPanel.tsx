"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COACH_EVENT,
  readCoachForProfile,
  summarizeCoach,
  type CoachInteraction,
} from "@/lib/adrian-coach";
import { useFamilyProfiles, verifyParentPin } from "@/lib/adrian-profiles";

const SESSION_KEY = "adrianos-coach-report-unlocked";

function gameName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function CoachReportPanel() {
  const { family, hydrated } = useFamilyProfiles();
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [profileId, setProfileId] = useState("adrian");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setUnlocked(window.sessionStorage.getItem(SESSION_KEY) === "yes");
    const refresh = () => setRefreshKey((value) => value + 1);
    window.addEventListener(COACH_EVENT, refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener(COACH_EVENT, refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, []);

  useEffect(() => {
    if (family.profiles.length > 0 && !family.profiles.some((profile) => profile.id === profileId)) {
      setProfileId(family.profiles[0].id);
    }
  }, [family.profiles, profileId]);

  const state = useMemo(
    () => readCoachForProfile(profileId),
    [profileId, refreshKey]
  );
  const summary = useMemo(() => summarizeCoach(state), [state]);
  const recent = useMemo(
    () => [...state.interactions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 8),
    [state]
  );
  const checkAccuracy = summary.checksCompleted > 0
    ? Math.round((summary.checksCorrect / summary.checksCompleted) * 100)
    : 0;

  function unlock() {
    if (!verifyParentPin(pin)) {
      setMessage("That PIN did not match.");
      return;
    }
    window.sessionStorage.setItem(SESSION_KEY, "yes");
    setUnlocked(true);
    setPin("");
    setMessage("");
  }

  if (!hydrated) return null;

  return (
    <aside style={shell}>
      <button onClick={() => setOpen((value) => !value)} style={toggleButton} type="button">
        <span>🧑‍🏫</span>
        <span>Coach log</span>
      </button>

      {open && (
        <div style={panel}>
          <div style={header}>
            <div>
              <span style={eyebrow}>PARENT REPORT</span>
              <h2 style={title}>Coach Mode activity</h2>
            </div>
            <button onClick={() => setOpen(false)} style={closeButton} aria-label="Close Coach report">×</button>
          </div>

          {!unlocked ? (
            <div style={lockBox}>
              <p style={muted}>Enter the parent PIN to see tutoring history.</p>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                maxLength={6}
                inputMode="numeric"
                type="password"
                placeholder="Parent PIN"
                style={pinInput}
              />
              <button onClick={unlock} style={primaryButton} type="button">Unlock report</button>
              {message && <p style={errorText}>{message}</p>}
            </div>
          ) : (
            <>
              <div style={profileTabs}>
                {family.profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setProfileId(profile.id)}
                    style={{
                      ...profileButton,
                      background: profileId === profile.id ? "#d9ff5b" : "#222936",
                      color: profileId === profile.id ? "#10131b" : "#fff",
                    }}
                    type="button"
                  >
                    {profile.emoji} {profile.name}
                  </button>
                ))}
              </div>

              <div style={metricGrid}>
                <Metric label="Coach sessions" value={summary.sessions} />
                <Metric label="Hints opened" value={summary.hintsViewed} />
                <Metric label="Read aloud" value={summary.voicePlays} />
                <Metric label="Check accuracy" value={checkAccuracy} suffix="%" />
              </div>

              <div style={{ marginTop: 18 }}>
                <strong>Recent coaching moments</strong>
                {recent.length === 0 ? (
                  <p style={muted}>No Coach Mode activity yet. It will appear after a child opens a hint.</p>
                ) : (
                  <div style={historyList}>
                    {recent.map((interaction) => (
                      <InteractionRow key={interaction.id} interaction={interaction} />
                    ))}
                  </div>
                )}
              </div>

              <p style={{ ...muted, marginBottom: 0 }}>
                Helpful votes: {summary.helpfulVotes}. Coach history syncs with the same Supabase family snapshot.
              </p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function InteractionRow({ interaction }: { interaction: CoachInteraction }) {
  return (
    <div style={historyRow}>
      <div>
        <strong>{interaction.skillLabel}</strong>
        <small style={small}>{gameName(interaction.gameSlug)} · {formatTime(interaction.startedAt)}</small>
      </div>
      <div style={chips}>
        <span style={chip}>{interaction.hintsViewed} hint{interaction.hintsViewed === 1 ? "" : "s"}</span>
        {interaction.checkResult && (
          <span style={{ ...chip, color: interaction.checkResult === "correct" ? "#d9ff5b" : "#ffb5bf" }}>
            Check {interaction.checkResult}
          </span>
        )}
        {interaction.helpful !== null && (
          <span style={chip}>{interaction.helpful ? "Helped" : "Needs another path"}</span>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div style={metric}>
      <small>{label}</small>
      <strong>{value}{suffix}</strong>
    </div>
  );
}

const shell: React.CSSProperties = { position: "fixed", right: 16, bottom: 78, zIndex: 105, display: "grid", justifyItems: "end", gap: 10 };
const toggleButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 15px", borderRadius: 999, border: "1px solid rgba(127,220,255,.28)", background: "#181d28", color: "#fff", boxShadow: "0 15px 40px rgba(0,0,0,.35)", fontWeight: 900, cursor: "pointer" };
const panel: React.CSSProperties = { width: "min(520px,calc(100vw - 32px))", maxHeight: "72vh", overflowY: "auto", padding: 20, borderRadius: 24, border: "1px solid rgba(255,255,255,.14)", background: "#181d28", boxShadow: "0 24px 70px rgba(0,0,0,.5)" };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12 };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontWeight: 950, fontSize: 11, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "5px 0 0", fontSize: 28, letterSpacing: "-.04em" };
const closeButton: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#222936", color: "#fff", fontSize: 22, cursor: "pointer" };
const lockBox: React.CSSProperties = { marginTop: 16, padding: 15, borderRadius: 17, background: "#222936" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.5, fontSize: 13 };
const pinInput: React.CSSProperties = { width: "100%", padding: "12px 13px", borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontWeight: 850, letterSpacing: ".18em", textAlign: "center" };
const primaryButton: React.CSSProperties = { width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const errorText: React.CSSProperties = { color: "#ffb5bf", fontSize: 13, fontWeight: 850 };
const profileTabs: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 };
const profileButton: React.CSSProperties = { padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontWeight: 900, cursor: "pointer" };
const metricGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 9, marginTop: 14 };
const metric: React.CSSProperties = { display: "grid", gap: 4, padding: 12, borderRadius: 15, background: "#222936" };
const historyList: React.CSSProperties = { display: "grid", gap: 9, marginTop: 10 };
const historyRow: React.CSSProperties = { display: "grid", gap: 9, padding: 13, borderRadius: 16, background: "#222936", border: "1px solid rgba(255,255,255,.07)" };
const small: React.CSSProperties = { display: "block", marginTop: 4, color: "#aab1bf", fontSize: 11 };
const chips: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
const chip: React.CSSProperties = { padding: "5px 8px", borderRadius: 999, background: "#10131b", color: "#c6b8ff", fontSize: 10, fontWeight: 900 };
