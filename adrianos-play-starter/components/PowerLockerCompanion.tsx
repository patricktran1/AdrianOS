"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readProgressForProfile } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import {
  POWER_LOCKER_EVENT,
  resolveEquippedPrize,
  type EquippedPrize,
} from "@/lib/adrian-power-locker";

type CompanionReaction = "idle" | "cheer" | "encourage" | "victory" | "surprise";

const REACTION_COPY: Record<CompanionReaction, string> = {
  idle: "Ready!",
  cheer: "POWER MOVE!",
  encourage: "TRY ANOTHER!",
  victory: "QUEST CLEAR!",
  surprise: "SURPRISE POWER!",
};

export default function PowerLockerCompanion() {
  const { activeProfile } = useFamilyProfiles();
  const grade = readProfileGrade(activeProfile);
  const [companion, setCompanion] = useState<EquippedPrize | null>(null);
  const [reaction, setReaction] = useState<CompanionReaction>("idle");
  const [ready, setReady] = useState(false);
  const reactionTimerRef = useRef<number | null>(null);
  const previousCompletionsRef = useRef(0);

  const refreshCompanion = useCallback(() => {
    const progress = readProgressForProfile(activeProfile.id);
    setCompanion(resolveEquippedPrize({
      profileId: activeProfile.id,
      progress,
      grade,
    }));
    setReady(true);
  }, [activeProfile.id, grade]);

  const react = useCallback((next: CompanionReaction, duration = 1150) => {
    setReaction(next);
    if (reactionTimerRef.current !== null) window.clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = window.setTimeout(() => {
      setReaction("idle");
      reactionTimerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    refreshCompanion();
    previousCompletionsRef.current = Object.values(readProgressForProfile(activeProfile.id).games)
      .reduce((sum, game) => sum + game.completions, 0);

    const refresh = () => refreshCompanion();
    const onProgress = () => {
      const progress = readProgressForProfile(activeProfile.id);
      const completions = Object.values(progress.games).reduce((sum, game) => sum + game.completions, 0);
      refreshCompanion();
      if (completions > previousCompletionsRef.current) react("victory", 2200);
      previousCompletionsRef.current = completions;
    };
    const onSurprise = () => react("surprise", 1900);
    const reset = () => {
      previousCompletionsRef.current = Object.values(readProgressForProfile(activeProfile.id).games)
        .reduce((sum, game) => sum + game.completions, 0);
      refreshCompanion();
      setReaction("idle");
    };

    window.addEventListener(POWER_LOCKER_EVENT, refresh);
    window.addEventListener("adrianos-learning-updated", refresh);
    window.addEventListener("adrianos-progress-updated", onProgress);
    window.addEventListener("adrianos-surprise-event", onSurprise);
    window.addEventListener("adrianos-family-updated", reset);
    return () => {
      window.removeEventListener(POWER_LOCKER_EVENT, refresh);
      window.removeEventListener("adrianos-learning-updated", refresh);
      window.removeEventListener("adrianos-progress-updated", onProgress);
      window.removeEventListener("adrianos-surprise-event", onSurprise);
      window.removeEventListener("adrianos-family-updated", reset);
    };
  }, [activeProfile.id, react, refreshCompanion]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".games-route-shell");
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>('button:not(:disabled), [role="button"]');
      if (!control || !root.contains(control)) return;
      if (control.dataset.correct === "true") react("cheer");
      if (control.dataset.correct === "false") react("encourage", 1450);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [react]);

  useEffect(() => () => {
    if (reactionTimerRef.current !== null) window.clearTimeout(reactionTimerRef.current);
  }, []);

  if (!companion) {
    return (
      <div
        data-power-locker-companion="none"
        data-power-locker-ready={ready ? "true" : "false"}
        aria-hidden="true"
      />
    );
  }

  return (
    <aside
      className={`power-locker-companion power-locker-aura-${companion.aura} power-locker-reaction-${reaction}`}
      aria-label={`${companion.name}, active game companion`}
      data-power-locker-companion={companion.name}
      data-power-locker-aura={companion.aura}
      data-power-locker-reaction={reaction}
      data-power-locker-ready={ready ? "true" : "false"}
    >
      <div className="power-locker-companion-aura" aria-hidden="true"><i /><i /><i /></div>
      <span className="power-locker-companion-emoji" aria-hidden="true">{companion.emoji}</span>
      <span className="power-locker-companion-copy">
        <small>{reaction === "idle" ? companion.auraLabel : REACTION_COPY[reaction]}</small>
        <strong>{companion.name}</strong>
      </span>
      <span className="power-locker-companion-bubble" aria-hidden="true">{REACTION_COPY[reaction]}</span>
    </aside>
  );
}
