export type GamePlaySettings = {
  sfx: boolean;
  haptics: boolean;
  autoAdvance: boolean;
};

export const GAME_PLAY_SETTINGS_KEY = "adrianos-play-settings-v1";
export const GAME_PLAY_SETTINGS_EVENT = "adrianos-play-settings-updated";

export const DEFAULT_GAME_PLAY_SETTINGS: GamePlaySettings = {
  sfx: true,
  haptics: true,
  autoAdvance: true,
};

export function normalizeGamePlaySettings(value: unknown): GamePlaySettings {
  if (!value || typeof value !== "object") return DEFAULT_GAME_PLAY_SETTINGS;
  const raw = value as Partial<GamePlaySettings>;
  return {
    sfx: typeof raw.sfx === "boolean" ? raw.sfx : DEFAULT_GAME_PLAY_SETTINGS.sfx,
    haptics: typeof raw.haptics === "boolean" ? raw.haptics : DEFAULT_GAME_PLAY_SETTINGS.haptics,
    autoAdvance: typeof raw.autoAdvance === "boolean"
      ? raw.autoAdvance
      : DEFAULT_GAME_PLAY_SETTINGS.autoAdvance,
  };
}

export function readGamePlaySettings(): GamePlaySettings {
  if (typeof window === "undefined") return DEFAULT_GAME_PLAY_SETTINGS;
  try {
    const stored = window.localStorage.getItem(GAME_PLAY_SETTINGS_KEY);
    return stored
      ? normalizeGamePlaySettings(JSON.parse(stored))
      : DEFAULT_GAME_PLAY_SETTINGS;
  } catch {
    return DEFAULT_GAME_PLAY_SETTINGS;
  }
}

export function writeGamePlaySettings(settings: GamePlaySettings): GamePlaySettings {
  const normalized = normalizeGamePlaySettings(settings);
  if (typeof window === "undefined") return normalized;
  window.localStorage.setItem(GAME_PLAY_SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(GAME_PLAY_SETTINGS_EVENT));
  return normalized;
}
