"use client";

import { useEffect, useMemo, useState } from "react";
import { readProgressForProfile } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  getSkillGraph,
  readSkillGoals,
  removeSkillGoal,
  setSkillGoal,
  type SkillNode,
} from "@/lib/adrian-skill-graph";

export default function ParentSkillGoals() {
  const { family, hydrated, verifyPin } = useFamilyProfiles();
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("adrian");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("adrianos-learning-updated", refresh);
    window.addEventListener("adrianos-progress-updated", refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener("adrianos-learning-updated", refresh);
      window.removeEventListener("adrianos-progress-updated", refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, []);

  useEffect(() => {
    if (!family.profiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(family.profiles[0]?.id ?? "adrian");
    }
  }, [family.profiles, selectedProfileId]);

  const selectedProfile = family.profiles.find(
    (profile) => profile.id === selectedProfileId
  ) ?? family.profiles[0];
  const progress = selectedProfile
    ? readProgressForProfile(selectedProfile.id)
    : readProgressForProfile("adrian");
  const nodes = useMemo(
    () => selectedProfile ? getSkillGraph(selectedProfile, progress) : [],
    [selectedProfile?.id, selectedProfile?.age, progress, revision]
  );
  const goals = selectedProfile ? readSkillGoals(selectedProfile.id) : [];

  function unlock() {
    if (!verifyPin(pin)) {
      setMessage("That PIN did not match.");
      return;
    }
    setUnlocked(true);
    setPin("");
    setMessage("");
  }

  function toggleGoal(node: SkillNode) {
    if (!selectedProfile) return;
    const existing = goals.find((goal) => goal.skillId === node.id);
    if (existing) {
      removeSkillGoal(selectedProfile.id, node.id);
      setMessage(`${node.label} was removed from ${selectedProfile.name}’s goals.`);
    } else {
      setSkillGoal(selectedProfile.id, node.id, 80);
      setMessage(`${node.label} is now ${selectedProfile.name}’s 80% mastery goal.`);
    }
    setRevision((value) => value + 1);
  }

  if (!hydrated) return null;

  return (
    <aside style={shell}>
      <button onClick={() => setOpen((value) => !value)} style={toggleButton}>
        🎯 Skill goals
      </button>

      {open && (
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <span style={eyebrow}>PARENT GOALS</span>
              <h2 style={title}>Choose the next milestone</h2>
            </div>
            <button onClick={() => setOpen(false)} style={closeButton} aria-label="Close skill goals">
              ×
            </button>
          </div>

          {!unlocked ? (
            <div>
              <p style={muted}>Enter the parent PIN to change learning goals.</p>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                type="password"
                maxLength={6}
                placeholder="Parent PIN"
                style={pinInput}
              />
              <button onClick={unlock} style={primaryButton}>Unlock goals</button>
              {message && <p style={{ ...muted, color: "#ffb5bf" }}>{message}</p>}
            </div>
          ) : (
            <>
              <div style={profileTabs}>
                {family.profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => {
                      setSelectedProfileId(profile.id);
                      setMessage("");
                    }}
                    style={{
                      ...profileButton,
                      background: profile.id === selectedProfileId ? "#d9ff5b" : "#222936",
                      color: profile.id === selectedProfileId ? "#10131b" : "#fff",
                    }}
                  >
                    {profile.emoji} {profile.name}
                  </button>
                ))}
              </div>

              {message && <div style={notice}>{message}</div>}

              <p style={muted}>
                Active goals are prioritized in Today’s Adventure. A goal completes at 80% mastery.
              </p>

              <div style={goalSummary}>
                <strong>{goals.length} active goal{goals.length === 1 ? "" : "s"}</strong>
                <span>{nodes.filter((node) => node.goalComplete).length} completed</span>
              </div>

              <div style={skillList}>
                {nodes.map((node) => {
                  const hasGoal = goals.some((goal) => goal.skillId === node.id);
                  return (
                    <div key={node.id} style={{ ...skillRow, opacity: node.locked ? 0.56 : 1 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={skillHeading}>
                          <strong>{node.label}</strong>
                          <span>{node.mastery}%</span>
                        </div>
                        <small style={muted}>{node.subject} · {node.locked ? "Prerequisite locked" : node.stage}</small>
                        <div style={track}>
                          <div style={{ ...fill, width: `${node.mastery}%` }} />
                        </div>
                      </div>
                      <button
                        onClick={() => toggleGoal(node)}
                        disabled={node.locked && !hasGoal}
                        style={{
                          ...goalButton,
                          background: hasGoal ? "#c6b8ff" : "#222936",
                          color: hasGoal ? "#10131b" : "#fff",
                        }}
                      >
                        {hasGoal ? "Remove" : "Set goal"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

const shell: React.CSSProperties = { position: "fixed", left: 16, bottom: 16, zIndex: 101, display: "grid", gap: 10, justifyItems: "start" };
const toggleButton: React.CSSProperties = { padding: "11px 15px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "#181d28", color: "#fff", boxShadow: "0 15px 40px rgba(0,0,0,.35)", fontWeight: 900, cursor: "pointer" };
const panel: React.CSSProperties = { width: "min(620px,calc(100vw - 32px))", maxHeight: "min(720px,calc(100vh - 90px))", overflowY: "auto", padding: 20, borderRadius: 24, border: "1px solid rgba(255,255,255,.14)", background: "#181d28", boxShadow: "0 24px 70px rgba(0,0,0,.5)" };
const panelHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontWeight: 950, fontSize: 11, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "5px 0 0", fontSize: 28, letterSpacing: "-.04em" };
const closeButton: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#222936", color: "#fff", fontSize: 22, cursor: "pointer" };
const muted: React.CSSProperties = { color: "#aab1bf", fontSize: 12, lineHeight: 1.5 };
const pinInput: React.CSSProperties = { width: "100%", padding: "13px", borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontWeight: 850, textAlign: "center", letterSpacing: ".2em" };
const primaryButton: React.CSSProperties = { width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const profileTabs: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, margin: "18px 0" };
const profileButton: React.CSSProperties = { padding: "10px 13px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontWeight: 900, cursor: "pointer" };
const notice: React.CSSProperties = { marginBottom: 12, padding: "10px 12px", borderRadius: 13, background: "rgba(198,184,255,.13)", color: "#c6b8ff", fontSize: 12, fontWeight: 850 };
const goalSummary: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: 13, borderRadius: 15, background: "#222936", marginBottom: 12 };
const skillList: React.CSSProperties = { display: "grid", gap: 9 };
const skillRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: 13, borderRadius: 16, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const skillHeading: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10 };
const track: React.CSSProperties = { height: 6, borderRadius: 999, background: "#222936", overflow: "hidden", marginTop: 8 };
const fill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)" };
const goalButton: React.CSSProperties = { padding: "9px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontWeight: 900, cursor: "pointer" };
