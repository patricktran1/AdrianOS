"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { gradeLabel, readProfileGrade } from "@/lib/adrian-profile-grade";
import {
  QUEST_WORLDS,
  claimStandardsQuest,
  questWorldSummary,
  standardsQuestsForGrade,
  type StandardsQuest,
} from "@/lib/adrian-quest-system";

export default function StandardsQuestPage() {
  const { family, activeProfile, switchProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady, award, xpIntoLevel, xpPerLevel } = useAdrianProgress();
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");

  const grade = profilesReady ? readProfileGrade(activeProfile) : 2;
  const quests = useMemo(
    () => profilesReady ? standardsQuestsForGrade(activeProfile.id, grade) : [],
    [activeProfile.id, grade, profilesReady, revision],
  );
  const mastered = quests.filter((quest) => quest.mastered).length;
  const claimed = quests.filter((quest) => quest.claimed).length;
  const crowns = QUEST_WORLDS.filter((world) => questWorldSummary(quests, world.id).complete).length;

  if (!profilesReady || !progressReady) {
    return <main style={page}><section style={hero}><h1>Opening the quest map…</h1></section></main>;
  }

  function claim(quest: StandardsQuest) {
    if (!claimStandardsQuest(activeProfile.id, quest)) return;
    award("curriculum-quests", {
      xp: quest.rewardXp,
      coins: quest.rewardCoins,
      score: quest.mastery,
    });
    setMessage(`${quest.code} mastered. +${quest.rewardXp} XP and +${quest.rewardCoins} coins!`);
    setRevision((current) => current + 1);
  }

  return (
    <main style={page}>
      <header style={topbar}>
        <Link href="/school" style={backLink}>← School Mode</Link>
        <Link href="/curriculum/elementary" style={mapLink}>Elementary Journey</Link>
      </header>

      <section style={hero}>
        <div>
          <span style={eyebrow}>STANDARDS BECOME ADVENTURES</span>
          <h1 style={heroTitle}>{activeProfile.name}’s Quest Worlds</h1>
          <p style={lead}>
            Learn the skill, prove it with evidence, then collect the treasure. Rewards unlock for mastery, not for random tapping.
          </p>
          <div style={profileRow} aria-label="Choose learner">
            {family.profiles.map((profile) => (
              <button
                type="button"
                key={profile.id}
                onClick={() => switchProfile(profile.id)}
                style={{ ...profileButton, ...(profile.id === activeProfile.id ? profileButtonActive : {}) }}
              >
                <span>{profile.emoji}</span>
                <strong>{profile.name}</strong>
              </button>
            ))}
          </div>
        </div>
        <div style={heroStats}>
          <div style={gradeBadge}><strong>{gradeLabel(grade)}</strong><span>ACTIVE WORLD</span></div>
          <div style={statGrid}>
            <div style={stat}><strong>{mastered}/{quests.length}</strong><span>quests mastered</span></div>
            <div style={stat}><strong>{claimed}</strong><span>treasures claimed</span></div>
            <div style={stat}><strong>{crowns}/3</strong><span>world crowns</span></div>
            <div style={stat}><strong>{progress.coins}</strong><span>coins</span></div>
          </div>
          <div style={levelCard}>
            <div style={levelLabels}><strong>Level {progress.level}</strong><span>{xpIntoLevel}/{xpPerLevel} XP</span></div>
            <div style={levelTrack}><div style={{ ...levelFill, width: `${xpIntoLevel / xpPerLevel * 100}%` }} /></div>
          </div>
        </div>
      </section>

      {message && <div role="status" style={toast}>{message}</div>}

      <section style={worldGrid} aria-label="Grade-level quest worlds">
        {QUEST_WORLDS.map((world) => {
          const summary = questWorldSummary(quests, world.id);
          const nextQuest = summary.rows.find((quest) => !quest.mastered) ?? summary.rows[0];
          return (
            <article key={world.id} style={worldCard}>
              <div style={worldHeader}>
                <div style={worldEmoji}>{summary.complete ? "👑" : world.emoji}</div>
                <div>
                  <span style={eyebrow}>{summary.complete ? "WORLD CROWN EARNED" : "QUEST WORLD"}</span>
                  <h2 style={worldTitle}>{world.title}</h2>
                  <p style={muted}>{world.description}</p>
                </div>
              </div>
              <div style={worldProgressLabels}><span>{summary.mastered}/{summary.rows.length} mastered</span><strong>{summary.mastery}%</strong></div>
              <div style={worldTrack}><div style={{ ...worldFill, width: `${summary.mastery}%` }} /></div>
              {nextQuest && !summary.complete && (
                <Link href={nextQuest.practiceHref} style={continueLink}>Continue: {nextQuest.title} →</Link>
              )}

              <div style={questList}>
                {summary.rows.map((quest, index) => (
                  <div key={quest.code} style={{ ...questCard, ...(quest.mastered ? masteredCard : {}) }}>
                    <div style={questTop}>
                      <span style={questNumber}>{quest.claimed ? "★" : index + 1}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={questMeta}>
                          <span style={codeChip}>{quest.code}</span>
                          <span style={quest.strength === "direct" ? directChip : supportChip}>
                            {quest.strength === "direct" ? "Direct evidence" : "Supporting"}
                          </span>
                        </div>
                        <h3 style={questTitle}>{quest.title}</h3>
                        <p style={goalText}>{quest.childGoal}</p>
                      </div>
                    </div>
                    <div style={questMeter}><div style={{ ...questMeterFill, width: `${quest.mastery}%` }} /></div>
                    <div style={questBottom}>
                      <span>{quest.mastery}% mastery</span>
                      {quest.mastered ? (
                        quest.claimed ? (
                          <strong style={{ color: "#d9ff5b" }}>TREASURE CLAIMED</strong>
                        ) : (
                          <button type="button" style={claimButton} onClick={() => claim(quest)}>
                            Claim {quest.rewardXp} XP + {quest.rewardCoins} coins
                          </button>
                        )
                      ) : (
                        <Link href={quest.practiceHref} style={practiceLink}>Play this quest →</Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section style={noteCard}>
        <strong>What “aligned” means here</strong>
        <p>
          Each quest is connected to a California grade-level priority standard or TK foundation. Direct-evidence quests can measure the linked skill inside AdrianOS. Supporting quests build relevant knowledge but are not presented as proof that the entire standard is mastered.
        </p>
      </section>
    </main>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", padding: "0 18px 90px", background: "#10131b", color: "#fff", overflowX: "hidden" };
const topbar: React.CSSProperties = { maxWidth: 1160, minHeight: 74, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const backLink: React.CSSProperties = { color: "#d9ff5b", textDecoration: "none", fontWeight: 950 };
const mapLink: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(127,220,255,.3)", color: "#7fdcff", textDecoration: "none", fontWeight: 900 };
const hero: React.CSSProperties = { maxWidth: 1160, margin: "0 auto 18px", padding: "clamp(26px,6vw,60px)", borderRadius: 36, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 28, alignItems: "center", background: "linear-gradient(145deg,rgba(217,255,91,.11),rgba(198,184,255,.09),rgba(127,220,255,.08),#181d28)", border: "1px solid rgba(217,255,91,.27)" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const heroTitle: React.CSSProperties = { margin: "10px 0 14px", fontSize: "clamp(3rem,8vw,6.5rem)", lineHeight: .88, letterSpacing: "-.075em" };
const lead: React.CSSProperties = { color: "#bec4ce", maxWidth: 720, lineHeight: 1.6, fontWeight: 700 };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.5, margin: "7px 0 0" };
const profileRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 };
const profileButton: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#10131b", color: "#fff", cursor: "pointer" };
const profileButtonActive: React.CSSProperties = { borderColor: "#d9ff5b", color: "#d9ff5b" };
const heroStats: React.CSSProperties = { display: "grid", gap: 12 };
const gradeBadge: React.CSSProperties = { display: "grid", placeItems: "center", padding: 19, borderRadius: 22, background: "#d9ff5b", color: "#10131b", textAlign: "center" };
const statGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 };
const stat: React.CSSProperties = { display: "grid", gap: 3, padding: 13, borderRadius: 16, background: "#10131b", textAlign: "center" };
const levelCard: React.CSSProperties = { padding: 14, borderRadius: 17, background: "#10131b" };
const levelLabels: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, fontSize: 13 };
const levelTrack: React.CSSProperties = { height: 9, borderRadius: 999, background: "#222936", overflow: "hidden" };
const levelFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)" };
const toast: React.CSSProperties = { maxWidth: 1160, margin: "0 auto 16px", padding: 14, borderRadius: 16, background: "rgba(217,255,91,.1)", border: "1px solid rgba(217,255,91,.32)", color: "#d9ff5b", fontWeight: 900 };
const worldGrid: React.CSSProperties = { maxWidth: 1160, margin: "0 auto", display: "grid", gap: 18 };
const worldCard: React.CSSProperties = { padding: "clamp(20px,4vw,34px)", borderRadius: 32, background: "#181d28", border: "1px solid rgba(255,255,255,.1)" };
const worldHeader: React.CSSProperties = { display: "grid", gridTemplateColumns: "76px 1fr", gap: 16, alignItems: "center" };
const worldEmoji: React.CSSProperties = { width: 72, height: 72, borderRadius: 22, display: "grid", placeItems: "center", background: "#222936", fontSize: 38 };
const worldTitle: React.CSSProperties = { margin: "6px 0 0", fontSize: "clamp(2rem,5vw,3.8rem)", letterSpacing: "-.055em" };
const worldProgressLabels: React.CSSProperties = { marginTop: 18, display: "flex", justifyContent: "space-between", gap: 12, color: "#aab1bf", fontWeight: 850 };
const worldTrack: React.CSSProperties = { height: 11, marginTop: 8, borderRadius: 999, background: "#10131b", overflow: "hidden" };
const worldFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)" };
const continueLink: React.CSSProperties = { display: "inline-block", marginTop: 14, color: "#d9ff5b", textDecoration: "none", fontWeight: 950 };
const questList: React.CSSProperties = { display: "grid", gap: 10, marginTop: 20 };
const questCard: React.CSSProperties = { padding: 16, borderRadius: 21, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const masteredCard: React.CSSProperties = { borderColor: "rgba(217,255,91,.3)", background: "rgba(217,255,91,.04)" };
const questTop: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px 1fr", gap: 12 };
const questNumber: React.CSSProperties = { width: 38, height: 38, borderRadius: 999, display: "grid", placeItems: "center", background: "#222936", color: "#d9ff5b", fontWeight: 950 };
const questMeta: React.CSSProperties = { display: "flex", gap: 7, flexWrap: "wrap" };
const codeChip: React.CSSProperties = { padding: "5px 8px", borderRadius: 999, background: "#7fdcff", color: "#10131b", fontSize: 11, fontWeight: 950 };
const directChip: React.CSSProperties = { padding: "5px 8px", borderRadius: 999, background: "rgba(217,255,91,.12)", color: "#d9ff5b", fontSize: 11, fontWeight: 900 };
const supportChip: React.CSSProperties = { padding: "5px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,.13)", color: "#aab1bf", fontSize: 11, fontWeight: 900 };
const questTitle: React.CSSProperties = { margin: "8px 0 4px", fontSize: "clamp(1.25rem,3vw,1.8rem)" };
const goalText: React.CSSProperties = { margin: 0, color: "#aab1bf", lineHeight: 1.48 };
const questMeter: React.CSSProperties = { height: 7, marginTop: 13, borderRadius: 999, background: "#222936", overflow: "hidden" };
const questMeterFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "#d9ff5b" };
const questBottom: React.CSSProperties = { minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 10, color: "#8f98a6", fontSize: 13 };
const practiceLink: React.CSSProperties = { color: "#7fdcff", textDecoration: "none", fontWeight: 950 };
const claimButton: React.CSSProperties = { padding: "10px 13px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const noteCard: React.CSSProperties = { maxWidth: 1160, margin: "18px auto 0", padding: 20, borderRadius: 24, background: "rgba(127,220,255,.07)", border: "1px solid rgba(127,220,255,.2)", color: "#b9c2ce", lineHeight: 1.55 };
