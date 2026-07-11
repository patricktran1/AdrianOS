"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  dayLabel,
  learningPlanForDate,
  readLearningSchedule,
  type LearningDayMode,
} from "@/lib/adrian-learning-schedule";

function modeLabel(mode: LearningDayMode): string {
  if (mode === "light") return "Light review day";
  if (mode === "free") return "Free-explore day";
  return "Full learning day";
}

export default function SchoolModeBanner() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("adrianos-learning-schedule-updated", refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener("adrianos-learning-schedule-updated", refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, []);

  if (!hydrated) return null;
  const schedule = readLearningSchedule(activeProfile.id);
  if (!schedule.schoolMode) return null;
  const plan = learningPlanForDate(activeProfile.id);
  void revision;

  return (
    <section style={shell}>
      <div style={copy}>
        <span style={eyebrow}>ADRIANOS SCHOOL MODE</span>
        <h2 style={title}>One button. Today’s learning is ready.</h2>
        <p style={muted}>
          {activeProfile.emoji} {activeProfile.name} has a {plan.minutes}-minute {modeLabel(plan.mode).toLowerCase()} for {dayLabel(plan.day)}.
        </p>
      </div>
      <Link href="/school" style={launchButton}>
        <span style={{ fontSize: 32 }}>🎒</span>
        <span>
          <small style={buttonLabel}>OPEN SCHOOL MODE</small>
          <strong style={buttonTitle}>Start today →</strong>
        </span>
      </Link>
    </section>
  );
}

const shell: React.CSSProperties = { marginTop: 30, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 22, alignItems: "center", padding: "clamp(22px,4vw,34px)", borderRadius: 30, border: "1px solid rgba(127,220,255,.32)", background: "linear-gradient(135deg,rgba(127,220,255,.12),rgba(198,184,255,.08),#181d28)", boxShadow: "0 26px 65px rgba(0,0,0,.24)" };
const copy: React.CSSProperties = { minWidth: 0 };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 12, fontWeight: 950, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "8px 0", fontSize: "clamp(2rem,5vw,3.8rem)", lineHeight: .96, letterSpacing: "-.055em" };
const muted: React.CSSProperties = { margin: 0, color: "#aab1bf", lineHeight: 1.5, fontWeight: 750 };
const launchButton: React.CSSProperties = { minWidth: 235, display: "flex", alignItems: "center", gap: 13, padding: "17px 21px", borderRadius: 22, background: "#d9ff5b", color: "#10131b", textDecoration: "none", boxShadow: "0 18px 45px rgba(217,255,91,.18)" };
const buttonLabel: React.CSSProperties = { display: "block", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" };
const buttonTitle: React.CSSProperties = { display: "block", marginTop: 3, fontSize: 20 };
