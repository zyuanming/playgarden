// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShapeMosaic from "../src/games/ShapeMosaic";
import { shapeMosaicLevels } from "../src/games/shapeMosaicLevels";
import {
  MOSAIC_NODE_LIMIT,
  createMosaicState,
  mosaicChangeOrientation,
  mosaicHint,
  mosaicOrientations,
  mosaicPlacementCells,
  mosaicWon,
  placeMosaic,
  removeMosaic,
  searchMosaic,
  transformMosaic,
  undoMosaic,
  validMosaicBoard,
  validMosaicLevel,
  type MosaicBoard,
  type MosaicCell,
  type MosaicLevel,
  type MosaicPiece,
  type MosaicPlacement,
} from "../src/games/shapeMosaicLogic";
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
// Independent affine coordinate-set implementation: no production placement, rotation,
// inventory, overlap or solver function is used below.
function oracleVariants(piece: MosaicPiece): number[][][] {
  const matrices = [
      [1, 0, 0, 1],
      [0, -1, 1, 0],
      [-1, 0, 0, -1],
      [0, 1, -1, 0],
    ],
    out: number[][][] = [],
    seen = new Set<string>();
  for (const reflect of piece.reflect ? [1, -1] : [1])
    for (const [a, b, c, d] of matrices) {
      const raw = piece.cells.map(([x, y]) => [
          a * x * reflect + b * y,
          c * x * reflect + d * y,
        ]),
        minX = Math.min(...raw.map((v) => v[0])),
        minY = Math.min(...raw.map((v) => v[1]));
      const normalized = raw
          .map(([x, y]) => [x - minX, y - minY])
          .sort((u, v) => u[1] - v[1] || u[0] - v[0]),
        key = JSON.stringify(normalized);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(normalized);
      }
    }
  return out;
}
function oracleCells(l: MosaicLevel, p: MosaicPlacement): string[] {
  const shape = oracleVariants(l.pieces[p.piece])[p.orientation];
  if (!shape) return [];
  return shape.map(
    ([x, y]) => `${x - shape[0][0] + p.x},${y - shape[0][1] + p.y}`,
  );
}
function oracleValid(
  l: MosaicLevel,
  b: MosaicBoard,
  complete = false,
): boolean {
  if (b.length !== l.pieces.length) return false;
  const covered = new Set<string>();
  for (let i = 0; i < b.length; i++) {
    const p = b[i];
    if (!p) {
      if (complete) return false;
      continue;
    }
    if (p.piece !== i) return false;
    const cells = oracleCells(l, p);
    if (cells.length !== l.pieces[i].cells.length) return false;
    for (const cell of cells) {
      const [x, y] = cell.split(",").map(Number);
      if (l.rows[y]?.[x] !== "." || covered.has(cell)) return false;
      covered.add(cell);
    }
  }
  return (
    !complete ||
    covered.size ===
      l.rows
        .join("")
        .split("")
        .filter((c) => c === ".").length
  );
}
function oracleSolve(
  l: MosaicLevel,
  fixed: MosaicBoard = l.pieces.map(() => null),
  max = 100,
): MosaicBoard[] {
  const answers: MosaicBoard[] = [],
    board = [...fixed];
  function visit(piece: number) {
    if (answers.length >= max) return;
    if (piece === l.pieces.length) {
      if (oracleValid(l, board, true)) answers.push([...board]);
      return;
    }
    if (board[piece]) {
      visit(piece + 1);
      return;
    }
    for (let o = 0; o < oracleVariants(l.pieces[piece]).length; o++)
      for (let y = 0; y < l.rows.length; y++)
        for (let x = 0; x < l.rows[0].length; x++) {
          board[piece] = { piece, orientation: o, x, y };
          if (oracleValid(l, board)) visit(piece + 1);
        }
    board[piece] = null;
  }
  visit(0);
  return answers;
}
function orientationActions(piece: MosaicPiece, target: number) {
  const queue = [{ o: 0, actions: [] as boolean[] }],
    seen = new Set<number>([0]);
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    if (n.o === target) return n.actions;
    for (const flip of piece.reflect ? [false, true] : [false]) {
      const o = mosaicChangeOrientation(piece, n.o, flip);
      if (!seen.has(o)) {
        seen.add(o);
        queue.push({ o, actions: [...n.actions, flip] });
      }
    }
  }
  throw Error("unreachable orientation");
}
function replay(
  view: ReturnType<typeof render>,
  level: number,
  placements = shapeMosaicLevels[level].certificate.placements,
) {
  for (const p of placements) {
    fireEvent.click(
      view.container.querySelector(`[data-mosaic-piece="${p.piece}"]`)!,
    );
    for (const flip of orientationActions(
      shapeMosaicLevels[level].pieces[p.piece],
      p.orientation,
    ))
      fireEvent.click(
        view.container.querySelector(
          flip ? "[data-mosaic-flip]" : "[data-mosaic-rotate]",
        )!,
      );
    expect(
      view.container
        .querySelector("[data-shape-mosaic-game]")!
        .getAttribute("data-mosaic-orientation"),
    ).toBe(String(p.orientation));
    fireEvent.click(
      view.container.querySelector(`[data-mosaic-cell="${p.x},${p.y}"]`)!,
    );
  }
}

describe("ShapeMosaic independent coordinate/inventory verification", () => {
  for (const l of shapeMosaicLevels)
    it(`${l.id} certifies every piece, region, and exact-cover continuation`, () => {
      expect(validMosaicLevel(l)).toBe(true);
      expect(l.pieces.length).toBeLessThanOrEqual(9);
      for (const p of l.pieces) {
        expect(mosaicOrientations(p)).toEqual(oracleVariants(p));
        expect(mosaicOrientations(p).length).toBeLessThanOrEqual(8);
      }
      expect(oracleValid(l, l.certificate.placements, true)).toBe(true);
      let state = createMosaicState(l);
      for (const p of l.certificate.placements) {
        const old = state,
          serialized = JSON.stringify(old);
        state = placeMosaic(l, state, p);
        expect(state).not.toBe(old);
        expect(JSON.stringify(old)).toBe(serialized);
        expect(oracleValid(l, state.board)).toBe(true);
      }
      expect(mosaicWon(l, state.board)).toBe(true);
      expect(placeMosaic(l, state, l.certificate.placements[0])).toBe(state);
      expect(undoMosaic(l, state)).toBe(state);
      expect(removeMosaic(l, state, 0)).toBe(state);
      const solved = searchMosaic(l);
      expect(solved.status).toBe("solved");
      expect(solved.nodes).toBeLessThanOrEqual(MOSAIC_NODE_LIMIT);
      expect(oracleValid(l, solved.board!, true)).toBe(true);
      const fixed = l.pieces.map((_, i) =>
          i === 0 ? l.certificate.placements[0] : null,
        ),
        continuation = searchMosaic(l, fixed);
      expect(continuation.status).toBe("solved");
      expect(continuation.board![0]).toEqual(fixed[0]);
      expect(oracleValid(l, continuation.board!, true)).toBe(true);
    });
  it("agrees with exhaustive small-board enumeration and accepts alternative valid tilings", () => {
    const l = shapeMosaicLevels[1],
      all = oracleSolve(l, undefined, 200);
    expect(all.length).toBeGreaterThan(1);
    for (const b of all) expect(mosaicWon(l, b)).toBe(true);
    expect(
      all.some(
        (b) => JSON.stringify(b) !== JSON.stringify(l.certificate.placements),
      ),
    ).toBe(true);
    const small = shapeMosaicLevels[0];
    for (let p = 0; p < small.pieces.length; p++)
      for (let o = 0; o < oracleVariants(small.pieces[p]).length; o++)
        for (let y = 0; y < small.rows.length; y++)
          for (let x = 0; x < small.rows[0].length; x++) {
            const b = small.pieces.map((_, i) =>
              i === p ? { piece: p, orientation: o, x, y } : null,
            );
            if (!oracleValid(small, b)) continue;
            expect(searchMosaic(small, b).status === "solved").toBe(
              oracleSolve(small, b, 1).length > 0,
            );
          }
  });
  it("keeps chiral reflections distinct and forbids non-permitted flips", () => {
    const chiral: MosaicPiece = {
      label: "A",
      cells: [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 2],
      ],
      reflect: false,
    };
    const mirror = transformMosaic(chiral.cells, 0, true);
    expect(mosaicOrientations(chiral)).toHaveLength(4);
    expect(
      mosaicOrientations(chiral).some(
        (o) => JSON.stringify(o) === JSON.stringify(mirror),
      ),
    ).toBe(false);
    expect(mosaicOrientations({ ...chiral, reflect: true })).toHaveLength(8);
    expect(mosaicChangeOrientation(chiral, 0, true)).toBe(0);
    const l = shapeMosaicLevels[4];
    expect(l.pieces.every((p) => !p.reflect)).toBe(true);
    const invalid = l.pieces.map((_, i) =>
      i === 0 ? { ...l.certificate.placements[0], orientation: 4 } : null,
    );
    expect(validMosaicBoard(l, invalid)).toBe(false);
    expect(searchMosaic(l, invalid).status).toBe("invalid");
  });
  it("an invalid move preserves the old placement and immutable history", () => {
    const l = shapeMosaicLevels[5],
      s = placeMosaic(l, createMosaicState(l), l.certificate.placements[0]),
      serialized = JSON.stringify(s);
    expect(placeMosaic(l, s, { piece: 0, orientation: 0, x: -1, y: -1 })).toBe(
      s,
    );
    expect(placeMosaic(l, s, { piece: 99, orientation: 0, x: 0, y: 0 })).toBe(
      s,
    );
    expect(placeMosaic(l, s, { piece: 0, orientation: 99, x: 0, y: 0 })).toBe(
      s,
    );
    expect(JSON.stringify(s)).toBe(serialized);
    const removed = removeMosaic(l, s, 0);
    expect(removed.board[0]).toBeNull();
    expect(undoMosaic(l, removed)).toEqual(s);
  });
  it("budget exhaustion is never called a dead end and completed boards need no hint", () => {
    const l = shapeMosaicLevels[0];
    expect(searchMosaic(l, undefined, 0).status).toBe("limit");
    const hint = mosaicHint(l, createMosaicState(l).board, 0);
    expect(hint.status).toBe("limit");
    expect(hint.text).toContain("不代表无解");
    expect(hint.forced).toBe(false);
    expect(mosaicHint(l, l.certificate.placements).placement).toBeNull();
    expect(searchMosaic(l, undefined, -1).status).toBe("invalid");
  });
  it("hints preserve fixed pieces, prove forced placements, and ignore certificates", () => {
    for (const l of shapeMosaicLevels.slice(0, 3)) {
      const board = createMosaicState(l).board,
        h = mosaicHint(l, board);
      expect(h.status).toBe("solved");
      expect(h.placement).not.toBeNull();
      const all = oracleSolve(l, board, 10000);
      if (h.forced)
        expect(
          all.every(
            (b) =>
              JSON.stringify(b[h.placement!.piece]) ===
              JSON.stringify(h.placement),
          ),
        ).toBe(true);
      else expect(h.text).toContain("不声称必然");
      expect(h.nodes).toBeLessThanOrEqual(MOSAIC_NODE_LIMIT);
      const corrupted = { ...l, certificate: { placements: [], nodes: -1 } };
      expect(mosaicHint(corrupted, board)).toEqual(h);
      expect(mosaicWon(corrupted, l.certificate.placements)).toBe(true);
    }
    const l = shapeMosaicLevels[0],
      almost = l.certificate.placements.map((p, i) => (i === 0 ? p : null)),
      h = mosaicHint(l, almost);
    expect(h.forced).toBe(true);
    expect(h.placement?.piece).toBe(1);
    expect(oracleSolve(l, almost).length).toBe(1);
  });
  it("finds and independently verifies a legal but dead-ended partial placement", () => {
    const l = shapeMosaicLevels[0];
    let dead: MosaicBoard | null = null;
    outer: for (let i = 0; i < l.pieces.length; i++)
      for (let o = 0; o < oracleVariants(l.pieces[i]).length; o++)
        for (let y = 0; y < l.rows.length; y++)
          for (let x = 0; x < l.rows[0].length; x++) {
            const b = l.pieces.map((_, j) =>
              j === i ? { piece: i, orientation: o, x, y } : null,
            );
            if (oracleValid(l, b) && !oracleSolve(l, b, 1).length) {
              dead = b;
              break outer;
            }
          }
    expect(dead).not.toBeNull();
    expect(searchMosaic(l, dead!).status).toBe("unreachable");
    expect(mosaicHint(l, dead!).text).toContain("保留现有拼片无法铺满");
  });
});

describe("ShapeMosaic rendered certificates and lifecycle", () => {
  for (let level = 0; level < shapeMosaicLevels.length; level++)
    it(`plays all rotate/flip/anchor controls in level ${level + 1}`, () => {
      const p = { ...props(), level },
        view = render(<ShapeMosaic {...p} />);
      replay(view, level);
      expect(
        view.container.querySelector("[data-mosaic-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      for (const button of view.container.querySelectorAll("button"))
        fireEvent.click(button);
      view.rerender(<ShapeMosaic {...p} undoToken={17} hintToken={4} />);
      expect(
        view.container.querySelector("[data-mosaic-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    });
  it("renders and accepts an independently enumerated alternative solution", () => {
    const level = 1,
      l = shapeMosaicLevels[level],
      alternative = oracleSolve(l).find(
        (b) => JSON.stringify(b) !== JSON.stringify(l.certificate.placements),
      )!;
    const p = { ...props(), level },
      v = render(<ShapeMosaic {...p} />);
    replay(v, level, alternative as MosaicPlacement[]);
    expect(p.onComplete).toHaveBeenCalledOnce();
  });
  it("pauses commands, consumes paused tokens, resets selection/state, and switches levels", () => {
    const p = props(),
      v = render(
        <StrictMode>
          <ShapeMosaic {...p} />
        </StrictMode>,
      );
    replay(v, 0, [shapeMosaicLevels[0].certificate.placements[0]]);
    v.rerender(
      <StrictMode>
        <ShapeMosaic {...p} paused hintToken={9} undoToken={5} />
      </StrictMode>,
    );
    fireEvent.click(v.container.querySelector("[data-mosaic-remove]")!);
    fireEvent.keyDown(v.container.querySelector("[data-shape-mosaic-game]")!, {
      key: "r",
    });
    expect(
      v.container.querySelector("[data-mosaic-placed='1']"),
    ).not.toBeNull();
    v.rerender(
      <StrictMode>
        <ShapeMosaic {...p} hintToken={9} undoToken={5} />
      </StrictMode>,
    );
    expect(
      v.container.querySelector("[data-mosaic-placed='1']"),
    ).not.toBeNull();
    v.rerender(
      <StrictMode>
        <ShapeMosaic {...p} hintToken={9} undoToken={6} />
      </StrictMode>,
    );
    expect(
      v.container.querySelector("[data-mosaic-placed='0']"),
    ).not.toBeNull();
    v.rerender(
      <StrictMode>
        <ShapeMosaic {...p} resetToken={1} />
      </StrictMode>,
    );
    expect(
      v.container.querySelector("[data-mosaic-orientation='0']"),
    ).not.toBeNull();
    v.rerender(
      <StrictMode>
        <ShapeMosaic {...p} level={11} resetToken={1} />
      </StrictMode>,
    );
    expect(v.container.querySelectorAll("[data-mosaic-piece]")).toHaveLength(9);
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("never deletes the old rendered piece on an invalid relocation", () => {
    const p = props(),
      v = render(<ShapeMosaic {...p} />);
    replay(v, 0, [shapeMosaicLevels[0].certificate.placements[0]]);
    const before = Array.from(
      v.container.querySelectorAll('[data-mosaic-owner="A"]'),
    ).map((n) => n.getAttribute("data-mosaic-cell"));
    fireEvent.click(v.container.querySelector('[data-mosaic-cell="2,2"]')!);
    expect(
      Array.from(v.container.querySelectorAll('[data-mosaic-owner="A"]')).map(
        (n) => n.getAttribute("data-mosaic-cell"),
      ),
    ).toEqual(before);
    expect(v.getByRole("status").textContent).toContain("没有被删除");
    fireEvent.click(v.container.querySelector("[data-mosaic-remove]")!);
    expect(
      v.container.querySelectorAll('[data-mosaic-owner="A"]'),
    ).toHaveLength(0);
  });
  it("supports Tab, numeric selection, R/F, focus arrows, Enter placement and live current-state hints", async () => {
    const user = userEvent.setup(),
      p = { ...props(), level: 3 },
      v = render(<ShapeMosaic {...p} />);
    await user.tab();
    expect(document.activeElement).toBe(
      v.container.querySelector('[data-mosaic-piece="0"]'),
    );
    await user.keyboard("2r");
    expect(
      v.container.querySelector("[data-mosaic-selected='1']"),
    ).not.toBeNull();
    const rotated = v.container
      .querySelector("[data-shape-mosaic-game]")!
      .getAttribute("data-mosaic-orientation");
    await user.keyboard("f");
    expect(
      v.container
        .querySelector("[data-shape-mosaic-game]")!
        .getAttribute("data-mosaic-orientation"),
    ).not.toBe(rotated);
    const cell = v.container.querySelector(
      '[data-mosaic-cell="0,0"]',
    ) as HTMLButtonElement;
    cell.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(
      v.container.querySelector('[data-mosaic-cell="1,0"]'),
    );
    v.rerender(<ShapeMosaic {...p} hintToken={1} />);
    const hint = mosaicHint(
      shapeMosaicLevels[3],
      createMosaicState(shapeMosaicLevels[3]).board,
    );
    const anchor = v.container.querySelector(
      `[data-mosaic-cell="${hint.placement!.x},${hint.placement!.y}"]`,
    ) as HTMLButtonElement;
    anchor.focus();
    await user.keyboard("{Enter}");
    expect(
      v.container.querySelector("[data-mosaic-placed='1']"),
    ).not.toBeNull();
  });
  it("notifies once in StrictMode and once more only after reset", () => {
    const p = props(),
      v = render(
        <StrictMode>
          <ShapeMosaic {...p} />
        </StrictMode>,
      );
    replay(v, 0);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    v.rerender(
      <StrictMode>
        <ShapeMosaic {...p} resetToken={1} />
      </StrictMode>,
    );
    replay(v, 0);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
});

it("describes rotated occupied cells and supports completed read-only inspection", () => {
  const p = props(),
    view = render(<ShapeMosaic {...p} />);
  const description = () =>
    view.container.querySelector("[data-mosaic-shape-description]")!
      .textContent;
  const before = description();
  expect(before).toContain("星标原点");
  fireEvent.click(view.container.querySelector("[data-mosaic-rotate]")!);
  expect(description()).not.toBe(before);
  view.rerender(<ShapeMosaic {...p} resetToken={1} />);
  replay(view, 0);
  const completed = view.container
    .querySelector("[data-shape-mosaic-game]")!
    .getAttribute("data-mosaic-placed");
  fireEvent.click(view.container.querySelector('[data-mosaic-piece="0"]')!);
  expect(description()).toContain("A 当前占格");
  expect(
    view.container
      .querySelector("[data-shape-mosaic-game]")!
      .getAttribute("data-mosaic-placed"),
  ).toBe(completed);
  expect(p.onComplete).toHaveBeenCalledTimes(1);
});
it("returns removal focus to the selected inventory without losing placement history", () => {
  const view = render(<ShapeMosaic {...props()} />);
  const placement = shapeMosaicLevels[0].certificate.placements[0];
  replay(view, 0, [placement]);
  const remove = view.container.querySelector(
    "[data-mosaic-remove]",
  ) as HTMLButtonElement;
  remove.focus();
  fireEvent.click(remove);
  expect(document.activeElement).toBe(
    view.container.querySelector(`[data-mosaic-piece="${placement.piece}"]`),
  );
  expect(remove.disabled).toBe(true);
});
