import { describe, it, expect } from "vitest";
import { lightLevels, traceLight } from "../src/games/lightLogic";
import { robotLevels, runProgram } from "../src/games/robotLogic";
import { bridgeLevels, bridgeConnected, exits } from "../src/games/bridgeLogic";
import {
  parseProgress,
  initialProgress,
  completeLevel,
} from "../src/lib/progress";
describe("Light Lab", () => {
  lightLevels.forEach((l, i) => {
    it(`level ${i + 1} is initially unsolved and has a solution`, () => {
      expect(traceLight(l, l.mirrors).won).toBe(false);
      expect(
        traceLight(
          l,
          l.mirrors.map((m, j) => ({ ...m, slash: l.solution[j] })),
        ).won,
      ).toBe(true);
    });
  });
  it("always terminates on bounded boards", () =>
    expect(traceLight(lightLevels[0], []).path.length).toBeLessThan(30));
});
describe("Robot Routes", () => {
  robotLevels.forEach((l, i) =>
    it(`level ${i + 1} has a valid program`, () =>
      expect(runProgram(l, l.solution, l.repeat).won).toBe(true)),
  );
  it("does not move through borders", () => {
    const r = runProgram(robotLevels[0], ["forward"], 10);
    expect(r.won).toBe(false);
    expect(r.frames.at(-1)?.crashed).toBe(true);
  });
  it("empty program is not a win", () =>
    expect(runProgram(robotLevels[0], [], 1).won).toBe(false));
  it("walls stop the robot", () =>
    expect(
      runProgram(robotLevels[2], ["forward", "forward"], 1).frames.at(-1)
        ?.crashed,
    ).toBe(true));
});
describe("Bridge Blocks", () => {
  bridgeLevels.forEach((l, i) =>
    it(`level ${i + 1} has an unsolved start and connected solution`, () => {
      expect(bridgeConnected(l.tiles, l.size)).toBe(false);
      expect(
        bridgeConnected(
          l.tiles.map((t, j) => ({ ...t, rotation: l.solution[j] })),
          l.size,
        ),
      ).toBe(true);
    }),
  );
  it("rotation wraps correctly", () =>
    expect(exits({ x: 0, y: 0, kind: "straight", rotation: 4 })).toEqual([
      0, 2,
    ]));
  it("missing bridge cannot connect", () =>
    expect(bridgeConnected([], 5)).toBe(false));
});
describe("Versioned local progress", () => {
  it("recovers malformed data", () =>
    expect(parseProgress("{oops")).toEqual(initialProgress()));
  it("rejects unknown versions", () =>
    expect(parseProgress('{"version":2}')).toEqual(initialProgress()));
  it("filters invalid progress", () =>
    expect(
      parseProgress(
        '{"version":1,"favorites":["robot","bad"],"completed":{"light":[0,0,-1,9,"1"]}}',
      ).completed.light,
    ).toEqual([0]));
  it("completion is idempotent", () => {
    const p = completeLevel(
      completeLevel(initialProgress(), "light", 0),
      "light",
      0,
    );
    expect(p.completed.light).toEqual([0]);
  });
});
