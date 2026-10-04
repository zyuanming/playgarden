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
import { nonogramLevels } from "../src/games/nonogramLogic";
import { connectLevels } from "../src/games/connectLogic";
import { mergeLevels } from "../src/games/mergeLogic";
import { trafficLevels } from "../src/games/trafficLogic";
import { reversiLevels } from "../src/games/reversiLogic";
import { boxLevels } from "../src/games/boxLogic";
import { hanoiLevels } from "../src/games/hanoiLogic";
import { arithmeticLevels } from "../src/games/arithmeticLogic";
import { wordSearchLevels } from "../src/games/wordSearchLogic";
import { balanceLevels } from "../src/games/balanceLogic";
import { gearLevels } from "../src/games/gearLogic";
import { oneStrokeLevels } from "../src/games/oneStrokeLogic";
import { mapColorsLevels } from "../src/games/mapColorsLogic";
import { futoshikiLevels } from "../src/games/futoshikiLogic";
import { skylineLevels } from "../src/games/skylineLogic";
import { waterJugLevels } from "../src/games/waterJugLogic";
import { riverLevels } from "../src/games/riverLogic";
import { sowingLevels } from "../src/games/sowingLogic";
import { nimLevels } from "../src/games/nimLogic";
import { pegLevels } from "../src/games/pegLogic";
import { knightLevels } from "../src/games/knightLogic";
import { hashiLevels } from "../src/games/hashiLogic";
import { slitherlinkLevels } from "../src/games/slitherlinkLogic";
import { booleanCircuitLevels } from "../src/games/booleanCircuitLogic";
import { stackQueueLevels } from "../src/games/stackQueueLogic";
const packs = {
  hashi: hashiLevels,
  slitherlink: slitherlinkLevels,
  circuit: booleanCircuitLevels,
  "stack-queue": stackQueueLevels,
  sowing: sowingLevels,
  nim: nimLevels,
  peg: pegLevels,
  knight: knightLevels,
  futoshiki: futoshikiLevels,
  skyline: skylineLevels,
  jugs: waterJugLevels,
  river: riverLevels,
  balance: balanceLevels,
  gears: gearLevels,
  "one-stroke": oneStrokeLevels,
  "map-colors": mapColorsLevels,
  arithmetic: arithmeticLevels,
  "word-search": wordSearchLevels,
  light: lightLevels,
  robot: robotLevels,
  bridge: bridgeLevels,
  slide: slideLevels,
  sudoku: sudokuLevels,
  memory: memoryLevels,
  "lights-out": lightsOutLevels,
  mines: minesLevels,
  hanoi: hanoiLevels,
  nonogram: nonogramLevels,
  boxes: boxLevels,
  connect: connectLevels,
  reversi: reversiLevels,
  merge: mergeLevels,
  traffic: trafficLevels,
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
  it("counts only 33 real games and 396 levels, not the roadmap", () => {
    expect(games).toHaveLength(33);
    expect(games.reduce((sum, g) => sum + g.levelCount, 0)).toBe(396);
  });
});
