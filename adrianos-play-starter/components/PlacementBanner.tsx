"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  PLACEMENT_EVENT,
  readPlacementReport,
  skillLabel,
  type PlacementReport,
} from "@/lib/adrian-placement";

export default function PlacementBanner() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const [report, setReport] = useState<PlacementReport | null>(null);

  useEffect(() => {
    const refresh = () => setReport(readPlacementReport(activeProfile.id));
    refresh();
    window.addEventListener(PLACEMENT_EVENT, refresh);
    window.addEventListener("adrianos-learning-updated", refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener(PLACEMENT_EVENT, refresh);
      window.removeEventListener("adrianos-learning-updated", refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, [activeProfile.id]);

  if (!hydrated) return null;

  if (!report) {
    return (
      <section style={shell}>
        <div style={icon}>🧭</div>
        <div style={{ flex: 1 }}>
          <span className="eyebrow">START HERE</span>
          <h2 style={title}>Map {activeProfile.name}’s learning starting point</h2>
          <p style={muted}>
            A short adaptive adventure finds strengths, prerequisite gaps, and the best first seven-day plan.
          </p>
        </div>
        <Link href="/games/placement-adventure" style={primaryLink}>
          Begin placement →
        </Link>
      </section>
    );
  }

  return (
    <section style={{ ...shell, borderColor: "rgba(217,255,91,.22)" }}>
      <div style={{ ...icon, background: "#d9ff5b" }}>🗺️</div>
      <div style={{ flex: 1 }}>
        <span className="eyebrow">STARTING MAP READY</span>
        <h2 style={compactTitle}>
          Next skill: {report.nextSkillId ? skillLabel(report.nextSkillId) : "Keep exploring"}
        </h2>
        <p style={muted}>
          {report.recommendedMinutes} minutes a day · {report.accuracy}% placement accuracy · Seven-day path created
        </p>
      </div>
      <Link href="/games/placement-adventure" style={secondaryLink}>
        View or retake
      </Link>
    </section>
  );
}

const shell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  flexWrap: "wrap",
  marginTop: 34,
  padding: "clamp(20px,4vw,30px)",
  borderRadius: 28,
  background: "linear-gradient(135deg,rgba(127,220,255,.10),rgba(198,184,255,.08),#181d28)",
  border: "1px solid rgba(127,220,255,.24)",
  boxShadow: "0 24px 60px rgba(0,0,0,.22)",
};
const icon: React.CSSProperties = { width: 72, height: 72, borderRadius: 22, display: "grid", placeItems: "center", background: "#7fdcff", fontSize: 38, flex: "0 0 auto" };
const title: React.CSSProperties = { margin: "7px 0", fontSize: "clamp(2rem,5vw,3.7rem)", lineHeight: .95, letterSpacing: "-.055em" };
const compactTitle: React.CSSProperties = { margin: "7px 0", fontSize: "clamp(1.6rem,4vw,2.7rem)", lineHeight: 1, letterSpacing: "-.045em" };
const muted: React.CSSProperties = { margin: 0, color: "#aab1bf", lineHeight: 1.5 };
const primaryLink: React.CSSProperties = { padding: "13px 18px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, textDecoration: "none", whiteSpace: "nowrap" };
const secondaryLink: React.CSSProperties = { padding: "12px 16px", borderRadius: 999, background: "#222936", color: "#fff", border: "1px solid rgba(255,255,255,.13)", fontWeight: 900, textDecoration: "none", whiteSpace: "nowrap" };
