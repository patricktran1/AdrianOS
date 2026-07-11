"use client";

import { useEffect, useRef, useState } from "react";
import { readProgressForProfile } from "@/lib/adrian-progress";
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
  const [message, setMessage] = useState("");
  const completing = useRef(false);

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

  const mission = profileId && missionIndex !== null && session
    ? session.missions[missionIndex]
    : null;

  useEffect(() => {
    if (!profileId || missionIndex === null || !mission || mission.status === "complete") return;

    const completeVerifiedMission = () => {
      if (completing.current) return;
      completing.current = true;
      const updated = completeDailySessionMission(profileId, missionIndex);
      if (!updated) {
        completing.current = false;
        return;
      }
      setSession(updated);
      setMessage("Mission complete! Returning to today’s route…");
      window.setTimeout(() => {
        window.location.href = "/daily-session?school=1";
      }, 1200);
    };

    const checkProgress = () => {
      const progress = readProgressForProfile(profileId);
      const game = progress.games[mission.gameSlug];
      if (!game) return;

      if (game.completions > mission.baselineCompletions) {
        completeVerifiedMission();
        return;
      }

      if (mission.kind === "explore" && mission.startedAt && game.plays > mission.baselinePlays) {
        const exploredFor = Date.now() - new Date(mission.startedAt).getTime();
        if (exploredFor >= 60_000) completeVerifiedMission();
      }
    };

    checkProgress();
    window.addEventListener("adrianos-progress-updated", checkProgress);
    const timer = window.setInterval(checkProgress, 1000);
    return () => {
      window.removeEventListener("adrianos-progress-updated", checkProgress);
      window.clearInterval(timer);
    };
  }, [profileId, missionIndex, mission?.id, mission?.status, mission?.startedAt, mission?.baselineCompletions, mission?.baselinePlays]);

  if (!profileId || missionIndex === null || !session || !mission) return null;

  const instruction = message || (mission.kind === "explore"
    ? "Explore for one minute. AdrianOS will unlock the next step automatically."
    : "Complete the game or review round to unlock the next step automatically.");

  return (
    <aside style={shell} aria-label="Daily session controls">
      <div style={progressTrack}>
        <div style={{ ...progressFill, width: `${((missionIndex + 1) / session.missions.length) * 100}%` }} />
      </div>
      <div style={body}>
        <div style={stepBubble}>{message ? "✓" : missionIndex + 1}</div>
        <div style={{ minWidth: 0 }}>
          <small style={eyebrow}>SCHOOL MODE · MISSION {missionIndex + 1} OF {session.missions.length}</small>
          <strong style={title}>{mission.title}</strong>
          <span style={status}>{instruction}</span>
        </div>
        <button onClick={() => { window.location.href = "/daily-session?school=1"; }} style={pauseButton} type="button">
          Pause
        </button>
      </div>
    </aside>
  );
}

const shell: React.CSSProperties = { position: "fixed", left: "50%", bottom: 14, transform: "translateX(-50%)", zIndex: 150, width: "min(820px,calc(100vw - 24px))", overflow: "hidden", borderRadius: 22, border: "1px solid rgba(127,220,255,.42)", background: "rgba(16,19,27,.96)", boxShadow: "0 22px 65px rgba(0,0,0,.5)", backdropFilter: "blur(16px)" };
const progressTrack: React.CSSProperties = { height: 5, background: "#222936" };
const progressFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)" };
const body: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: 13 };
const stepBubble: React.CSSProperties = { width: 40, height: 40, borderRadius: 999, display: "grid", placeItems: "center", background: "#7fdcff", color: "#10131b", fontWeight: 950 };
const eyebrow: React.CSSProperties = { display: "block", color: "#7fdcff", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" };
const title: React.CSSProperties = { display: "block", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const status: React.CSSProperties = { display: "block", marginTop: 3, color: "#aab1bf", fontSize: 11, lineHeight: 1.35 };
const pauseButton: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.15)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
