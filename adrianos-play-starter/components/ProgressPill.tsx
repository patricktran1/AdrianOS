"use client";

import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";

export default function ProgressPill({ large = false }: { large?: boolean }) {
  const { progress, xpIntoLevel, xpPerLevel } = useAdrianProgress();
  const { activeProfile } = useFamilyProfiles();

  return (
    <div
      aria-label={`${activeProfile.name}, level ${progress.level}, ${progress.coins} coins, ${xpIntoLevel} of ${xpPerLevel} XP`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: large ? 14 : 9,
        flexWrap: "wrap",
        padding: large ? "12px 15px" : "8px 11px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(24,29,40,.92)",
        boxShadow: "0 10px 28px rgba(0,0,0,.18)",
        fontSize: large ? 14 : 12,
        fontWeight: 900,
      }}
    >
      <span>{activeProfile.emoji} {activeProfile.name}</span>
      <span style={{ color: "#d9ff5b" }}>LV {progress.level}</span>
      <span style={{ color: "#f6f5f2" }}>🪙 {progress.coins}</span>
      <span style={{ color: "#aab1bf" }}>{xpIntoLevel}/{xpPerLevel} XP</span>
    </div>
  );
}
