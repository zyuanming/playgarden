import {
  emptyPosition,
  replayMoves,
  type Position,
  type Stone,
} from "./gomokuLogic.ts";
import type { Difficulty } from "./gomokuAi.ts";

export const GOMOKU_KEY = "playgarden.gomoku.v1";
export const GOMOKU_RULE = "freestyle-15-v1";
export type MatchSettings = {
  mode: "computer" | "local";
  human: Stone;
  difficulty: Difficulty;
};
export const defaultSettings: MatchSettings = {
  mode: "computer",
  human: 1,
  difficulty: "gentle",
};
export type SavedRound = {
  position: Position;
  settings: MatchSettings;
  restored: boolean;
  invalid: boolean;
};
export function isMatchSettings(value: unknown): value is MatchSettings {
  if (!value || typeof value !== "object") return false;
  const s = value as MatchSettings;
  return (
    (s.mode === "computer" || s.mode === "local") &&
    (s.human === 1 || s.human === 2) &&
    (s.difficulty === "gentle" || s.difficulty === "steady")
  );
}
export function roundKey(level: number, free: boolean) {
  return `${GOMOKU_KEY}.round.${free ? "free" : level}`;
}
export function parseRound(
  raw: string | null,
  initial: readonly number[],
  puzzleId: string,
): SavedRound {
  const fallback = {
    position: replayMoves(initial) ?? emptyPosition(),
    settings: { ...defaultSettings },
    restored: false,
    invalid: raw !== null,
  };
  if (!raw || raw.length > 12000) return fallback;
  try {
    const data = JSON.parse(raw);
    if (
      !data ||
      data.version !== 1 ||
      data.ruleId !== GOMOKU_RULE ||
      data.puzzleId !== puzzleId ||
      !isMatchSettings(data.settings) ||
      !Array.isArray(data.moves) ||
      data.moves.length > 225 ||
      data.moves.length < initial.length ||
      initial.some((m, i) => data.moves[i] !== m)
    )
      return fallback;
    const position = replayMoves(data.moves);
    if (!position) return fallback;
    return {
      position,
      settings: { ...data.settings },
      restored: data.moves.length > initial.length,
      invalid: false,
    };
  } catch {
    return fallback;
  }
}
export function loadRound(
  level: number,
  free: boolean,
  initial: readonly number[],
  puzzleId: string,
): SavedRound {
  try {
    return parseRound(
      localStorage.getItem(roundKey(level, free)),
      initial,
      puzzleId,
    );
  } catch {
    return parseRound(null, initial, puzzleId);
  }
}
export function saveRound(
  level: number,
  free: boolean,
  puzzleId: string,
  position: Position,
  settings: MatchSettings,
): boolean {
  try {
    localStorage.setItem(
      roundKey(level, free),
      JSON.stringify({
        version: 1,
        ruleId: GOMOKU_RULE,
        puzzleId,
        moves: position.moves,
        settings,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
