"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { readLearningProfile } from "@/lib/adrian-learning-profile";
import {
  isGameAgeFit,
  readArcadeState,
  toggleArcadeFavorite,
  type ArcadeState,
} from "@/lib/adventure-arcade";
import {
  POWER_LOCKER_EVENT,
  equipPowerLockerPrize,
  powerLockerPrizeKey,
  readPowerLockerState,
  unlockedPowerLockerPrizes,
} from "@/lib/adrian-power-locker";
import { buildAdventureWorld } from "@/lib/adventure-world";
import { useLearnerModel } from "@/lib/adrian-evidence";
import { recommendNextActivity } from "@/lib/adrian-learner-model";
import {
  buildWorldMap,
  trailPoints,
  type WorldLandmark,
  type WorldPriority,
} from "@/lib/adrian-world-map";
import { buildWeeklyWorldQuest } from "@/lib/adrian-world-quest";
import {
  ADRIAN_PRIZE_COLLECTIONS,
  prizeProgressForGrade,
} from "@/lib/adrian-prize-collections";
import { readLearningSchedule } from "@/lib/adrian-learning-schedule";
import {
  DAILY_SESSION_EVENT,
  ensureDailySession,
  guidedMissionHref,
  startDailySessionMission,
  type DailySession,
} from "@/lib/adrian-daily-session";
import { useAdrianSound } from "@/lib/adrian-sound";
import type { Game } from "@/lib/games";
import styles from "./WorldStage.module.css";

const SECRET_STORE_PREFIX = "adrianos-world-secrets-v1:";
const AVATAR_STORE_PREFIX = "adrianos-world-avatar-v1:";
const SECRET_COINS = 5;
const PRIZE_SEEN_PREFIX = "adrianos-world-prize-seen-v1:";

const AVATARS = [
  { emoji: "🚀", name: "Rocket", cost: 0 },
  { emoji: "🤖", name: "Robot", cost: 20 },
  { emoji: "🦖", name: "Dino", cost: 30 },
  { emoji: "🧑‍🚀", name: "Astronaut", cost: 40 },
  { emoji: "🧙", name: "Wizard", cost: 50 },
  { emoji: "🐉", name: "Dragon", cost: 60 },
] as const;

type SheetId = "me" | "places" | "collection" | null;

function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readStoredList(key: string): number[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is number => typeof value === "number")
      : [];
  } catch {
    return [];
  }
}

/**
 * The child's entire home.
 *
 * One viewport, no page scroll, and every route to gameplay is a single tap.
 * The world is the navigation: landmarks hold fixed positions so the map can
 * be learned, and one of them glows because the learner model decided it
 * should. Secondary surfaces (all places, the collection, the avatar) open as
 * sheets over the world rather than pushing it down the page.
 */
export default function WorldStage({ games }: { games: Game[] }) {
  const router = useRouter();
  const { activeProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady, spendCoins, addCoins } = useAdrianProgress();
  const { model: learner } = useLearnerModel(profilesReady ? activeProfile.id : "");
  const { play, vibrate, reducedMotion } = useAdrianSound();

  const [arcade, setArcade] = useState<ArcadeState>({ favorites: [], recent: [] });
  const [arcadeReady, setArcadeReady] = useState(false);
  const [foundSecrets, setFoundSecrets] = useState<number[]>([]);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [unlockedAvatars, setUnlockedAvatars] = useState<number[]>([0]);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [schoolMode, setSchoolMode] = useState(false);
  const [session, setSession] = useState<DailySession | null>(null);
  const [learningRevision, setLearningRevision] = useState(0);
  const [equippedKey, setEquippedKey] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ emoji: string; name: string } | null>(null);

  const profileId = profilesReady ? activeProfile.id : "";

  useEffect(() => {
    if (!profilesReady) return;
    const refresh = () => {
      setArcade(readArcadeState(activeProfile.id));
      setArcadeReady(true);
      setFoundSecrets(readStoredList(`${SECRET_STORE_PREFIX}${activeProfile.id}:${todayKey()}`));
      setUnlockedAvatars(() => {
        const stored = readStoredList(`${AVATAR_STORE_PREFIX}${activeProfile.id}`);
        return stored.includes(0) ? stored : [0, ...stored];
      });
      setSchoolMode(readLearningSchedule(activeProfile.id).schoolMode === true);
      setEquippedKey(readPowerLockerState(activeProfile.id).equippedPrizeKey);
      setLearningRevision((value) => value + 1);
    };
    refresh();
    window.addEventListener("adrianos-learning-updated", refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    window.addEventListener("adrianos-learning-schedule-updated", refresh);
    window.addEventListener(POWER_LOCKER_EVENT, refresh);
    return () => {
      window.removeEventListener("adrianos-learning-updated", refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
      window.removeEventListener("adrianos-learning-schedule-updated", refresh);
      window.removeEventListener(POWER_LOCKER_EVENT, refresh);
    };
  }, [activeProfile.id, profilesReady]);

  // The planned session is resolved here so the world can point straight at
  // the next mission instead of routing the child through a school screen.
  useEffect(() => {
    if (!profilesReady || !progressReady) return;
    const refresh = () => setSession(ensureDailySession(activeProfile, games, progress));
    refresh();
    window.addEventListener(DAILY_SESSION_EVENT, refresh);
    return () => window.removeEventListener(DAILY_SESSION_EVENT, refresh);
  }, [activeProfile, games, profilesReady, progress, progressReady]);

  // The world screen owns the whole viewport; nothing behind it should scroll.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1900);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const grade = readProfileGrade(activeProfile);
  const interests = useMemo(() => {
    void learningRevision;
    return profilesReady ? readLearningProfile(activeProfile.id)?.interests ?? [] : [];
  }, [activeProfile.id, learningRevision, profilesReady]);

  const world = useMemo(() => {
    if (!profilesReady || !progressReady || !arcadeReady) return null;
    return buildAdventureWorld({
      profileId: activeProfile.id,
      age: activeProfile.age,
      grade,
      interests,
      games,
      progress,
      arcade,
    });
  }, [
    activeProfile.age,
    activeProfile.id,
    arcade,
    arcadeReady,
    games,
    grade,
    interests,
    profilesReady,
    progress,
    progressReady,
  ]);

  const next = useMemo(() => recommendNextActivity(learner), [learner]);

  const pendingMission = useMemo(() => {
    if (!schoolMode || !session) return null;
    const index = session.missions.findIndex((mission) => mission.status !== "complete");
    return index < 0 ? null : { index, mission: session.missions[index] };
  }, [schoolMode, session]);

  const priority: WorldPriority | null = useMemo(() => {
    if (!pendingMission) return null;
    const game = games.find((item) => item.slug === pendingMission.mission.gameSlug);
    return {
      slug: pendingMission.mission.gameSlug,
      // The mission's own title is written for a child; a game slug title
      // ("Placement Adventure") reads like software.
      title: pendingMission.mission.title || game?.title || "Next quest",
      emoji: game?.emoji ?? "\u{1F392}",
      href: pendingMission.mission.href,
      guideLine: "Your quest is ready. Tap the bright one!",
      rationale: "A planned session mission is pending, so it leads the world.",
    };
  }, [games, pendingMission]);

  const map = useMemo(
    () => (world ? buildWorldMap(world, learner, next, foundSecrets, priority) : null),
    [foundSecrets, learner, next, priority, world]
  );

  const quest = useMemo(() => {
    if (!profilesReady || !progressReady) return null;
    const built = buildWeeklyWorldQuest(activeProfile, games, progress);
    return built && built.missions.length === 3 ? built : null;
  }, [activeProfile, games, profilesReady, progress, progressReady]);

  const playableGames = useMemo(
    () => games.filter((game) => game.status === "playable"),
    [games]
  );
  const ageFitGames = useMemo(() => {
    const fit = playableGames.filter((game) => isGameAgeFit(game, activeProfile.age));
    return fit.length >= 6 ? fit : playableGames;
  }, [activeProfile.age, playableGames]);

  // Favourites lead, then everything else in catalogue order: a child who
  // starred a game should find it without hunting through 43 tiles.
  const sortedPlaces = useMemo(() => {
    const favorites = new Set(arcade.favorites);
    return [...ageFitGames].sort((left, right) => {
      const leftFavorite = favorites.has(left.slug) ? 0 : 1;
      const rightFavorite = favorites.has(right.slug) ? 0 : 1;
      return leftFavorite - rightFavorite;
    });
  }, [ageFitGames, arcade.favorites]);

  const lastPlayed = useMemo(() => {
    const slug = arcade.recent[0];
    return slug ? playableGames.find((game) => game.slug === slug) ?? null : null;
  }, [arcade.recent, playableGames]);

  const prize = useMemo(
    () => prizeProgressForGrade(progress, grade),
    [grade, progress]
  );
  const collection = ADRIAN_PRIZE_COLLECTIONS[grade];

  const unlockedPrizes = useMemo(
    () => (progressReady ? unlockedPowerLockerPrizes(progress, grade) : []),
    [grade, progress, progressReady]
  );
  const companion = useMemo(
    () => unlockedPrizes.find((item) => item.key === equippedKey) ?? unlockedPrizes.at(-1) ?? null,
    [equippedKey, unlockedPrizes]
  );

  /*
   * A new prize is announced in the world, not buried in a panel. The last
   * seen count is stored per profile so a clear celebrates exactly once, and
   * only ever after a verified completion raised the count.
   */
  useEffect(() => {
    if (!profileId || !progressReady) return;
    const key = `${PRIZE_SEEN_PREFIX}${profileId}`;
    let seen = 0;
    try {
      seen = Number(window.localStorage.getItem(key) ?? "0");
    } catch {
      seen = 0;
    }
    if (!Number.isFinite(seen)) seen = 0;
    if (prize.unlocked <= seen) return;
    try {
      window.localStorage.setItem(key, String(prize.unlocked));
    } catch {
      // Celebrating twice is better than crashing on a full store.
    }
    const item = collection.prizes[prize.unlocked - 1];
    if (item) setCelebration({ emoji: item.emoji, name: item.name });
  }, [collection.prizes, prize.unlocked, profileId, progressReady]);

  useEffect(() => {
    if (!celebration) return;
    play("reward");
    vibrate([12, 60, 18, 60, 24]);
  }, [celebration, play, vibrate]);

  const travel = useCallback((href: string) => {
    play("travel");
    vibrate(12);
    router.push(href);
  }, [play, router, vibrate]);

  /**
   * A landmark tap is the only step between the world and gameplay.
   * When the beacon is carrying a planned mission it is marked active first,
   * so the guided run is recorded without the child visiting a school screen.
   */
  const enterLandmark = useCallback((landmark: WorldLandmark) => {
    if (landmark.beacon && pendingMission && profileId) {
      const updated = startDailySessionMission(profileId, pendingMission.index);
      if (updated) {
        travel(guidedMissionHref(
          updated.missions[pendingMission.index],
          profileId,
          pendingMission.index,
          updated.missions.length
        ));
        return;
      }
    }
    travel(landmark.href);
  }, [pendingMission, profileId, travel]);

  const openSheet = useCallback((id: Exclude<SheetId, null>) => {
    play("tap");
    setSheet(id);
  }, [play]);

  const closeSheet = useCallback(() => {
    play("back");
    setSheet(null);
  }, [play]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSheet, sheet]);

  const findSecret = useCallback((index: number) => {
    if (!profileId || foundSecrets.includes(index)) return;
    const nextFound = [...foundSecrets, index];
    setFoundSecrets(nextFound);
    try {
      window.localStorage.setItem(
        `${SECRET_STORE_PREFIX}${profileId}:${todayKey()}`,
        JSON.stringify(nextFound)
      );
    } catch {
      // A found secret is a bonus; storage failure must not break the world.
    }
    addCoins(SECRET_COINS);
    play("reward");
    vibrate([10, 40, 14]);
    setToast(`Secret found! +${SECRET_COINS} coins`);
  }, [addCoins, foundSecrets, play, profileId, vibrate]);

  const equipCompanion = useCallback((index: number) => {
    const item = unlockedPrizes.find((prize) => prize.index === index);
    if (!item || !profileId) return;
    equipPowerLockerPrize(profileId, item);
    setEquippedKey(item.key);
    play("reveal");
    setToast(`${item.name} joins you`);
  }, [play, profileId, unlockedPrizes]);

  const toggleFavorite = useCallback((slug: string) => {
    if (!profileId) return;
    setArcade(toggleArcadeFavorite(profileId, slug));
    play("tap");
  }, [play, profileId]);

  const chooseAvatar = useCallback((index: number) => {
    const avatar = AVATARS[index];
    if (unlockedAvatars.includes(index)) {
      setAvatarIndex(index);
      play("tap");
      return;
    }
    if (!spendCoins(avatar.cost)) {
      setToast(`${avatar.cost} coins needed`);
      return;
    }
    const nextUnlocked = [...unlockedAvatars, index];
    setUnlockedAvatars(nextUnlocked);
    setAvatarIndex(index);
    try {
      window.localStorage.setItem(
        `${AVATAR_STORE_PREFIX}${profileId}`,
        JSON.stringify(nextUnlocked)
      );
    } catch {
      // Unlocks are cosmetic; ignore storage failures.
    }
    play("reward");
    setToast(`${avatar.name} unlocked!`);
  }, [play, profileId, spendCoins, unlockedAvatars]);

  if (!map || !world) {
    return (
      <div className={styles.stage} data-world-loading="true" aria-busy="true">
        <div />
        <div className={styles.map}>
          <div className={styles.sky} aria-hidden="true" />
          <div className={styles.hillNear} aria-hidden="true" />
        </div>
        <div />
      </div>
    );
  }

  // The beacon leads in the DOM so keyboard and screen-reader users reach the
  // primary target first, even though the map positions it visually.
  const orderedLandmarks: WorldLandmark[] = [
    ...map.landmarks.filter((landmark) => landmark.beacon),
    ...map.landmarks.filter((landmark) => !landmark.beacon),
  ];

  const avatar = AVATARS[avatarIndex] ?? AVATARS[0];

  return (
    <div
      className={styles.stage}
      data-world-theme={map.themeId}
      data-sky={map.sky}
      data-world-stage="active"
      data-world-intent={map.intent}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <header className={styles.topRail}>
        <button
          type="button"
          className={styles.meChip}
          onClick={() => openSheet("me")}
          data-world-me="true"
        >
          <span className={styles.meAvatar} aria-hidden="true">{avatar.emoji}</span>
          <span className={styles.meName}>{activeProfile.name}</span>
          <span className={styles.meLevel}>LV {progress.level}</span>
        </button>

        <p className={styles.worldName}>
          {companion ? (
            <span
              className={styles.companionChip}
              data-power-locker-active={companion.name}
              data-power-locker-aura={companion.aura}
            >
              <span aria-hidden="true">{companion.emoji}</span>
            </span>
          ) : null}
          {map.title} · {map.stageTitle}
        </p>

        <button
          type="button"
          className={styles.parentDoor}
          onClick={() => travel("/parent")}
          aria-label="Grown-up area"
          title="Grown-up area"
        >
          <span aria-hidden="true">🔐</span>
        </button>
      </header>

      <div className={styles.map} data-world-map="true">
        <div className={styles.sky} aria-hidden="true" />
        <div className={styles.stars} aria-hidden="true" />
        <div className={styles.celestial} aria-hidden="true" />
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.ridgeFar} aria-hidden="true" />
        <div className={styles.ridgeMid} aria-hidden="true" />
        <div className={styles.ground} aria-hidden="true" />

        <svg
          className={`${styles.trail} ${styles.trailWide}`}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline className={styles.trailLine} points={trailPoints(map.landmarks, "wide")} />
        </svg>
        <svg
          className={`${styles.trail} ${styles.trailTall}`}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline className={styles.trailLine} points={trailPoints(map.landmarks, "tall")} />
        </svg>

        {quest ? (
          <button
            type="button"
            className={styles.questFlag}
            onClick={() => travel("/world-quest")}
            data-world-quest-flag="true"
          >
            <span aria-hidden="true">{quest.theme.emoji}</span>
            <span>{quest.theme.title}</span>
            <span className={styles.questDots} aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className={styles.questDot}
                  data-done={index < quest.completedMissions ? "true" : "false"}
                />
              ))}
            </span>
            <span className="sr-only">
              {quest.completedMissions} of 3 quest missions complete
            </span>
          </button>
        ) : null}

        {map.structures.map((structure, index) => (
          <span
            key={`${structure.emoji}-${index}`}
            className={styles.structure}
            style={{
              "--x": `${structure.wide.x}%`,
              "--y": `${structure.wide.y}%`,
              "--xt": `${structure.tall.x}%`,
              "--yt": `${structure.tall.y}%`,
              "--scale": structure.scale,
              animationDelay: `${Math.min(index, 8) * 45}ms`,
            } as React.CSSProperties}
            title={structure.label}
            aria-hidden="true"
          >
            {structure.emoji}
          </span>
        ))}

        {map.secrets.map((secret, index) => (
          <button
            key={`secret-${secret.emoji}-${index}`}
            type="button"
            className={styles.secret}
            style={{
              "--x": `${secret.wide.x}%`,
              "--y": `${secret.wide.y}%`,
              "--xt": `${secret.tall.x}%`,
              "--yt": `${secret.tall.y}%`,
            } as React.CSSProperties}
            onClick={() => findSecret(index)}
            aria-label="Something is hidden here"
            data-world-secret="true"
            title={secret.emoji}
          >
            <span className={styles.secretGlint} aria-hidden="true" />
          </button>
        ))}

        {orderedLandmarks.map((landmark) => (
          <button
            key={landmark.portal.id}
            type="button"
            className={styles.landmark}
            data-beacon={landmark.beacon ? "true" : "false"}
            data-cleared={landmark.cleared ? "true" : "false"}
            data-world-landmark={landmark.portal.id}
            style={{
              "--x": `${landmark.wide.x}%`,
              "--y": `${landmark.wide.y}%`,
              "--xt": `${landmark.tall.x}%`,
              "--yt": `${landmark.tall.y}%`,
            } as React.CSSProperties}
            onClick={() => enterLandmark(landmark)}
          >
            <span className={styles.orbWrap}>
              <span className={styles.landmarkOrb} aria-hidden="true">{landmark.emoji}</span>
              {landmark.portal.completions > 0 ? (
                <span className={styles.clearBadge} aria-hidden="true">
                  {landmark.portal.completions}
                </span>
              ) : null}
            </span>
            <span className={styles.landmarkLabel}>{landmark.label}</span>
            <span className={styles.landmarkStatus}>{landmark.status}</span>
            <span className="sr-only">
              {landmark.beacon ? "Suggested next. " : ""}
              {landmark.portal.completions > 0
                ? `Cleared ${landmark.portal.completions} times.`
                : landmark.portal.plays > 0 ? "Started before." : "Not played yet."}
            </span>
          </button>
        ))}

        <div
          className={styles.guide}
          style={{
            "--x": `${Math.min(84, Math.max(16, map.beacon.wide.x + 18))}%`,
            "--y": `${Math.min(86, map.beacon.wide.y + 18)}%`,
            "--xt": `${Math.min(82, Math.max(18, map.beacon.tall.x + 20))}%`,
            "--yt": `${Math.min(88, map.beacon.tall.y + 20)}%`,
          } as React.CSSProperties}
        >
          <span className={styles.guideAvatar} aria-hidden="true">{map.guideEmoji}</span>
          <p className={styles.guideLine} data-world-guide="true">{map.guideLine}</p>
        </div>

        {celebration ? (
          <button
            type="button"
            className={styles.celebration}
            onClick={() => { play("tap"); setCelebration(null); }}
            data-world-celebration="true"
          >
            <span className={styles.celebrationEmoji} aria-hidden="true">{celebration.emoji}</span>
            <strong className={styles.celebrationTitle}>{celebration.name} joined you!</strong>
            <span className={styles.celebrationHint}>Tap to keep exploring</span>
          </button>
        ) : null}

        {toast ? <p className={styles.toast} role="status">{toast}</p> : null}
      </div>

      <nav className={styles.worldRail} aria-label="World">
        <button type="button" className={styles.railButton} onClick={() => openSheet("collection")}>
          <span className={styles.railIcon} aria-hidden="true">🎒</span>
          <span className={styles.railText}>
            <span className={styles.railTitle}>Collection</span>
            <span className={styles.railMeta}>{prize.unlocked}/{collection.prizes.length}</span>
          </span>
        </button>

        {lastPlayed ? (
          <button
            type="button"
            className={styles.railButton}
            onClick={() => travel(`/games/${lastPlayed.slug}?from=world-again`)}
            data-world-again="true"
          >
            <span className={styles.railIcon} aria-hidden="true">↻</span>
            <span className={styles.railText}>
              <span className={styles.railTitle}>Again</span>
              <span className={styles.railMeta}>{lastPlayed.title}</span>
            </span>
          </button>
        ) : null}

        <button type="button" className={styles.railButton} onClick={() => openSheet("places")}>
          <span className={styles.railIcon} aria-hidden="true">🗺</span>
          <span className={styles.railText}>
            <span className={styles.railTitle}>All places</span>
            <span className={styles.railMeta}>{ageFitGames.length} to explore</span>
          </span>
        </button>
      </nav>

      {sheet ? (
        <div
          className={styles.sheetBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label={sheet === "places" ? "All places" : sheet === "collection" ? "Collection" : "Me"}
          onClick={(event) => { if (event.target === event.currentTarget) closeSheet(); }}
        >
          <div className={styles.sheet} data-world-sheet={sheet}>
            <div className={styles.sheetHeader}>
              <div>
                <h2 className={styles.sheetTitle}>
                  {sheet === "places" ? "Everywhere you can go" : null}
                  {sheet === "collection" ? collection.title : null}
                  {sheet === "me" ? `${activeProfile.name}'s pack` : null}
                </h2>
                <p className={styles.sheetSubtitle}>
                  {sheet === "places" ? "Tap any place to play it right away." : null}
                  {sheet === "collection" ? collection.intro : null}
                  {sheet === "me" ? "Coins, level, and who you travel as." : null}
                </p>
              </div>
              <button
                type="button"
                className={styles.sheetClose}
                onClick={closeSheet}
                aria-label="Close"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className={styles.sheetBody}>
              {sheet === "places" ? (
                <div className={styles.tileGrid}>
                  {sortedPlaces.map((game) => {
                    const row = progress.games[game.slug];
                    const cleared = (row?.completions ?? 0) > 0;
                    const favorite = arcade.favorites.includes(game.slug);
                    return (
                      <div key={game.slug} className={styles.tileWrap}>
                        <button
                          type="button"
                          className={styles.tile}
                          data-cleared={cleared ? "true" : "false"}
                          data-game-slug={game.slug}
                          onClick={() => travel(`/games/${game.slug}?from=world-places`)}
                        >
                          <span className={styles.tileEmoji} aria-hidden="true">{game.emoji}</span>
                          <span className={styles.tileName}>{game.title}</span>
                          <span className={styles.tileMeta}>
                            {cleared ? `Cleared ${row?.completions}×` : row?.plays ? "Continue" : "New"}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.favorite}
                          data-favorite={favorite ? "true" : "false"}
                          data-favorite-slug={game.slug}
                          onClick={() => toggleFavorite(game.slug)}
                          aria-pressed={favorite}
                          aria-label={favorite ? `Remove ${game.title} from favourites` : `Add ${game.title} to favourites`}
                        >
                          <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {sheet === "collection" ? (
                <>
                  <div className={styles.statRow}>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{prize.unlocked}</span>
                      <span className={styles.statLabel}>Collected</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{map.clears}</span>
                      <span className={styles.statLabel}>Clears</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{map.structures.length}</span>
                      <span className={styles.statLabel}>Built</span>
                    </div>
                  </div>
                  <p className={styles.sectionLabel}>
                    {companion ? `${companion.emoji} ${companion.name} travels with you` : "Treasures"}
                  </p>
                  <p className={styles.sheetHint}>
                    {prize.unlocked === 0
                      ? "Finish any game to open your first treasure."
                      : "Tap a treasure to bring it into every game."}
                  </p>
                  <div className={styles.prizeGrid} data-power-locker="active">
                    {collection.prizes.map((item, index) => {
                      const locked = index >= prize.unlocked;
                      const active = companion?.index === index;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          className={styles.prize}
                          data-locked={locked ? "true" : "false"}
                          data-active={active ? "true" : "false"}
                          data-power-locker-prize={powerLockerPrizeKey(grade, index)}
                          data-power-locker-selected={active ? "true" : "false"}
                          disabled={locked}
                          onClick={() => equipCompanion(index)}
                          aria-label={locked ? "Locked treasure" : `Travel with ${item.name}`}
                          aria-pressed={locked ? undefined : active}
                        >
                          <span className={styles.prizeEmoji} aria-hidden="true">
                            {locked ? "❔" : item.emoji}
                          </span>
                          <span className={styles.prizeName}>{locked ? "Locked" : item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {map.structures.length > 0 ? (
                    <>
                      <p className={styles.sectionLabel}>Built in {map.title}</p>
                      <div className={styles.prizeGrid}>
                        {map.structures.map((structure, index) => (
                          <div key={`${structure.label}-${index}`} className={styles.prize}>
                            <span className={styles.prizeEmoji} aria-hidden="true">{structure.emoji}</span>
                            <span className={styles.prizeName}>{structure.label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}

              {sheet === "me" ? (
                <>
                  <div className={styles.statRow}>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{progress.level}</span>
                      <span className={styles.statLabel}>Level</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{progress.coins}</span>
                      <span className={styles.statLabel}>Coins</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{progress.xp}</span>
                      <span className={styles.statLabel}>XP</span>
                    </div>
                  </div>
                  <p className={styles.sectionLabel}>Travel as</p>
                  <div className={styles.avatarRow}>
                    {AVATARS.map((item, index) => {
                      const locked = !unlockedAvatars.includes(index);
                      return (
                        <button
                          key={item.name}
                          type="button"
                          className={styles.avatarPick}
                          data-active={index === avatarIndex ? "true" : "false"}
                          data-locked={locked ? "true" : "false"}
                          onClick={() => chooseAvatar(index)}
                          aria-label={locked ? `${item.name}, costs ${item.cost} coins` : item.name}
                        >
                          <span aria-hidden="true">{locked ? "🔒" : item.emoji}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
