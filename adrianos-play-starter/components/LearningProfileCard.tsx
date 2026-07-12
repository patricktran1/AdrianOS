"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readLearningProfile, type LearningProfileSettings } from "@/lib/adrian-learning-profile";

const EMPTY: LearningProfileSettings = {
  configured: false,
  interests: [],
  priorities: [],
  sessionMinutes: 12,
  updatedAt: null,
};

export default function LearningProfileCard() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const [settings, setSettings] = useState<LearningProfileSettings>(EMPTY);

  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => setSettings(readLearningProfile(activeProfile.id));
    refresh();
    window.addEventListener("adrianos-learning-updated", refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener("adrianos-learning-updated", refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, [activeProfile.id, hydrated]);

  if (!hydrated) return null;

  return (
    <section style={card} aria-label={`${activeProfile.name} learning profile`}>
      <div style={headingRow}>
        <div>
          <span style={eyebrow}>PERSONALIZED LEARNING PROFILE</span>
          <h2 style={title}>{settings.configured ? `Built around ${activeProfile.name}.` : `Tell AdrianOS about ${activeProfile.name}.`}</h2>
        </div>
        <Link href="/family/setup?manage=1" style={editLink}>{settings.configured ? "Edit profile" : "Personalize"}</Link>
      </div>

      {settings.configured ? (
        <div style={grid}>
          <div style={section}>
            <small style={label}>PARENT PRIORITIES</small>
            <div style={chips}>
              {settings.priorities.length > 0
                ? settings.priorities.map((priority) => <span key={priority} style={priorityChip}>{priority}</span>)
                : <span style={emptyText}>Curriculum needs and review history choose the focus.</span>}
            </div>
          </div>
          <div style={section}>
            <small style={label}>INTEREST HOOKS</small>
            <div style={chips}>
              {settings.interests.length > 0
                ? settings.interests.map((interest) => <span key={interest} style={interestChip}>{interest}</span>)
                : <span style={emptyText}>Exploration rotates across different topics.</span>}
            </div>
          </div>
          <div style={minutesBox}>
            <strong>{settings.sessionMinutes}</strong>
            <span>guided minutes</span>
          </div>
        </div>
      ) : (
        <p style={emptyText}>Add interests, learning priorities, and a comfortable session length so School Mode can build a better daily route.</p>
      )}

      <p style={footnote}>Priorities influence recommendations, but grade-level curriculum, prerequisites, and missed work still outrank preference.</p>
    </section>
  );
}

const card: React.CSSProperties = { maxWidth: 1040, margin: "0 auto 16px", padding: "clamp(20px,4vw,30px)", borderRadius: 28, border: "1px solid rgba(227,146,255,.25)", background: "linear-gradient(145deg,rgba(227,146,255,.08),#181d28 55%)" };
const headingRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" };
const eyebrow: React.CSSProperties = { color: "#e392ff", fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { margin: "8px 0 0", fontSize: "clamp(2rem,5vw,3.6rem)", lineHeight: .94, letterSpacing: "-.055em" };
const editLink: React.CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 42, padding: "9px 14px", borderRadius: 999, border: "1px solid rgba(227,146,255,.3)", color: "#e392ff", background: "rgba(227,146,255,.08)", fontWeight: 950 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: 12, marginTop: 20 };
const section: React.CSSProperties = { display: "grid", alignContent: "start", gap: 8, padding: 15, borderRadius: 18, background: "rgba(16,19,27,.62)", border: "1px solid rgba(255,255,255,.07)" };
const label: React.CSSProperties = { color: "#8f99a8", fontSize: 10, fontWeight: 950, letterSpacing: ".13em" };
const chips: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7 };
const priorityChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "rgba(217,255,91,.11)", color: "#d9ff5b", fontSize: 12, fontWeight: 900 };
const interestChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "rgba(127,220,255,.11)", color: "#7fdcff", fontSize: 12, fontWeight: 900 };
const minutesBox: React.CSSProperties = { minHeight: 120, display: "grid", placeContent: "center", textAlign: "center", padding: 15, borderRadius: 18, background: "#e392ff", color: "#10131b" };
const emptyText: React.CSSProperties = { margin: 0, color: "#aab1bf", lineHeight: 1.55 };
const footnote: React.CSSProperties = { margin: "15px 0 0", color: "#7f8898", fontSize: 12, lineHeight: 1.5 };
