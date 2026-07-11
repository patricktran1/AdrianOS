"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  ensureWeeklyWriting,
  getWritingPrompt,
  WRITING_STUDIO_EVENT,
  type WritingPiece,
} from "@/lib/adrian-writing";

export default function WritingStudioCard() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const [piece, setPiece] = useState<WritingPiece | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => setPiece(ensureWeeklyWriting(activeProfile));
    refresh();
    window.addEventListener(WRITING_STUDIO_EVENT, refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener(WRITING_STUDIO_EVENT, refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, [activeProfile.id, activeProfile.age, hydrated]);

  if (!hydrated || !piece) return null;
  const prompt = getWritingPrompt(piece.promptId);
  if (!prompt) return null;

  const complete = Boolean(piece.completedAt);
  const label = complete ? "PUBLISHED THIS WEEK" : piece.startedAt ? "WRITING IN PROGRESS" : "THIS WEEK’S WRITING";
  const button = complete ? "Read my writing →" : piece.startedAt ? "Resume writing →" : "Start writing →";

  return (
    <section style={shell}>
      <div style={icon}>{prompt.emoji}</div>
      <div style={{ minWidth: 0 }}>
        <span style={eyebrow}>{label}</span>
        <h2 style={title}>{piece.title || prompt.title}</h2>
        <p style={muted}>{prompt.prompt}</p>
      </div>
      <Link href="/games/writing-studio" style={buttonStyle}>{button}</Link>
    </section>
  );
}

const shell: React.CSSProperties = { maxWidth: 1040, margin: "16px auto", display: "grid", gridTemplateColumns: "72px minmax(0,1fr) auto", gap: 18, alignItems: "center", padding: "clamp(20px,4vw,28px)", borderRadius: 28, border: "1px solid rgba(198,184,255,.3)", background: "linear-gradient(145deg,rgba(198,184,255,.1),rgba(217,255,91,.05),#181d28)", boxShadow: "0 24px 58px rgba(0,0,0,.23)" };
const icon: React.CSSProperties = { width: 68, height: 68, display: "grid", placeItems: "center", borderRadius: 20, background: "#c6b8ff", fontSize: 36 };
const eyebrow: React.CSSProperties = { color: "#c6b8ff", fontWeight: 950, fontSize: 11, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "6px 0", fontSize: "clamp(1.8rem,4vw,3rem)", letterSpacing: "-.045em" };
const muted: React.CSSProperties = { margin: 0, color: "#aab1bf", lineHeight: 1.5 };
const buttonStyle: React.CSSProperties = { padding: "14px 19px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950, whiteSpace: "nowrap" };
