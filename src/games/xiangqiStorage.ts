// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 YuanMing; Playgarden original contributions.
import {
  replayMoves,
  initialPosition,
  RULE_ID,
  type Color,
  type Position,
} from "./xiangqiLogic.ts";
export const XIANGQI_KEY = "playgarden.xiangqi.v1";
export type MatchSettings = { mode: "computer" | "local"; human: Color };
export const defaultSettings: MatchSettings = { mode: "computer", human: "r" };
export function isMatchSettings(value: unknown): value is MatchSettings {
  if (!value || typeof value !== "object") return false;
  const s = value as MatchSettings;
  return (
    (s.mode === "computer" || s.mode === "local") &&
    (s.human === "r" || s.human === "b")
  );
}
export const roundKey = (level: number, free: boolean) =>
  `${XIANGQI_KEY}.round.${free ? "free" : level}`;
export function parseRound(
  raw: string | null,
  initial: string,
  puzzleId: string,
) {
  const fallback = {
    position: initialPosition(initial)!,
    settings: { ...defaultSettings },
    restored: false,
    invalid: raw !== null,
  };
  if (!raw || raw.length > 60000) return fallback;
  try {
    const data = JSON.parse(raw);
    if (
      !data ||
      data.version !== 1 ||
      data.ruleId !== RULE_ID ||
      data.puzzleId !== puzzleId ||
      data.initial !== initial ||
      !isMatchSettings(data.settings)
    )
      return fallback;
    const position = replayMoves(initial, data.moves);
    if (!position) return fallback;
    return {
      position,
      settings: { ...data.settings } as MatchSettings,
      restored: position.moves.length > 0,
      invalid: false,
    };
  } catch {
    return fallback;
  }
}
export function loadRound(
  level: number,
  free: boolean,
  initial: string,
  puzzleId: string,
) {
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
) {
  try {
    localStorage.setItem(
      roundKey(level, free),
      JSON.stringify({
        version: 1,
        ruleId: RULE_ID,
        puzzleId,
        initial: position.initial,
        moves: position.moves,
        settings,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
