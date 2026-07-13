"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import {
  readArcadeState,
  rememberArcadeGame,
  type ArcadeState,
} from "@/lib/adventure-arcade";
import { buildQuickPlayDeck } from "@/lib/quick-play";
import type { Game } from "@/lib/games";
import styles from "./QuickPlayLaunchpad.module.css";

export default function QuickPlayLaunchpad({ games }: { games: Game[] }) {
  const { activeProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady } = useAdrianProgress();
  const [arcade, setArcade] = useState<ArcadeState>({ favorites: [], recent: [] });
  const [arcadeReady, setArcadeReady] = useState(false);

  useEffect(() => {
    if (!profilesReady) return;
    const refresh = () => {
      setArcade(readArcadeState(activeProfile.id));
      setArcadeReady(true);
    };
    refresh();
    window.addEventListener("adrianos-learning-updated", refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener("adrianos-learning-updated", refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, [activeProfile.id, profilesReady]);

  const grade = readProfileGrade(activeProfile);
  const deck = useMemo(() => {
    if (!profilesReady || !progressReady || !arcadeReady) return null;
    return buildQuickPlayDeck({
      profileId: activeProfile.id,
      age: activeProfile.age,
      grade,
      games,
      progress,
      arcade,
    });
  }, [activeProfile.age, activeProfile.id, arcade, arcadeReady, games, grade, profilesReady, progress, progressReady]);

  function remember(slug: string) {
    setArcade(rememberArcadeGame(activeProfile.id, slug));
  }

  function browseArcade() {
    document.querySelector<HTMLElement>('[aria-label="Adventure Arcade"]')?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  if (!deck || deck.choices.length === 0) return null;

  return (
    <section
      className={styles.shell}
      aria-label="Quick play launchpad"
      data-quick-play-launchpad="active"
      data-quick-play-ready="true"
    >
      <div className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>PLAY IN ONE TAP</span>
          <h1>What sounds fun?</h1>
          <p>Jump straight into a game. No menus, setup screens, or bonus choices first.</p>
        </div>

        <Link
          href={deck.surprise.href}
          onClick={() => remember(deck.surprise.game.slug)}
          className={styles.surprise}
          data-quick-surprise={deck.surprise.game.slug}
          aria-label={`Play a surprise game: ${deck.surprise.game.title}`}
        >
          <span className={styles.dice} aria-hidden="true">🎲</span>
          <span>
            <small>{deck.surprise.eyebrow}</small>
            <strong>Play something fun</strong>
            <em>Picked for {activeProfile.name} right now</em>
          </span>
          <b aria-hidden="true">→</b>
        </Link>
      </div>

      <div className={styles.pickHeader}>
        <strong>Or pick one</strong>
        <span>Four fun choices, ready immediately</span>
      </div>

      <div className={styles.grid}>
        {deck.choices.map((choice) => (
          <Link
            key={`${choice.mood}:${choice.game.slug}`}
            href={choice.href}
            onClick={() => remember(choice.game.slug)}
            className={styles.card}
            data-quick-game={choice.game.slug}
            data-quick-mood={choice.mood}
            aria-label={`Play ${choice.game.title}`}
          >
            <div className={styles.cardTop}>
              <span className={styles.gameEmoji} aria-hidden="true">{choice.game.emoji}</span>
              <span className={styles.playArrow} aria-hidden="true">▶</span>
            </div>
            <small>{choice.eyebrow}</small>
            <strong>{choice.game.title}</strong>
            <p>{choice.reason}</p>
            <div className={styles.meta}>
              <span>{choice.game.subject}</span>
              <span>{choice.completions > 0 ? `🏆 ${choice.completions}` : choice.plays > 0 ? "↩ Continue" : "✨ New"}</span>
            </div>
          </Link>
        ))}
      </div>

      <button type="button" className={styles.browseLink} onClick={browseArcade}>
        Browse every game and filter by subject ↓
      </button>
    </section>
  );
}
