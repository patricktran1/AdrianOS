"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { readAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { games } from "@/lib/generated-games";

const SESSION_STEP_EVENT = "adrianos-session-step";

/** What the session runtime announces after an activity finishes. */
type StepSummary = {
  slug: string;
  href: string;
  childReason: string;
  complete: boolean;
};

function slugFromPath(pathname: string): string {
  const marker = "/games/";
  const start = pathname.indexOf(marker);
  if (start < 0) return "";
  return decodeURIComponent(pathname.slice(start + marker.length).split("/")[0] ?? "");
}

function asSummary(value: unknown): StepSummary | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.href !== "string" || typeof raw.slug !== "string") return null;
  return {
    slug: raw.slug,
    href: raw.href,
    childReason: typeof raw.childReason === "string" ? raw.childReason : "",
    complete: raw.complete === true,
  };
}

type Continuation = {
  kind: "next" | "finished";
  title: string;
  emoji: string;
  eyebrow: string;
  reason: string;
  href: string;
  slug: string;
};

/**
 * The end of one activity is the join between two steps of a session.
 *
 * It used to be a fork: three cards built by a second, independent policy
 * that read subject averages and play counts. A child who had just built
 * place value five times was offered a dinosaur game, a boss arena and an
 * art studio — none of which continued anything.
 *
 * There is now one next destination, and it is the session plan's next step.
 * The child still chooses whether to take it: replaying and going home are
 * both one tap away.
 *
 * The step arrives as an event rather than being fetched. This component sits
 * in the games layout, which the bundler copies into every game route, so
 * importing the planner here would put it — and the learner model, the
 * mastery loop and the placement report behind it — into fifty chunks that
 * every game download pays for.
 */
export default function AdaptiveAdventureChain() {
  const pathname = usePathname();
  const slug = slugFromPath(pathname);
  const currentGame = useMemo(() => games.find((game) => game.slug === slug), [slug]);
  const { activeProfile } = useFamilyProfiles();
  const [continuation, setContinuation] = useState<Continuation | null>(null);
  const [open, setOpen] = useState(false);
  const [controllerReady, setControllerReady] = useState(false);
  const revealTimerRef = useRef<number | null>(null);
  const firstChoiceRef = useRef<HTMLAnchorElement | null>(null);
  /** The most recent step the session announced. */
  const stepRef = useRef<StepSummary | null>(null);

  const clearChain = useCallback(() => {
    setOpen(false);
    setContinuation(null);
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setControllerReady(false);
    clearChain();
  }, [slug, clearChain]);

  useEffect(() => {
    const onStep = (event: Event) => {
      stepRef.current = asSummary((event as CustomEvent).detail);
    };
    window.addEventListener(SESSION_STEP_EVENT, onStep);
    return () => window.removeEventListener(SESSION_STEP_EVENT, onStep);
  }, []);

  useEffect(() => {
    if (!currentGame) return;
    setControllerReady(false);
    let previous = readAdrianProgress();

    const refresh = () => {
      const next = readAdrianProgress();
      const previousGame = previous.games[currentGame.slug];
      const nextGame = next.games[currentGame.slug];
      const completionGain = (nextGame?.completions ?? 0) - (previousGame?.completions ?? 0);
      const playGain = (nextGame?.plays ?? 0) - (previousGame?.plays ?? 0);

      if (completionGain > 0) {
        setOpen(false);
        if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
        // The session advances elsewhere, from the evidence this run produced.
        // Reading it at reveal time rather than now means this panel always
        // shows the step the world is already pointing at.
        revealTimerRef.current = window.setTimeout(() => {
          revealTimerRef.current = null;
          setContinuation(continuationFor(stepRef.current, activeProfile.name));
          setOpen(true);
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
    setControllerReady(true);
    return () => {
      window.removeEventListener("adrianos-progress-updated", refresh);
      window.removeEventListener("adrianos-family-updated", reset);
    };
  }, [activeProfile, clearChain, currentGame]);

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

  if (!currentGame) return null;

  return (
    <>
      <span
        hidden
        data-adventure-chain-controller="active"
        data-controller-ready={controllerReady ? "true" : "false"}
        data-current-game={currentGame.slug}
      />

      {open && continuation && (
        <div className="adventure-chain-backdrop" data-adventure-chain="active">
          <section
            className="adventure-chain"
            role="dialog"
            aria-labelledby="adventure-chain-title"
            aria-describedby="adventure-chain-copy"
            data-chain-mode={continuation.kind}
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
                <small>{continuation.eyebrow}</small>
                <h2 id="adventure-chain-title">
                  {continuation.kind === "finished" ? "Adventure complete" : "Next stop"}
                </h2>
                <p id="adventure-chain-copy">{continuation.reason}</p>
              </div>
            </header>

            <div className="adventure-chain-grid" data-chain-count="1">
              <a
                ref={firstChoiceRef}
                className="adventure-chain-card"
                href={continuation.href}
                data-chain-kind={continuation.kind}
                data-chain-game={continuation.slug}
              >
                <span className="adventure-chain-kind-icon" aria-hidden="true">
                  {continuation.kind === "finished" ? "🌤️" : "➡️"}
                </span>
                <small>{continuation.eyebrow}</small>
                <span className="adventure-chain-game-icon" aria-hidden="true">{continuation.emoji}</span>
                <strong>{continuation.title}</strong>
                <p>{continuation.reason}</p>
                <span className="adventure-chain-go">GO →</span>
              </a>
            </div>

            <footer className="adventure-chain-footer">
              <a href={pathname}>↻ Replay this mission</a>
              <a href="/">Mission Control</a>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

/**
 * Turns the session's next step into a card, or says the session is over.
 *
 * Nothing here re-decides anything. If the plan has a next step, that step is
 * the card; if it does not, the child is told they are done and sent back to
 * the world, which is a place rather than a menu.
 */
function continuationFor(step: StepSummary | null, childName: string): Continuation {
  if (!step || step.complete || !step.slug) {
    return {
      kind: "finished",
      title: "Back to the world",
      emoji: "🗺️",
      eyebrow: "ALL DONE FOR TODAY",
      reason: `${childName || "You"} did a lot of thinking today. The world is yours to wander.`,
      href: "/",
      slug: "",
    };
  }
  const game = games.find((row) => row.slug === step.slug);
  return {
    kind: "next",
    title: game?.title ?? "Keep going",
    emoji: game?.emoji ?? "✨",
    eyebrow: "YOUR NEXT STOP",
    reason: step.childReason,
    href: step.href,
    slug: step.slug,
  };
}
