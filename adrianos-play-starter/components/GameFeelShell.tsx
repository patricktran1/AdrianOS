"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
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

type Burst = {
  id: number;
  x: number;
  y: number;
  kind: BurstKind;
};

type Reward = {
  id: number;
  label: string;
  icon: string;
};

type Celebration = {
  id: number;
  title: string;
  subtitle: string;
  icon: string;
};

const DEFAULT_THEME: GameTheme = {
  key: "play",
  label: "ADRIANOS ADVENTURE",
  icon: "✨",
  accent: "#d9ff5b",
  accent2: "#c6b8ff",
  accent3: "#7fdcff",
  tokens: ["✨", "⭐", "💫", "🎯", "🏆", "⚡"],
};

const SUBJECT_THEMES: Record<string, GameTheme> = {
  Logic: { key: "logic", label: "PUZZLE WORLD", icon: "🧩", accent: "#d9ff5b", accent2: "#7fdcff", accent3: "#c6b8ff", tokens: ["🧩", "🔷", "✨", "💡", "⚡", "🎯"] },
  Memory: { key: "memory", label: "MEMORY WORLD", icon: "🧠", accent: "#c6b8ff", accent2: "#d9ff5b", accent3: "#7fdcff", tokens: ["🧠", "🃏", "✨", "⭐", "🔮", "💫"] },
  Math: { key: "math", label: "NUMBER ARCADE", icon: "🧮", accent: "#ffd45f", accent2: "#d9ff5b", accent3: "#ff8f70", tokens: ["➕", "🔢", "⭐", "🪙", "✖️", "🎯"] },
  Reading: { key: "reading", label: "STORY WORLD", icon: "📚", accent: "#ffcc78", accent2: "#e392ff", accent3: "#7fdcff", tokens: ["📖", "✨", "🦉", "💎", "🔤", "⭐"] },
  Science: { key: "science", label: "DISCOVERY LAB", icon: "🔬", accent: "#7fdcff", accent2: "#d9ff5b", accent3: "#8d7dff", tokens: ["🔬", "🧪", "⚛️", "✨", "🪐", "🌱"] },
  Geography: { key: "geography", label: "WORLD EXPLORER", icon: "🌍", accent: "#58e1c1", accent2: "#7fdcff", accent3: "#ffd45f", tokens: ["🌍", "🧭", "🗺️", "✨", "🏔️", "🌊"] },
  History: { key: "history", label: "TIME PORTAL", icon: "🏛️", accent: "#e8bd71", accent2: "#c6b8ff", accent3: "#ff8f70", tokens: ["🏛️", "📜", "⏳", "✨", "🗿", "🧭"] },
  Civics: { key: "civics", label: "COMMUNITY QUEST", icon: "⚖️", accent: "#7fdcff", accent2: "#ffd45f", accent3: "#c6b8ff", tokens: ["⚖️", "🏙️", "🤝", "✨", "🗳️", "⭐"] },
  Economics: { key: "economics", label: "COIN QUEST", icon: "🪙", accent: "#ffd45f", accent2: "#78e6a4", accent3: "#7fdcff", tokens: ["🪙", "💰", "📈", "✨", "🏪", "🎯"] },
  Wellbeing: { key: "wellbeing", label: "CALM POWER", icon: "🌿", accent: "#8de3b5", accent2: "#e392ff", accent3: "#7fdcff", tokens: ["🌿", "💛", "✨", "🌈", "🫶", "⭐"] },
  Health: { key: "health", label: "BODY HERO", icon: "❤️", accent: "#ff7f92", accent2: "#7fdcff", accent3: "#d9ff5b", tokens: ["❤️", "🫀", "✨", "🩺", "💪", "⭐"] },
  "Digital Citizenship": { key: "digital", label: "DIGITAL DEFENDER", icon: "🛡️", accent: "#7fdcff", accent2: "#d9ff5b", accent3: "#8d7dff", tokens: ["🛡️", "💻", "🔐", "✨", "🌐", "⚡"] },
  Music: { key: "music", label: "SOUND STUDIO", icon: "🎵", accent: "#e392ff", accent2: "#7fdcff", accent3: "#ffd45f", tokens: ["🎵", "🎹", "🎶", "✨", "🥁", "⭐"] },
  Art: { key: "art", label: "CREATIVE STUDIO", icon: "🎨", accent: "#ff85c8", accent2: "#ffd45f", accent3: "#7fdcff", tokens: ["🎨", "🖌️", "✨", "🌈", "🟣", "⭐"] },
  Engineering: { key: "engineering", label: "MAKER LAB", icon: "⚙️", accent: "#ff9c61", accent2: "#7fdcff", accent3: "#d9ff5b", tokens: ["⚙️", "🔧", "🏗️", "✨", "🤖", "⚡"] },
  Movement: { key: "movement", label: "MOVE MODE", icon: "🏃", accent: "#d9ff5b", accent2: "#ff9c61", accent3: "#7fdcff", tokens: ["🏃", "⚡", "✨", "🏅", "💨", "⭐"] },
  "Life Skills": { key: "life", label: "LIFE QUEST", icon: "🧰", accent: "#ffd45f", accent2: "#78e6a4", accent3: "#c6b8ff", tokens: ["🧰", "🏠", "✨", "✅", "🪙", "⭐"] },
  Environment: { key: "environment", label: "EARTH GUARDIAN", icon: "🌱", accent: "#78e6a4", accent2: "#7fdcff", accent3: "#ffd45f", tokens: ["🌱", "🌍", "♻️", "✨", "🌳", "💧"] },
  "Learning Skills": { key: "learning", label: "BRAIN TRAINING", icon: "🧠", accent: "#c6b8ff", accent2: "#d9ff5b", accent3: "#7fdcff", tokens: ["🧠", "💡", "✨", "🎯", "📚", "⭐"] },
  Coding: { key: "coding", label: "CODE WORLD", icon: "💻", accent: "#7fdcff", accent2: "#d9ff5b", accent3: "#e392ff", tokens: ["💻", "🤖", "⚡", "✨", "🧩", "🌐"] },
  Creativity: { key: "creativity", label: "IMAGINATION LAB", icon: "✨", accent: "#ff85c8", accent2: "#ffd45f", accent3: "#c6b8ff", tokens: ["✨", "🌈", "💡", "🎨", "⭐", "🚀"] },
};

const SPECIAL_THEMES: Record<string, GameTheme> = {
  "story-expedition": { key: "story", label: "LIVING STORYBOOK", icon: "📚", accent: "#ffcf70", accent2: "#e392ff", accent3: "#7fdcff", tokens: ["📖", "🦉", "🐉", "💎", "✨", "🎗️"] },
  "daily-adventure-remix": { key: "daily", label: "TODAY'S POWER RUN", icon: "⚡", accent: "#d9ff5b", accent2: "#e392ff", accent3: "#7fdcff", tokens: ["⚡", "🎯", "💎", "✨", "🔥", "🏆"] },
  "dino-time-rescue": { key: "dino", label: "DINO TIME RESCUE", icon: "🦖", accent: "#ffc857", accent2: "#7ee081", accent3: "#ff8f70", tokens: ["🦖", "🦕", "🦴", "🌿", "🥚", "✨"] },
  "robot-rescue-city": { key: "robot", label: "ROBOT RESCUE CITY", icon: "🤖", accent: "#7fdcff", accent2: "#d9ff5b", accent3: "#8d7dff", tokens: ["🤖", "⚙️", "🔋", "⚡", "🏙️", "✨"] },
  "rainbow-rocket-park": { key: "rainbow", label: "RAINBOW ROCKET PARK", icon: "🌈", accent: "#ffd95b", accent2: "#ff85c8", accent3: "#7fdcff", tokens: ["🌈", "🚀", "⭐", "☁️", "🎈", "✨"] },
  "space-station-sigma": { key: "space", label: "SPACE STATION SIGMA", icon: "🪐", accent: "#8d7dff", accent2: "#7fdcff", accent3: "#e392ff", tokens: ["🪐", "🚀", "🛰️", "⭐", "🌙", "✨"] },
  "mystery-temple": { key: "temple", label: "MYSTERY TEMPLE", icon: "🏛️", accent: "#f0c36a", accent2: "#e392ff", accent3: "#65d6b2", tokens: ["🏛️", "🔑", "💎", "🗿", "✨", "🧭"] },
  "cyber-city-five": { key: "cyber", label: "CYBER CITY FIVE", icon: "🌐", accent: "#63e6ff", accent2: "#d9ff5b", accent3: "#e392ff", tokens: ["🌐", "💻", "🛡️", "⚡", "🤖", "✨"] },
  "mastery-rescue-lab": { key: "rescue", label: "MASTERY RESCUE LAB", icon: "🛟", accent: "#7fdcff", accent2: "#d9ff5b", accent3: "#c6b8ff", tokens: ["🛟", "🧠", "🔧", "✨", "💡", "⚡"] },
  "mastery-lab": { key: "rescue", label: "MASTERY LAB", icon: "🧠", accent: "#7fdcff", accent2: "#d9ff5b", accent3: "#c6b8ff", tokens: ["🧠", "🔧", "💡", "✨", "⚡", "🏆"] },
  "family-quest-party": { key: "party", label: "FAMILY QUEST PARTY", icon: "🎉", accent: "#ff85c8", accent2: "#ffd45f", accent3: "#7fdcff", tokens: ["🎉", "🎈", "🏆", "✨", "🎊", "⭐"] },
  "adaptive-boss-arena": { key: "boss", label: "ADAPTIVE BOSS ARENA", icon: "👾", accent: "#ff7f92", accent2: "#e392ff", accent3: "#ffd45f", tokens: ["👾", "⚔️", "🔥", "⚡", "🏆", "✨"] },
  "word-forge-studio": { key: "forge", label: "WORD FORGE STUDIO", icon: "⚒️", accent: "#ff9c61", accent2: "#ffd45f", accent3: "#7fdcff", tokens: ["⚒️", "🔤", "🔥", "✨", "📚", "⭐"] },
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
      if (!status || !root.contains(status)) return;
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
      data-game-slug={slug}
      data-game-theme={theme.key}
      style={customStyle}
    >
      <div className="game-feel-ambient" aria-hidden="true">
        <div className="game-feel-glow game-feel-glow-one" />
        <div className="game-feel-glow game-feel-glow-two" />
        <div className="game-feel-orbit" />
        {theme.tokens.map((token, index) => (
          <span
            key={`${token}-${index}`}
            className={`game-feel-token game-feel-token-${index + 1}`}
          >
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

      <div className="game-feel-live" role="status" aria-live="polite">{liveMessage}</div>
    </div>
  );
}
