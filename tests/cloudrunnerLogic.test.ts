// SPDX-License-Identifier: GPL-3.0-only
import { describe, it, expect } from "vitest";
import certificates from "./fixtures/cloudrunnerLessons.json";
import {
  createRunner,
  startRunner,
  inputRunner,
  advanceRunner,
  runnerLessons,
  runnerScore,
  clearBufferedInput,
  routeFrame,
  TURN_WINDOW,
  type RunnerState,
} from "../src/games/cloudrunnerLogic";
import {
  createInitialPlayer,
  step,
  pose,
  type Intent,
} from "../src/vendor/cloudrunner/player/index";
import { resolve } from "../src/vendor/cloudrunner/collision/index";
import { nextBatch, generate } from "../src/vendor/cloudrunner/track/index";
import { curve } from "../src/vendor/cloudrunner/difficulty/index";
import {
  createHighScore,
  scoreFor,
} from "../src/vendor/cloudrunner/scoring/index";
import {
  keyToIntent,
  swipeToIntent,
} from "../src/vendor/cloudrunner/input/index";
function run(state: RunnerState, seconds: number) {
  for (let t = 0; t < seconds - 1e-8; t += 0.1)
    state = advanceRunner(state, Math.min(0.1, seconds - t));
  return state;
}
describe("Cloudrunner source adaptation and independent certificates", () => {
  it.each(certificates)(
    "completes independent continuous certificate for lesson $lesson",
    (c) => {
      let s = startRunner(createRunner(c.lesson)),
        time = 0;
      for (const a of c.actions) {
        s = run(s, a.time - time);
        s = inputRunner(s, a.intent as Intent);
        time = a.time;
      }
      s = run(s, c.length / 14 - time + 0.2);
      expect(s.outcome).toBe("finished");
      expect(s.game.distance).toBe(c.length);
      expect(s.turnCount).toBe(runnerLessons[c.lesson].turns.length);
      expect(advanceRunner(s, 1)).toBe(s);
      expect(inputRunner(s, "jump")).toBe(s);
    },
  );
  it("never advances or accepts movement before explicit start", () => {
    const s = createRunner(0);
    expect(advanceRunner(s, 2)).toBe(s);
    expect(inputRunner(s, "right")).toBe(s);
  });
  it.each([0, 1, 2, 3, 4, 5])(
    "fails an unattended lesson %i without awarding finish",
    (n) => {
      const s = run(startRunner(createRunner(n)), 40);
      expect(s.outcome).toBe("crashed");
    },
  );
  it("low-frame-rate step cannot tunnel across a full blocker", () => {
    let s = startRunner(createRunner(0));
    s = { ...s, game: { ...s.game, distance: 40 } };
    expect(advanceRunner(s, 0.5).outcome).toBe("crashed");
  });
  it.each([NaN, Infinity, -1, 0])("rejects invalid delta %s", (dt) => {
    const s = startRunner(createRunner());
    expect(advanceRunner(s, dt)).toBe(s);
  });
  it("turn input is distinct from lane input and wrong direction can be corrected", () => {
    let s = startRunner(createRunner(3));
    s = { ...s, game: { ...s.game, distance: 96 - TURN_WINDOW - 1 } };
    s = inputRunner(s, "right");
    expect(s.queuedTurn).toBeNull();
    expect(s.player.lane).toBe("right");
    s = advanceRunner(s, 0.1);
    s = inputRunner(s, "right");
    expect(s.queuedTurn).toBe("right");
    s = inputRunner(s, "left");
    expect(s.queuedTurn).toBe("left");
    s = run(s, 3);
    expect(s.turnCount).toBe(1);
    expect(s.player.lane).toBe("center");
  });
  it("keeps accepted route choices while clearing transient buffers at interruptions", () => {
    let s = startRunner(createRunner(3));
    s = {
      ...s,
      queuedTurn: "left",
      player: { ...s.player, buffered: "jump", bufferAge: 0.1 },
    };
    const c = clearBufferedInput(s);
    expect(c.queuedTurn).toBe("left");
    expect(c.player.buffered).toBeNull();
    expect(c.player.bufferAge).toBe(0);
  });
  it("route actually turns ninety degrees and continues in world coordinates", () => {
    const t = [{ z: 96, direction: "left" as const }];
    expect(routeFrame(t, 96)).toEqual({ x: 0, z: 96, heading: -Math.PI / 2 });
    const p = routeFrame(t, 116);
    expect(p.x).toBeCloseTo(-20);
    expect(p.z).toBeCloseTo(96);
  });
  it.each([0, 1, 42, 20261006, 0xffffffff])(
    "uses real upstream deterministic chunks for seed %i",
    (seed) => {
      expect(generate(seed, 0.8)).toEqual(generate(seed, 0.8));
      const s = createRunner(null, seed);
      const batch = nextBatch(seed, 0, 0, 0).filter(
        (p) => p.z >= 36 && !s.turns.some((t) => Math.abs(t.z - p.z) < 44),
      );
      expect(s.placements).toEqual(batch);
    },
  );
  it("retains no collected coin and counts score once", () => {
    let s = startRunner(createRunner(0));
    s = run(s, 2);
    expect(s.coins).toBe(3);
    expect(s.placements.some((p) => p.z === 20)).toBe(false);
    expect(runnerScore(s)).toBe(scoreFor(s.game.distance, 3));
  });
});
describe("Adapted runner movement, collisions and input", () => {
  it("supports a lateral input and a jump on the same frame", () => {
    let p = step(createInitialPlayer(), "left", 0);
    p = step(p, "jump", 0);
    expect(p.lane).toBe("left");
    expect(p.mode).toBe("jumping");
    expect(pose(step(p, null, 0.3)).y).toBeCloseTo(2.4);
  });
  it("reserves both lanes until lateral tween completes", () => {
    const p = step(createInitialPlayer(), "left", 0),
      entities = [
        { lane: "center" as const, z: 2, type: "full-block" as const },
      ];
    expect(resolve(p, entities, 0).hit).toBe(true);
    expect(resolve(step(p, null, 0.12), entities, 0).hit).toBe(false);
  });
  it("jump activation alone is not enough to clear a physical low gate", () => {
    const p = step(createInitialPlayer(), "jump", 0),
      e = [{ lane: "center" as const, z: 2, type: "obstacle-low" as const }];
    expect(resolve(p, e, 0).hit).toBe(true);
    expect(resolve(step(p, null, 0.1), e, 0).hit).toBe(false);
  });
  it("only slide clears a high gate; full-block is never cleared", () => {
    const p = step(createInitialPlayer(), "slide", 0);
    expect(
      resolve(p, [{ lane: "center", z: 2, type: "obstacle-high" }], 0).hit,
    ).toBe(false);
    expect(
      resolve(p, [{ lane: "center", z: 2, type: "full-block" }], 0).hit,
    ).toBe(true);
  });
  it("buffers a just-before-landing slide then expires older actions", () => {
    let p = step(createInitialPlayer(), "jump", 0);
    p = step(p, null, 0.5);
    p = step(p, "slide", 0);
    expect(step(p, null, 0.11).mode).toBe("sliding");
    let early = step(createInitialPlayer(), "jump", 0);
    early = step(early, "slide", 0);
    expect(step(early, null, 0.61).mode).toBe("grounded");
  });
  it.each([
    ["ArrowUp", "jump"],
    ["KeyS", "slide"],
    ["ArrowLeft", "left"],
    ["KeyD", "right"],
    ["Space", "jump"],
    ["Escape", null],
  ])("maps %s to %s", (key, value) => expect(keyToIntent(key!)).toBe(value));
  it.each([
    [25, 0, "right"],
    [-25, 0, "left"],
    [0, -25, "jump"],
    [0, 25, "slide"],
    [8, 8, null],
  ])("classifies swipe %i %i", (x, y, v) =>
    expect(swipeToIntent(Number(x), Number(y), 24)).toBe(v),
  );
  it.each([0, 500, 10000, 1e9])("difficulty is bounded at %i meters", (d) => {
    expect(curve(d).speed).toBeGreaterThanOrEqual(14);
    expect(curve(d).speed).toBeLessThanOrEqual(28);
  });
  it("safe high-score store withstands corrupt storage and write denial", () => {
    const store = createHighScore({
      getItem: () => "-4",
      setItem: () => {
        throw Error();
      },
    });
    expect(store.get()).toBe(0);
    expect(store.submit(123)).toBe(123);
    expect(store.submit(Infinity)).toBe(123);
    expect(store.submit(1)).toBe(123);
  });
});
