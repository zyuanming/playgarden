// SPDX-License-Identifier: GPL-3.0-only
import type { CubeLevel } from "./cubeComposerLevels";
import { validCubeProgram } from "../vendor/cubeComposerCore";
export const CUBE_COMPOSER_RESUME_KEY = "playgarden.cube-composer.v1";
export type CubeRound = { program: string[]; history: string[][] };
export const freshCubeRound = (): CubeRound => ({ program: [], history: [] });
export function loadCubeRound(index: number, puzzle: CubeLevel): CubeRound {
  try {
    const raw = localStorage.getItem(`${CUBE_COMPOSER_RESUME_KEY}.round.${index}`);
    if (!raw || raw.length > 50000) return freshCubeRound();
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || saved.id !== puzzle.id || !validCubeProgram(saved.program, puzzle.functions)
      || !Array.isArray(saved.history) || saved.history.length > 100
      || !saved.history.every((program: unknown) => validCubeProgram(program, puzzle.functions))) return freshCubeRound();
    // The program is recomputed against the original wall. Saved walls and completion flags are ignored.
    return { program: saved.program, history: saved.history };
  } catch { return freshCubeRound(); }
}
export function saveCubeRound(index: number, puzzle: CubeLevel, round: CubeRound): boolean {
  try {
    localStorage.setItem(`${CUBE_COMPOSER_RESUME_KEY}.round.${index}`, JSON.stringify({ version: 1, id: puzzle.id, program: round.program, history: round.history }));
    return true;
  } catch { return false; }
}
