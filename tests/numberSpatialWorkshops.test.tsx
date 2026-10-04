// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import FractionMosaic from "../src/games/FractionMosaic";
import CoordinateTreasure from "../src/games/CoordinateTreasure";
import {
  applyFractionMove,
  createFractionState,
  formatFraction,
  fractionMosaicLevels,
  fractionMosaicSolutions,
  fractionMove,
  fractionWon,
  legalFractionMoves,
  searchFraction,
  undoFraction,
  validFractionBoard,
  FRACTION_SEARCH_LIMIT,
  type FractionBoard,
  type FractionLevel,
  type FractionMove,
} from "../src/games/fractionMosaicLogic";
import {
  applyCoordinateMove,
  coordinateEqual,
  coordinateLabel,
  coordinateMove,
  coordinatePath,
  coordinateTreasureLevels,
  coordinateTreasureSolutions,
  coordinateWon,
  createCoordinateState,
  searchCoordinate,
  undoCoordinate,
  validCoordinateBoard,
  vectorLabel,
  COORDINATE_SEARCH_LIMIT,
  type CoordinateBoard,
  type CoordinateLevel,
} from "../src/games/coordinateTreasureLogic";

afterEach(cleanup);
const props = (overrides: Partial<GameProps> = {}) => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onStatus: vi.fn(),
  onComplete: vi.fn(),
  ...overrides,
});
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
const button = (query: string) => {
  const found = document.querySelector<HTMLButtonElement>(query);
  expect(found, query).not.toBeNull();
  return found!;
};
const piece = (id: string) => button(`[data-fraction-piece="${id}"]`);
const action = (name: string) => button(`[data-fraction-action="${name}"]`);
const tray = (n: number) => button(`[data-fraction-tray="${n}"]`);
const vector = (n: number) => button(`[data-vector-card="${n}"]`);
const depart = () => button('[data-coordinate-action="move"]');
function clickFraction(move: FractionMove) {
  if (move.kind === "join") {
    fireEvent.click(piece(move.first));
    fireEvent.click(piece(move.second));
    fireEvent.click(action("join"));
  } else {
    fireEvent.click(piece(move.piece));
    fireEvent.click(
      move.kind === "split" ? action(`split-${move.parts}`) : tray(move.tray),
    );
  }
}
function clickCoordinate(card: number) {
  fireEvent.click(vector(card));
  fireEvent.click(depart());
}

// Independent certificate checker: no production reducers, search, validity or won functions.
function fractionCertificate(level: FractionLevel) {
  const stock = new Map(level.stock.map((n, i) => [`p${i}`, BigInt(n)]));
  const filled = new Set<number>();
  let cuts = level.cuts,
    serial = 0;
  const initial = level.stock.reduce((a, b) => a + BigInt(b), 0n);
  expect(level.targets.reduce((a, b) => a + BigInt(b), 0n)).toBe(initial);
  for (const move of level.solution) {
    if (move.kind === "join") {
      expect(move.first).not.toBe(move.second);
      const a = stock.get(move.first),
        b = stock.get(move.second);
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      expect(a! + b!).toBeLessThanOrEqual(BigInt(level.denominator));
      stock.delete(move.first);
      stock.delete(move.second);
      stock.set(`m${serial++}`, a! + b!);
    } else {
      const n = stock.get(move.piece);
      expect(n).toBeDefined();
      stock.delete(move.piece);
      if (move.kind === "split") {
        expect(cuts--).toBeGreaterThan(0);
        expect(n! % BigInt(move.parts)).toBe(0n);
        for (let i = 0; i < move.parts; i++)
          stock.set(`s${serial}-${i}`, n! / BigInt(move.parts));
        serial++;
      } else {
        expect(filled.has(move.tray)).toBe(false);
        expect(n).toBe(BigInt(level.targets[move.tray]));
        filled.add(move.tray);
      }
    }
    expect(stock.size).toBeLessThanOrEqual(10);
    const total =
      [...stock.values()].reduce((a, b) => a + b, 0n) +
      [...filled].reduce((a, i) => a + BigInt(level.targets[i]), 0n);
    expect(total).toBe(initial);
  }
  expect(stock.size).toBe(0);
  expect(filled.size).toBe(level.targets.length);
  expect(cuts).toBeGreaterThanOrEqual(0);
}
// A separate exhaustive multiset reachability oracle. It knows no piece IDs or production search.
function fractionOracle(
  level: FractionLevel,
  initial?: FractionBoard,
): boolean {
  type Node = { pieces: number[]; mask: number; cuts: number };
  const seen = new Set<string>(),
    all = (1 << level.targets.length) - 1;
  function visit({ pieces, mask, cuts }: Node): boolean {
    if (!pieces.length) return mask === all;
    const sorted = [...pieces].sort((a, b) => a - b),
      key = `${sorted}|${mask}|${cuts}`;
    if (seen.has(key)) return false;
    seen.add(key);
    for (let i = 0; i < pieces.length; i++) {
      const others = pieces.filter((_, j) => j !== i),
        value = pieces[i];
      for (let t = 0; t < level.targets.length; t++)
        if (
          !(mask & (1 << t)) &&
          level.targets[t] === value &&
          visit({ pieces: others, mask: mask | (1 << t), cuts })
        )
          return true;
      for (let j = i + 1; j < pieces.length; j++)
        if (
          value + pieces[j] <= level.denominator &&
          visit({
            pieces: [
              ...pieces.filter((_, k) => k !== i && k !== j),
              value + pieces[j],
            ],
            mask,
            cuts,
          })
        )
          return true;
      if (cuts)
        for (const n of [2, 3])
          if (
            value % n === 0 &&
            pieces.length + n - 1 <= 10 &&
            visit({
              pieces: [...others, ...Array(n).fill(value / n)],
              mask,
              cuts: cuts - 1,
            })
          )
            return true;
    }
    return false;
  }
  return visit(
    initial
      ? {
          pieces: initial.pieces.map((p) => p.units),
          mask: initial.filled.reduce((m, v, i) => m | (v ? 1 << i : 0), 0),
          cuts: initial.cutsLeft,
        }
      : { pieces: level.stock, mask: 0, cuts: level.cuts },
  );
}
function coordinateCertificate(level: CoordinateLevel) {
  let [x, y] = [level.start.x, level.start.y];
  const remaining = level.cards.map((c) => c.count),
    found = new Set<string>();
  for (const index of level.solution) {
    const card = level.cards[index];
    expect(remaining[index]--).toBeGreaterThan(0);
    expect(
      !card.dx || !card.dy || Math.abs(card.dx) === Math.abs(card.dy),
    ).toBe(true);
    const steps = Math.max(Math.abs(card.dx), Math.abs(card.dy));
    expect(steps).toBeGreaterThan(0);
    for (let i = 1; i <= steps; i++) {
      const u = x + Math.sign(card.dx) * i,
        v = y + Math.sign(card.dy) * i;
      expect(u).toBeGreaterThanOrEqual(level.min);
      expect(v).toBeGreaterThanOrEqual(level.min);
      expect(u).toBeLessThan(level.min + level.size);
      expect(v).toBeLessThan(level.min + level.size);
      expect(level.rocks.some((p) => p.x === u && p.y === v)).toBe(false);
    }
    x += card.dx;
    y += card.dy;
    if (level.gems.some((p) => p.x === x && p.y === y)) found.add(`${x},${y}`);
  }
  expect(found.size).toBe(level.gems.length);
  expect([x, y]).toEqual([level.finish.x, level.finish.y]);
}
function coordinateOracle(
  level: CoordinateLevel,
  initial?: CoordinateBoard,
): number | null {
  type Node = {
    x: number;
    y: number;
    used: number[];
    mask: number;
    depth: number;
  };
  const queue: Node[] = [
    initial
      ? {
          x: initial.position.x,
          y: initial.position.y,
          used: level.cards.map((c, i) => c.count - initial.remaining[i]),
          mask: initial.collected,
          depth: 0,
        }
      : {
          x: level.start.x,
          y: level.start.y,
          used: level.cards.map(() => 0),
          mask: 0,
          depth: 0,
        },
  ];
  const seen = new Set<string>();
  for (let h = 0; h < queue.length; h++) {
    const s = queue[h];
    if (
      s.mask === (1 << level.gems.length) - 1 &&
      s.x === level.finish.x &&
      s.y === level.finish.y
    )
      return s.depth;
    for (let c = 0; c < level.cards.length; c++) {
      const card = level.cards[c];
      if (s.used[c] >= card.count) continue;
      let legal = true;
      for (
        let i = 1;
        i <= Math.max(Math.abs(card.dx), Math.abs(card.dy));
        i++
      ) {
        const x = s.x + Math.sign(card.dx) * i,
          y = s.y + Math.sign(card.dy) * i;
        if (
          x < level.min ||
          y < level.min ||
          x >= level.min + level.size ||
          y >= level.min + level.size ||
          level.rocks.some((p) => p.x === x && p.y === y)
        )
          legal = false;
      }
      if (!legal) continue;
      const x = s.x + card.dx,
        y = s.y + card.dy,
        used = [...s.used];
      used[c]++;
      let mask = s.mask;
      level.gems.forEach((p, i) => {
        if (p.x === x && p.y === y) mask |= 1 << i;
      });
      const key = `${x},${y}|${mask}|${used}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ x, y, used, mask, depth: s.depth + 1 });
    }
  }
  return null;
}

describe("24 original certified number and spatial levels", () => {
  it("exports twelve distinct progressive levels per game and exact certificate arrays", () => {
    expect(fractionMosaicLevels).toHaveLength(12);
    expect(coordinateTreasureLevels).toHaveLength(12);
    expect(fractionMosaicSolutions).toEqual(
      fractionMosaicLevels.map((l) => l.solution),
    );
    expect(coordinateTreasureSolutions).toEqual(
      coordinateTreasureLevels.map((l) => l.solution),
    );
    expect(
      new Set(
        fractionMosaicLevels.map((l) =>
          JSON.stringify([l.stock, l.targets, l.denominator]),
        ),
      ).size,
    ).toBe(12);
    expect(
      new Set(
        coordinateTreasureLevels.map((l) =>
          JSON.stringify([l.start, l.finish, l.gems, l.rocks, l.cards]),
        ),
      ).size,
    ).toBe(12);
    expect(fractionMosaicLevels.map((l) => l.cuts)).toEqual([
      0, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4,
    ]);
    expect(coordinateTreasureLevels.at(-1)!.gems.length).toBe(6);
  });
  for (const [i, level] of fractionMosaicLevels.entries()) {
    it(`fraction ${i + 1}: independent exact certificate, independent reachability, current-state search and reversibility`, () => {
      fractionCertificate(level);
      expect(fractionOracle(level)).toBe(true);
      let state = createFractionState(level);
      const original = JSON.stringify(state);
      const result = searchFraction(level, freeze(state));
      expect(result.status).toBe("found");
      expect(result.visited).toBeLessThanOrEqual(FRACTION_SEARCH_LIMIT);
      for (const move of result.moves) {
        const next = fractionMove(state, level, move);
        expect(next).not.toBe(state);
        expect(validFractionBoard(level, next)).toBe(true);
        state = next;
      }
      expect(fractionWon(level, state)).toBe(true);
      expect(searchFraction(level, state).status).toBe("solved");
      expect(fractionMove(state, level, level.solution[0])).toBe(state);
      while (state.history.length) state = undoFraction(state);
      expect(JSON.stringify(state)).toBe(original);
      for (const move of level.solution)
        state = fractionMove(state, level, move);
      expect(fractionWon(level, state)).toBe(true);
    });
    it(`fraction ${i + 1}: complete touch/click route and single completion`, () => {
      const p = props({ level: i }),
        view = render(<FractionMosaic {...p} />);
      for (const move of level.solution) clickFraction(move);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        document.querySelectorAll('[data-fraction-tray][data-filled="true"]'),
      ).toHaveLength(level.targets.length);
      view.rerender(
        <FractionMosaic
          {...p}
          hintToken={1}
          undoToken={1}
          onStatus={vi.fn()}
        />,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    });
  }
  for (const [i, level] of coordinateTreasureLevels.entries()) {
    it(`coordinate ${i + 1}: independent path certificate and shortest-route oracle agree with bounded BFS`, () => {
      coordinateCertificate(level);
      let state = createCoordinateState(level);
      const initial = JSON.stringify(state),
        distance = coordinateOracle(level);
      expect(distance).not.toBeNull();
      const result = searchCoordinate(level, freeze(state));
      expect(result.status).toBe("found");
      expect(result.moves.length).toBe(distance);
      expect(result.visited).toBeLessThanOrEqual(COORDINATE_SEARCH_LIMIT);
      for (const move of result.moves) {
        const next = coordinateMove(state, level, move);
        expect(next).not.toBe(state);
        expect(validCoordinateBoard(level, next)).toBe(true);
        state = next;
      }
      expect(coordinateWon(level, state)).toBe(true);
      expect(searchCoordinate(level, state).status).toBe("solved");
      expect(coordinateMove(state, level, 0)).toBe(state);
      while (state.history.length) state = undoCoordinate(state);
      expect(JSON.stringify(state)).toBe(initial);
      for (const move of level.solution)
        state = coordinateMove(state, level, move);
      expect(coordinateWon(level, state)).toBe(true);
    });
    it(`coordinate ${i + 1}: complete click route and idempotent completion`, () => {
      const p = props({ level: i }),
        view = render(<CoordinateTreasure {...p} />);
      for (const move of level.solution) clickCoordinate(move);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        document
          .querySelector("[data-coordinate-collected]")!
          .getAttribute("data-coordinate-collected"),
      ).toBe(String(level.gems.length));
      view.rerender(
        <CoordinateTreasure
          {...p}
          hintToken={1}
          undoToken={1}
          onComplete={p.onComplete}
        />,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    });
  }
});

describe("fraction rules and current-state hints", () => {
  it("uses reduced exact rational displays and never mutates frozen inputs", () => {
    expect(formatFraction(8, 24)).toBe("1/3");
    expect(formatFraction(24, 24)).toBe("1");
    expect(formatFraction(7, 24)).toBe("7/24");
    const l = fractionMosaicLevels[0],
      s = freeze(createFractionState(l)),
      next = fractionMove(s, l, l.solution[0]);
    expect(next.pieces.at(-1)!.units).toBe(2);
    expect(s.pieces).toHaveLength(3);
    expect(undoFraction(createFractionState(l)).history).toEqual([]);
  });
  it("rejects stale IDs, duplicate selection, invalid targets, overflow, indivisible cuts and exhausted cuts", () => {
    const l = fractionMosaicLevels[0],
      s = createFractionState(l);
    const moves: FractionMove[] = [
      { kind: "join", first: "p0", second: "p0" },
      { kind: "join", first: "p0", second: "missing" },
      { kind: "serve", piece: "p0", tray: 0 },
      { kind: "serve", piece: "p2", tray: 99 },
      { kind: "serve", piece: "p2", tray: -1 },
      { kind: "serve", piece: "p2", tray: NaN },
      { kind: "split", piece: "p2", parts: 2 },
    ];
    for (const move of moves) expect(fractionMove(s, l, move)).toBe(s);
    const big = fractionMosaicLevels[6],
      start = createFractionState(big);
    expect(
      applyFractionMove(big, start, {
        kind: "join",
        first: "p0",
        second: "p1",
      }),
    ).not.toBeNull();
    const custom = { ...big, stock: [8, 8], targets: [8, 8] },
      cs = createFractionState(custom);
    expect(
      fractionMove(cs, custom, { kind: "join", first: "p0", second: "p1" }),
    ).toBe(cs);
    expect(
      fractionMove(start, big, { kind: "split", piece: "p0", parts: 2 }),
    ).toBe(start);
    const served = fractionMove(s, l, { kind: "serve", piece: "p2", tray: 0 });
    expect(
      fractionMove(served, l, { kind: "serve", piece: "p0", tray: 0 }),
    ).toBe(served);
  });
  it("distinguishes exhaustive dead ends from budget exhaustion, and searches the current pieces", () => {
    const l = fractionMosaicLevels[0],
      s = createFractionState(l),
      bad = fractionMove(s, l, { kind: "join", first: "p0", second: "p2" });
    expect(searchFraction(l, bad).status).toBe("unsolvable");
    expect(fractionOracle(l, bad)).toBe(false);
    expect(searchFraction(l, s, 0)).toEqual({
      status: "limit",
      moves: [],
      visited: 0,
    });
    expect(searchFraction(l, s, 1).status).toBe("limit");
    expect(searchFraction(l, { ...s, cutsLeft: -1 }).status).toBe("invalid");
    expect(
      searchFraction(l, { ...s, pieces: [...s.pieces, s.pieces[0]] }).status,
    ).toBe("invalid");
    const current = fractionMove(s, l, { kind: "serve", piece: "p2", tray: 1 }),
      result = searchFraction(l, current);
    expect(result.status).toBe("found");
    expect(result.moves.every((m) => m.kind !== "serve" || m.tray !== 1)).toBe(
      true,
    );
    for (const move of legalFractionMoves(l, current))
      expect(applyFractionMove(l, current, move)).not.toBeNull();
  });
});

describe("coordinate rules and honest route hints", () => {
  it("blocks middle rocks, diagonal middle rocks, edges, unavailable and stale cards", () => {
    const base = coordinateTreasureLevels[0],
      s = createCoordinateState(base),
      east = base.cards.findIndex((c) => c.dx === 2);
    const blocked = { ...base, rocks: [{ x: 1, y: 0 }] };
    expect(applyCoordinateMove(blocked, s, east)).toBeNull();
    expect(applyCoordinateMove(base, s, -1)).toBeNull();
    expect(applyCoordinateMove(base, s, 0.5)).toBeNull();
    expect(applyCoordinateMove(base, s, NaN)).toBeNull();
    expect(
      applyCoordinateMove(
        base,
        { ...s, remaining: s.remaining.map(() => 0) },
        east,
      ),
    ).toBeNull();
    const diagonal = coordinateTreasureLevels[3],
      ds = createCoordinateState(diagonal),
      d = diagonal.cards.findIndex((c) => c.dx === 2 && c.dy === 2);
    expect(
      applyCoordinateMove({ ...diagonal, rocks: [{ x: 1, y: 1 }] }, ds, d),
    ).toBeNull();
    const edge = { ...s, position: { x: 3, y: 0 } };
    expect(applyCoordinateMove(base, edge, east)).toBeNull();
  });
  it("collects only at landing, returns cards and gems on undo, and does not demand all cards be used", () => {
    const custom: CoordinateLevel = {
      title: "test",
      size: 4,
      min: 0,
      start: { x: 0, y: 0 },
      finish: { x: 2, y: 0 },
      rocks: [],
      gems: [{ x: 1, y: 0 }],
      cards: [
        { dx: 2, dy: 0, count: 1 },
        { dx: -1, dy: 0, count: 1 },
        { dx: 1, dy: 0, count: 2 },
      ],
      idea: "",
      solution: [],
    };
    let s = createCoordinateState(custom);
    s = coordinateMove(s, custom, 0);
    expect(s.collected).toBe(0);
    expect(coordinateWon(custom, s)).toBe(false);
    s = coordinateMove(s, custom, 1);
    expect(s.collected).toBe(1);
    const previous = undoCoordinate(s);
    expect(previous.collected).toBe(0);
    expect(previous.remaining[1]).toBe(1);
    s = coordinateMove(s, custom, 2);
    expect(coordinateWon(custom, s)).toBe(true);
    expect(s.remaining[2]).toBe(1);
  });
  it("distinguishes dead ends, exhausted budgets and invalid states; resumes from current resources", () => {
    const l = coordinateTreasureLevels[0],
      s = createCoordinateState(l);
    expect(searchCoordinate(l, s, 0)).toEqual({
      status: "limit",
      moves: [],
      visited: 0,
    });
    expect(searchCoordinate(l, s, 1).status).toBe("limit");
    const stuck = { ...s, remaining: s.remaining.map(() => 0) };
    expect(searchCoordinate(l, stuck).status).toBe("unsolvable");
    expect(coordinateOracle(l, stuck)).toBeNull();
    expect(
      searchCoordinate(l, { ...s, position: { x: 20, y: 0 } }).status,
    ).toBe("invalid");
    expect(searchCoordinate(l, { ...s, collected: 99 }).status).toBe("invalid");
    const current = coordinateMove(s, l, l.solution[0]),
      route = searchCoordinate(l, current);
    expect(route.status).toBe("found");
    expect(route.moves.length).toBe(coordinateOracle(l, current));
    expect(vectorLabel({ dx: -2, dy: 3 })).toBe("(-2, +3)");
    expect(coordinateLabel({ x: -1, y: 2 })).toBe("(-1, 2)");
    expect(coordinateEqual(l.start, l.finish)).toBe(false);
  });
});

describe("fraction UI lifecycle and accessibility", () => {
  it("pauses selection, actions, hints and undo without queued actions on resume", () => {
    const p = props(),
      view = render(<FractionMosaic {...p} />);
    fireEvent.click(piece("p0"));
    fireEvent.click(piece("p1"));
    view.rerender(<FractionMosaic {...p} paused hintToken={1} undoToken={1} />);
    fireEvent.click(action("join"));
    fireEvent.click(piece("p2"));
    expect(piece("p0").getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll("[data-fraction-piece]")).toHaveLength(3);
    view.rerender(<FractionMosaic {...p} hintToken={1} undoToken={1} />);
    expect(document.querySelectorAll(".nsw-hinted")).toHaveLength(0);
    fireEvent.click(action("join"));
    expect(document.querySelectorAll("[data-fraction-piece]")).toHaveLength(2);
    view.rerender(<FractionMosaic {...p} hintToken={1} undoToken={2} />);
    expect(document.querySelectorAll("[data-fraction-piece]")).toHaveLength(3);
  });
  it("hints only select, undo restores cuts and trays, reset and level changes clear all state", () => {
    const p = props({ level: 1 }),
      view = render(<FractionMosaic {...p} />);
    view.rerender(<FractionMosaic {...p} hintToken={1} />);
    expect(piece("p0").getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll("[data-fraction-piece]")).toHaveLength(1);
    fireEvent.click(action("split-2"));
    expect(
      document
        .querySelector("[data-fraction-cuts]")!
        .getAttribute("data-fraction-cuts"),
    ).toBe("0");
    clickFraction(fractionMosaicLevels[1].solution[1]);
    view.rerender(<FractionMosaic {...p} hintToken={1} undoToken={1} />);
    expect(tray(0).getAttribute("data-filled")).toBe("false");
    expect(document.querySelectorAll("[data-fraction-piece]")).toHaveLength(2);
    view.rerender(<FractionMosaic {...p} hintToken={1} undoToken={2} />);
    expect(
      document
        .querySelector("[data-fraction-cuts]")!
        .getAttribute("data-fraction-cuts"),
    ).toBe("1");
    expect(piece("p0")).toBeTruthy();
    view.rerender(<FractionMosaic {...p} hintToken={2} undoToken={2} />);
    view.rerender(
      <FractionMosaic {...p} hintToken={2} undoToken={2} resetToken={1} />,
    );
    expect(
      document.querySelectorAll('[aria-pressed="true"],.nsw-hinted'),
    ).toHaveLength(0);
    view.rerender(
      <FractionMosaic
        {...p}
        level={11}
        hintToken={2}
        undoToken={2}
        resetToken={1}
      />,
    );
    expect(document.querySelectorAll("[data-fraction-tray]")).toHaveLength(3);
    expect(
      document
        .querySelector("[data-fraction-cuts]")!
        .getAttribute("data-fraction-cuts"),
    ).toBe("4");
  });
  it("supports selection replacement, clear, wrong-tray feedback and honest dead-end status", () => {
    const p = props(),
      view = render(<FractionMosaic {...p} />);
    fireEvent.click(piece("p0"));
    fireEvent.click(piece("p0"));
    expect(piece("p0").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(piece("p0"));
    fireEvent.click(piece("p1"));
    fireEvent.click(piece("p2"));
    expect(
      document.querySelectorAll('[data-fraction-piece][aria-pressed="true"]'),
    ).toHaveLength(1);
    fireEvent.click(action("clear"));
    fireEvent.click(piece("p0"));
    fireEvent.click(tray(0));
    expect(screen.getByRole("status").textContent).toContain("精确相等");
    expect(document.querySelectorAll("[data-fraction-piece]")).toHaveLength(3);
    fireEvent.click(piece("p2"));
    fireEvent.click(action("join"));
    view.rerender(<FractionMosaic {...p} hintToken={1} />);
    expect(screen.getByRole("status").textContent).toContain("无法完成");
    expect(document.querySelectorAll(".nsw-hinted")).toHaveLength(0);
  });
  it("supports keyboard Enter/Space and idempotent StrictMode completion across reset", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(
        <StrictMode>
          <FractionMosaic {...p} />
        </StrictMode>,
      );
    piece("p0").focus();
    await user.keyboard("{Enter}");
    piece("p1").focus();
    await user.keyboard(" ");
    action("join").focus();
    await user.keyboard("{Enter}");
    for (const move of fractionMosaicLevels[0].solution.slice(1))
      clickFraction(move);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <FractionMosaic {...p} onStatus={vi.fn()} />
      </StrictMode>,
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <FractionMosaic {...p} resetToken={1} />
      </StrictMode>,
    );
    for (const move of fractionMosaicLevels[0].solution) clickFraction(move);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
});

describe("coordinate UI lifecycle and accessibility", () => {
  it("previews without consuming a card, supports destination clicks and restores resources on undo", () => {
    const p = props(),
      l = coordinateTreasureLevels[0],
      view = render(<CoordinateTreasure {...p} />),
      first = l.solution[0];
    fireEvent.click(vector(first));
    expect(vector(first).getAttribute("data-remaining")).toBe("1");
    expect(document.querySelectorAll('[data-preview="true"]')).toHaveLength(2);
    fireEvent.click(button('[data-coordinate-cell="2,0"]'));
    expect(vector(first).getAttribute("data-remaining")).toBe("0");
    expect(
      document
        .querySelector("[data-coordinate-collected]")!
        .getAttribute("data-coordinate-collected"),
    ).toBe("1");
    view.rerender(<CoordinateTreasure {...p} undoToken={1} />);
    expect(vector(first).getAttribute("data-remaining")).toBe("1");
    expect(
      document
        .querySelector("[data-coordinate-position]")!
        .getAttribute("data-coordinate-position"),
    ).toBe("(0, 0)");
    expect(
      document
        .querySelector("[data-coordinate-collected]")!
        .getAttribute("data-coordinate-collected"),
    ).toBe("0");
  });
  it("pause blocks all actions and consumes pending hint/undo tokens without replay", () => {
    const p = props(),
      view = render(<CoordinateTreasure {...p} />),
      first = coordinateTreasureLevels[0].solution[0];
    fireEvent.click(vector(first));
    view.rerender(
      <CoordinateTreasure {...p} paused hintToken={1} undoToken={1} />,
    );
    fireEvent.click(depart());
    expect(document.querySelectorAll('[data-preview="true"]')).toHaveLength(0);
    expect(vector(first).getAttribute("data-remaining")).toBe("1");
    view.rerender(<CoordinateTreasure {...p} hintToken={1} undoToken={1} />);
    expect(vector(first).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(depart());
    expect(vector(first).getAttribute("data-remaining")).toBe("0");
  });
  it("uses current-state hints without auto-moving, clears previews, resets and changes level", () => {
    const p = props(),
      view = render(<CoordinateTreasure {...p} />);
    clickCoordinate(coordinateTreasureLevels[0].solution[0]);
    view.rerender(<CoordinateTreasure {...p} hintToken={1} />);
    expect(screen.getByRole("status").textContent).toContain("还有 2 步");
    expect(
      document
        .querySelector("[data-coordinate-position]")!
        .getAttribute("data-coordinate-position"),
    ).toBe("(2, 0)");
    fireEvent.click(button('[data-coordinate-action="clear"]'));
    expect(document.querySelectorAll('[data-preview="true"]')).toHaveLength(0);
    view.rerender(<CoordinateTreasure {...p} hintToken={2} />);
    view.rerender(<CoordinateTreasure {...p} hintToken={2} resetToken={1} />);
    expect(
      document.querySelectorAll('[aria-pressed="true"],.nsw-hinted'),
    ).toHaveLength(0);
    expect(
      document
        .querySelector("[data-coordinate-position]")!
        .getAttribute("data-coordinate-position"),
    ).toBe("(0, 0)");
    view.rerender(
      <CoordinateTreasure {...p} level={11} hintToken={2} resetToken={1} />,
    );
    expect(document.querySelectorAll("[data-coordinate-cell]")).toHaveLength(
      49,
    );
    expect(
      document
        .querySelector("[data-coordinate-position]")!
        .getAttribute("data-coordinate-position"),
    ).toBe("(-3, -3)");
  });
  it("explains an illegal preview, allows deselection, and reports a proven dead end", () => {
    const p = props({ level: 1 }),
      l = coordinateTreasureLevels[1],
      view = render(<CoordinateTreasure {...p} />),
      east = l.cards.findIndex((c) => c.dx === 1);
    fireEvent.click(vector(east));
    expect(screen.getByRole("status").textContent).toContain("礁石");
    expect(depart().disabled).toBe(true);
    expect(vector(east).getAttribute("data-remaining")).toBe("1");
    fireEvent.click(vector(east));
    expect(vector(east).getAttribute("aria-pressed")).toBe("false");
    view.rerender(<CoordinateTreasure {...p} level={0} />);
    const bad = coordinateTreasureLevels[0].cards.findIndex((c) => c.dx === 1);
    clickCoordinate(bad);
    view.rerender(<CoordinateTreasure {...p} level={0} hintToken={1} />);
    expect(screen.getByRole("status").textContent).toContain("无法收齐");
  });
  it("supports keyboard-only moves and idempotent StrictMode completion across reset", async () => {
    const user = userEvent.setup(),
      p = props(),
      l = coordinateTreasureLevels[0],
      view = render(
        <StrictMode>
          <CoordinateTreasure {...p} />
        </StrictMode>,
      );
    vector(l.solution[0]).focus();
    await user.keyboard(" ");
    depart().focus();
    await user.keyboard("{Enter}");
    for (const move of l.solution.slice(1)) clickCoordinate(move);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <CoordinateTreasure {...p} onStatus={vi.fn()} />
      </StrictMode>,
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <CoordinateTreasure {...p} resetToken={1} />
      </StrictMode>,
    );
    for (const move of l.solution) clickCoordinate(move);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
});

describe("certified hints after off-route decisions", () => {
  it("matches an independent solver after every legal first fraction move", () => {
    for (const level of fractionMosaicLevels)
      for (const move of legalFractionMoves(
        level,
        createFractionState(level),
      )) {
        const state = fractionMove(createFractionState(level), level, move),
          result = searchFraction(level, state),
          solvable = fractionOracle(level, state);
        expect(result.status).toBe(solvable ? "found" : "unsolvable");
        let current = state;
        for (const next of result.moves)
          current = fractionMove(current, level, next);
        if (solvable) expect(fractionWon(level, current)).toBe(true);
      }
  });
  it("matches independent shortest distances after every legal first vector move", () => {
    for (const level of coordinateTreasureLevels)
      for (let card = 0; card < level.cards.length; card++) {
        const initial = createCoordinateState(level),
          state = coordinateMove(initial, level, card);
        if (state === initial) continue;
        const distance = coordinateOracle(level, state),
          result = searchCoordinate(level, state);
        expect(result.status).toBe(distance === null ? "unsolvable" : "found");
        if (distance !== null) expect(result.moves.length).toBe(distance);
      }
  });
  it("finds a valid completion from every certificate prefix without consulting certificates", () => {
    for (const level of fractionMosaicLevels) {
      let state = createFractionState(level);
      for (const move of level.solution) {
        const result = searchFraction(level, state);
        expect(result.status).toBe("found");
        state = fractionMove(state, level, move);
      }
    }
    for (const level of coordinateTreasureLevels) {
      let state = createCoordinateState(level);
      for (const move of level.solution) {
        const result = searchCoordinate(level, state);
        expect(result.status).toBe("found");
        state = coordinateMove(state, level, move);
      }
    }
  });
  it("rejects malformed rational inputs and prevents a cut exceeding the material-table capacity", () => {
    expect(formatFraction(0, 12)).toBe("0");
    expect(() => formatFraction(1, 0)).toThrow(RangeError);
    expect(() => formatFraction(NaN, 6)).toThrow(RangeError);
    expect(() => formatFraction(1.5, 6)).toThrow(RangeError);
    const level = {
        ...fractionMosaicLevels[1],
        denominator: 24,
        stock: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        targets: [20],
        cuts: 1,
      },
      state = createFractionState(level);
    expect(
      fractionMove(state, level, { kind: "split", piece: "p0", parts: 2 }),
    ).toBe(state);
  });
  it("keeps repeated clicks on newly spent cards from consuming further resources", () => {
    const p = props(),
      level = coordinateTreasureLevels[0];
    render(<CoordinateTreasure {...p} />);
    const first = level.solution[0];
    fireEvent.click(vector(first));
    fireEvent.click(depart());
    fireEvent.click(depart());
    fireEvent.click(vector(first));
    expect(vector(first).getAttribute("data-remaining")).toBe("0");
    expect(
      document
        .querySelector("[data-coordinate-position]")!
        .getAttribute("data-coordinate-position"),
    ).toBe("(2, 0)");
    expect(depart().disabled).toBe(true);
  });
});
