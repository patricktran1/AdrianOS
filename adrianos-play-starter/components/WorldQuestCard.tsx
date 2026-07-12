"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildWeeklyWorldQuest } from "@/lib/adrian-world-quest";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import type { Game } from "@/lib/games";
import styles from "./WorldQuest.module.css";

export default function WorldQuestCard({ games }: { games: Game[] }) {
  const { progress, hydrated } = useAdrianProgress();
  const { activeProfile, hydrated: profilesReady } = useFamilyProfiles();
  const [learningRevision, setLearningRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setLearningRevision((value) => value + 1);
    window.addEventListener("adrianos-learning-updated", refresh);
    return () => window.removeEventListener("adrianos-learning-updated", refresh);
  }, []);

  const quest = useMemo(
    () => hydrated && profilesReady ? buildWeeklyWorldQuest(activeProfile, games, progress) : null,
    [activeProfile, games, hydrated, learningRevision, profilesReady, progress],
  );

  if (!quest || quest.missions.length !== 3) return null;

  const style = {
    "--quest-accent": quest.theme.accent,
    "--quest-accent-2": quest.theme.accent2,
  } as React.CSSProperties;

  return (
    <section
      className={styles.homeCard}
      style={style}
      aria-label="Weekly world quest"
      data-world-quest-home="active"
      data-quest-progress={quest.completedMissions}
      data-boss-unlocked={quest.bossUnlocked ? "true" : "false"}
      data-boss-complete={quest.bossCompleted ? "true" : "false"}
    >
      <div className={styles.homeGrid}>
        <div>
          <span className={styles.eyebrow}>{quest.theme.emoji} WEEKLY WORLD QUEST</span>
          <h2 className={styles.homeTitle}>{quest.theme.title}</h2>
          <p className={styles.homeCopy}>
            {quest.story} Three verified game clears open the final Boss Arena. The map changes every Monday.
          </p>
          <div className={styles.homeActions}>
            <Link href="/world-quest" className={styles.primaryLink}>
              {quest.bossCompleted
                ? "View conquered quest →"
                : quest.bossUnlocked
                  ? "Enter the Boss Arena →"
                  : quest.nextMission
                    ? `Continue with ${quest.nextMission.title} →`
                    : "Open the world map →"}
            </Link>
            <span className={styles.pill}>{quest.weekLabel}</span>
          </div>
        </div>

        <div className={styles.progressCard} aria-label="World quest progress">
          <div className={styles.progressTop}>
            <strong>{quest.bossCompleted ? "Quest conquered" : `${quest.completedMissions}/3 gates restored`}</strong>
            <span>{quest.progressPercent}%</span>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${quest.progressPercent}%` }} />
          </div>
          <div className={styles.miniGates}>
            {quest.missions.map((mission) => (
              <div
                key={mission.id}
                className={styles.miniGate}
                data-complete={mission.completed ? "true" : "false"}
                title={mission.title}
              >
                <span aria-hidden="true">{mission.completed ? "✓" : mission.emoji}</span>
                <small>{mission.eyebrow.replace(" GATE", "")}</small>
              </div>
            ))}
            <div
              className={styles.miniGate}
              data-complete={quest.bossCompleted ? "true" : "false"}
              title={quest.bossTitle}
            >
              <span aria-hidden="true">{quest.bossCompleted ? "👑" : quest.bossUnlocked ? quest.bossEmoji : "🔒"}</span>
              <small>BOSS</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
