"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { games } from "@/lib/generated-games";

const INSTANT_SOURCES = new Set([
  "quick-play",
  "adventure-chain",
  "world-quest",
  "weekly-world-quest",
]);

const BLOCKED_LABEL = /(play again|replay|next|continue|results|finish|home|back|exit|quit|end session|hint|clue|reveal|answer|option|setting|sound|haptic|auto-next|save|remove|collect|reward)/i;
const START_LABEL = /(start|begin|launch|enter|play|mission|challenge|adventure|story|quest|round|arena|blast|expedition|rescue)/i;

type StartState = "idle" | "looking" | "starting" | "playing" | "cancelled";
type LaunchContext = { enabled: boolean; source: string; mood: string; key: string };

const IDLE_LAUNCH: LaunchContext = { enabled: false, source: "", mood: "surprise", key: "idle" };

function visible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== "none"
    && style.visibility !== "hidden"
    && Number(style.opacity || 1) > 0
    && element.getClientRects().length > 0;
}

function labelFor(element: HTMLElement): string {
  return (element.getAttribute("aria-label") || element.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeControl(element: HTMLElement): boolean {
  if (!visible(element) || element.matches(":disabled")) return false;
  if (element.dataset.correct === "true" || element.dataset.correct === "false") return false;
  if (element.closest(".game-topbar, .game-power-controls, .game-flow-director, .game-feel-effects")) return false;
  const label = labelFor(element);
  return Boolean(label) && !BLOCKED_LABEL.test(label);
}

function explicitStart(stage: HTMLElement, mood: string): HTMLElement | null {
  const controls = Array.from(stage.querySelectorAll<HTMLElement>("button[data-instant-start], a[data-instant-start], [role='button'][data-instant-start]"))
    .filter(safeControl);
  if (controls.length === 0) return null;
  const moodMatch = controls.find((control) =>
    (control.dataset.instantStart ?? "").split(/\s+/).includes(mood),
  );
  return moodMatch
    ?? controls.find((control) => (control.dataset.instantStart ?? "").split(/\s+/).includes("default"))
    ?? controls[0]
    ?? null;
}

function scoreControl(control: HTMLElement, mood: string): number {
  if (!safeControl(control)) return Number.NEGATIVE_INFINITY;
  const label = labelFor(control).toLowerCase();
  if (!START_LABEL.test(label)) return Number.NEGATIVE_INFINITY;

  let score = 0;
  if (/^(start|begin|launch|enter|play)\b/.test(label)) score += 180;
  if (/mission|challenge|adventure|story|quest|round|arena|blast|expedition|rescue/.test(label)) score += 95;
  if (/daily/.test(label)) score += 20;
  if (label.length > 110) score -= 20;

  if (mood === "quick" && /(quick|60-second|speed|blast|short|round)/.test(label)) score += 130;
  if (mood === "adventure" && /(adventure|story|mission|quest|expedition|rescue)/.test(label)) score += 130;
  if (mood === "challenge" && /(challenge|boss|hard|arena|mission)/.test(label)) score += 130;
  if (mood === "create" && /(create|make|studio|free|music|build)/.test(label)) score += 130;
  if (mood === "surprise" && /(daily|mission|adventure|play)/.test(label)) score += 55;

  return score;
}

function inferredStart(stage: HTMLElement, mood: string): HTMLElement | null {
  return Array.from(stage.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], [role='button']"))
    .map((control) => ({ control, score: scoreControl(control, mood) }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((left, right) => right.score - left.score)[0]?.control ?? null;
}

export default function GameStartDirector() {
  const pathname = usePathname();
  const slug = pathname.split("/games/")[1]?.split("/")[0] ?? "";
  const gameTitle = useMemo(
    () => games.find((game) => game.slug === slug)?.title ?? "your game",
    [slug],
  );
  const [launch, setLaunch] = useState<LaunchContext>(IDLE_LAUNCH);
  const [state, setState] = useState<StartState>("idle");
  const [targetLabel, setTargetLabel] = useState("");
  const firedRef = useRef(false);

  useEffect(() => {
    const refresh = () => {
      const params = new URLSearchParams(window.location.search);
      const source = params.get("from") ?? "";
      const mood = params.get("mood") ?? "surprise";
      setLaunch({
        enabled: params.get("instant") === "1" || INSTANT_SOURCES.has(source),
        source,
        mood,
        key: `${pathname}?${params.toString()}`,
      });
    };
    refresh();
    window.addEventListener("popstate", refresh);
    return () => window.removeEventListener("popstate", refresh);
  }, [pathname]);

  useEffect(() => {
    firedRef.current = false;
    setTargetLabel("");
    if (!launch.enabled) {
      setState("idle");
      return;
    }

    setState("looking");
    const root = document.querySelector<HTMLElement>(".games-route-shell");
    if (!root) return;
    delete root.dataset.instantStartFired;
    delete root.dataset.instantStartTarget;
    const startedAt = Date.now();
    let cancelled = false;
    let scanTimer: number | null = null;
    let settleTimer: number | null = null;
    let observer: MutationObserver | null = null;

    const finishWithoutClick = () => {
      if (cancelled || firedRef.current) return;
      firedRef.current = true;
      setState("playing");
      observer?.disconnect();
    };

    const scan = () => {
      if (cancelled || firedRef.current) return;
      const stage = root.querySelector<HTMLElement>(".game-stage");
      if (!stage) return;
      const control = explicitStart(stage, launch.mood) ?? inferredStart(stage, launch.mood);
      if (!control) {
        if (Date.now() - startedAt > 1800) finishWithoutClick();
        return;
      }

      firedRef.current = true;
      const label = labelFor(control);
      setTargetLabel(label);
      setState("starting");
      root.dataset.instantStartFired = "true";
      root.dataset.instantStartTarget = label;
      observer?.disconnect();

      window.setTimeout(() => {
        if (cancelled || !control.isConnected || !visible(control) || control.matches(":disabled")) {
          setState("playing");
          return;
        }
        control.dataset.instantStartFired = "true";
        control.click();
        window.dispatchEvent(new CustomEvent("adrianos-game-instant-start", {
          detail: { slug, label, source: launch.source, mood: launch.mood },
        }));
        window.setTimeout(() => {
          delete control.dataset.instantStartFired;
          setState("playing");
        }, 700);
      }, 140);
    };

    const queueScan = () => {
      if (scanTimer !== null) window.clearTimeout(scanTimer);
      scanTimer = window.setTimeout(scan, 45);
    };

    const cancel = () => {
      if (firedRef.current) return;
      cancelled = true;
      firedRef.current = true;
      setState("cancelled");
      observer?.disconnect();
      if (scanTimer !== null) window.clearTimeout(scanTimer);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".game-start-director")) return;
      cancel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };

    observer = new MutationObserver(queueScan);
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    settleTimer = window.setTimeout(finishWithoutClick, 2600);
    queueScan();

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (scanTimer !== null) window.clearTimeout(scanTimer);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [launch.enabled, launch.key, launch.mood, launch.source, slug]);

  return (
    <div
      className={`game-start-director is-${state}`}
      data-game-start-director="active"
      data-instant-start-enabled={launch.enabled ? "true" : "false"}
      data-instant-start-state={state}
      data-instant-start-source={launch.source}
      data-instant-start-target={targetLabel}
      aria-live="polite"
      aria-atomic="true"
    >
      {launch.enabled && (state === "looking" || state === "starting") && (
        <div className="game-start-warp" aria-hidden="true">
          <span>⚡</span>
          <div>
            <strong>{state === "starting" ? "GO!" : `Opening ${gameTitle}…`}</strong>
            <small>{state === "starting" ? "First challenge ready" : "Skipping the setup screen"}</small>
          </div>
          <i />
        </div>
      )}
      <span className="game-start-live">
        {state === "starting" ? `${gameTitle} is starting.` : ""}
      </span>
    </div>
  );
}
