"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { elementaryGradeLabel } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import {
  ADRIAN_PRIZE_COLLECTIONS,
  prizeProgressForGrade,
} from "@/lib/adrian-prize-collections";
import {
  POWER_LOCKER_EVENT,
  equipPowerLockerPrize,
  readPowerLockerState,
  unlockedPowerLockerPrizes,
} from "@/lib/adrian-power-locker";

export default function PrizeVault() {
  const { activeProfile } = useFamilyProfiles();
  const { progress, hydrated } = useAdrianProgress();
  const [celebrate, setCelebrate] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const grade = readProfileGrade(activeProfile);
  const collection = ADRIAN_PRIZE_COLLECTIONS[grade];
  const { clears, unlocked, prestige, nextPrize } = prizeProgressForGrade(progress, grade);
  const unlockedPrizes = unlockedPowerLockerPrizes(progress, grade);
  const activePrize = unlockedPrizes.find((prize) => prize.key === selectedKey)
    ?? unlockedPrizes.at(-1)
    ?? null;
  const seenKey = `adrianos-prize-vault-seen-v1:${activeProfile.id}`;

  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => setSelectedKey(readPowerLockerState(activeProfile.id).equippedPrizeKey);
    refresh();
    window.addEventListener(POWER_LOCKER_EVENT, refresh);
    window.addEventListener("adrianos-learning-updated", refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener(POWER_LOCKER_EVENT, refresh);
      window.removeEventListener("adrianos-learning-updated", refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, [activeProfile.id, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const seen = Number(window.localStorage.getItem(seenKey) ?? "0");
    if (unlocked <= seen) return;
    setCelebrate(true);
    window.localStorage.setItem(seenKey, String(unlocked));
    const timer = window.setTimeout(() => setCelebrate(false), 4200);
    return () => window.clearTimeout(timer);
  }, [hydrated, seenKey, unlocked]);

  const message = useMemo(() => {
    if (unlocked === 0) return "Finish any game to open your first prize and game companion.";
    if (unlocked < collection.prizes.length) return `${collection.prizes.length - unlocked} prizes still hidden.`;
    return prestige > 0
      ? `Collection complete · ${prestige} champion stars earned.`
      : "Collection complete. Replays now earn champion stars.";
  }, [collection.prizes.length, prestige, unlocked]);

  function equip(index: number) {
    const prize = unlockedPrizes.find((item) => item.index === index);
    if (!prize) return;
    equipPowerLockerPrize(activeProfile.id, prize);
    setSelectedKey(prize.key);
  }

  return (
    <section
      aria-label="Prize Vault"
      data-power-locker="active"
      style={{ ...shell, ...(celebrate ? celebration : {}) }}
    >
      <div style={headingRow}>
        <div>
          <span style={eyebrow}>PRIZE VAULT + POWER LOCKER · {elementaryGradeLabel(grade)}</span>
          <h2 style={title}>{collection.title}</h2>
          <p style={copy}>{collection.intro} Tap any unlocked prize to bring it into every game.</p>
        </div>
        <div style={counter} aria-label={`${unlocked} of ${collection.prizes.length} prizes unlocked`}>
          <strong>{unlocked}/{collection.prizes.length}</strong>
          <span>UNLOCKED</span>
        </div>
      </div>

      {activePrize ? (
        <div
          style={activeCompanion}
          aria-live="polite"
          data-power-locker-active={activePrize.name}
          data-power-locker-aura={activePrize.aura}
        >
          <span style={activeEmoji}>{activePrize.emoji}</span>
          <span>
            <small style={activeEyebrow}>ACTIVE GAME COMPANION</small>
            <strong style={activeName}>{activePrize.name}</strong>
            <em style={activeAura}>{activePrize.auraLabel} follows every adventure.</em>
          </span>
          <span aria-hidden="true" style={activeSpark}>✦</span>
        </div>
      ) : (
        <div style={emptyCompanion}>
          <span aria-hidden="true">🔒</span>
          <strong>Finish one game to unlock your first game companion.</strong>
        </div>
      )}

      {celebrate && unlocked > 0 && (
        <div role="status" style={newPrizeBanner}>
          <span style={{ fontSize: 36 }}>{collection.prizes[unlocked - 1].emoji}</span>
          <span>
            <strong style={{ display: "block" }}>New prize unlocked!</strong>
            <small>{collection.prizes[unlocked - 1].name} can now join your games.</small>
          </span>
          <span aria-hidden="true">✨</span>
        </div>
      )}

      <div style={grid}>
        {collection.prizes.map((prize, index) => {
          const open = index < unlocked;
          const lockerPrize = unlockedPrizes.find((item) => item.index === index);
          const active = lockerPrize?.key === activePrize?.key;
          if (!open || !lockerPrize) {
            return (
              <div
                key={prize.name}
                style={{ ...prizeCard, ...lockedCard }}
                aria-label="Locked prize"
              >
                <span style={prizeEmoji}>?</span>
                <strong>Mystery prize</strong>
                <small>Finish {Math.max(1, index + 1 - clears)} more</small>
              </div>
            );
          }
          return (
            <button
              key={prize.name}
              type="button"
              onClick={() => equip(index)}
              style={{ ...prizeCard, ...openCard, ...(active ? activeCard : {}) }}
              aria-label={active ? `${prize.name} is your active game companion` : `Equip ${prize.name} as game companion`}
              aria-pressed={active}
              data-power-locker-prize={lockerPrize.key}
              data-power-locker-selected={active ? "true" : "false"}
            >
              <span style={prizeEmoji}>{prize.emoji}</span>
              <strong>{prize.name}</strong>
              <small>{active ? `ACTIVE · ${lockerPrize.auraLabel}` : `Equip · ${lockerPrize.auraLabel}`}</small>
            </button>
          );
        })}
      </div>

      <div style={footerRow}>
        <span>{message}</span>
        {nextPrize && <strong>Next: {nextPrize.emoji} {nextPrize.name}</strong>}
        {prestige > 0 && <strong>⭐ {prestige} champion stars</strong>}
      </div>
    </section>
  );
}

const shell: React.CSSProperties = { margin: "18px 0", padding: "clamp(18px,4vw,30px)", borderRadius: 30, border: "1px solid rgba(255,255,255,.14)", background: "radial-gradient(circle at top right,rgba(217,255,91,.16),transparent 32%),linear-gradient(145deg,#1a1e29,#222936)", color: "#fff", boxShadow: "0 20px 55px rgba(0,0,0,.22)", transition: "transform .25s ease,box-shadow .25s ease" };
const celebration: React.CSSProperties = { transform: "translateY(-3px)", boxShadow: "0 0 0 3px rgba(217,255,91,.3),0 26px 70px rgba(0,0,0,.3)" };
const headingRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".13em" };
const title: React.CSSProperties = { margin: "7px 0 6px", fontSize: "clamp(1.8rem,5vw,3rem)", letterSpacing: "-.05em", lineHeight: .95 };
const copy: React.CSSProperties = { margin: 0, color: "#b7bfcc", fontWeight: 650, lineHeight: 1.45 };
const counter: React.CSSProperties = { minWidth: 96, display: "grid", placeItems: "center", padding: "12px 16px", borderRadius: 20, background: "#d9ff5b", color: "#11151d" };
const activeCompanion: React.CSSProperties = { minHeight: 105, display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", alignItems: "center", gap: 14, marginTop: 18, padding: "15px 18px", borderRadius: 22, border: "1px solid rgba(217,255,91,.42)", background: "linear-gradient(135deg,rgba(217,255,91,.14),rgba(127,220,255,.1))", boxShadow: "inset 0 1px rgba(255,255,255,.08),0 14px 34px rgba(0,0,0,.2)" };
const activeEmoji: React.CSSProperties = { width: 68, height: 68, display: "grid", placeItems: "center", borderRadius: 21, background: "#d9ff5b", fontSize: 39, filter: "drop-shadow(0 8px 12px rgba(0,0,0,.2))" };
const activeEyebrow: React.CSSProperties = { display: "block", color: "#d9ff5b", fontSize: 9, fontWeight: 950, letterSpacing: ".14em" };
const activeName: React.CSSProperties = { display: "block", marginTop: 4, fontSize: "clamp(1.25rem,4vw,1.8rem)", letterSpacing: "-.035em" };
const activeAura: React.CSSProperties = { display: "block", marginTop: 4, color: "#b9c2cf", fontSize: 12, fontStyle: "normal", fontWeight: 750 };
const activeSpark: React.CSSProperties = { color: "#d9ff5b", fontSize: 28 };
const emptyCompanion: React.CSSProperties = { display: "flex", alignItems: "center", gap: 11, marginTop: 18, padding: "14px 16px", borderRadius: 18, border: "1px dashed rgba(255,255,255,.17)", color: "#aab2bf" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(118px,1fr))", gap: 10, marginTop: 20 };
const prizeCard: React.CSSProperties = { minHeight: 132, display: "grid", placeItems: "center", alignContent: "center", gap: 5, padding: 12, borderRadius: 20, textAlign: "center", color: "inherit", font: "inherit" };
const openCard: React.CSSProperties = { background: "linear-gradient(160deg,rgba(127,220,255,.18),rgba(198,184,255,.12))", border: "1px solid rgba(127,220,255,.35)", cursor: "pointer" };
const activeCard: React.CSSProperties = { border: "2px solid #d9ff5b", background: "linear-gradient(160deg,rgba(217,255,91,.22),rgba(127,220,255,.14))", boxShadow: "0 0 0 4px rgba(217,255,91,.1),0 15px 32px rgba(0,0,0,.2)" };
const lockedCard: React.CSSProperties = { background: "rgba(255,255,255,.035)", border: "1px dashed rgba(255,255,255,.14)", color: "#737b89" };
const prizeEmoji: React.CSSProperties = { fontSize: 35, filter: "drop-shadow(0 8px 12px rgba(0,0,0,.28))" };
const newPrizeBanner: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, marginTop: 18, padding: "12px 16px", borderRadius: 18, background: "#d9ff5b", color: "#11151d", fontWeight: 900 };
const footerRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 16, color: "#b7bfcc", fontSize: 13 };
