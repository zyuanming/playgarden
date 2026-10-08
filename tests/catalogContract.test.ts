import { signpostLevels } from "../src/games/signpostLevels";
import { magnetsLevels } from "../src/games/magnetsLevels";
import { galaxiesLevels } from "../src/games/galaxiesLevels";
import { akariLevels } from "../src/games/akariLevels";
import { floodLevels } from "../src/games/floodLevels";
import { breakoutLevels } from "../src/games/breakoutLogic";
import { runnerLessons } from "../src/games/cloudrunnerLogic";
import { xiangqiLevels } from "../src/games/xiangqiLevels";
import { gomokuLevels } from "../src/games/gomokuLevels";
import { blackboxLevels } from "../src/games/blackboxLevels";
import { pancakeLevels } from "../src/games/pancakeLevels";
import { samegameLevels } from "../src/games/samegameLevels";
import { slantLevels } from "../src/games/slantLevels";
import { memoryRoutesLevels } from "../src/games/memoryRoutesLevels";
import { rhythmEchoLevels } from "../src/games/rhythmEchoLevels";
import { symmetryRepairLevels } from "../src/games/symmetryRepairLevels";
import { probabilityBagLevels } from "../src/games/probabilityBagLevels";
import { paperFoldLevels } from "../src/games/paperFoldLevels";
import { treeRotationsLevels } from "../src/games/treeRotationsLevels";
import { spectralFiltersLevels } from "../src/games/spectralFiltersLevels";
import { waveStudioLevels } from "../src/games/waveStudioLevels";
import { compressionPostLevels } from "../src/games/compressionPostLevels";
import { functionFactoryLevels } from "../src/games/functionFactoryLevels";
import { railwayTimetableLevels } from "../src/games/railwayTimetableLevels";
import { pipeCapacityLevels } from "../src/games/pipeCapacityLevels";
import { binaryBalanceLevels } from "../src/games/binaryBalanceLevels";
import { carryLettersLevels } from "../src/games/carryLettersLevels";
import { fleetLevels } from "../src/games/fleetLevels";
import { iceStopsLevels } from "../src/games/iceStopsLevels";
import { rollingFacesLevels } from "../src/games/rollingFacesLevels";
import { shapeMosaicLevels } from "../src/games/shapeMosaicLevels";
import { codeCluesLevels } from "../src/games/codeCluesLevels";
import { energyDispatchLevels } from "../src/games/energyDispatchLevels";
import { concurrentKitchenLevels } from "../src/games/concurrentKitchenLevels";
import { parabolicTargetsLevels } from "../src/games/parabolicTargetsLevels";
import { currentCircuitLevels } from "../src/games/currentCircuitLevels";
import { budgetTownLevels } from "../src/games/budgetTownLevels";
import { conditionalSorterLevels } from "../src/games/conditionalSorterLevels";
import { stateMachineLocksLevels } from "../src/games/stateMachineLocksLogic";
import {
  townTourLevels,
  postmanRoutesLevels,
} from "../src/games/routeOptimizationLevels";
import { kakuroLevels } from "../src/games/kakuroLogic";
import { arithmeticCageLevels } from "../src/games/arithmeticCageLogic";
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
import { shikakuLevels } from "../src/games/shikakuLogic";
import { tentsLevels } from "../src/games/tentsLogic";
import { fractionMosaicLevels } from "../src/games/fractionMosaicLogic";
import { coordinateTreasureLevels } from "../src/games/coordinateTreasureLogic";
import { hexLevels } from "../src/games/hexLogic";
import { dotsLevels } from "../src/games/dotsAndBoxesLogic";
import { inclineLevels } from "../src/games/inclineLogic";
import { buoyancyLevels } from "../src/games/buoyancyLogic";
import { untangleLevels } from "../src/games/untangleLogic";
import { minimumNetworkLevels } from "../src/games/minimumNetworkLogic";
import { hitoriLevels } from "../src/games/hitoriLogic";
import { nurikabeLevels } from "../src/games/nurikabeLogic";
import { binaryCourierLevels } from "../src/games/binaryCourierLogic";
import { sortingNetworkLevels } from "../src/games/sortingNetworkLogic";
import { voxelViewsLevels } from "../src/games/voxelViewsLogic";
import { cubeNetLevels } from "../src/games/cubeNetLogic";
const packs = {
  flood: floodLevels,
  akari: akariLevels,
  galaxies: galaxiesLevels,
  magnets: magnetsLevels,
  signpost: signpostLevels,
  gomoku: gomokuLevels,
  xiangqi: xiangqiLevels,
  cloudrunner: runnerLessons,
  breakout: breakoutLevels,
  pancake: pancakeLevels,
  blackbox: blackboxLevels,
  samegame: samegameLevels,
  slant: slantLevels,
  "memory-routes": memoryRoutesLevels,
  "rhythm-echo": rhythmEchoLevels,
  "symmetry-repair": symmetryRepairLevels,
  "probability-bag": probabilityBagLevels,

  "paper-fold": paperFoldLevels,
  "tree-rotations": treeRotationsLevels,
  "spectral-filters": spectralFiltersLevels,
  "wave-studio": waveStudioLevels,

  "compression-post": compressionPostLevels,
  "function-factory": functionFactoryLevels,
  "railway-timetable": railwayTimetableLevels,
  "pipe-capacity": pipeCapacityLevels,
  "binary-balance": binaryBalanceLevels,
  "carry-letters": carryLettersLevels,
  "fleet-logic": fleetLevels,
  "ice-stops": iceStopsLevels,
  "rolling-faces": rollingFacesLevels,
  "shape-mosaic": shapeMosaicLevels,
  binary: binaryCourierLevels,
  "sorting-network": sortingNetworkLevels,
  voxel: voxelViewsLevels,
  "cube-net": cubeNetLevels,
  kakuro: kakuroLevels,
  "code-clues": codeCluesLevels,
  "energy-dispatch": energyDispatchLevels,
  "concurrent-kitchen": concurrentKitchenLevels,
  parabolic: parabolicTargetsLevels,
  "current-circuit": currentCircuitLevels,
  "budget-town": budgetTownLevels,
  "conditional-sorter": conditionalSorterLevels,
  "state-machine-locks": stateMachineLocksLevels,
  "town-tour": townTourLevels,
  "postman-routes": postmanRoutesLevels,
  "arithmetic-cage": arithmeticCageLevels,
  untangle: untangleLevels,
  "minimum-network": minimumNetworkLevels,
  hitori: hitoriLevels,
  nurikabe: nurikabeLevels,
  hex: hexLevels,
  dots: dotsLevels,
  incline: inclineLevels,
  buoyancy: buoyancyLevels,
  shikaku: shikakuLevels,
  tents: tentsLevels,
  fraction: fractionMosaicLevels,
  coordinate: coordinateTreasureLevels,
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
  merge: [],
  snake: [],
  falling: [],
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
      expect(game.source.license).toBe(
        game.source.kind === "original"
          ? "GPL-3.0-only"
          : game.id === "xiangqi"
            ? "BSD-2-Clause"
            : "MIT",
      );
      expect(game.artwork.url).toMatch(/^\.\/[a-z0-9-]+\.(?:webp|svg)$/);
      for (const root of [
        "https://example.test/",
        "https://example.test/playgarden/",
      ]) {
        const base = new URL(root);
        const artwork = new URL(game.artwork.url, base);
        expect(artwork.origin).toBe(base.origin);
        expect(artwork.pathname).toBe(
          base.pathname + game.artwork.url.slice(2),
        );
      }
    }),
  );
  it("counts only 94 real games and 2309 levels, not the roadmap", () => {
    expect(games).toHaveLength(94);
    expect(games.reduce((sum, g) => sum + g.levelCount, 0)).toBe(2309);
  });
});
