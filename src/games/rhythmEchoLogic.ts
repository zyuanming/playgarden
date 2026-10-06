// SPDX-License-Identifier: GPL-3.0-only
/** A visual motif grammar, shared by equally valid untimed and live modes. */
export type RhythmInterval = 1 | 2 | 3;
export type RhythmTransform = "forward" | "reverse" | "rotate" | "lengthen";
export type RhythmPart = { transform: RhythmTransform; repeat: number };
export type RhythmLevel = {
  id: string;
  title: string;
  lesson: string;
  motif: readonly RhythmInterval[];
  parts: readonly RhythmPart[];
};
export type RhythmState = {
  phase: "observe" | "recall" | "complete";
  mode: "tokens" | "live";
  entered: readonly number[];
};
export const RHYTHM_UNIT_MS = 1000;
export const rhythmIntervalLabels: Record<RhythmInterval, string> = {
  1: "短 · 1 格",
  2: "中 · 2 格",
  3: "长 · 3 格",
};
export const rhythmTransformLabels: Record<RhythmTransform, string> = {
  forward: "原样",
  reverse: "倒序",
  rotate: "首项移到末尾",
  lengthen: "每项加 1 格",
};
export function rhythmTarget(level: RhythmLevel): RhythmInterval[] {
  return level.parts.flatMap((part) => {
    const motif = [...level.motif];
    const phrase =
      part.transform === "reverse"
        ? motif.reverse()
        : part.transform === "rotate"
          ? [...motif.slice(1), motif[0]]
          : part.transform === "lengthen"
            ? motif.map((value) => value + 1)
            : motif;
    if (
      phrase.some((value) => value < 1 || value > 3) ||
      part.repeat < 1 ||
      part.repeat > 3
    )
      throw new Error(`Invalid rhythm phrase ${level.id}`);
    return Array.from(
      { length: part.repeat },
      () => phrase,
    ).flat() as RhythmInterval[];
  });
}
export const createRhythmState = (): RhythmState => ({
  phase: "observe",
  mode: "tokens",
  entered: [],
});
/** Inclusive broad windows; these are performance allowances, not token classification boundaries. */
export const rhythmToleranceMs = (interval: RhythmInterval): number =>
  Math.max(450, interval * RHYTHM_UNIT_MS * 0.35);
export function rhythmIntervalMatches(
  expected: RhythmInterval,
  actual: number,
  mode: RhythmState["mode"],
): boolean {
  return (
    Number.isFinite(actual) &&
    (mode === "tokens"
      ? actual === expected
      : Math.abs(actual - expected * RHYTHM_UNIT_MS) <=
        rhythmToleranceMs(expected))
  );
}
export function rhythmWon(level: RhythmLevel, state: RhythmState): boolean {
  const target = rhythmTarget(level);
  return (
    state.entered.length === target.length &&
    state.entered.every((value, i) =>
      rhythmIntervalMatches(target[i], value, state.mode),
    )
  );
}
export function beginRhythm(state: RhythmState, paused = false): RhythmState {
  return paused || state.phase !== "observe"
    ? state
    : { ...state, phase: "recall" };
}
export function replayRhythm(state: RhythmState, paused = false): RhythmState {
  return paused || state.phase !== "recall"
    ? state
    : { ...state, phase: "observe" };
}
export function changeRhythmMode(
  state: RhythmState,
  mode: RhythmState["mode"],
  paused = false,
): RhythmState {
  return paused || state.phase === "complete" || state.mode === mode
    ? state
    : { ...state, mode, entered: [] };
}
export function enterRhythm(
  level: RhythmLevel,
  state: RhythmState,
  value: number,
  paused = false,
): RhythmState {
  if (
    paused ||
    state.phase !== "recall" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 3600000 ||
    (state.mode === "tokens" && ![1, 2, 3].includes(value)) ||
    state.entered.length >= rhythmTarget(level).length
  )
    return state;
  const next: RhythmState = { ...state, entered: [...state.entered, value] };
  return rhythmWon(level, next) ? { ...next, phase: "complete" } : next;
}
export function undoRhythm(state: RhythmState, paused = false): RhythmState {
  return paused || state.phase === "complete" || !state.entered.length
    ? state
    : { ...state, entered: state.entered.slice(0, -1) };
}
export function rhythmHint(
  level: RhythmLevel,
  state: RhythmState,
): { step: number; interval: RhythmInterval; text: string } {
  const target = rhythmTarget(level);
  const mismatch = state.entered.findIndex(
    (value, i) => !rhythmIntervalMatches(target[i], value, state.mode),
  );
  const step =
    mismatch < 0 ? Math.min(state.entered.length, target.length - 1) : mismatch;
  const interval = target[step];
  return {
    step,
    interval,
    text: `${mismatch < 0 ? "下一个" : "最早需要调整的"}是第 ${step + 1} 个间隔：${rhythmIntervalLabels[interval]}。${mismatch < 0 ? "沿着任务卡的规则继续。" : "用撤销退回这里，或重置再试。"}`,
  };
}
