"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  buildAdventureChain,
  type AdventureChainChoice,
} from "@/lib/adrian-adventure-chain";
import { readAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { games } from "@/lib/generated-games";

function slugFromPath(pathname: string): string {
  const marker = "/games/";
  const start = pathname.indexOf(marker);
  if (start < 0) return "";
  return decodeURIComponent(pathname.slice(start + marker.length).split("/")[0] ?? "");
}

const KIND_ICONS: Record<AdventureChainChoice["kind"], string> = {
  stretch: "⚡",
  rescue: "🛠️",
  explore: "🧭",
};

export default function AdaptiveAdventureChain() {
  const pathname = usePathname();
  const slug = slugFromPath(pathname);
  const currentGame = useMemo(() => games.find((game) => game.slug === slug), [slug]);
  const { activeProfile } = useFamilyProfiles();
  const [choices, setChoices] = useState<AdventureChainChoice[]>([]);
  const [open, setOpen] = useState(false);
  const revealTimerRef = useRef<number | null>(null);
  const firstChoiceRef = useRef<HTMLAnchorElement | null>(null);

  function clearChain() {
    setOpen(false);
    setChoices([]);
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }

  useEffect(() => {
    clearChain();
  }, [slug]);

  useEffect(() => {
    if (!currentGame) return;
    let previous = readAdrianProgress();

    const refresh = () => {
      const next = readAdrianProgress();
      const previousGame = previous.games[currentGame.slug];
      const nextGame = next.games[currentGame.slug];
      const completionGain = (nextGame?.completions ?? 0) - (previousGame?.completions ?? 0);
      const playGain = (nextGame?.plays ?? 0) - (previousGame?.plays ?? 0);

      if (completionGain > 0) {
        const nextChoices = buildAdventureChain({
          currentGame,
          games,
          progress: next,
          profile: activeProfile,
        });
        setChoices(nextChoices);
        setOpen(false);
        if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = window.setTimeout(() => {
          setOpen(nextChoices.length > 0);
          revealTimerRef.current = null;
        }, 3800);
      } else if (playGain > 0) {
        clearChain();
      }

      previous = next;
    };

    const reset = () => {
      previous = readAdrianProgress();
      clearChain();
    };

    window.addEventListener("adrianos-progress-updated", refresh);
    window.addEventListener("adrianos-family-updated", reset);
    return () => {
      window.removeEventListener("adrianos-progress-updated", refresh);
      window.removeEventListener("adrianos-family-updated", reset);
    };
  }, [activeProfile, currentGame]);

  useEffect(() => () => {
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    firstChoiceRef.current?.focus({ preventScroll: true });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (!open || choices.length === 0 || !currentGame) return null;

  return (
    <div className="adventure-chain-backdrop" data-adventure-chain="active">
      <section
        className="adventure-chain"
        role="dialog"
        aria-labelledby="adventure-chain-title"
        aria-describedby="adventure-chain-copy"
      >
        <button
          type="button"
          className="adventure-chain-close"
          aria-label="Close next adventure choices"
          onClick={() => setOpen(false)}
        >
          ×
        </button>

        <header className="adventure-chain-heading">
          <span className="adventure-chain-orbit" aria-hidden="true">{currentGame.emoji}</span>
          <div>
            <small>VICTORY PATH</small>
            <h2 id="adventure-chain-title">Choose what happens next</h2>
            <p id="adventure-chain-copy">
              Three paths, personalized from {activeProfile.name}&apos;s real play and mastery evidence.
            </p>
          </div>
        </header>

        <div className="adventure-chain-grid">
          {choices.map((choice, index) => (
            <a
              key={`${choice.kind}:${choice.gameSlug}`}
              ref={index === 0 ? firstChoiceRef : undefined}
              className="adventure-chain-card"
              href={choice.href}
              data-chain-kind={choice.kind}
              data-chain-game={choice.gameSlug}
            >
              <span className="adventure-chain-kind-icon" aria-hidden="true">
                {KIND_ICONS[choice.kind]}
              </span>
              <small>{choice.eyebrow}</small>
              <span className="adventure-chain-game-icon" aria-hidden="true">{choice.emoji}</span>
              <strong>{choice.title}</strong>
              <p>{choice.reason}</p>
              <span className="adventure-chain-go">GO →</span>
            </a>
          ))}
        </div>

        <footer className="adventure-chain-footer">
          <a href={pathname}>↻ Replay this mission</a>
          <a href="/">Mission Control</a>
        </footer>
      </section>
    </div>
  );
}
