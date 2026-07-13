"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  GAME_PLAY_SETTINGS_EVENT,
  readGamePlaySettings,
} from "@/lib/game-play-settings";

type PendingAdvance = {
  label: string;
  delay: number;
};

const FORWARD_LABEL = /^(next (question|case|mission|clue|gate|rematch|round|challenge|puzzle|step)|see (results|treasure|score)|finish today['’]s remix|open checkpoint|continue the remix)\s*(→|›)?$/i;
const UTILITY_LABEL = /(sound|read it aloud|hint|clue compass|reveal|play again|replay|go home|exit|options|settings|pause|start|begin|bonus)/i;
const DEFAULT_DELAY = 1800;

function labelFor(control: HTMLElement): string {
  return (control.getAttribute("aria-label") || control.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isVisible(control: HTMLElement): boolean {
  const style = window.getComputedStyle(control);
  return style.display !== "none"
    && style.visibility !== "hidden"
    && Number(style.opacity || 1) > 0
    && control.getClientRects().length > 0;
}

function isForwardControl(control: HTMLElement): boolean {
  return control.dataset.autoAdvance === "true" || FORWARD_LABEL.test(labelFor(control));
}

function isLikelyAnswer(control: HTMLElement): boolean {
  if (control.dataset.correct === "true" || control.dataset.correct === "false") return true;
  const label = labelFor(control);
  if (!label || UTILITY_LABEL.test(label) || isForwardControl(control)) return false;
  const parent = control.parentElement;
  if (!parent) return false;
  const siblings = Array.from(parent.querySelectorAll<HTMLElement>("button:not(:disabled)"))
    .filter((button) => isVisible(button));
  return siblings.length >= 2;
}

function delayFor(control: HTMLElement): number {
  const raw = Number(control.dataset.autoAdvanceDelay);
  if (!Number.isFinite(raw)) return DEFAULT_DELAY;
  return Math.max(500, Math.min(4000, raw));
}

export default function GameFlowDirector() {
  const pathname = usePathname();
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [pending, setPending] = useState<PendingAdvance | null>(null);
  const answerWindowUntilRef = useRef(0);
  const pendingControlRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const clearPending = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingControlRef.current = null;
    setPending(null);
  }, []);

  const schedule = useCallback((control: HTMLElement) => {
    if (pendingControlRef.current === control || !control.isConnected || !isVisible(control)) return;
    clearPending();
    const delay = delayFor(control);
    const label = labelFor(control);
    pendingControlRef.current = control;
    setPending({ label, delay });
    timerRef.current = window.setTimeout(() => {
      const next = pendingControlRef.current;
      timerRef.current = null;
      pendingControlRef.current = null;
      setPending(null);
      if (!next || !next.isConnected || !isVisible(next) || next.matches(":disabled")) return;
      next.dataset.autoAdvanceFired = "true";
      next.click();
      window.setTimeout(() => delete next.dataset.autoAdvanceFired, 0);
      answerWindowUntilRef.current = 0;
    }, delay);
  }, [clearPending]);

  const scan = useCallback(() => {
    if (!autoAdvance) {
      clearPending();
      return;
    }
    const root = document.querySelector<HTMLElement>(".games-route-shell");
    if (!root) return;
    const explicit = Array.from(root.querySelectorAll<HTMLElement>('button[data-auto-advance="true"]:not(:disabled)'))
      .find((control) => isVisible(control));
    if (explicit) {
      schedule(explicit);
      return;
    }
    if (Date.now() > answerWindowUntilRef.current) return;
    const candidate = Array.from(root.querySelectorAll<HTMLElement>("button:not(:disabled)"))
      .find((control) => isVisible(control) && isForwardControl(control));
    if (candidate) schedule(candidate);
  }, [autoAdvance, clearPending, schedule]);

  useEffect(() => {
    const refresh = () => setAutoAdvance(readGamePlaySettings().autoAdvance);
    refresh();
    window.addEventListener(GAME_PLAY_SETTINGS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(GAME_PLAY_SETTINGS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    answerWindowUntilRef.current = 0;
    clearPending();
  }, [pathname, clearPending]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".games-route-shell");
    if (!root) return;

    const queueScan = () => {
      if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = window.setTimeout(scan, 35);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>("button:not(:disabled)");
      if (!control || !root.contains(control) || control.closest(".game-power-controls")) return;
      if (isForwardControl(control)) {
        clearPending();
        answerWindowUntilRef.current = 0;
        return;
      }
      if (!isLikelyAnswer(control)) return;
      answerWindowUntilRef.current = Date.now() + 2200;
      queueScan();
      window.setTimeout(scan, 120);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!pendingControlRef.current) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".game-power-controls")) return;
      if (target && pendingControlRef.current.contains(target)) return;
      clearPending();
      answerWindowUntilRef.current = 0;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearPending();
        answerWindowUntilRef.current = 0;
      }
    };

    const observer = new MutationObserver(queueScan);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
    root.addEventListener("click", onClick);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    queueScan();

    return () => {
      observer.disconnect();
      root.removeEventListener("click", onClick);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
      clearPending();
    };
  }, [clearPending, scan]);

  return (
    <div
      className="game-flow-director"
      data-game-flow-director="active"
      data-auto-next-enabled={autoAdvance ? "true" : "false"}
      data-auto-next-pending={pending ? "true" : "false"}
      aria-hidden="true"
    >
      {pending && (
        <div
          className="game-flow-countdown"
          style={{ "--game-flow-delay": `${pending.delay}ms` } as React.CSSProperties}
        >
          <span>⚡</span>
          <div>
            <strong>{/see|finish/i.test(pending.label) ? "Finishing…" : "Next challenge…"}</strong>
            <small>Tap anywhere to pause</small>
          </div>
          <i />
        </div>
      )}
    </div>
  );
}
