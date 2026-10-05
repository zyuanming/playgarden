import { describe, expect, it } from "vitest";
import {
  getLightsOutLevel,
  lightsOutLevels,
  solveLightsOut,
} from "../src/games/lightsOutLogic";
import {
  LIGHTS_OUT_CAMPAIGN_VERSION,
  lightsOutBoards,
  lightsOutChapters,
} from "../src/games/lightsOutCampaign";
import { completeLevel, initialProgress, parseProgress } from "../src/lib/progress";
import {
  applyOracleLightMoves,
  lightsOutOrbitKey,
  solveLightsOutOracle,
} from "./fixtures/lightsOutOracle";

describe("Lights Out fixed campaign", () => {
  it("contains 112 different puzzle orbits and 8 complete teaching chapters", () => {
    expect(LIGHTS_OUT_CAMPAIGN_VERSION).toBe(1);
    expect(lightsOutLevels).toHaveLength(112);
    expect(lightsOutChapters).toHaveLength(8);
    expect(new Set(lightsOutLevels.map((l) => lightsOutOrbitKey(l.initial, l.size))).size).toBe(112);
    lightsOutChapters.forEach((chapter, i) => {
      const levels = lightsOutLevels.slice(chapter.start, chapter.start + chapter.count);
      expect(chapter.start).toBe(i * 14);
      expect(levels).toHaveLength(14);
      expect(levels.every((l) => l.chapter === i && l.size === chapter.size && l.lesson === chapter.lesson)).toBe(true);
      expect(levels.map((l) => l.solution.length)).toEqual(levels.map((l) => l.solution.length).sort((a,b) => a-b));
    });
    expect(lightsOutLevels.slice(0, 3).map((l) => l.solution)).toEqual([[0], [1], [4]]);
    expect(lightsOutLevels[111].initial.every(Boolean)).toBe(true);
    expect(lightsOutLevels[111].solution).toHaveLength(15);
  });

  it("independently certifies every stored board and exact minimum solution", () => {
    for (const [index, level] of lightsOutLevels.entries()) {
      const [initialMask, solutionMask] = lightsOutBoards[index];
      expect(initialMask).toBeGreaterThan(0);
      expect(initialMask).toBeLessThan(2 ** (level.size * level.size));
      expect(solutionMask).toBeGreaterThan(0);
      expect(solutionMask).toBeLessThan(2 ** (level.size * level.size));
      expect(new Set(level.solution).size).toBe(level.solution.length);
      expect(applyOracleLightMoves(level.initial, level.size, level.solution).every((on) => !on)).toBe(true);
      const oracle = solveLightsOutOracle(level.initial, level.size);
      expect(oracle).not.toBeNull();
      expect(oracle!.length).toBe(level.solution.length);
      expect(solveLightsOut(level.initial, level.size)?.length).toBe(oracle!.length);
    }
  });

  it("has no first-level fallback and preserves earned high-index current progress", () => {
    for (const index of [-1, 112, 10000, 0.5, NaN, Infinity])
      expect(() => getLightsOutLevel(index)).toThrow(RangeError);
    expect(getLightsOutLevel(111)).toBe(lightsOutLevels[111]);
    let progress = initialProgress();
    for (const index of [99, 100, 111, 111]) progress = completeLevel(progress, "lights-out", index);
    const restored = parseProgress(JSON.stringify(progress));
    expect(restored.completed["lights-out"]).toEqual([99, 100, 111]);
    expect(restored.lastPlayed).toBe("lights-out");
  });
});
