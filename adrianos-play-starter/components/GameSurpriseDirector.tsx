"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { games } from "@/lib/generated-games";

type SurpriseKind =
  | "meteor"
  | "treasure"
  | "turbo"
  | "portal"
  | "rainbow"
  | "dino"
  | "robot"
  | "ocean"
  | "comeback";

type SurpriseDefinition = {
  kind: SurpriseKind;
  icon: string;
  eyebrow: string;
  title: string;
  copy: string;
  tokens: string[];
};

type ActiveSurprise = SurpriseDefinition & {
  id: number;
  comeback: boolean;
};

const SURPRISES: SurpriseDefinition[] = [
  {
    kind: "meteor",
    icon: "☄️",
    eyebrow: "WORLD EVENT",
    title: "METEOR SHOWER!",
    copy: "Your streak lit up the whole adventure.",
    tokens: ["☄️", "✦", "⭐", "☄️", "✦", "⭐"],
  },
  {
    kind: "treasure",
    icon: "💎",
    eyebrow: "SECRET FOUND",
    title: "TREASURE BURST!",
    copy: "A hidden vault cracked open with sparkle power.",
    tokens: ["💎", "🪙", "✦", "💎", "🪙", "✦"],
  },
  {
    kind: "turbo",
    icon: "⚡",
    eyebrow: "POWER SURGE",
    title: "TURBO WORLD!",
    copy: "The whole game just shifted into lightning mode.",
    tokens: ["⚡", "✦", "🔥", "⚡", "✦", "🔥"],
  },
  {
    kind: "portal",
    icon: "🌀",
    eyebrow: "SECRET WORLD",
    title: "PORTAL POP!",
    copy: "A surprise dimension flashed across the screen.",
    tokens: ["🌀", "✨", "🔮", "🌀", "✨", "🔮"],
  },
  {
    kind: "rainbow",
    icon: "🌈",
    eyebrow: "COLOR POWER",
    title: "RAINBOW STORM!",
    copy: "Every smart move added another color to the sky.",
    tokens: ["🌈", "⭐", "✨", "🌈", "⭐", "✨"],
  },
  {
    kind: "dino",
    icon: "🦖",
    eyebrow: "WILD EVENT",
    title: "DINO STAMPEDE!",
    copy: "Your answer shook the ground with prehistoric power.",
    tokens: ["🦖", "🦕", "🌿", "🦖", "🦕", "🌿"],
  },
  {
    kind: "robot",
    icon: "🤖",
    eyebrow: "SYSTEM BOOST",
    title: "ROBOT OVERDRIVE!",
    copy: "The adventure systems powered up all at once.",
    tokens: ["🤖", "⚙️", "⚡", "🤖", "⚙️", "⚡"],
  },
  {
    kind: "ocean",
    icon: "🐙",
    eyebrow: "DEEP-SEA EVENT",
    title: "OCEAN POP!",
    copy: "A wave of curious creatures joined the celebration.",
    tokens: ["🐙", "🐠", "🌊", "🐙", "🐠", "🌊"],
  },
];

const COMEBACK: SurpriseDefinition = {
  kind: "comeback",
  icon: "🚀",
  eyebrow: "COMEBACK EVENT",
  title: "ROCKET RECOVERY!",
  copy: "A tricky turn made the next smart move even brighter.",
  tokens: ["🚀", "💫", "⭐", "🚀", "💫", "⭐"],
};

const SUBJECT_OFFSETS: Record<string, number> = {
  Math: 2,
  Reading: 3,
  Science: 0,
  Logic: 6,
  Memory: 3,
  Coding: 6,
  Engineering: 6,
  Art: 4,
  Music: 4,
  Creativity: 4,
  Geography: 7,
  Environment: 7,
  History: 1,
};

function slugFromPath(pathname: string): string {
  const marker = "/games/";
  const start = pathname.indexOf(marker);
  if (start < 0) return "";
  return decodeURIComponent(pathname.slice(start + marker.length).split("/")[0] ?? "");
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function thresholdFor(eventCount: number): number {
  return eventCount === 0 ? 2 : 3;
}

function chooseSurprise(slug: string, subject: string, eventNumber: number, comeback: boolean): SurpriseDefinition {
  if (comeback) return COMEBACK;
  const offset = SUBJECT_OFFSETS[subject] ?? 0;
  const index = (stableHash(`${slug}:${eventNumber}`) + offset) % SURPRISES.length;
  return SURPRISES[index];
}

export default function GameSurpriseDirector() {
  const pathname = usePathname();
  const slug = slugFromPath(pathname);
  const game = useMemo(() => games.find((item) => item.slug === slug), [slug]);
  const subject = game?.subject ?? "Adventure";
  const [ready, setReady] = useState(false);
  const [charge, setCharge] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [active, setActive] = useState<ActiveSurprise | null>(null);
  const chargeRef = useRef(0);
  const eventCountRef = useRef(0);
  const comebackRef = useRef(false);
  const nextIdRef = useRef(1);
  const eventTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ control: Element | null; at: number }>({ control: null, at: 0 });

  const clearWorldClass = useCallback(() => {
    const root = document.querySelector<HTMLElement>(".games-route-shell");
    if (!root) return;
    root.classList.remove("game-surprise-world-active");
    for (const definition of [...SURPRISES, COMEBACK]) {
      root.classList.remove(`game-surprise-world-${definition.kind}`);
    }
    delete root.dataset.gameSurpriseEvent;
  }, []);

  const triggerSurprise = useCallback(() => {
    const nextEventCount = eventCountRef.current + 1;
    const comeback = comebackRef.current;
    const definition = chooseSurprise(slug, subject, nextEventCount, comeback);
    const nextActive: ActiveSurprise = {
      ...definition,
      id: nextIdRef.current++,
      comeback,
    };

    chargeRef.current = 0;
    eventCountRef.current = nextEventCount;
    comebackRef.current = false;
    setCharge(0);
    setEventCount(nextEventCount);
    setActive(nextActive);

    clearWorldClass();
    const root = document.querySelector<HTMLElement>(".games-route-shell");
    if (root) {
      root.classList.add("game-surprise-world-active", `game-surprise-world-${definition.kind}`);
      root.dataset.gameSurpriseEvent = definition.kind;
    }

    window.dispatchEvent(new CustomEvent("adrianos-surprise-event", {
      detail: {
        kind: definition.kind,
        title: definition.title,
        eventCount: nextEventCount,
        comeback,
        slug,
      },
    }));

    if (eventTimerRef.current !== null) window.clearTimeout(eventTimerRef.current);
    eventTimerRef.current = window.setTimeout(() => {
      setActive((current) => current?.id === nextActive.id ? null : current);
      clearWorldClass();
      eventTimerRef.current = null;
    }, 1900);
  }, [clearWorldClass, slug, subject]);

  useEffect(() => {
    chargeRef.current = 0;
    eventCountRef.current = 0;
    comebackRef.current = false;
    setCharge(0);
    setEventCount(0);
    setActive(null);
    clearWorldClass();
  }, [clearWorldClass, slug]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".games-route-shell");
    if (!root) return;
    setReady(true);

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>('[data-correct="true"], [data-correct="false"]');
      if (!control || !root.contains(control)) return;

      const now = performance.now();
      if (lastTapRef.current.control === control && now - lastTapRef.current.at < 700) return;
      lastTapRef.current = { control, at: now };

      if (control.dataset.correct === "false") {
        comebackRef.current = true;
        return;
      }

      const nextCharge = chargeRef.current + 1;
      const threshold = thresholdFor(eventCountRef.current);
      if (nextCharge >= threshold) {
        triggerSurprise();
        return;
      }

      chargeRef.current = nextCharge;
      setCharge(nextCharge);
    };

    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("click", onClick);
      setReady(false);
    };
  }, [triggerSurprise]);

  useEffect(() => () => {
    if (eventTimerRef.current !== null) window.clearTimeout(eventTimerRef.current);
    clearWorldClass();
  }, [clearWorldClass]);

  const threshold = thresholdFor(eventCount);

  return (
    <div
      className="game-surprise-director"
      data-game-surprise-director="active"
      data-surprise-ready={ready ? "true" : "false"}
      data-surprise-charge={charge}
      data-surprise-threshold={threshold}
      data-surprise-count={eventCount}
      data-surprise-visible={active ? "true" : "false"}
      data-surprise-event={active?.kind ?? ""}
      data-surprise-comeback={active?.comeback ? "true" : "false"}
    >
      <div className="game-surprise-meter" aria-hidden="true">
        <span><b>🎁</b> SURPRISE</span>
        <div>
          {Array.from({ length: threshold }, (_, index) => (
            <i key={index} className={index < charge ? "is-filled" : ""} />
          ))}
        </div>
      </div>

      {active && (
        <div
          key={active.id}
          className={`game-surprise-overlay game-surprise-${active.kind}`}
          data-surprise-overlay="active"
          data-surprise-event={active.kind}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="game-surprise-wash" aria-hidden="true" />
          <div className="game-surprise-particles" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => (
              <span key={index} style={{ "--particle-index": index } as React.CSSProperties}>
                {active.tokens[index % active.tokens.length]}
              </span>
            ))}
          </div>
          <div className="game-surprise-card">
            <small>{active.eyebrow}</small>
            <span>{active.icon}</span>
            <strong>{active.title}</strong>
            <p>{active.copy}</p>
          </div>
        </div>
      )}
    </div>
  );
}
