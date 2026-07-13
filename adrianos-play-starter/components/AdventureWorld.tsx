"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { readLearningProfile } from "@/lib/adrian-learning-profile";
import {
  POWER_LOCKER_EVENT,
  resolveEquippedPrize,
} from "@/lib/adrian-power-locker";
import {
  readArcadeState,
  rememberArcadeGame,
  type ArcadeState,
} from "@/lib/adventure-arcade";
import {
  buildAdventureWorld,
  type AdventureWorldPortal,
  type AdventureWorldSky,
} from "@/lib/adventure-world";
import type { Game } from "@/lib/games";
import styles from "./AdventureWorld.module.css";

const SKY_ORDER: AdventureWorldSky[] = ["sunrise", "day", "sunset", "night"];
const SKY_LABELS: Record<AdventureWorldSky, string> = {
  sunrise: "Golden sunrise",
  day: "Adventure blue",
  sunset: "Meteor sunset",
  night: "Starlight night",
};

const GROWTH_POSITIONS = [
  { left: "11%", top: "58%" },
  { left: "22%", top: "74%" },
  { left: "35%", top: "55%" },
  { left: "48%", top: "77%" },
  { left: "61%", top: "58%" },
  { left: "75%", top: "72%" },
  { left: "86%", top: "52%" },
  { left: "15%", top: "34%" },
  { left: "83%", top: "33%" },
  { left: "44%", top: "30%" },
  { left: "69%", top: "25%" },
  { left: "30%", top: "24%" },
] as const;

const SECRET_POSITIONS = [
  { left: "8%", top: "44%" },
  { left: "91%", top: "46%" },
  { left: "52%", top: "18%" },
] as const;

function portalHistory(portal: AdventureWorldPortal): string {
  if (portal.completions > 0) return `🏆 ${portal.completions} clear${portal.completions === 1 ? "" : "s"}`;
  if (portal.plays > 0) return "↩ Continue";
  return portal.interest ? `✨ ${portal.interest} pick` : "✨ New route";
}

export default function AdventureWorld({ games }: { games: Game[] }) {
  const { activeProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady } = useAdrianProgress();
  const [arcade, setArcade] = useState<ArcadeState>({ favorites: [], recent: [] });
  const [arcadeReady, setArcadeReady] = useState(false);
  const [learningRevision, setLearningRevision] = useState(0);
  const [companionRevision, setCompanionRevision] = useState(0);
  const [sky, setSky] = useState<AdventureWorldSky | null>(null);
  const [foundSecrets, setFoundSecrets] = useState<number[]>([]);
  const [scoutIndex, setScoutIndex] = useState(0);
  const [companionMessage, setCompanionMessage] = useState("Tap me and I’ll scout a portal!");

  useEffect(() => {
    if (!profilesReady) return;
    const refresh = () => {
      setArcade(readArcadeState(activeProfile.id));
      setArcadeReady(true);
      setLearningRevision((value) => value + 1);
    };
    const refreshCompanion = () => setCompanionRevision((value) => value + 1);
    refresh();
    window.addEventListener("adrianos-learning-updated", refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    window.addEventListener(POWER_LOCKER_EVENT, refreshCompanion);
    window.addEventListener("adrianos-progress-updated", refreshCompanion);
    return () => {
      window.removeEventListener("adrianos-learning-updated", refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
      window.removeEventListener(POWER_LOCKER_EVENT, refreshCompanion);
      window.removeEventListener("adrianos-progress-updated", refreshCompanion);
    };
  }, [activeProfile.id, profilesReady]);

  const grade = readProfileGrade(activeProfile);
  const learningProfile = useMemo(() => {
    void learningRevision;
    return profilesReady ? readLearningProfile(activeProfile.id) : null;
  }, [activeProfile.id, learningRevision, profilesReady]);
  const model = useMemo(() => {
    if (!profilesReady || !progressReady || !arcadeReady) return null;
    return buildAdventureWorld({
      profileId: activeProfile.id,
      age: activeProfile.age,
      grade,
      interests: learningProfile?.interests ?? [],
      games,
      progress,
      arcade,
    });
  }, [
    activeProfile.age,
    activeProfile.id,
    arcade,
    arcadeReady,
    games,
    grade,
    learningProfile?.interests,
    profilesReady,
    progress,
    progressReady,
  ]);

  const companion = useMemo(() => {
    void companionRevision;
    if (!model || !profilesReady || !progressReady) return null;
    return resolveEquippedPrize({
      profileId: activeProfile.id,
      progress,
      grade,
    });
  }, [activeProfile.id, companionRevision, grade, model, profilesReady, progress, progressReady]);

  useEffect(() => {
    if (!model) return;
    setSky(model.sky);
    setFoundSecrets([]);
    setScoutIndex(0);
    setCompanionMessage("Tap me and I’ll scout a portal!");
  }, [activeProfile.id, model?.themeId, model?.sky]);

  if (!model) return null;

  const activeSky = sky ?? model.sky;
  const scoutPortal = model.portals[scoutIndex % model.portals.length] ?? model.heroPortal;
  const allSecretsFound = foundSecrets.length === model.secretIcons.length;
  const companionEmoji = companion?.emoji ?? model.guideEmoji;
  const companionName = companion?.name ?? `${activeProfile.name}'s world guide`;
  const nextGrowthAt = model.growthPieces.length + 1;

  function remember(slug: string) {
    setArcade(rememberArcadeGame(activeProfile.id, slug));
  }

  function cycleSky() {
    const currentIndex = SKY_ORDER.indexOf(activeSky);
    setSky(SKY_ORDER[(currentIndex + 1) % SKY_ORDER.length]);
  }

  function findSecret(index: number) {
    setFoundSecrets((current) => current.includes(index) ? current : [...current, index]);
  }

  function scout() {
    const nextIndex = (scoutIndex + 1) % model.portals.length;
    const nextPortal = model.portals[nextIndex] ?? model.heroPortal;
    setScoutIndex(nextIndex);
    setCompanionMessage(`${nextPortal.game.title} is glowing. Let’s go!`);
  }

  return (
    <section
      className={styles.shell}
      aria-label={`${activeProfile.name}'s Adventure World`}
      data-adventure-world="active"
      data-world-theme={model.themeId}
      data-world-stage={model.stage.index}
      data-world-growth={model.growthPieces.length}
      data-world-clears={model.clears}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>MY LIVING ADVENTURE WORLD</span>
          <h1>{model.title}</h1>
          <p>{model.tagline}</p>
        </div>
        <div className={styles.worldStatus}>
          <strong>{model.stage.title}</strong>
          <span>{model.clears} verified game clear{model.clears === 1 ? "" : "s"} built this world</span>
          <em>{model.stage.copy}</em>
        </div>
      </header>

      <div
        className={`${styles.scene} ${styles[`sky_${activeSky}`]}`}
        data-world-sky={activeSky}
        aria-label={`${model.title}, ${SKY_LABELS[activeSky]}`}
      >
        <div className={styles.sunMoon} aria-hidden="true" />
        <div className={styles.clouds} aria-hidden="true"><i /><i /><i /></div>
        <div className={styles.mountains} aria-hidden="true" />
        <div className={styles.river} aria-hidden="true" />
        <div className={styles.ground} aria-hidden="true" />

        {model.growthPieces.map((piece, index) => (
          <span
            key={`${piece.label}:${index}`}
            className={styles.growthPiece}
            style={{
              left: GROWTH_POSITIONS[index]?.left,
              top: GROWTH_POSITIONS[index]?.top,
              "--growth-delay": `${index * 70}ms`,
            } as CSSProperties}
            title={`${piece.label}, built from verified game clear ${index + 1}`}
            data-world-growth-piece={piece.label}
          >
            <span aria-hidden="true">{piece.emoji}</span>
            <small>{piece.label}</small>
          </span>
        ))}

        <div className={styles.portalLayer}>
          {model.portals.map((portal) => (
            <Link
              key={portal.id}
              href={portal.href}
              onClick={() => remember(portal.game.slug)}
              className={`${styles.portal} ${styles[`portal_${portal.id}`]} ${scoutPortal.id === portal.id ? styles.portalScouted : ""}`}
              data-world-portal={portal.id}
              data-world-game={portal.game.slug}
              aria-label={`${portal.title}: play ${portal.game.title}`}
            >
              <span className={styles.portalIcon} aria-hidden="true">{portal.emoji}</span>
              <span>
                <small>{portal.eyebrow}</small>
                <strong>{portal.game.title}</strong>
                <em>{portalHistory(portal)}</em>
              </span>
            </Link>
          ))}
        </div>

        <button
          type="button"
          className={styles.companion}
          onClick={scout}
          aria-label={`Ask ${companionName} to scout another game portal`}
          data-world-companion={companion?.name ?? "world-guide"}
          data-world-scout={scoutPortal.id}
        >
          <span className={styles.companionAura} aria-hidden="true"><i /><i /><i /></span>
          <span className={styles.companionEmoji} aria-hidden="true">{companionEmoji}</span>
          <span className={styles.companionName}>{companionName}</span>
          <span className={styles.companionBubble} aria-live="polite">{companionMessage}</span>
        </button>

        {model.secretIcons.map((icon, index) => {
          const found = foundSecrets.includes(index);
          return (
            <button
              type="button"
              key={`${icon}:${index}`}
              onClick={() => findSecret(index)}
              className={`${styles.secret} ${found ? styles.secretFound : ""}`}
              style={{ left: SECRET_POSITIONS[index].left, top: SECRET_POSITIONS[index].top }}
              aria-label={found ? `World secret ${index + 1} found` : `Explore hidden world secret ${index + 1}`}
              aria-pressed={found}
              data-world-secret={index + 1}
              data-world-secret-found={found ? "true" : "false"}
            >
              <span aria-hidden="true">{found ? icon : "✦"}</span>
            </button>
          );
        })}

        {allSecretsFound && (
          <div className={styles.secretCelebration} role="status" data-world-secret-celebration="true">
            <span aria-hidden="true">✨</span>
            <strong>World secret complete!</strong>
            <small>Pure explorer glory. No fake XP or mastery.</small>
          </div>
        )}
      </div>

      <div className={styles.actionBar}>
        <button type="button" onClick={cycleSky} className={styles.skyButton}>
          <span aria-hidden="true">{activeSky === "night" ? "🌙" : activeSky === "sunset" ? "☄️" : "☀️"}</span>
          <span><small>CHANGE THE SKY</small><strong>{SKY_LABELS[activeSky]}</strong></span>
        </button>

        <Link
          href={scoutPortal.href}
          onClick={() => remember(scoutPortal.game.slug)}
          className={styles.heroPlay}
          data-world-hero-game={scoutPortal.game.slug}
        >
          <span aria-hidden="true">{companionEmoji}</span>
          <span><small>COMPANION PICK</small><strong>Play {scoutPortal.game.title}</strong></span>
          <b aria-hidden="true">▶</b>
        </Link>

        <div className={styles.growthNext}>
          <small>WORLD GROWTH</small>
          {model.nextGrowthPiece ? (
            <>
              <strong>{model.nextGrowthPiece.emoji} {model.nextGrowthPiece.label}</strong>
              <span>Finish one real game to build piece {nextGrowthAt}.</span>
            </>
          ) : (
            <>
              <strong>👑 Legendary world complete</strong>
              <span>Future clears keep powering champion play.</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
