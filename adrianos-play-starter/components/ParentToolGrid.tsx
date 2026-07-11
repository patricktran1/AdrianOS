"use client";

import { useEffect, useMemo, useState } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  dayLabel,
  learningPlanForDate,
  readLearningSchedule,
  writeLearningSchedule,
  type LearningDayKey,
  type LearningDayMode,
  type LearningSchedule,
} from "@/lib/adrian-learning-schedule";

const LEGACY_TOOL_LABELS = ["Skill goals", "Weekly report", "Starting map", "Coach log", "Cloud sync"];
const DAYS: LearningDayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const TOOLS = [
  { emoji: "📅", title: "Weekly report", description: "See progress, friction, and next week’s focus.", target: "Weekly report" },
  { emoji: "🎯", title: "Skill goals", description: "Choose the exact skills AdrianOS should prioritize.", target: "Skill goals" },
  { emoji: "🧭", title: "Starting map", description: "Review placement results and the first learning plan.", target: "Starting map" },
  { emoji: "🧑‍🏫", title: "Coach activity", description: "See hints, checks, read-aloud use, and helpful votes.", target: "Coach log" },
  { emoji: "🗓️", title: "Learning schedule", description: "Set full, light, and free-explore days.", target: "schedule" },
  { emoji: "☁️", title: "Cloud sync", description: "Manage the family cloud copy and connected email.", target: "Cloud sync" },
] as const;

function findLegacyButton(label: string): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("aside > button"))
    .find((button) => button.textContent?.includes(label)) ?? null;
}

function hideLegacyButtons() {
  for (const label of LEGACY_TOOL_LABELS) {
    const button = findLegacyButton(label);
    if (button) {
      button.style.display = "none";
      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;
    }
  }
}

function nextMode(mode: LearningDayMode): LearningDayMode {
  if (mode === "full") return "light";
  if (mode === "light") return "free";
  return "full";
}

function modeLabel(mode: LearningDayMode): string {
  if (mode === "full") return "Full session";
  if (mode === "light") return "Light review";
  return "Free explore";
}

function modeColor(mode: LearningDayMode): string {
  if (mode === "full") return "#d9ff5b";
  if (mode === "light") return "#c6b8ff";
  return "#7fdcff";
}

export default function ParentToolGrid() {
  const { family, hydrated } = useFamilyProfiles();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [profileId, setProfileId] = useState("adrian");
  const [schedule, setSchedule] = useState<LearningSchedule | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    hideLegacyButtons();
    const observer = new MutationObserver(hideLegacyButtons);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (family.profiles.length > 0 && !family.profiles.some((profile) => profile.id === profileId)) {
      setProfileId(family.profiles[0].id);
    }
  }, [family.profiles, profileId]);

  useEffect(() => {
    if (!hydrated) return;
    setSchedule(readLearningSchedule(profileId));
  }, [hydrated, profileId, scheduleOpen]);

  const today = useMemo(
    () => hydrated ? learningPlanForDate(profileId) : null,
    [hydrated, profileId, schedule?.updatedAt]
  );

  function openTool(target: string) {
    if (target === "schedule") {
      setScheduleOpen(true);
      setMessage("");
      return;
    }
    const button = findLegacyButton(target);
    if (button) button.click();
  }

  function changeDay(day: LearningDayKey) {
    if (!schedule) return;
    setSchedule({
      ...schedule,
      days: { ...schedule.days, [day]: nextMode(schedule.days[day]) },
    });
  }

  function saveSchedule() {
    if (!schedule) return;
    const saved = writeLearningSchedule(profileId, schedule);
    setSchedule(saved);
    setMessage("Weekly learning schedule saved.");
  }

  if (!hydrated) return null;

  return (
    <>
      <section style={section}>
        <div style={headingRow}>
          <div>
            <span style={eyebrow}>PARENT TOOLS</span>
            <h2 style={title}>Everything in one place</h2>
            <p style={muted}>The dashboard is already unlocked. Open any report or control without entering the PIN again.</p>
          </div>
          {today && (
            <div style={todayPill}>
              <small>TODAY</small>
              <strong>{modeLabel(today.mode)}</strong>
              <span>{today.minutes} minutes</span>
            </div>
          )}
        </div>

        <div style={grid}>
          {TOOLS.map((tool) => (
            <button key={tool.title} onClick={() => openTool(tool.target)} style={toolButton} type="button">
              <span style={toolEmoji}>{tool.emoji}</span>
              <span style={{ minWidth: 0 }}>
                <strong style={toolTitle}>{tool.title}</strong>
                <small style={toolDescription}>{tool.description}</small>
              </span>
              <span style={arrow}>→</span>
            </button>
          ))}
        </div>
      </section>

      {scheduleOpen && schedule && (
        <div style={backdrop} role="presentation" onMouseDown={() => setScheduleOpen(false)}>
          <section style={modal} role="dialog" aria-modal="true" aria-label="Weekly learning schedule" onMouseDown={(event) => event.stopPropagation()}>
            <div style={modalHeader}>
              <div>
                <span style={eyebrow}>WEEKLY LEARNING SCHEDULE</span>
                <h2 style={modalTitle}>Choose the rhythm</h2>
              </div>
              <button onClick={() => setScheduleOpen(false)} style={closeButton} aria-label="Close schedule">×</button>
            </div>

            <div style={profileTabs}>
              {family.profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => { setProfileId(profile.id); setMessage(""); }}
                  style={{ ...profileButton, background: profile.id === profileId ? "#d9ff5b" : "#222936", color: profile.id === profileId ? "#10131b" : "#fff" }}
                  type="button"
                >
                  {profile.emoji} {profile.name}
                </button>
              ))}
            </div>

            <p style={muted}>Tap a day to cycle between a full three-mission session, one light review mission, and one free-explore mission.</p>

            <div style={dayGrid}>
              {DAYS.map((day) => {
                const mode = schedule.days[day];
                return (
                  <button key={day} onClick={() => changeDay(day)} style={{ ...dayButton, borderColor: modeColor(mode) }} type="button">
                    <strong>{dayLabel(day).slice(0, 3)}</strong>
                    <span style={{ ...modeBadge, background: modeColor(mode) }}>{modeLabel(mode)}</span>
                  </button>
                );
              })}
            </div>

            <div style={minuteGrid}>
              <label style={minuteCard}>
                <span>Full-session minutes</span>
                <input
                  type="number"
                  min={8}
                  max={30}
                  value={schedule.fullMinutes}
                  onChange={(event) => setSchedule({ ...schedule, fullMinutes: Number(event.target.value) })}
                  style={numberInput}
                />
              </label>
              <label style={minuteCard}>
                <span>Light-day minutes</span>
                <input
                  type="number"
                  min={3}
                  max={15}
                  value={schedule.lightMinutes}
                  onChange={(event) => setSchedule({ ...schedule, lightMinutes: Number(event.target.value) })}
                  style={numberInput}
                />
              </label>
            </div>

            {message && <div style={notice}>{message}</div>}
            <button onClick={saveSchedule} style={saveButton} type="button">Save weekly schedule</button>
          </section>
        </div>
      )}
    </>
  );
}

const section: React.CSSProperties = { marginBottom: 18, padding: "clamp(22px,4vw,32px)", borderRadius: 28, border: "1px solid rgba(217,255,91,.22)", background: "linear-gradient(145deg,rgba(217,255,91,.07),rgba(127,220,255,.05),#181d28)", boxShadow: "0 26px 60px rgba(0,0,0,.25)" };
const headingRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontWeight: 950, fontSize: 12, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "7px 0", fontSize: "clamp(2rem,5vw,3.5rem)", letterSpacing: "-.05em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const todayPill: React.CSSProperties = { minWidth: 190, display: "grid", gap: 4, padding: 15, borderRadius: 19, background: "#d9ff5b", color: "#10131b" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 22 };
const toolButton: React.CSSProperties = { minHeight: 116, display: "grid", gridTemplateColumns: "52px 1fr auto", gap: 14, alignItems: "center", padding: 18, borderRadius: 22, border: "1px solid rgba(255,255,255,.12)", background: "#222936", color: "#fff", textAlign: "left", cursor: "pointer" };
const toolEmoji: React.CSSProperties = { fontSize: 34 };
const toolTitle: React.CSSProperties = { display: "block", fontSize: 18 };
const toolDescription: React.CSSProperties = { display: "block", marginTop: 5, color: "#aab1bf", lineHeight: 1.4, fontSize: 12 };
const arrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 24, fontWeight: 950 };
const backdrop: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 300, display: "grid", placeItems: "center", padding: 16, background: "rgba(5,8,14,.78)", backdropFilter: "blur(8px)" };
const modal: React.CSSProperties = { width: "min(760px,100%)", maxHeight: "88vh", overflowY: "auto", padding: "clamp(20px,4vw,30px)", borderRadius: 28, border: "1px solid rgba(255,255,255,.14)", background: "#181d28", boxShadow: "0 30px 90px rgba(0,0,0,.58)" };
const modalHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14 };
const modalTitle: React.CSSProperties = { margin: "6px 0 0", fontSize: "clamp(2rem,5vw,3.5rem)", letterSpacing: "-.05em" };
const closeButton: React.CSSProperties = { width: 42, height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#222936", color: "#fff", fontSize: 26, cursor: "pointer" };
const profileTabs: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0" };
const profileButton: React.CSSProperties = { padding: "11px 15px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontWeight: 900, cursor: "pointer" };
const dayGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 9, marginTop: 18 };
const dayButton: React.CSSProperties = { minHeight: 104, display: "grid", gap: 10, placeContent: "center", padding: 12, borderRadius: 18, border: "2px solid", background: "#10131b", color: "#fff", cursor: "pointer" };
const modeBadge: React.CSSProperties = { padding: "6px 8px", borderRadius: 999, color: "#10131b", fontSize: 10, fontWeight: 950 };
const minuteGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 18 };
const minuteCard: React.CSSProperties = { display: "grid", gap: 8, padding: 14, borderRadius: 18, background: "#222936", color: "#aab1bf", fontWeight: 850 };
const numberInput: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 13, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontSize: 20, fontWeight: 950, textAlign: "center" };
const notice: React.CSSProperties = { marginTop: 14, padding: 11, borderRadius: 14, background: "rgba(198,184,255,.14)", color: "#c6b8ff", fontWeight: 850 };
const saveButton: React.CSSProperties = { width: "100%", marginTop: 16, padding: "15px 18px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontSize: 16, fontWeight: 950, cursor: "pointer" };
