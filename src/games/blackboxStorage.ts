import {
  BLACKBOX_SAVE_LIMIT,
  blackboxSignature,
  createBlackboxState,
  markBlackbox,
  traceBlackbox,
  type BlackboxLevel,
  type BlackboxState,
  type Mark,
  type Probe,
} from "./blackboxLogic.ts";
export const BLACKBOX_RESUME_KEY = "playgarden.blackbox.v1";
export function parseBlackboxRound(
  raw: string | null,
  level: BlackboxLevel,
): BlackboxState {
  const initial = createBlackboxState(level);
  try {
    if (!raw || raw.length > 400000) return initial;
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      value.id !== level.id ||
      !Array.isArray(value.marks) ||
      value.marks.length !== level.size ** 2 ||
      !value.marks.every((m: unknown) => m === -1 || m === 0 || m === 1) ||
      !Array.isArray(value.history) ||
      value.history.length > BLACKBOX_SAVE_LIMIT ||
      !Array.isArray(value.probes) ||
      value.probes.length > 4 * level.size ||
      typeof value.submitted !== "boolean"
    )
      return initial;
    let rebuilt = initial;
    for (const change of value.history) {
      if (
        !change ||
        !Number.isInteger(change.cell) ||
        change.cell < 0 ||
        change.cell >= level.size ** 2 ||
        ![-1, 0, 1].includes(change.after) ||
        rebuilt.marks[change.cell] !== change.before ||
        change.before === change.after
      )
        return initial;
      rebuilt = markBlackbox(rebuilt, change.cell, change.after as Mark);
    }
    if (rebuilt.marks.some((m, i) => m !== value.marks[i])) return initial;
    const seen = new Set<number>();
    for (const probe of value.probes) {
      if (
        !probe ||
        !Number.isInteger(probe.port) ||
        seen.has(probe.port) ||
        traceBlackbox(level.size, level.atoms, probe.port) !== probe.result ||
        probe.result === null
      )
        return initial;
      seen.add(probe.port);
      if (probe.result >= 0) seen.add(probe.result);
    }
    if (value.submitted) {
      const atoms = value.marks.flatMap((m: Mark, i: number) =>
        m === 1 ? [i] : [],
      );
      if (
        atoms.length !== level.atoms.length ||
        JSON.stringify(blackboxSignature(level.size, atoms)) !==
          JSON.stringify(blackboxSignature(level.size, level.atoms))
      )
        return initial;
    }
    return {
      ...rebuilt,
      probes: value.probes.map((p: Probe) => ({
        port: p.port,
        result: p.result,
      })),
      submitted: value.submitted,
    };
  } catch {
    return initial;
  }
}
export function loadBlackboxRound(
  index: number,
  level: BlackboxLevel,
): BlackboxState {
  try {
    return parseBlackboxRound(
      localStorage.getItem(`${BLACKBOX_RESUME_KEY}.round.${index}`),
      level,
    );
  } catch {
    return createBlackboxState(level);
  }
}
export function saveBlackboxRound(
  index: number,
  level: BlackboxLevel,
  state: BlackboxState,
): boolean {
  if (state.history.length > BLACKBOX_SAVE_LIMIT) return false;
  try {
    localStorage.setItem(
      `${BLACKBOX_RESUME_KEY}.round.${index}`,
      JSON.stringify({ version: 1, id: level.id, ...state }),
    );
    return true;
  } catch {
    return false;
  }
}
