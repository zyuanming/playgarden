import type { GameId } from "./types";
export type Progress = {
  version: 1;
  favorites: GameId[];
  completed: Record<GameId, number[]>;
  muted: boolean;
};
export const initialProgress = (): Progress => ({
  version: 1,
  favorites: [],
  completed: { light: [], robot: [], bridge: [] },
  muted: false,
});
export function parseProgress(raw: string | null): Progress {
  try {
    const p = JSON.parse(raw || "null");
    if (p?.version !== 1) return initialProgress();
    const base = initialProgress();
    base.favorites = Array.isArray(p.favorites)
      ? p.favorites.filter((x: unknown) =>
          ["light", "robot", "bridge"].includes(String(x)),
        )
      : [];
    for (const id of ["light", "robot", "bridge"] as GameId[])
      base.completed[id] = Array.isArray(p.completed?.[id])
        ? [
            ...new Set<number>(
              p.completed[id].filter(
                (n: unknown) =>
                  Number.isInteger(n) && Number(n) >= 0 && Number(n) < 3,
              ),
            ),
          ]
        : [];
    base.muted = !!p.muted;
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
  return {
    ...p,
    completed: {
      ...p.completed,
      [id]: [...new Set([...p.completed[id], level])],
    },
  };
}
export const STORAGE_KEY = "playgarden.progress.v1";
