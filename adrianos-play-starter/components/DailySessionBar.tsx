"use client";

import { useEffect, useState } from "react";
import {
  completeDailySessionMission,
  DAILY_SESSION_EVENT,
  readDailySession,
  type DailySession,
} from "@/lib/adrian-daily-session";

export default function DailySessionBar() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [missionIndex, setMissionIndex] = useState<number | null>(null);
  const [session, setSession] = useState<DailySession | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("guided") !== "1") return;
    const profile = params.get("guidedProfile");
    const index = Number(params.get("guidedMission"));
    if (!profile || !Number.isInteger(index) || index < 0) return;
    setProfileId(profile);
    setMissionIndex(index);
    const refresh = () => setSession(readDailySession(profile));
    refresh();
    window.addEventListener(DAILY_SESSION_EVENT, refresh);
    window.addEventListener("adrianos-learning-updated", refresh);
    return () => {
      window.removeEventListener(DAILY_SESSION_EVENT, refresh);
      window.removeEventListener("adrianos-learning-updated", refresh);
    };
  }, []);

  if (!profileId || missionIndex === null || !session) return null;
  const mission = session.missions[missionIndex];
  if (!mission) return null;

  function finishMission() {
    if (!profileId || missionIndex === null) return;
    completeDailySessionMission(profileId, missionIndex);
    window.location.href = "/daily-session";
  }

  return (
    <aside style={shell} aria-label="Daily session controls">
      <div style={progressTrack}>
        <div style={{ ...progressFill, width: `${((missionIndex + 1) / session.missions.length) * 100}%` }} />
      </div>
      <div style={body}>
        <div style={stepBubble}>{missionIndex + 1}</div>
        <div style={{ minWidth: 0 }}>
          <small style={eyebrow}>GUIDED SESSION · MISSION {missionIndex + 1} OF {session.missions.length}</small>
          <strong style={title}>{mission.title}</strong>
        </div>
        <div style={actions}>
          <button onClick={() => { window.location.href = "/daily-session"; }} style={pauseButton} type="button">
            Pause
          </button>
          <button onClick={finishMission} style={finishButton} type="button">
            I finished →
          </button>
        </div>
      </div>
    </aside>
  );
}

const shell: React.CSSProperties = { position: "fixed", left: "50%", bottom: 14, transform: "translateX(-50%)", zIndex: 150, width: "min(760px,calc(100vw - 24px))", overflow: "hidden", borderRadius: 22, border: "1px solid rgba(127,220,255,.42)", background: "rgba(16,19,27,.96)", boxShadow: "0 22px 65px rgba(0,0,0,.5)", backdropFilter: "blur(16px)" };
const progressTrack: React.CSSProperties = { height: 5, background: "#222936" };
const progressFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)" };
const body: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: 13 };
const stepBubble: React.CSSProperties = { width: 40, height: 40, borderRadius: 999, display: "grid", placeItems: "center", background: "#7fdcff", color: "#10131b", fontWeight: 950 };
const eyebrow: React.CSSProperties = { display: "block", color: "#7fdcff", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" };
const title: React.CSSProperties = { display: "block", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const actions: React.CSSProperties = { display: "flex", gap: 7 };
const pauseButton: React.CSSProperties = { padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,.15)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
const finishButton: React.CSSProperties = { padding: "9px 14px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
