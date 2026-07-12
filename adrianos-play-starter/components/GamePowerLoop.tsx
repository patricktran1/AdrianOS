"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { games } from "@/lib/generated-games";
import { readAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import {
  ADRIAN_PRIZE_COLLECTIONS,
  prizeProgressForGrade,
  totalGameCompletions,
} from "@/lib/adrian-prize-collections";

type PlaySettings = {
  sfx: boolean;
  haptics: boolean;
};

type FeedbackKind = "tap" | "correct" | "retry" | "complete" | "level";

type PowerMoment = {
  id: number;
  icon: string;
  eyebrow: string;
  title: string;
  copy: string;
};

type SafariAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const SETTINGS_KEY = "adrianos-play-settings-v1";
const DEFAULT_SETTINGS: PlaySettings = { sfx: true, haptics: true };

const SUBJECT_FREQUENCIES: Record<string, number> = {
  Logic: 392,
  Memory: 349,
  Math: 440,
  Reading: 392,
  Science: 523,
  Geography: 330,
  History: 294,
  Civics: 370,
  Economics: 440,
  Wellbeing: 330,
  Health: 415,
  "Digital Citizenship": 466,
  Music: 494,
  Art: 415,
  Engineering: 370,
  Movement: 440,
  "Life Skills": 349,
  Environment: 330,
  "Learning Skills": 392,
  Coding: 466,
  Creativity: 415,
};

function slugFromPath(pathname: string): string {
  const marker = "/games/";
  const start = pathname.indexOf(marker);
  if (start < 0) return "";
  return decodeURIComponent(pathname.slice(start + marker.length).split("/")[0] ?? "");
}

function safeSettings(value: unknown): PlaySettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const raw = value as Partial<PlaySettings>;
  return {
    sfx: typeof raw.sfx === "boolean" ? raw.sfx : DEFAULT_SETTINGS.sfx,
    haptics: typeof raw.haptics === "boolean" ? raw.haptics : DEFAULT_SETTINGS.haptics,
  };
}

export default function GamePowerLoop() {
  const pathname = usePathname();
  const slug = slugFromPath(pathname);
  const game = useMemo(() => games.find((item) => item.slug === slug), [slug]);
  const baseFrequency = SUBJECT_FREQUENCIES[game?.subject ?? ""] ?? 392;
  const { activeProfile } = useFamilyProfiles();
  const grade = readProfileGrade(activeProfile);
  const [settings, setSettings] = useState<PlaySettings>(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [supportsHaptics, setSupportsHaptics] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<FeedbackKind | "">("");
  const [moment, setMoment] = useState<PowerMoment | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const streakRef = useRef(0);
  const momentIdRef = useRef(1);
  const momentTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SETTINGS_KEY);
      if (stored) setSettings(safeSettings(JSON.parse(stored)));
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
    setSupportsHaptics(typeof navigator.vibrate === "function");
    setSettingsReady(true);
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, settingsReady]);

  useEffect(() => () => {
    if (momentTimerRef.current !== null) window.clearTimeout(momentTimerRef.current);
    if (audioRef.current && audioRef.current.state !== "closed") {
      void audioRef.current.close();
    }
  }, []);

  const ensureAudio = useCallback((): AudioContext | null => {
    if (!settings.sfx) return null;
    const AudioContextClass = window.AudioContext ??
      (window as SafariAudioWindow).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioRef.current || audioRef.current.state === "closed") {
      audioRef.current = new AudioContextClass();
    }
    if (audioRef.current.state === "suspended") void audioRef.current.resume();
    return audioRef.current;
  }, [settings.sfx]);

  const playFeedback = useCallback((kind: FeedbackKind, power = 1) => {
    const context = ensureAudio();
    if (!context) return;

    const patterns: Record<FeedbackKind, number[]> = {
      tap: [baseFrequency * .75],
      correct: [baseFrequency, baseFrequency * 1.25, baseFrequency * 1.5],
      retry: [baseFrequency * .55, baseFrequency * .46],
      complete: [baseFrequency, baseFrequency * 1.25, baseFrequency * 1.5, baseFrequency * 2],
      level: [baseFrequency, baseFrequency * 1.33, baseFrequency * 1.67, baseFrequency * 2],
    };
    const notes = patterns[kind];
    const now = context.currentTime;
    const spacing = kind === "tap" ? .02 : .075;
    const duration = kind === "retry" ? .14 : kind === "tap" ? .07 : .22;
    const volume = Math.min(.055, .022 + power * .004);

    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * spacing;
      oscillator.type = kind === "retry" ? "triangle" : kind === "tap" ? "sine" : "square";
      oscillator.frequency.setValueAtTime(Math.min(1800, frequency), start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + .02);
    });
  }, [baseFrequency, ensureAudio]);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (!settings.haptics || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(pattern);
  }, [settings.haptics]);

  const showMoment = useCallback((nextMoment: Omit<PowerMoment, "id">) => {
    const id = momentIdRef.current++;
    setMoment({ ...nextMoment, id });
    if (momentTimerRef.current !== null) window.clearTimeout(momentTimerRef.current);
    momentTimerRef.current = window.setTimeout(() => {
      setMoment((current) => current?.id === id ? null : current);
    }, 3600);
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".games-route-shell");
    if (!root) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>('button:not(:disabled), a[href], [role="button"]');
      if (!control || !root.contains(control) || control.closest(".game-power-controls")) return;

      const answer = control.dataset.correct;
      if (answer === "true") {
        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        setLastFeedback("correct");
        playFeedback("correct", Math.min(nextStreak, 6));
        vibrate(nextStreak >= 3 ? [14, 18, 28] : [12, 16, 20]);
        return;
      }

      if (answer === "false") {
        streakRef.current = 0;
        setStreak(0);
        setLastFeedback("retry");
        playFeedback("retry");
        vibrate(18);
        return;
      }

      setLastFeedback("tap");
      playFeedback("tap");
      vibrate(8);
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [playFeedback, vibrate]);

  useEffect(() => {
    let previous = readAdrianProgress();

    const refresh = () => {
      const next = readAdrianProgress();
      const previousClears = totalGameCompletions(previous);
      const nextClears = totalGameCompletions(next);
      const completionGain = nextClears - previousClears;
      const levelGain = next.level - previous.level;

      if (completionGain > 0) {
        const collection = ADRIAN_PRIZE_COLLECTIONS[grade];
        const prizeProgress = prizeProgressForGrade(next, grade);
        const earnedCollectionPrize = nextClears <= collection.prizes.length
          ? prizeProgress.latestPrize
          : null;
        const icon = earnedCollectionPrize?.emoji ?? "⭐";
        const title = levelGain > 0 && earnedCollectionPrize
          ? `Level ${next.level} + ${earnedCollectionPrize.name}!`
          : levelGain > 0
            ? `Level ${next.level} reached!`
            : earnedCollectionPrize
              ? `${earnedCollectionPrize.name} unlocked!`
              : "Champion star earned!";
        const copy = earnedCollectionPrize
          ? `${earnedCollectionPrize.name} joined the ${collection.title}.`
          : `The ${collection.title} is complete, so this victory became champion star ${prizeProgress.prestige}.`;

        showMoment({
          icon,
          eyebrow: levelGain > 0 ? "POWER-UP + PRIZE" : "PRIZE VAULT UNLOCK",
          title,
          copy,
        });
        setLastFeedback(levelGain > 0 ? "level" : "complete");
        playFeedback(levelGain > 0 ? "level" : "complete", 5);
        vibrate([28, 34, 55]);
        streakRef.current = 0;
        setStreak(0);
      } else if (levelGain > 0) {
        showMoment({
          icon: "⚡",
          eyebrow: "POWER LEVEL UP",
          title: `Level ${next.level} reached!`,
          copy: "New learning power is online across AdrianOS.",
        });
        setLastFeedback("level");
        playFeedback("level", 5);
        vibrate([28, 34, 55]);
      }

      previous = next;
    };

    const reset = () => { previous = readAdrianProgress(); };
    window.addEventListener("adrianos-progress-updated", refresh);
    window.addEventListener("adrianos-family-updated", reset);
    return () => {
      window.removeEventListener("adrianos-progress-updated", refresh);
      window.removeEventListener("adrianos-family-updated", reset);
    };
  }, [grade, playFeedback, showMoment, vibrate]);

  function toggleSetting(key: keyof PlaySettings) {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <>
      <div
        className={`game-power-controls${panelOpen ? " is-open" : ""}`}
        data-game-power-loop="active"
        data-power-ready={settingsReady ? "true" : "false"}
        data-sfx-enabled={settings.sfx ? "true" : "false"}
        data-haptics-enabled={settings.haptics ? "true" : "false"}
        data-power-streak={streak}
        data-last-feedback={lastFeedback}
      >
        <button
          type="button"
          className="game-power-trigger"
          onClick={() => setPanelOpen((open) => !open)}
          aria-label="Play settings"
          aria-expanded={panelOpen}
        >
          <span aria-hidden="true">{settings.sfx ? "🔊" : "🔇"}</span>
          <strong>PLAY</strong>
        </button>

        {panelOpen && (
          <div className="game-power-panel" aria-label="Play settings panel">
            <span className="game-power-panel-label">GAME POWER</span>
            <button
              type="button"
              onClick={() => toggleSetting("sfx")}
              aria-pressed={settings.sfx}
            >
              <span aria-hidden="true">{settings.sfx ? "🔊" : "🔇"}</span>
              <span><strong>Sound effects</strong><small>{settings.sfx ? "On" : "Off"}</small></span>
            </button>
            <button
              type="button"
              onClick={() => toggleSetting("haptics")}
              aria-pressed={settings.haptics}
              disabled={!supportsHaptics}
            >
              <span aria-hidden="true">📳</span>
              <span><strong>Haptics</strong><small>{supportsHaptics ? (settings.haptics ? "On" : "Off") : "Not supported"}</small></span>
            </button>
          </div>
        )}
      </div>

      {streak >= 2 && (
        <div className="game-power-streak" aria-hidden="true">
          <span>⚡</span>
          <strong>{streak}× POWER STREAK</strong>
          <i style={{ width: `${Math.min(100, streak * 16)}%` }} />
        </div>
      )}

      {moment && (
        <div
          key={moment.id}
          className="game-power-moment"
          data-power-moment="active"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="game-power-moment-rays" aria-hidden="true" />
          <span className="game-power-moment-icon">{moment.icon}</span>
          <small>{moment.eyebrow}</small>
          <strong>{moment.title}</strong>
          <p>{moment.copy}</p>
        </div>
      )}
    </>
  );
}
