"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FamilyProfileBar from "@/components/FamilyProfileBar";
import styles from "@/components/WorldQuest.module.css";
import { buildWeeklyWorldQuest } from "@/lib/adrian-world-quest";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { games } from "@/lib/generated-games";

export default function WorldQuestPage() {
  const { progress, hydrated } = useAdrianProgress();
  const { activeProfile, hasProfiles, hydrated: profilesReady } = useFamilyProfiles();
  const [learningRevision, setLearningRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setLearningRevision((value) => value + 1);
    window.addEventListener("adrianos-learning-updated", refresh);
    return () => window.removeEventListener("adrianos-learning-updated", refresh);
  }, []);

  const quest = useMemo(
    () => hydrated && profilesReady && hasProfiles
      ? buildWeeklyWorldQuest(activeProfile, games, progress)
      : null,
    [activeProfile, hasProfiles, hydrated, learningRevision, profilesReady, progress],
  );

  if (!hydrated || !profilesReady) {
    return (
      <main className={styles.pageShell} aria-busy="true">
        <div className={styles.pageInner}>Opening the weekly world map…</div>
      </main>
    );
  }

  if (!hasProfiles || !quest || quest.missions.length !== 3) {
    return (
      <main className={styles.pageShell}>
        <div className={styles.pageInner}>
          <section className={styles.conquered}>
            <span className={styles.conqueredIcon}>🧭</span>
            <h1>Create a learner before opening a World Quest.</h1>
            <Link href="/family/setup" className={styles.primaryLink}>Create learner profile →</Link>
          </section>
        </div>
      </main>
    );
  }

  const style = {
    "--quest-accent": quest.theme.accent,
    "--quest-accent-2": quest.theme.accent2,
  } as React.CSSProperties;

  return (
    <>
      <FamilyProfileBar />
      <main
        className={styles.pageShell}
        style={style}
        data-world-quest="active"
        data-quest-week={quest.weekKey}
        data-quest-progress={quest.completedMissions}
        data-boss-unlocked={quest.bossUnlocked ? "true" : "false"}
        data-boss-complete={quest.bossCompleted ? "true" : "false"}
      >
        <div className={styles.pageInner}>
          <section className={styles.hero}>
            <div>
              <span className={styles.eyebrow}>WEEKLY WORLD QUEST · {quest.weekLabel}</span>
              <h1 className={styles.heroTitle}>{quest.theme.title}</h1>
              <p className={styles.heroCopy}>
                {quest.theme.helper} found a new map for {activeProfile.name}. {quest.story}
              </p>
              <div className={styles.heroMeta}>
                <span className={styles.pill}>{quest.completedMissions}/3 gates restored</span>
                <span className={styles.pill}>{quest.progressPercent}% complete</span>
                <span className={styles.pill}>{quest.bossUnlocked ? "Boss gate open" : "Boss gate locked"}</span>
              </div>
            </div>
            <div className={styles.heroIcon} aria-hidden="true">{quest.theme.emoji}</div>
          </section>

          <section className={styles.questPath} aria-label="Weekly quest gates">
            {quest.missions.map((mission) => (
              <article
                key={mission.id}
                className={styles.missionCard}
                data-mission-game={mission.gameSlug}
                data-mission-kind={mission.kind}
                data-complete={mission.completed ? "true" : "false"}
              >
                <div className={styles.missionOrb} aria-hidden="true">
                  {mission.completed ? "✓" : mission.emoji}
                </div>
                <div className={styles.missionBody}>
                  <small>{mission.eyebrow}</small>
                  <h2>{mission.title}</h2>
                  <p className={styles.missionReason}>{mission.reason}</p>
                  <div className={styles.missionStats}>
                    <span>{mission.subject}</span>
                    <span>{mission.difficulty}</span>
                    <span>{mission.completed ? "Verified this week" : "Waiting for a verified clear"}</span>
                  </div>
                </div>
                {mission.completed ? (
                  <Link href={mission.href} className={styles.completeMark} aria-label={`Replay ${mission.title}`}>
                    ✓ REPLAY
                  </Link>
                ) : (
                  <Link href={mission.href} className={styles.missionLink} aria-label={`Enter ${mission.title}`}>
                    ENTER →
                  </Link>
                )}
              </article>
            ))}

            <article
              className={styles.bossCard}
              data-quest-boss="active"
              data-locked={quest.bossUnlocked ? "false" : "true"}
              data-complete={quest.bossCompleted ? "true" : "false"}
            >
              <div className={styles.bossOrb} aria-hidden="true">
                {quest.bossCompleted ? "👑" : quest.bossUnlocked ? quest.bossEmoji : "🔒"}
              </div>
              <div className={styles.bossBody}>
                <small>FINAL GATE</small>
                <h2>{quest.bossTitle}</h2>
                <p className={styles.missionReason}>
                  {quest.bossCompleted
                    ? "The guardian is defeated. This week's world map is fully conquered."
                    : quest.bossUnlocked
                      ? "All three gates are restored. The adaptive guardian is ready for the final battle."
                      : `Restore ${3 - quest.completedMissions} more ${3 - quest.completedMissions === 1 ? "gate" : "gates"} to unlock the final battle.`}
                </p>
              </div>
              {quest.bossCompleted ? (
                <span className={styles.completeMark}>QUEST WON</span>
              ) : quest.bossUnlocked ? (
                <Link href={quest.bossHref} className={styles.bossLink}>FACE BOSS →</Link>
              ) : (
                <span className={styles.lockedButton}>LOCKED</span>
              )}
            </article>
          </section>

          {quest.bossCompleted && (
            <section className={styles.conquered} aria-label="World quest conquered">
              <span className={styles.conqueredIcon} aria-hidden="true">👑{quest.theme.emoji}</span>
              <span className={styles.eyebrow}>WORLD QUEST CONQUERED</span>
              <h2>{activeProfile.name} restored the entire realm!</h2>
              <p className={styles.heroCopy}>
                Every gate came from a verified game completion, and the boss was defeated after the map opened.
              </p>
              <Link href="/" className={styles.primaryLink}>Return to Adventure Arcade →</Link>
            </section>
          )}

          <footer className={styles.pageFooter}>
            <Link href="/" className={styles.secondaryLink}>← Adventure Arcade</Link>
            <span>Opening a portal never counts as a clear. Only verified game completion timestamps move this map.</span>
          </footer>
        </div>
      </main>
    </>
  );
}
