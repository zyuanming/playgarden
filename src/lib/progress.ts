import { GAME_IDS, type GameId } from "./catalog";
export type Progress = {
  version: 2;
  favorites: GameId[];
  completed: Record<GameId, number[]>;
  muted: boolean;
  lastPlayed: GameId | null;
};
export const STORAGE_KEY = "playgarden.progress.v2";
export const LEGACY_STORAGE_KEY = "playgarden.progress.v1";
export const initialProgress = (): Progress => ({
  version: 2,
  favorites: [],
  completed: Object.fromEntries(
    GAME_IDS.map((id) => [id, []]),
  ) as unknown as Record<GameId, number[]>,
  muted: false,
  lastPlayed: null,
});
const validGame = (id: unknown): id is GameId =>
  typeof id === "string" && (GAME_IDS as readonly string[]).includes(id);
/** Forward-compatible level indices keep earned progress as packs grow. Unknown IDs are ignored. */
export function parseProgress(raw: string | null): Progress {
  try {
    const p = JSON.parse(raw || "null");
    if (p?.version !== 1 && p?.version !== 2) return initialProgress();
    const base = initialProgress();
    base.favorites = Array.isArray(p.favorites)
      ? [...new Set<GameId>(p.favorites.filter(validGame))]
      : [];
    for (const id of GAME_IDS)
      base.completed[id] = Array.isArray(p.completed?.[id])
        ? [
            ...new Set<number>(
              p.completed[id].filter(
                (n: unknown) =>
                  Number.isInteger(n) && Number(n) >= 0 && Number(n) < 10000,
              ),
            ),
          ].sort((a, b) => a - b)
        : [];
    base.muted = !!p.muted;
    base.lastPlayed = validGame(p.lastPlayed) ? p.lastPlayed : null;
    return base;
  } catch {
    return initialProgress();
  }
}
export function completeLevel(
  p: Progress,
  id: GameId,
  level: number,
): Progress {
  if (!Number.isInteger(level) || level < 0 || level >= 10000) return p;
  return {
    ...p,
    lastPlayed: id,
    completed: {
      ...p.completed,
      [id]: [...new Set([...p.completed[id], level])].sort((a, b) => a - b),
    },
  };
}
