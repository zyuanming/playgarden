import { describe, it, expect } from "vitest";
import { games } from "../src/lib/registry";
import { GAME_IDS } from "../src/lib/catalog";
import { lightLevels } from "../src/games/lightLogic";
import { robotLevels } from "../src/games/robotLogic";
import { bridgeLevels } from "../src/games/bridgeLogic";
import { slideLevels } from "../src/games/slideLogic";
import { sudokuLevels } from "../src/games/sudokuLogic";
import { memoryLevels } from "../src/games/memoryLogic";
import { lightsOutLevels } from "../src/games/lightsOutLogic";
import { minesLevels } from "../src/games/minesLogic";
import { hanoiLevels } from "../src/games/hanoiLogic";
const packs = {
  light: lightLevels,
  robot: robotLevels,
  bridge: bridgeLevels,
  slide: slideLevels,
  sudoku: sudokuLevels,
  memory: memoryLevels,
  "lights-out": lightsOutLevels,
  mines: minesLevels,
  hanoi: hanoiLevels,
};
describe("Scalable catalog contract", () => {
  it("has unique registered IDs and exactly the implemented set", () => {
    expect(new Set(games.map((g) => g.id)).size).toBe(games.length);
    expect([...games.map((g) => g.id)].sort()).toEqual([...GAME_IDS].sort());
  });
  games.forEach((game) =>
    it(`${game.id} metadata matches its real levels and license`, () => {
      expect(game.levelCount).toBe(packs[game.id].length);
      expect(game.source.license).toBe("MIT");
      expect(game.artwork.url).toMatch(/^\//);
    }),
  );
  it("counts only 9 real games and 108 levels, not the roadmap", () => {
    expect(games).toHaveLength(9);
    expect(games.reduce((sum, g) => sum + g.levelCount, 0)).toBe(108);
  });
});
