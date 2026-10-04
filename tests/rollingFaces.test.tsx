// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RollingFaces from "../src/games/RollingFaces";
import { rollingFacesLevels } from "../src/games/rollingFacesLevels";
import {
  ROLL_DIRECTIONS,
  ROLL_ORIENTATIONS,
  ROLL_START,
  ROLL_STATE_LIMIT,
  createRollState,
  initialRollBoard,
  moveRoll,
  rollStep,
  rollingHint,
  rollingWon,
  rotateRoll,
  searchRolling,
  undoRoll,
  validRollBoard,
  validRollingLevel,
  type RollBoard,
  type RollingLevel,
  type RollDirection,
} from "../src/games/rollingFacesLogic";
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
type Vector = readonly [number, number, number];
type Oracle = { x: number; y: number; normals: Vector[]; lit: Set<number> };
const normals: Vector[] = [
  [0, 0, 1],
  [0, -1, 0],
  [-1, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, -1],
];
function vectorRotate(v: Vector, d: RollDirection): Vector {
  const [x, y, z] = v;
  return d === "E"
    ? [z, y, -x]
    : d === "W"
      ? [-z, y, x]
      : d === "N"
        ? [x, -z, y]
        : [x, z, -y];
}
function faces(o: Oracle) {
  return [
    [0, 0, 1],
    [0, 0, -1],
    [0, -1, 0],
    [0, 1, 0],
    [-1, 0, 0],
    [1, 0, 0],
  ].map((v) => o.normals.findIndex((n) => n.every((c, i) => c === v[i])));
}
function oracleStart(l: RollingLevel): Oracle {
  return {
    x: l.start[0],
    y: l.start[1],
    normals: normals.map((n) => [...n] as Vector),
    lit: new Set(),
  };
}
function oracleStep(
  l: RollingLevel,
  s: Oracle,
  d: RollDirection,
): Oracle | null {
  const moves = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] },
    [dx, dy] = moves[d],
    x = s.x + dx,
    y = s.y + dy;
  if (l.rows[y]?.[x] !== ".") return null;
  const next = {
      x,
      y,
      normals: s.normals.map((v) => vectorRotate(v, d)),
      lit: new Set(s.lit),
    },
    bottom = faces(next)[1];
  const gate = l.gates.find((g) => g.x === x && g.y === y);
  if (
    gate &&
    (gate.face !== bottom ||
      l.plates.some((_, i) =>
        (gate.needs ?? 0) & (1 << i) ? !s.lit.has(i) : false,
      ))
  )
    return null;
  l.plates.forEach((p, i) => {
    if (p.x === x && p.y === y && p.face === bottom) next.lit.add(i);
  });
  return next;
}
function oracleWon(l: RollingLevel, s: Oracle) {
  const f = faces(s);
  return (
    s.x === l.exit.x &&
    s.y === l.exit.y &&
    f[1] === l.exit.bottom &&
    f[2] === l.exit.north &&
    s.lit.size === l.plates.length
  );
}
function oracleSearch(l: RollingLevel) {
  const queue = [{ state: oracleStart(l), distance: 0 }],
    seen = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const { state, distance } = queue[i];
    if (oracleWon(l, state)) return distance;
    for (const d of ["W", "S", "E", "N"] as RollDirection[]) {
      const next = oracleStep(l, state, d);
      if (!next) continue;
      const key = JSON.stringify([
        next.x,
        next.y,
        next.normals,
        [...next.lit].sort(),
      ]);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ state: next, distance: distance + 1 });
    }
  }
  return null;
}

describe("RollingFaces integer-vector oracle", () => {
  it("enumerates exactly 24 proper orientations and agrees on every roll, inverse, and four-roll identity", () => {
    const queue = [normals],
      seen = new Map<string, Vector[]>();
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i],
        key = JSON.stringify(n);
      if (seen.has(key)) continue;
      seen.set(key, n);
      for (const d of ROLL_DIRECTIONS)
        queue.push(n.map((v) => vectorRotate(v, d)));
    }
    expect(seen.size).toBe(24);
    expect(ROLL_ORIENTATIONS).toHaveLength(24);
    for (const n of seen.values()) {
      const f = faces({
        x: 0,
        y: 0,
        normals: n,
        lit: new Set(),
      }) as unknown as typeof ROLL_START;
      expect(ROLL_ORIENTATIONS.some((o) => o.join() === f.join())).toBe(true);
      for (const d of ROLL_DIRECTIONS) {
        const predicted = faces({
          x: 0,
          y: 0,
          normals: n.map((v) => vectorRotate(v, d)),
          lit: new Set(),
        });
        expect(rotateRoll(f, d)).toEqual(predicted);
        const inverse = ({ N: "S", S: "N", E: "W", W: "E" } as const)[d];
        expect(rotateRoll(rotateRoll(f, d), inverse)).toEqual(f);
        let four = f;
        for (let j = 0; j < 4; j++) four = rotateRoll(four, d);
        expect(four).toEqual(f);
      }
    }
  });
  for (const l of rollingFacesLevels)
    it(`${l.id} explicit bounds, independent shortest path, and certificate`, () => {
      expect(validRollingLevel(l)).toBe(true);
      expect(
        l.rows
          .join("")
          .split("")
          .filter((c) => c === ".").length *
          24 *
          (1 << l.plates.length),
      ).toBeLessThanOrEqual(ROLL_STATE_LIMIT);
      let state = createRollState(l),
        oracle = oracleStart(l);
      const initial = JSON.stringify(state);
      for (const d of l.certificate.moves) {
        const old = state;
        state = moveRoll(l, state, d);
        expect(state).not.toBe(old);
        oracle = oracleStep(l, oracle, d)!;
        expect(oracle).not.toBeNull();
        expect(state.board.faces).toEqual(faces(oracle));
        expect(state.board.x).toBe(oracle.x);
        expect(state.board.y).toBe(oracle.y);
        expect(state.board.plates).toBe(
          [...oracle.lit].reduce((mask, i) => mask | (1 << i), 0),
        );
      }
      expect(oracleWon(l, oracle)).toBe(true);
      expect(rollingWon(l, state.board)).toBe(true);
      expect(initial).toBe(JSON.stringify(createRollState(l)));
      expect(searchRolling(l).moves.length).toBe(l.certificate.shortest);
      expect(oracleSearch(l)).toBe(l.certificate.shortest);
      expect(searchRolling(l).visited).toBeLessThanOrEqual(ROLL_STATE_LIMIT);
      expect(moveRoll(l, state, "N")).toBe(state);
      expect(undoRoll(l, state)).toBe(state);
    });
  it("revisiting a square can change orientation and only an oriented exit wins", () => {
    const l = { ...rollingFacesLevels[0], rows: ["...", "...", "..."] };
    let b = initialRollBoard(l);
    for (const d of ["E", "S", "W", "N"] as RollDirection[])
      b = rollStep(l, b, d)!;
    expect([b.x, b.y]).toEqual(l.start);
    expect(b.faces).not.toEqual(ROLL_START);
    const goal = { ...b, x: l.exit.x, y: l.exit.y };
    expect(rollingWon(l, { ...goal, faces: ROLL_START })).toBe(false);
  });
  it("rejects malformed states, blocked moves, wrong gate faces and unmet keys", () => {
    const l = rollingFacesLevels[0],
      s = createRollState(l);
    expect(moveRoll(l, s, "N")).toBe(s);
    expect(moveRoll(l, s, "bogus" as RollDirection)).toBe(s);
    expect(validRollBoard(l, { ...s.board, faces: [0, 0, 1, 2, 3, 4] })).toBe(
      false,
    );
    expect(searchRolling(l, { ...s.board, plates: 8 }).status).toBe("invalid");
    const gateLevel = { ...l, gates: [{ x: 1, y: 0, face: 2 }] };
    expect(rollStep(gateLevel, s.board, "E")).toBeNull();
    const keyed = {
      ...l,
      plates: [{ x: 0, y: 1, face: 4 }],
      gates: [{ x: 1, y: 0, face: 3, needs: 1 }],
    };
    expect(rollStep(keyed, s.board, "E")).toBeNull();
    expect(rollStep(keyed, { ...s.board, plates: 1 }, "E")).not.toBeNull();
  });
  it("proves a dead end rather than reporting a search limit", () => {
    const l = {
      ...rollingFacesLevels[0],
      rows: [".."],
      start: [0, 0] as const,
      exit: { x: 1, y: 0, bottom: 0, north: 1 },
      gates: [],
      plates: [],
    };
    expect(searchRolling(l).status).toBe("unreachable");
    expect(rollingHint(l, initialRollBoard(l))).toContain("无法完成");
  });
  it("current-state hints ignore damaged certificates and undo is immutable", () => {
    const l = rollingFacesLevels[7],
      s = createRollState(l),
      m = moveRoll(l, s, l.certificate.moves[0]);
    const prior = JSON.stringify(s);
    expect(undoRoll(l, m)).toEqual(s);
    expect(JSON.stringify(s)).toBe(prior);
    const altered = {
      ...l,
      certificate: { moves: [], shortest: 9999, visited: 0 },
    };
    expect(searchRolling(altered, m.board)).toEqual(searchRolling(l, m.board));
    expect(rollingHint(altered, m.board)).toBe(rollingHint(l, m.board));
    expect(rollingHint(l, m.board)).toContain(
      `${searchRolling(l, m.board).moves.length} 步`,
    );
  });
});

describe("RollingFaces rendered certificates and lifecycle", () => {
  for (let level = 0; level < rollingFacesLevels.length; level++)
    it(`plays every real control in level ${level + 1}`, () => {
      const p = { ...props(), level },
        view = render(<RollingFaces {...p} />);
      for (const d of rollingFacesLevels[level].certificate.moves) {
        fireEvent.click(
          view.container.querySelector(`[data-roll-direction="${d}"]`)!,
        );
      }
      expect(
        view.container.querySelector("[data-rolling-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      for (const button of view.container.querySelectorAll("button"))
        fireEvent.click(button);
      view.rerender(<RollingFaces {...p} undoToken={4} hintToken={7} />);
      expect(
        view.container.querySelector("[data-rolling-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(view.getByLabelText("当前立方体六面图")).toBeTruthy();
    });
  it("pauses mutation and consumes paused tokens; reset and level change start a new round", () => {
    const p = props(),
      view = render(
        <StrictMode>
          <RollingFaces {...p} />
        </StrictMode>,
      );
    fireEvent.click(view.container.querySelector('[data-roll-direction="E"]')!);
    const position = view.container
      .querySelector("[data-rolling-faces-game]")!
      .getAttribute("data-rolling-position");
    view.rerender(
      <StrictMode>
        <RollingFaces {...p} paused hintToken={11} undoToken={8} />
      </StrictMode>,
    );
    fireEvent.click(view.container.querySelector('[data-roll-direction="S"]')!);
    fireEvent.keyDown(view.getByRole("group", { name: /可操作地图/ }), {
      key: "ArrowDown",
    });
    expect(
      view.container
        .querySelector("[data-rolling-faces-game]")!
        .getAttribute("data-rolling-position"),
    ).toBe(position);
    view.rerender(
      <StrictMode>
        <RollingFaces {...p} hintToken={11} undoToken={8} />
      </StrictMode>,
    );
    expect(
      view.container
        .querySelector("[data-rolling-faces-game]")!
        .getAttribute("data-rolling-position"),
    ).toBe(position);
    view.rerender(
      <StrictMode>
        <RollingFaces {...p} hintToken={12} undoToken={9} />
      </StrictMode>,
    );
    expect(
      view.container.querySelector("[data-rolling-position='0,0']"),
    ).not.toBeNull();
    view.rerender(
      <StrictMode>
        <RollingFaces {...p} resetToken={1} />
      </StrictMode>,
    );
    expect(
      view.container.querySelector("[data-rolling-orientation='051423']"),
    ).not.toBeNull();
    view.rerender(
      <StrictMode>
        <RollingFaces {...p} level={5} resetToken={1} />
      </StrictMode>,
    );
    expect(
      view.container.querySelector("[data-rolling-plates='0']"),
    ).not.toBeNull();
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("supports focus, world-fixed arrow keys, WebGL fallback, and exactly one completion per reset", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(
        <StrictMode>
          <RollingFaces {...p} />
        </StrictMode>,
      );
    expect(
      view.getByText(
        "3D 预览不可用。下方棋盘、面图与方向按钮包含全部规则与操作。",
      ),
    ).toBeTruthy();
    await user.tab();
    expect(document.activeElement).toBe(
      view.getByRole("group", { name: /可操作地图/ }),
    );
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <RollingFaces {...p} resetToken={1} />
      </StrictMode>,
    );
    view.getByRole("group", { name: /可操作地图/ }).focus();
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("adjacent-cell clicks roll but distant cells do not teleport", () => {
    const p = props(),
      v = render(<RollingFaces {...p} />);
    fireEvent.click(v.container.querySelector('[data-rolling-cell="2,0"]')!);
    expect(
      v.container.querySelector('[data-rolling-position="0,0"]'),
    ).not.toBeNull();
    fireEvent.click(v.container.querySelector('[data-rolling-cell="1,0"]')!);
    expect(
      v.container.querySelector('[data-rolling-position="1,0"]'),
    ).not.toBeNull();
  });
});
