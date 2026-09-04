"use client";

import { useEffect, useState } from "react";
import {
  readSessionGlance,
  type SessionGlance,
} from "@/lib/session/session-glance";

/**
 * The guided-mode ribbon.
 *
 * It reports where the session has got to; it decides nothing. A mission used
 * to complete here by watching the play counter, which meant a game opened
 * and abandoned could advance the route. The session now advances from the
 * evidence an activity actually produced, so this only has to notice.
 *
 * It reads the stored plan directly rather than through the planner: this
 * component is mounted on every game screen, and the planner is not something
 * fifty routes should each be carrying.
 */
export default function DailySessionBar() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [missionIndex, setMissionIndex] = useState<number | null>(null);
  const [glance, setGlance] = useState<SessionGlance | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("guided") !== "1") return;
    const profile = params.get("guidedProfile");
    const index = Number(params.get("guidedMission"));
    if (!profile || !Number.isInteger(index) || index < 0) return;
    document.documentElement.dataset.schoolMissionActive = "true";
    setProfileId(profile);
    setMissionIndex(index);
    const refresh = () => setGlance(readSessionGlance(profile));
    refresh();
    window.addEventListener("adrianos-session-updated", refresh);
    window.addEventListener("adrianos-learning-updated", refresh);
    window.addEventListener("adrianos-evidence-updated", refresh);
    return () => {
      delete document.documentElement.dataset.schoolMissionActive;
      window.removeEventListener("adrianos-session-updated", refresh);
      window.removeEventListener("adrianos-learning-updated", refresh);
      window.removeEventListener("adrianos-evidence-updated", refresh);
    };
  }, []);

  // The planner has moved past this activity, so the only thing left here is
  // to go back to the route.
  const finished = glance !== null && missionIndex !== null && glance.currentIndex > missionIndex;
  useEffect(() => {
    if (!finished) return;
    setMessage("Mission complete! Returning to today’s route…");
    const timer = window.setTimeout(() => {
      window.location.href = "/daily-session?school=1";
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [finished]);

  if (!profileId || missionIndex === null || !glance || glance.total === 0) return null;

  // The game's own title sits directly above this ribbon, so repeating it
  // here only crowded a small bar on a phone.
  const instruction = message
    || "Finish the round. AdrianOS unlocks the next step from what you answer.";

  return (
    <aside className="daily-session-bar" style={shell} aria-label="Daily session controls" role="status" aria-live="polite">
      <div style={progressTrack}>
        <div style={{ ...progressFill, width: `${((missionIndex + 1) / glance.total) * 100}%` }} />
      </div>
      <div className="daily-session-bar-body" style={body}>
        <div style={stepBubble}>{message ? "✓" : missionIndex + 1}</div>
        <div style={{ minWidth: 0 }}>
          <small style={eyebrow}>SCHOOL MODE · MISSION {missionIndex + 1} OF {glance.total}</small>
          <span className="daily-session-bar-status" style={status}>{instruction}</span>
        </div>
        <button className="daily-session-bar-pause" onClick={() => { window.location.href = "/daily-session?school=1"; }} style={pauseButton} type="button" aria-label="Pause School Mode and return to today’s route">
          Pause
        </button>
      </div>
    </aside>
  );
}

const shell: React.CSSProperties = { position: "fixed", left: "50%", bottom: "max(10px, env(safe-area-inset-bottom))", transform: "translateX(-50%)", zIndex: 150, width: "min(820px,calc(100vw - 24px))", overflow: "hidden", borderRadius: 22, border: "1px solid rgba(127,220,255,.42)", background: "rgba(16,19,27,.96)", boxShadow: "0 22px 65px rgba(0,0,0,.5)", backdropFilter: "blur(16px)" };
const progressTrack: React.CSSProperties = { height: 5, background: "#222936" };
const progressFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)" };
const body: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: 13 };
const stepBubble: React.CSSProperties = { width: 40, height: 40, borderRadius: 999, display: "grid", placeItems: "center", background: "#7fdcff", color: "#10131b", fontWeight: 950 };
const eyebrow: React.CSSProperties = { display: "block", color: "#7fdcff", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" };
const status: React.CSSProperties = { display: "block", marginTop: 3, color: "#aab1bf", fontSize: 11, lineHeight: 1.35 };
const pauseButton: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.15)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
