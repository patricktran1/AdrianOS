"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_GAME_PLAY_SETTINGS,
  GAME_PLAY_SETTINGS_EVENT,
  readGamePlaySettings,
  type GamePlaySettings,
} from "@/lib/game-play-settings";

/**
 * Shared synthesized audio for AdrianOS.
 *
 * Individual games each grew their own oscillator code. This is the single
 * restrained voice for shell-level feedback: short, quiet, pitched tones that
 * confirm an action rather than decorate it.
 *
 * It honours the child's sound setting and the operating system's
 * reduced-motion preference, which children and adults with vestibular or
 * sensory sensitivities commonly use as a general "less stimulation" signal.
 */

export type SoundCue =
  | "tap"
  | "travel"
  | "reveal"
  | "reward"
  | "back";

type CueShape = {
  type: OscillatorType;
  notes: number[];
  step: number;
  duration: number;
  volume: number;
};

const CUES: Record<SoundCue, CueShape> = {
  tap: { type: "sine", notes: [660], step: 0, duration: 0.07, volume: 0.055 },
  travel: { type: "triangle", notes: [523, 784], step: 0.06, duration: 0.12, volume: 0.06 },
  reveal: { type: "sine", notes: [784, 988], step: 0.07, duration: 0.14, volume: 0.05 },
  reward: { type: "triangle", notes: [523, 659, 784, 1047], step: 0.075, duration: 0.16, volume: 0.06 },
  back: { type: "sine", notes: [440, 330], step: 0.06, duration: 0.1, volume: 0.045 },
};

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Sound and haptics that respect the child's settings and OS preferences. */
export function useAdrianSound() {
  const [settings, setSettings] = useState<GamePlaySettings>(DEFAULT_GAME_PLAY_SETTINGS);
  const [reducedMotion, setReducedMotion] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const sync = () => setSettings(readGamePlaySettings());
    sync();
    window.addEventListener(GAME_PLAY_SETTINGS_EVENT, sync);
    return () => window.removeEventListener(GAME_PLAY_SETTINGS_EVENT, sync);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => () => {
    void contextRef.current?.close();
    contextRef.current = null;
  }, []);

  const ensureContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!contextRef.current) {
      try {
        contextRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    const context = contextRef.current;
    // Browsers suspend audio until a gesture; every cue here follows one.
    if (context.state === "suspended") void context.resume();
    return context;
  }, []);

  const play = useCallback((cue: SoundCue) => {
    if (!settings.sfx) return;
    const context = ensureContext();
    if (!context) return;
    const shape = CUES[cue];
    const start = context.currentTime;
    shape.notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + index * shape.step;
      oscillator.type = shape.type;
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(shape.volume, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + shape.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + shape.duration + 0.02);
    });
  }, [ensureContext, settings.sfx]);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (!settings.haptics) return;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Vibration is a nicety; never let it interrupt play.
    }
  }, [settings.haptics]);

  return { play, vibrate, reducedMotion, settings };
}
