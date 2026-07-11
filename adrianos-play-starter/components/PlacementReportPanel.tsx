"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PLACEMENT_EVENT,
  readPlacementReport,
  skillLabel,
  type PlacementReport,
} from "@/lib/adrian-placement";
import { useFamilyProfiles, verifyParentPin } from "@/lib/adrian-profiles";

const SESSION_KEY = "adrianos-placement-report-unlocked";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export default function PlacementReportPanel() {
  const { family, hydrated } = useFamilyProfiles();
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [profileId, setProfileId] = useState("adrian");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setUnlocked(window.sessionStorage.getItem(SESSION_KEY) === "yes");
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(PLACEMENT_EVENT, refresh);
    window.addEventListener("adrianos-learning-updated", refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener(PLACEMENT_EVENT, refresh);
      window.removeEventListener("adrianos-learning-updated", refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, []);

  useEffect(() => {
    if (family.profiles.length > 0 && !family.profiles.some((profile) => profile.id === profileId)) {
      setProfileId(family.profiles[0].id);
    }
  }, [family.profiles, profileId]);

  const profile = family.profiles.find((item) => item.id === profileId) ?? family.profiles[0];
  const report = useMemo<PlacementReport | null>(
    () => readPlacementReport(profileId),
    [profileId, revision]
  );

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
        <span>🧭</span>
        <span>Starting map</span>
      </button>

      {open && (
        <div style={panel}>
          <div style={header}>
            <div>
              <span style={eyebrow}>PLACEMENT REPORT</span>
              <h2 style={title}>Learning starting map</h2>
            </div>
            <button onClick={() => setOpen(false)} style={closeButton} aria-label="Close placement report">×</button>
          </div>

          {!unlocked ? (
            <div style={lockBox}>
              <p style={muted}>Enter the parent PIN to view placement results and the seven-day plan.</p>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                maxLength={6}
                inputMode="numeric"
                type="password"
                placeholder="Parent PIN"
                style={pinInput}
              />
              <button onClick={unlock} style={primaryButton} type="button">Unlock starting map</button>
              {message && <p style={errorText}>{message}</p>}
            </div>
          ) : (
            <>
              <div style={profileTabs}>
                {family.profiles.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setProfileId(child.id)}
                    style={{
                      ...profileButton,
                      background: profileId === child.id ? "#d9ff5b" : "#222936",
                      color: profileId === child.id ? "#10131b" : "#fff",
                    }}
                    type="button"
                  >
                    {child.emoji} {child.name}
                  </button>
                ))}
              </div>

              {!report ? (
                <div style={emptyCard}>
                  <div style={{ fontSize: 48 }}>🧭</div>
                  <strong>{profile?.name ?? "This child"} has not completed Placement Adventure yet.</strong>
                  <p style={muted}>Open the child profile and start Placement Adventure from the homepage.</p>
                </div>
              ) : (
                <>
                  <div style={metricGrid}>
                    <Metric label="Accuracy" value={`${report.accuracy}%`} />
                    <Metric label="Questions" value={String(report.totalQuestions)} />
                    <Metric label="Time" value={formatDuration(report.durationSeconds)} />
                    <Metric label="Daily plan" value={`${report.recommendedMinutes} min`} />
                  </div>

                  <p style={muted}>Completed {formatDate(report.completedAt)} at age {report.age}.</p>

                  <div style={twoColumn}>
                    <SkillGroup
                      title="Strong starting points"
                      skillIds={report.strengths}
                      empty="The short assessment did not mark a clear strength yet."
                    />
                    <SkillGroup
                      title="Building now"
                      skillIds={report.building}
                      empty="No major gaps appeared in the placement sample."
                    />
                  </div>

                  <div style={nextCard}>
                    <span style={eyebrow}>RECOMMENDED NEXT</span>
                    <strong style={{ fontSize: 24 }}>
                      {report.nextSkillId ? skillLabel(report.nextSkillId) : "Continue exploring"}
                    </strong>
                    <p style={{ ...muted, marginBottom: 0 }}>
                      This skill is prioritized in Today’s Adventure and the active goal list.
                    </p>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <strong>First seven-day plan</strong>
                    <div style={planList}>
                      {report.plan.map((day) => (
                        <div key={day.day} style={planRow}>
                          <span style={dayBadge}>DAY {day.day}</span>
                          <div style={{ minWidth: 0 }}>
                            <strong>{skillLabel(day.skillId)}</strong>
                            <small style={small}>{day.activity} · {day.minutes} minutes</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={metric}><small>{label}</small><strong>{value}</strong></div>;
}

function SkillGroup({ title, skillIds, empty }: { title: string; skillIds: string[]; empty: string }) {
  return (
    <div style={skillGroup}>
      <strong>{title}</strong>
      {skillIds.length > 0 ? (
        <div style={chips}>{skillIds.map((skillId) => <span key={skillId} style={chip}>{skillLabel(skillId)}</span>)}</div>
      ) : (
        <p style={muted}>{empty}</p>
      )}
    </div>
  );
}

const shell: React.CSSProperties = { position: "fixed", right: 16, bottom: 140, zIndex: 106, display: "grid", justifyItems: "end", gap: 10 };
const toggleButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 15px", borderRadius: 999, border: "1px solid rgba(217,255,91,.28)", background: "#181d28", color: "#fff", boxShadow: "0 15px 40px rgba(0,0,0,.35)", fontWeight: 900, cursor: "pointer" };
const panel: React.CSSProperties = { width: "min(580px,calc(100vw - 32px))", maxHeight: "74vh", overflowY: "auto", padding: 20, borderRadius: 24, border: "1px solid rgba(255,255,255,.14)", background: "#181d28", boxShadow: "0 24px 70px rgba(0,0,0,.5)" };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12 };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontWeight: 950, fontSize: 11, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "5px 0 0", fontSize: 28, letterSpacing: "-.04em" };
const closeButton: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#222936", color: "#fff", fontSize: 22, cursor: "pointer" };
const lockBox: React.CSSProperties = { marginTop: 16, padding: 15, borderRadius: 17, background: "#222936" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.5, fontSize: 13 };
const pinInput: React.CSSProperties = { width: "100%", padding: "12px 13px", borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontWeight: 850, letterSpacing: ".18em", textAlign: "center" };
const primaryButton: React.CSSProperties = { width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const errorText: React.CSSProperties = { color: "#ffb5bf", fontSize: 13, fontWeight: 850 };
const profileTabs: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 };
const profileButton: React.CSSProperties = { padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontWeight: 900, cursor: "pointer" };
const emptyCard: React.CSSProperties = { display: "grid", gap: 10, justifyItems: "center", textAlign: "center", marginTop: 18, padding: 24, borderRadius: 20, background: "#222936" };
const metricGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 9, marginTop: 16 };
const metric: React.CSSProperties = { display: "grid", gap: 4, padding: 12, borderRadius: 15, background: "#222936" };
const twoColumn: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 14 };
const skillGroup: React.CSSProperties = { padding: 14, borderRadius: 17, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const chips: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 };
const chip: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, background: "#222936", color: "#c6b8ff", fontSize: 11, fontWeight: 900 };
const nextCard: React.CSSProperties = { display: "grid", gap: 7, marginTop: 14, padding: 16, borderRadius: 18, background: "rgba(217,255,91,.08)", border: "1px solid rgba(217,255,91,.22)" };
const planList: React.CSSProperties = { display: "grid", gap: 8, marginTop: 10 };
const planRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "66px 1fr", gap: 11, alignItems: "center", padding: 11, borderRadius: 15, background: "#222936" };
const dayBadge: React.CSSProperties = { display: "grid", placeItems: "center", minHeight: 38, borderRadius: 12, background: "#d9ff5b", color: "#10131b", fontSize: 10, fontWeight: 950 };
const small: React.CSSProperties = { display: "block", marginTop: 3, color: "#aab1bf", fontSize: 11, textTransform: "capitalize" };
