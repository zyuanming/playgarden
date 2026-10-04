// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WaterJugLab from "../src/games/WaterJugLab";
import RiverCrossingGarden from "../src/games/RiverCrossingGarden";
import {
  applyWaterJugMove,
  createWaterJugState,
  legalWaterJugMoves,
  searchWaterJug,
  solveWaterJug,
  undoWaterJug,
  validWaterJugVolumes,
  waterJugLevels,
  waterJugMove,
  waterJugWon,
  WATER_JUG_STATE_LIMIT,
  type WaterJugLevel,
  type WaterJugMove,
} from "../src/games/waterJugLogic";
import {
  applyRiverMove,
  createRiverState,
  isRiverSafe,
  legalRiverMoves,
  riverLevels,
  riverMove,
  riverMoveProblem,
  riverWon,
  searchRiver,
  solveRiver,
  undoRiver,
  validRiverBoard,
  RIVER_STATE_LIMIT,
  type RiverLevel,
  type RiverBoard,
} from "../src/games/riverLogic";

afterEach(cleanup);
const props = () => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
});
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
// Independent rule implementations establish shortest distance without calling either game solver.
function jugOracle(level: WaterJugLevel): number | null {
  const queue = [{ volumes: level.start, distance: 0 }],
    seen = new Set([level.start.join(",")]);
  for (let h = 0; h < queue.length; h++) {
    const { volumes, distance } = queue[h];
    if (volumes.every((n, i) => n === level.target[i])) return distance;
    for (let from = 0; from < volumes.length; from++) {
      const candidates: number[][] = [];
      for (const n of [0, level.capacities[from]]) {
        const next = [...volumes];
        next[from] = n;
        candidates.push(next);
      }
      for (let to = 0; to < volumes.length; to++) {
        if (to === from) continue;
        const next = [...volumes];
        while (next[from] > 0 && next[to] < level.capacities[to]) {
          next[from]--;
          next[to]++;
        }
        candidates.push(next);
      }
      for (const next of candidates)
        if (!seen.has(next.join(","))) {
          seen.add(next.join(","));
          queue.push({ volumes: next, distance: distance + 1 });
        }
    }
  }
  return null;
}
function riverOracle(level: RiverLevel): number | null {
  const n = level.items.length,
    goal = (1 << n) - 1;
  const start = level.start.positions.reduce<number>(
    (m, p, i) => m | (p << i),
    0,
  );
  const queue = [{ mask: start, boat: Number(level.start.boat), distance: 0 }],
    seen = new Set([`${start}:${level.start.boat}`]);
  for (let h = 0; h < queue.length; h++) {
    const { mask, boat, distance } = queue[h];
    if (mask === goal && boat === 1) return distance;
    for (let passengers = 0; passengers <= goal; passengers++) {
      const items = Array.from({ length: n }, (_, i) => i).filter(
        (i) => (passengers >> i) & 1,
      );
      if (
        items.length > level.capacity ||
        items.some((i) => ((mask >> i) & 1) !== boat)
      )
        continue;
      const next = mask ^ passengers,
        other = 1 - boat;
      if (
        level.conflicts.some(
          ([a, b]) =>
            ((next >> a) & 1) === ((next >> b) & 1) &&
            ((next >> a) & 1) !== other,
        )
      )
        continue;
      const key = `${next}:${other}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ mask: next, boat: other, distance: distance + 1 });
      }
    }
  }
  return null;
}
const readVolumes = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[data-jug]"), (element) =>
    Number(element.getAttribute("data-volume")),
  );
const readRiver = (container: HTMLElement): RiverBoard => {
  const items = Array.from(container.querySelectorAll("[data-river-item]"));
  return {
    positions: items
      .sort(
        (a, b) =>
          Number(a.getAttribute("data-river-item")) -
          Number(b.getAttribute("data-river-item")),
      )
      .map((item) => Number(item.getAttribute("data-bank")) as 0 | 1),
    boat: Number(
      container
        .querySelector("[data-river-boat]")
        ?.getAttribute("data-river-boat"),
    ) as 0 | 1,
  };
};
function clickJug(container: HTMLElement, move: WaterJugMove) {
  const jug = move.kind === "pour" ? move.from : move.jug;
  fireEvent.click(container.querySelector(`[data-jug="${jug}"]`)!);
  fireEvent.click(
    container.querySelector(
      move.kind === "pour"
        ? `[data-jug-action="pour"][data-jug-to="${move.to}"]`
        : `[data-jug-action="${move.kind}"]`,
    )!,
  );
}
function clickRiver(container: HTMLElement, passengers: number[]) {
  for (const i of passengers)
    fireEvent.click(container.querySelector(`[data-river-item="${i}"]`)!);
  fireEvent.click(container.querySelector("[data-river-sail]")!);
}

describe("24 original shortest certificates", () => {
  it("contains 12 distinct levels per game and progressively introduces new state spaces", () => {
    expect(waterJugLevels).toHaveLength(12);
    expect(riverLevels).toHaveLength(12);
    expect(
      waterJugLevels.slice(0, 6).every((l) => l.capacities.length === 2),
    ).toBe(true);
    expect(
      waterJugLevels.slice(6).every((l) => l.capacities.length === 3),
    ).toBe(true);
    expect(
      new Set(
        waterJugLevels.map((l) => JSON.stringify([l.capacities, l.target])),
      ).size,
    ).toBe(12);
    expect(
      new Set(
        riverLevels.map((l) =>
          JSON.stringify([l.items.length, l.capacity, l.conflicts]),
        ),
      ).size,
    ).toBe(12);
    expect(new Set(riverLevels.map((l) => l.capacity))).toEqual(
      new Set([1, 2, 3]),
    );
  });
  it.each(waterJugLevels.map((level, i) => [i + 1, level] as const))(
    "certifies jug challenge %i with an independent shortest oracle and exact undo",
    (_i, level) => {
      expect(jugOracle(level)).toBe(level.par);
      expect(solveWaterJug(level)).toEqual(level.solution);
      expect(level.solution).toHaveLength(level.par);
      let state = createWaterJugState(level);
      expect(waterJugWon(level, state.volumes)).toBe(false);
      for (const move of level.solution) {
        const previous = deepFreeze(state);
        state = waterJugMove(previous, level, move);
        expect(state).not.toBe(previous);
        expect(validWaterJugVolumes(level.capacities, state.volumes)).toBe(
          true,
        );
        if (move.kind === "pour")
          expect(state.volumes.reduce((a, b) => a + b, 0)).toBe(
            previous.volumes.reduce((a, b) => a + b, 0),
          );
      }
      expect(state.volumes).toEqual(level.target);
      expect(waterJugWon(level, state.volumes)).toBe(true);
      expect(solveWaterJug(level, state.volumes)).toEqual([]);
      expect(waterJugMove(state, level, { kind: "empty", jug: 0 })).toBe(state);
      while (state.history.length) state = undoWaterJug(deepFreeze(state));
      expect(state).toEqual(createWaterJugState(level));
    },
  );
  it.each(riverLevels.map((level, i) => [i + 1, level] as const))(
    "certifies river challenge %i with an independent shortest oracle and exact undo",
    (_i, level) => {
      expect(riverOracle(level)).toBe(level.par);
      expect(solveRiver(level)).toEqual(level.solution);
      expect(level.solution).toHaveLength(level.par);
      let state = createRiverState(level);
      expect(riverWon(level, state.board)).toBe(false);
      for (const passengers of level.solution) {
        const previous = deepFreeze(state);
        state = riverMove(previous, level, passengers);
        expect(state).not.toBe(previous);
        expect(isRiverSafe(level, state.board)).toBe(true);
        expect(state.board.boat).toBe(1 - previous.board.boat);
        state.board.positions.forEach((bank, i) =>
          expect(bank).toBe(
            passengers.includes(i)
              ? 1 - previous.board.positions[i]
              : previous.board.positions[i],
          ),
        );
        expect(passengers.length).toBeLessThanOrEqual(level.capacity);
      }
      expect(riverWon(level, state.board)).toBe(true);
      expect(solveRiver(level, state.board)).toEqual([]);
      expect(riverMove(state, level, [])).toBe(state);
      while (state.history.length) state = undoRiver(deepFreeze(state));
      expect(state).toEqual(createRiverState(level));
    },
  );
});

describe("bounded planning, invariants and impossible moves", () => {
  it("checks every reachable jug state and all its volume changes", () => {
    for (const level of waterJugLevels) {
      const queue = [level.start],
        seen = new Set([level.start.join(",")]);
      for (let h = 0; h < queue.length; h++) {
        const state = queue[h];
        for (const move of legalWaterJugMoves(level, state)) {
          const next = applyWaterJugMove(level, deepFreeze(state), move)!;
          expect(validWaterJugVolumes(level.capacities, next)).toBe(true);
          expect(next).not.toEqual(state);
          if (move.kind === "pour") {
            expect(next.reduce((a, b) => a + b, 0)).toBe(
              state.reduce((a, b) => a + b, 0),
            );
            expect(
              next[move.from] === 0 ||
                next[move.to] === level.capacities[move.to],
            ).toBe(true);
            next.forEach((n, i) => {
              if (i !== move.from && i !== move.to) expect(n).toBe(state[i]);
            });
          } else
            next.forEach((n, i) =>
              expect(n).toBe(
                i === move.jug
                  ? move.kind === "fill"
                    ? level.capacities[i]
                    : 0
                  : state[i],
              ),
            );
          const key = next.join(",");
          if (!seen.has(key)) {
            seen.add(key);
            queue.push(next);
          }
        }
      }
      expect(seen.size).toBeLessThanOrEqual(WATER_JUG_STATE_LIMIT);
      for (const board of queue) {
        const result = searchWaterJug(level, board);
        expect(result.status).toBe("solved");
        let reached = board;
        for (const move of result.solution!)
          reached = applyWaterJugMove(level, reached, move)!;
        expect(waterJugWon(level, reached)).toBe(true);
      }
    }
  });
  it("checks every reachable river state and all accepted unattended banks", () => {
    for (const level of riverLevels) {
      const queue = [level.start],
        seen = new Set([JSON.stringify(level.start)]);
      for (let h = 0; h < queue.length; h++)
        for (const passengers of legalRiverMoves(level, queue[h])) {
          const board = applyRiverMove(
            level,
            deepFreeze(queue[h]),
            passengers,
          )!;
          expect(validRiverBoard(level, board)).toBe(true);
          expect(isRiverSafe(level, board)).toBe(true);
          for (const [a, b] of level.conflicts)
            if (board.positions[a] === board.positions[b])
              expect(board.positions[a]).toBe(board.boat);
          expect(board.boat).toBe(1 - queue[h].boat);
          const key = JSON.stringify(board);
          if (!seen.has(key)) {
            seen.add(key);
            queue.push(board);
          }
        }
      expect(seen.size).toBeLessThanOrEqual(RIVER_STATE_LIMIT);
      for (const board of queue) {
        const result = searchRiver(level, board);
        expect(result.status).toBe("solved");
        let reached = board;
        for (const move of result.solution!)
          reached = applyRiverMove(level, reached, move)!;
        expect(riverWon(level, reached)).toBe(true);
      }
    }
  });
  it("rejects jug no-ops, fractional/out-of-range indices and invalid quantities without history", () => {
    const level = waterJugLevels[0],
      state = deepFreeze(createWaterJugState(level));
    for (const move of [
      { kind: "empty", jug: 0 },
      { kind: "fill", jug: 0.5 },
      { kind: "fill", jug: -1 },
      { kind: "empty", jug: 8 },
      { kind: "pour", from: 0, to: 1 },
      { kind: "pour", from: 0, to: 0 },
      { kind: "pour", from: 0, to: 0.5 },
    ] as WaterJugMove[]) {
      expect(applyWaterJugMove(level, state.volumes, move)).toBeNull();
      expect(waterJugMove(state, level, move)).toBe(state);
    }
    const filled = waterJugMove(state, level, { kind: "fill", jug: 1 });
    expect(waterJugMove(filled, level, { kind: "fill", jug: 1 })).toBe(filled);
    expect(undoWaterJug(state)).toBe(state);
    for (const volumes of [[-1, 0], [0, 3.5], [0, 4], [0], [NaN, 1]])
      expect(validWaterJugVolumes(level.capacities, volumes)).toBe(false);
    expect(validWaterJugVolumes([99, 2], [0, 0])).toBe(false);
  });
  it("rejects unsafe, remote, duplicated, overloaded or invalid river passengers", () => {
    const level = riverLevels[2],
      state = deepFreeze(createRiverState(level));
    for (const move of [[], [0], [2], [0, 1], [1, 1], [-1], [0.5], [3]]) {
      expect(applyRiverMove(level, state.board, move)).toBeNull();
      expect(riverMove(state, level, move)).toBe(state);
    }
    expect(riverMoveProblem(level, state.board, [])).toContain(
      "无人照看的左岸",
    );
    const moved = riverMove(state, level, [1]);
    expect(applyRiverMove(level, moved.board, [0])).toBeNull();
    expect(applyRiverMove(level, moved.board, [])!.positions).toEqual(
      moved.board.positions,
    );
    expect(applyRiverMove(level, moved.board, [])!.boat).not.toBe(
      moved.board.boat,
    );
    expect(undoRiver(state)).toBe(state);
    expect(isRiverSafe(level, { positions: [0, 0, 0], boat: 1 })).toBe(false);
    expect(validRiverBoard(level, { positions: [0], boat: 0 })).toBe(false);
  });
  it.each(waterJugLevels.map((l, i) => [i + 1, l] as const))(
    "finds a fresh jug route after each first-turn detour in level %i",
    (_i, level) => {
      for (const first of legalWaterJugMoves(level, level.start)) {
        let state = waterJugMove(createWaterJugState(level), level, first);
        const route = solveWaterJug(level, state.volumes);
        expect(route).not.toBeNull();
        for (const move of route!) state = waterJugMove(state, level, move);
        expect(waterJugWon(level, state.volumes)).toBe(true);
      }
    },
  );
  it.each(riverLevels.map((l, i) => [i + 1, l] as const))(
    "finds a fresh river route after legal detours in level %i",
    (_i, level) => {
      for (const first of legalRiverMoves(level, level.start)) {
        let state = riverMove(createRiverState(level), level, first);
        const route = solveRiver(level, state.board);
        expect(route).not.toBeNull();
        for (const move of route!) state = riverMove(state, level, move);
        expect(riverWon(level, state.board)).toBe(true);
      }
    },
  );
  it("distinguishes disconnected goals, already solved boards, invalid inputs and hard search limits", () => {
    const jug = { ...waterJugLevels[0], capacities: [2, 4], target: [1, 0] };
    expect(jugOracle(jug)).toBeNull();
    expect(searchWaterJug(jug).status).toBe("unreachable");
    expect(solveWaterJug(jug)).toBeNull();
    const river: RiverLevel = {
      ...riverLevels[2],
      conflicts: [
        [0, 1],
        [1, 2],
        [0, 2],
      ],
    };
    expect(riverOracle(river)).toBeNull();
    expect(searchRiver(river).status).toBe("unreachable");
    expect(solveRiver(river)).toBeNull();
    expect(searchWaterJug(waterJugLevels[0], waterJugLevels[0].target)).toEqual(
      { solution: [], visited: 1, status: "solved" },
    );
    expect(searchRiver(riverLevels[0], { positions: [1, 1], boat: 1 })).toEqual(
      { solution: [], visited: 1, status: "solved" },
    );
    expect(searchWaterJug(jug, [-1, 0]).status).toBe("invalid");
    expect(searchRiver(river, { positions: [0, 0, 0], boat: 1 }).status).toBe(
      "invalid",
    );
    expect(searchWaterJug(waterJugLevels[11], undefined, 1)).toEqual({
      solution: null,
      visited: 1,
      status: "limit",
    });
    expect(searchRiver(riverLevels[11], undefined, 1)).toEqual({
      solution: null,
      visited: 1,
      status: "limit",
    });
  });
  it("reports bounded solver visits and runtime for all 24 published starting states", () => {
    const start = performance.now();
    const jug = waterJugLevels.map((level) => searchWaterJug(level));
    const river = riverLevels.map((level) => searchRiver(level));
    expect(
      jug.every(
        (r) => r.status === "solved" && r.visited <= WATER_JUG_STATE_LIMIT,
      ),
    ).toBe(true);
    expect(
      river.every(
        (r) => r.status === "solved" && r.visited <= RIVER_STATE_LIMIT,
      ),
    ).toBe(true);
    console.info(
      `Transfer BFS: jug worst ${Math.max(...jug.map((r) => r.visited))}/${WATER_JUG_STATE_LIMIT} states; river worst ${Math.max(...river.map((r) => r.visited))}/${RIVER_STATE_LIMIT} states; all 24 ${Math.round(performance.now() - start)} ms.`,
    );
  });
});

describe("touch, keyboard and interruption controls", () => {
  it.each(waterJugLevels.map((l, i) => [i, l] as const))(
    "finishes jug UI %i using only visible controls, reporting completion once",
    (level, config) => {
      const base = { ...props(), level },
        view = render(
          <StrictMode>
            <WaterJugLab {...base} />
          </StrictMode>,
        );
      for (const move of config.solution) clickJug(view.container, move);
      expect(readVolumes(view.container)).toEqual(config.target);
      expect(base.onComplete).toHaveBeenCalledTimes(1);
      expect(
        view.container.querySelector("[data-jug-complete]"),
      ).not.toBeNull();
      fireEvent.keyDown(screen.getByRole("group"), { key: "e" });
      view.rerender(
        <StrictMode>
          <WaterJugLab {...base} hintToken={1} />
        </StrictMode>,
      );
      expect(base.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it.each(riverLevels.map((l, i) => [i, l] as const))(
    "finishes river UI %i using only visible controls, reporting completion once",
    (level, config) => {
      const base = { ...props(), level },
        view = render(
          <StrictMode>
            <RiverCrossingGarden {...base} />
          </StrictMode>,
        );
      for (const passengers of config.solution)
        clickRiver(view.container, passengers);
      expect(riverWon(config, readRiver(view.container))).toBe(true);
      expect(base.onComplete).toHaveBeenCalledTimes(1);
      fireEvent.click(view.container.querySelector("[data-river-sail]")!);
      fireEvent.keyDown(screen.getByRole("group"), { key: "Enter" });
      view.rerender(
        <StrictMode>
          <RiverCrossingGarden {...base} hintToken={1} />
        </StrictMode>,
      );
      expect(base.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it("jug controls reject repeated no-ops, support hotkeys, consume paused tokens and clear reset state", () => {
    const base = props(),
      view = render(<WaterJugLab {...base} />),
      board = screen.getByRole("group");
    fireEvent.keyDown(board, { key: "f" });
    fireEvent.keyDown(board, { key: "f" });
    expect(readVolumes(view.container)).toEqual([2, 0]);
    expect(view.container.querySelector("[data-jug-moves]")!.textContent).toBe(
      "1",
    );
    fireEvent.keyDown(board, { key: "e", repeat: true });
    expect(readVolumes(view.container)).toEqual([2, 0]);
    view.rerender(<WaterJugLab {...base} paused hintToken={1} undoToken={1} />);
    fireEvent.keyDown(board, { key: "e" });
    fireEvent.click(view.container.querySelector('[data-jug-action="empty"]')!);
    expect(readVolumes(view.container)).toEqual([2, 0]);
    view.rerender(<WaterJugLab {...base} hintToken={1} undoToken={1} />);
    expect(readVolumes(view.container)).toEqual([2, 0]);
    view.rerender(<WaterJugLab {...base} hintToken={2} undoToken={1} />);
    expect(screen.getByRole("status").textContent).toContain("当前水量");
    expect(view.container.querySelectorAll(".tp-hinted")).toHaveLength(1);
    view.rerender(<WaterJugLab {...base} hintToken={2} undoToken={2} />);
    expect(readVolumes(view.container)).toEqual([0, 0]);
    fireEvent.keyDown(board, { key: "2" });
    fireEvent.keyDown(board, { key: "f" });
    expect(readVolumes(view.container)).toEqual([0, 3]);
    view.rerender(
      <WaterJugLab {...base} resetToken={1} hintToken={2} undoToken={2} />,
    );
    expect(readVolumes(view.container)).toEqual([0, 0]);
    expect(view.container.querySelectorAll(".tp-hinted")).toHaveLength(0);
    expect(
      view.container
        .querySelector('[data-jug="0"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");
    view.rerender(<WaterJugLab {...base} level={11} />);
    expect(readVolumes(view.container)).toEqual(waterJugLevels[11].start);
  });
  it("river blocks unsafe moves, toggles repeated selections, enforces capacity and ignores double-click dispatch", () => {
    const base = { ...props(), level: 2 },
      view = render(<RiverCrossingGarden {...base} />),
      board = screen.getByRole("group");
    fireEvent.click(view.container.querySelector("[data-river-sail]")!);
    expect(readRiver(view.container)).toEqual(riverLevels[2].start);
    expect(screen.getByRole("status").textContent).toContain("无人照看");
    fireEvent.keyDown(board, { key: "2" });
    fireEvent.keyDown(board, { key: "2" });
    expect(
      view.container
        .querySelector('[data-river-item="1"]')!
        .getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.keyDown(board, { key: "2" });
    fireEvent.keyDown(board, { key: "1" });
    expect(screen.getByRole("status").textContent).toContain("船位满了");
    fireEvent.keyDown(board, { key: "Enter" });
    expect(readRiver(view.container)).toEqual({
      positions: [0, 1, 0],
      boat: 1,
    });
    fireEvent.click(view.container.querySelector("[data-river-sail]")!, {
      detail: 2,
    });
    expect(readRiver(view.container)).toEqual({
      positions: [0, 1, 0],
      boat: 1,
    });
    fireEvent.keyDown(board, { key: "1" });
    expect(screen.getByRole("status").textContent).toContain("先把船划到");
    fireEvent.keyDown(board, { key: "Enter", repeat: true });
    expect(readRiver(view.container).boat).toBe(1);
  });
  it("river pause consumes interrupted tokens, hint replans after an empty-return detour and undo restores boat and items", () => {
    const base = { ...props(), level: 2 },
      view = render(<RiverCrossingGarden {...base} />),
      board = screen.getByRole("group");
    clickRiver(view.container, [1]);
    const moved = readRiver(view.container);
    view.rerender(
      <RiverCrossingGarden {...base} paused hintToken={1} undoToken={1} />,
    );
    fireEvent.keyDown(board, { key: "Enter" });
    expect(readRiver(view.container)).toEqual(moved);
    view.rerender(
      <RiverCrossingGarden {...base} hintToken={1} undoToken={1} />,
    );
    expect(readRiver(view.container)).toEqual(moved);
    clickRiver(view.container, [1]);
    expect(readRiver(view.container)).toEqual(riverLevels[2].start);
    view.rerender(
      <RiverCrossingGarden {...base} hintToken={2} undoToken={1} />,
    );
    expect(screen.getByRole("status").textContent).toContain("最少还需 7 次");
    expect(
      view.container
        .querySelector('[data-river-item="1"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      view.container.querySelector("[data-river-sail]")!.className,
    ).toContain("tp-hinted");
    view.rerender(
      <RiverCrossingGarden {...base} hintToken={2} undoToken={2} />,
    );
    expect(readRiver(view.container)).toEqual(moved);
    expect(
      view.container.querySelectorAll('[aria-pressed="true"]'),
    ).toHaveLength(0);
    view.rerender(
      <RiverCrossingGarden
        {...base}
        resetToken={1}
        hintToken={2}
        undoToken={2}
      />,
    );
    expect(readRiver(view.container)).toEqual(riverLevels[2].start);
    view.rerender(
      <RiverCrossingGarden
        {...base}
        level={11}
        resetToken={1}
        hintToken={2}
        undoToken={2}
      />,
    );
    expect(readRiver(view.container)).toEqual(riverLevels[11].start);
  });
  it("undoing and replaying completion is idempotent while reset starts a fresh round in both games", () => {
    const jugProps = props(),
      jug = render(<WaterJugLab {...jugProps} />);
    waterJugLevels[0].solution.forEach((move) => clickJug(jug.container, move));
    jug.rerender(<WaterJugLab {...jugProps} undoToken={1} />);
    clickJug(jug.container, waterJugLevels[0].solution.at(-1)!);
    expect(jugProps.onComplete).toHaveBeenCalledTimes(1);
    jug.rerender(<WaterJugLab {...jugProps} resetToken={1} undoToken={1} />);
    waterJugLevels[0].solution.forEach((move) => clickJug(jug.container, move));
    expect(jugProps.onComplete).toHaveBeenCalledTimes(2);
    jug.unmount();
    const riverProps = props(),
      river = render(<RiverCrossingGarden {...riverProps} />);
    riverLevels[0].solution.forEach((move) =>
      clickRiver(river.container, move),
    );
    river.rerender(<RiverCrossingGarden {...riverProps} undoToken={1} />);
    clickRiver(river.container, riverLevels[0].solution.at(-1)!);
    expect(riverProps.onComplete).toHaveBeenCalledTimes(1);
    river.rerender(
      <RiverCrossingGarden {...riverProps} resetToken={1} undoToken={1} />,
    );
    riverLevels[0].solution.forEach((move) =>
      clickRiver(river.container, move),
    );
    expect(riverProps.onComplete).toHaveBeenCalledTimes(2);
  });
});
