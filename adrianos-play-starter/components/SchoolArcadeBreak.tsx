"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { readArcadeState, rememberArcadeGame, type ArcadeState } from "@/lib/adventure-arcade";
import { buildQuickPlayDeck, type QuickPlayChoice } from "@/lib/quick-play";
import type { Game } from "@/lib/games";
import styles from "./SchoolArcadeBreak.module.css";

function uniqueChoices(choices: QuickPlayChoice[]): QuickPlayChoice[] {
  const seen = new Set<string>();
  return choices.filter((choice) => {
    if (seen.has(choice.game.slug)) return false;
    seen.add(choice.game.slug);
    return true;
  });
}

export default function SchoolArcadeBreak({ games }: { games: Game[] }) {
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

  if (!deck) return null;

  const create = deck.choices.find((choice) => choice.mood === "create");
  const quick = deck.choices.find((choice) => choice.mood === "quick");
  const adventure = deck.choices.find((choice) => choice.mood === "adventure");
  const picks = uniqueChoices([deck.surprise, create, quick, adventure].filter((choice): choice is QuickPlayChoice => Boolean(choice))).slice(0, 3);

  function remember(slug: string) {
    setArcade(rememberArcadeGame(activeProfile.id, slug));
  }

  return (
    <section id="school-arcade-break" className={styles.shell} aria-label="Arcade break" data-school-arcade-break="active">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>ARCADE IS ALWAYS OPEN</span>
          <h2>Take a fun route.</h2>
          <p>School is one way to play AdrianOS. Jump into any game without finishing a checklist first.</p>
        </div>
        <Link href="/?from=school#quick-play" className={styles.fullArcade}>Open the full arcade →</Link>
      </div>

      <div className={styles.grid}>
        {picks.map((choice, index) => (
          <Link
            key={`${choice.mood}:${choice.game.slug}`}
            href={choice.href}
            onClick={() => remember(choice.game.slug)}
            className={styles.card}
            data-school-arcade-game={choice.game.slug}
          >
            <div className={styles.cardTop}>
              <span aria-hidden="true">{choice.game.emoji}</span>
              <b aria-hidden="true">▶</b>
            </div>
            <small>{index === 0 ? "SURPRISE ME" : choice.eyebrow}</small>
            <strong>{choice.game.title}</strong>
            <p>{choice.reason}</p>
            <em>{choice.completions > 0 ? `🏆 ${choice.completions} clears` : choice.plays > 0 ? "↩ Jump back in" : "✨ New game"}</em>
          </Link>
        ))}
      </div>
    </section>
  );
}
