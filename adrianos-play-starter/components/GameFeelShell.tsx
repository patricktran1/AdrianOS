"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { games } from "@/lib/generated-games";
import { readAdrianProgress } from "@/lib/adrian-progress";

type GameTheme = {
  key: string;
  label: string;
  icon: string;
  accent: string;
  accent2: string;
  accent3: string;
  tokens: string[];
};

type BurstKind = "tap" | "correct" | "retry";
type Burst = { id: number; x: number; y: number; kind: BurstKind };
type Reward = { id: number; label: string; icon: string };
type Celebration = { id: number; title: string; subtitle: string; icon: string };

const DEFAULT_THEME: GameTheme = {
  key: "play",
  label: "ADRIANOS ADVENTURE",
  icon: "✨",
  accent: "#d9ff5b",
  accent2: "#c6b8ff",
  accent3: "#7fdcff",
  tokens: ["✨", "⭐", "💫", "🎯", "🏆", "⚡"],
};

function subjectTheme(
  key: string,
  label: string,
  icon: string,
  accent: string,
  accent2: string,
  accent3: string,
  tokens: string[]
): GameTheme {
  return { key, label, icon, accent, accent2, accent3, tokens };
}

const SUBJECT_THEMES: Record<string, GameTheme> = {
  Logic: subjectTheme("logic", "PUZZLE WORLD", "🧩", "#d9ff5b", "#7fdcff", "#c6b8ff", ["🧩", "🔷", "✨", "💡", "⚡", "🎯"]),
  Memory: subjectTheme("memory", "MEMORY WORLD", "🧠", "#c6b8ff", "#d9ff5b", "#7fdcff", ["🧠", "🃏", "✨", "⭐", "🔮", "💫"]),
  Math: subjectTheme("math", "NUMBER ARCADE", "🧮", "#ffd45f", "#d9ff5b", "#ff8f70", ["➕", "🔢", "⭐", "🪙", "✖️", "🎯"]),
  Reading: subjectTheme("reading", "STORY WORLD", "📚", "#ffcc78", "#e392ff", "#7fdcff", ["📖", "✨", "🦉", "💎", "🔤", "⭐"]),
  Science: subjectTheme("science", "DISCOVERY LAB", "🔬", "#7fdcff", "#d9ff5b", "#8d7dff", ["🔬", "🧪", "⚛️", "✨", "🪐", "🌱"]),
  Geography: subjectTheme("geography", "WORLD EXPLORER", "🌍", "#58e1c1", "#7fdcff", "#ffd45f", ["🌍", "🧭", "🗺️", "✨", "🏔️", "🌊"]),
  History: subjectTheme("history", "TIME PORTAL", "🏛️", "#e8bd71", "#c6b8ff", "#ff8f70", ["🏛️", "📜", "⏳", "✨", "🗿", "🧭"]),
  Civics: subjectTheme("civics", "COMMUNITY QUEST", "⚖️", "#7fdcff", "#ffd45f", "#c6b8ff", ["⚖️", "🏙️", "🤝", "✨", "🗳️", "⭐"]),
  Economics: subjectTheme("economics", "COIN QUEST", "🪙", "#ffd45f", "#78e6a4", "#7fdcff", ["🪙", "💰", "📈", "✨", "🏪", "🎯"]),
  Wellbeing: subjectTheme("wellbeing", "CALM POWER", "🌿", "#8de3b5", "#e392ff", "#7fdcff", ["🌿", "💛", "✨", "🌈", "🫶", "⭐"]),
  Health: subjectTheme("health", "BODY HERO", "❤️", "#ff7f92", "#7fdcff", "#d9ff5b", ["❤️", "🫀", "✨", "🩺", "💪", "⭐"]),
  "Digital Citizenship": subjectTheme("digital", "DIGITAL DEFENDER", "🛡️", "#7fdcff", "#d9ff5b", "#8d7dff", ["🛡️", "💻", "🔐", "✨", "🌐", "⚡"]),
  Music: subjectTheme("music", "SOUND STUDIO", "🎵", "#e392ff", "#7fdcff", "#ffd45f", ["🎵", "🎹", "🎶", "✨", "🥁", "⭐"]),
  Art: subjectTheme("art", "CREATIVE STUDIO", "🎨", "#ff85c8", "#ffd45f", "#7fdcff", ["🎨", "🖌️", "✨", "🌈", "🟣", "⭐"]),
  Engineering: subjectTheme("engineering", "MAKER LAB", "⚙️", "#ff9c61", "#7fdcff", "#d9ff5b", ["⚙️", "🔧", "🏗️", "✨", "🤖", "⚡"]),
  Movement: subjectTheme("movement", "MOVE MODE", "🏃", "#d9ff5b", "#ff9c61", "#7fdcff", ["🏃", "⚡", "✨", "🏅", "💨", "⭐"]),
  "Life Skills": subjectTheme("life", "LIFE QUEST", "🧰", "#ffd45f", "#78e6a4", "#c6b8ff", ["🧰", "🏠", "✨", "✅", "🪙", "⭐"]),
  Environment: subjectTheme("environment", "EARTH GUARDIAN", "🌱", "#78e6a4", "#7fdcff", "#ffd45f", ["🌱", "🌍", "♻️", "✨", "🌳", "💧"]),
  "Learning Skills": subjectTheme("learning", "BRAIN TRAINING", "🧠", "#c6b8ff", "#d9ff5b", "#7fdcff", ["🧠", "💡", "✨", "🎯", "📚", "⭐"]),
  Coding: subjectTheme("coding", "CODE WORLD", "💻", "#7fdcff", "#d9ff5b", "#e392ff", ["💻", "🤖", "⚡", "✨", "🧩", "🌐"]),
  Creativity: subjectTheme("creativity", "IMAGINATION LAB", "✨", "#ff85c8", "#ffd45f", "#c6b8ff", ["✨", "🌈", "💡", "🎨", "⭐", "🚀"]),
};

const SPECIAL_THEMES: Record<string, GameTheme> = {
  "story-expedition": subjectTheme("story", "LIVING STORYBOOK", "📚", "#ffcf70", "#e392ff", "#7fdcff", ["📖", "🦉", "🐉", "💎", "✨", "🎗️"]),
  "daily-adventure-remix": subjectTheme("daily", "TODAY'S POWER RUN", "⚡", "#d9ff5b", "#e392ff", "#7fdcff", ["⚡", "🎯", "💎", "✨", "🔥", "🏆"]),
  "dino-time-rescue": subjectTheme("dino", "DINO TIME RESCUE", "🦖", "#ffc857", "#7ee081", "#ff8f70", ["🦖", "🦕", "🦴", "🌿", "🥚", "✨"]),
  "robot-rescue-city": subjectTheme("robot", "ROBOT RESCUE CITY", "🤖", "#7fdcff", "#d9ff5b", "#8d7dff", ["🤖", "⚙️", "🔋", "⚡", "🏙️", "✨"]),
  "rainbow-rocket-park": subjectTheme("rainbow", "RAINBOW ROCKET PARK", "🌈", "#ffd95b", "#ff85c8", "#7fdcff", ["🌈", "🚀", "⭐", "☁️", "🎈", "✨"]),
  "space-station-sigma": subjectTheme("space", "SPACE STATION SIGMA", "🪐", "#8d7dff", "#7fdcff", "#e392ff", ["🪐", "🚀", "🛰️", "⭐", "🌙", "✨"]),
  "mystery-temple": subjectTheme("temple", "MYSTERY TEMPLE", "🏛️", "#f0c36a", "#e392ff", "#65d6b2", ["🏛️", "🔑", "💎", "🗿", "✨", "🧭"]),
  "cyber-city-five": subjectTheme("cyber", "CYBER CITY FIVE", "🌐", "#63e6ff", "#d9ff5b", "#e392ff", ["🌐", "💻", "🛡️", "⚡", "🤖", "✨"]),
  "mastery-rescue-lab": subjectTheme("rescue", "MASTERY RESCUE LAB", "🛟", "#7fdcff", "#d9ff5b", "#c6b8ff", ["🛟", "🧠", "🔧", "✨", "💡", "⚡"]),
  "mastery-lab": subjectTheme("rescue", "MASTERY LAB", "🧠", "#7fdcff", "#d9ff5b", "#c6b8ff", ["🧠", "🔧", "💡", "✨", "⚡", "🏆"]),
  "family-quest-party": subjectTheme("party", "FAMILY QUEST PARTY", "🎉", "#ff85c8", "#ffd45f", "#7fdcff", ["🎉", "🎈", "🏆", "✨", "🎊", "⭐"]),
  "adaptive-boss-arena": subjectTheme("boss", "ADAPTIVE BOSS ARENA", "👾", "#ff7f92", "#e392ff", "#ffd45f", ["👾", "⚔️", "🔥", "⚡", "🏆", "✨"]),
  "word-forge-studio": subjectTheme("forge", "WORD FORGE STUDIO", "⚒️", "#ff9c61", "#ffd45f", "#7fdcff", ["⚒️", "🔤", "🔥", "✨", "📚", "⭐"]),
};

function slugFromPath(pathname: string): string {
  const marker = "/games/";
  const start = pathname.indexOf(marker);
  if (start < 0) return "";
  return decodeURIComponent(pathname.slice(start + marker.length).split("/")[0] ?? "");
}

function themeFor(slug: string): GameTheme {
  const special = SPECIAL_THEMES[slug];
  if (special) return special;
  const game = games.find((item) => item.slug === slug);
  return SUBJECT_THEMES[game?.subject ?? ""] ?? DEFAULT_THEME;
}

function addTemporaryClass(element: HTMLElement, className: string, duration: number) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), duration);
}

export default function GameFeelShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const slug = slugFromPath(pathname);
  const theme = useMemo(() => themeFor(slug), [slug]);
  const rootRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [progressReady, setProgressReady] = useState(false);

  const later = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timers.current.push(timer);
    return timer;
  }, []);

  const spawnBurst = useCallback((kind: BurstKind, x: number, y: number) => {
    const id = nextId.current++;
    setBursts((items) => [...items.slice(-8), { id, kind, x, y }]);
    later(() => setBursts((items) => items.filter((item) => item.id !== id)), 850);
  }, [later]);

  const pushReward = useCallback((label: string, icon: string) => {
    const id = nextId.current++;
    setRewards((items) => [...items.slice(-3), { id, label, icon }]);
    later(() => setRewards((items) => items.filter((item) => item.id !== id)), 1800);
  }, [later]);

  const celebrate = useCallback((title: string, subtitle: string) => {
    const id = nextId.current++;
    setCelebration({ id, title, subtitle, icon: theme.icon });
    later(() => setCelebration((current) => current?.id === id ? null : current), 2300);
  }, [later, theme.icon]);

  useEffect(() => () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>('button:not(:disabled), a[href], [role="button"]');
      if (!control || !root.contains(control)) return;

      const rect = control.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const answer = control.dataset.correct;

      if (answer === "true") {
        addTemporaryClass(control, "game-feel-correct", 700);
        spawnBurst("correct", x, y);
      } else if (answer === "false") {
        addTemporaryClass(control, "game-feel-retry", 620);
        spawnBurst("retry", x, y);
      } else {
        addTemporaryClass(control, "game-feel-pressed", 260);
        spawnBurst("tap", x, y);
      }
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [spawnBurst]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const remembered = new WeakMap<Element, string>();

    const animateFeedback = (element: Element | null) => {
      const status = element?.closest<HTMLElement>('[role="status"], .win-panel, [aria-live]');
      if (!status || !root.contains(status) || status.classList.contains("game-feel-live")) return;
      const text = status.textContent?.trim() ?? "";
      if (!text || remembered.get(status) === text) return;
      remembered.set(status, text);
      addTemporaryClass(status, "game-feel-feedback-pop", 520);
    };

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const element = record.target instanceof Element ? record.target : record.target.parentElement;
        animateFeedback(element);
        for (const node of record.addedNodes) {
          if (node instanceof Element) animateFeedback(node);
        }
      }
    });

    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let previous = readAdrianProgress();
    setProgressReady(true);

    const refresh = () => {
      const next = readAdrianProgress();
      const previousGame = previous.games[slug];
      const nextGame = next.games[slug];
      const completionGain = (nextGame?.completions ?? 0) - (previousGame?.completions ?? 0);
      const xpGain = next.xp - previous.xp;
      const coinGain = next.coins - previous.coins;

      if (completionGain > 0) {
        celebrate("Quest clear!", "Your skills powered up and a new win was saved.");
      }
      if (xpGain > 0) pushReward(`+${xpGain} XP`, "⚡");
      if (coinGain > 0) pushReward(`+${coinGain} coins`, "🪙");
      previous = next;
    };

    const reset = () => { previous = readAdrianProgress(); };
    window.addEventListener("adrianos-progress-updated", refresh);
    window.addEventListener("adrianos-family-updated", reset);
    return () => {
      setProgressReady(false);
      window.removeEventListener("adrianos-progress-updated", refresh);
      window.removeEventListener("adrianos-family-updated", reset);
    };
  }, [celebrate, pushReward, slug]);

  const customStyle = {
    "--game-accent": theme.accent,
    "--game-accent-2": theme.accent2,
    "--game-accent-3": theme.accent3,
  } as CSSProperties;

  const liveMessage = celebration?.title ?? rewards.at(-1)?.label ?? "";

  return (
    <div
      ref={rootRef}
      className={`games-route-shell game-theme-${theme.key}`}
      data-game-feel-shell="active"
      data-game-feel-ready={progressReady ? "true" : "false"}
      data-game-slug={slug}
      data-game-theme={theme.key}
      style={customStyle}
    >
      <div className="game-feel-ambient" aria-hidden="true">
        <div className="game-feel-glow game-feel-glow-one" />
        <div className="game-feel-glow game-feel-glow-two" />
        <div className="game-feel-orbit" />
        {theme.tokens.map((token, index) => (
          <span key={`${token}-${index}`} className={`game-feel-token game-feel-token-${index + 1}`}>
            {token}
          </span>
        ))}
      </div>

      <div className="game-feel-world-ribbon" aria-hidden="true">
        <span>{theme.icon}</span>
        <strong>{theme.label}</strong>
      </div>

      {children}

      <div className="game-feel-effects" aria-hidden="true">
        {bursts.map((burst) => (
          <span
            key={burst.id}
            className={`game-feel-burst game-feel-burst-${burst.kind}`}
            style={{ left: burst.x, top: burst.y }}
          >
            <i>✦</i><i>●</i><i>★</i><i>✦</i><i>●</i><i>★</i>
          </span>
        ))}

        <div className="game-feel-reward-stack">
          {rewards.map((reward) => (
            <div key={reward.id} className="game-feel-reward">
              <span>{reward.icon}</span>
              <strong>{reward.label}</strong>
            </div>
          ))}
        </div>

        {celebration && (
          <div className="game-feel-celebration">
            <div className="game-feel-celebration-ring" />
            <span className="game-feel-celebration-icon">{celebration.icon}</span>
            <strong>{celebration.title}</strong>
            <small>{celebration.subtitle}</small>
          </div>
        )}
      </div>

      <div className="game-feel-live" aria-live="polite" aria-atomic="true">{liveMessage}</div>
    </div>
  );
}
