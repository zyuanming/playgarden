// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FleetLogic from "../src/games/FleetLogic";
import { fleetLevels } from "../src/games/fleetLevels";
import {
  FLEET_NODE_LIMIT,
  checkFleet,
  createFleetState,
  editFleet,
  fillFleetSea,
  fleetFragment,
  fleetHint,
  fleetWon,
  initialFleetMarks,
  solveFleet,
  undoFleet,
  validFleetProblem,
  type FleetFragment,
  type FleetMark,
  type FleetProblem,
} from "../src/games/fleetLogic";
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
/** Independent occupied-board oracle: partition by Manhattan connectivity, inspect straight components and king-distance halos. */
function oracle(l: FleetProblem, board: readonly boolean[]): boolean {
  const n = l.size,
    cells = board.flatMap((v, i) => (v ? [i] : [])),
    coords = (i: number) => [Math.floor(i / n), i % n];
  if (
    board.length !== n * n ||
    l.rowTotals.some(
      (v, r) => cells.filter((c) => Math.floor(c / n) === r).length !== v,
    ) ||
    l.colTotals.some((v, c) => cells.filter((i) => i % n === c).length !== v)
  )
    return false;
  const parts: number[][] = [],
    left = new Set(cells);
  while (left.size) {
    const first = left.values().next().value!;
    const part = [first];
    left.delete(first);
    for (let head = 0; head < part.length; head++) {
      const [r, c] = coords(part[head]);
      for (const other of left) {
        const [y, x] = coords(other);
        if (Math.abs(r - y) + Math.abs(c - x) === 1) {
          left.delete(other);
          part.push(other);
        }
      }
    }
    parts.push(part);
  }
  if (
    parts.some(
      (part) =>
        new Set(part.map((c) => Math.floor(c / n))).size > 1 &&
        new Set(part.map((c) => c % n)).size > 1,
    )
  )
    return false;
  if (
    parts
      .map((p) => p.length)
      .sort()
      .join() !== [...l.fleet].sort().join()
  )
    return false;
  for (let a = 0; a < parts.length; a++)
    for (let b = a + 1; b < parts.length; b++)
      for (const ca of parts[a])
        for (const cb of parts[b]) {
          const [r, c] = coords(ca),
            [y, x] = coords(cb);
          if (Math.max(Math.abs(r - y), Math.abs(c - x)) <= 1) return false;
        }
  for (const clue of l.clues) {
    if (clue.fragment === "sea") {
      if (board[clue.cell]) return false;
      continue;
    }
    const part = parts.find((p) => p.includes(clue.cell));
    if (!part) return false;
    if (clue.fragment === "ship") continue;
    let shape: FleetFragment;
    if (part.length === 1) shape = "single";
    else {
      const sorted = [...part].sort((a, b) => a - b),
        horizontal = sorted[0] + 1 === sorted[1];
      shape =
        clue.cell === sorted[0]
          ? horizontal
            ? "W"
            : "N"
          : clue.cell === sorted.at(-1)
            ? horizontal
              ? "E"
              : "S"
            : horizontal
              ? "middle-h"
              : "middle-v";
    }
    if (shape !== clue.fragment) return false;
  }
  return true;
}
/** Independent uniqueness search chooses whole ROW bitmasks, never ship placements or ship identities. */
function rowOracle(l: FleetProblem): boolean[][] {
  const n = l.size,
    candidates = l.rowTotals.map((total) =>
      Array.from({ length: 1 << n }, (_, mask) => mask).filter(
        (mask) =>
          [...mask.toString(2)].filter((c) => c === "1").length === total,
      ),
    ),
    out: boolean[][] = [];
  function visit(r: number, masks: number[], cols: number[]) {
    if (r === n) {
      const b = masks.flatMap((mask) =>
        Array.from({ length: n }, (_, c) => Boolean(mask & (1 << c))),
      );
      if (oracle(l, b)) out.push(b);
      return;
    }
    for (const mask of candidates[r]) {
      if (r > 0 && mask & ((masks[r - 1] << 1) | (masks[r - 1] >> 1))) continue;
      if (
        l.clues.some(
          (clue) =>
            Math.floor(clue.cell / n) === r &&
            Boolean(mask & (1 << (clue.cell % n))) ===
              (clue.fragment === "sea"),
        )
      )
        continue;
      const next = cols.map((v, c) => v + ((mask >> c) & 1));
      if (
        next.some(
          (v, c) => v > l.colTotals[c] || v + n - r - 1 < l.colTotals[c],
        )
      )
        continue;
      visit(r + 1, [...masks, mask], next);
    }
  }
  visit(0, [], Array(n).fill(0));
  return out;
}
const flexible: FleetProblem = {
  id: "two",
  title: "",
  lesson: "",
  size: 3,
  fleet: [1, 1],
  rowTotals: [1, 0, 1],
  colTotals: [1, 0, 1],
  clues: [],
};
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

describe("FleetLogic independent occupied-board verification", () => {
  it("contains 12 distinct original levels with bounded fleet/domain and explicit problem data", () => {
    expect(fleetLevels).toHaveLength(12);
    expect(
      new Set(
        fleetLevels.map((l) =>
          JSON.stringify([l.size, l.rowTotals, l.colTotals, l.clues]),
        ),
      ).size,
    ).toBe(12);
    expect(FLEET_NODE_LIMIT).toBe(200000);
    expect(
      new Set(fleetLevels.flatMap((l) => l.clues.map((c) => c.fragment))),
    ).toEqual(
      new Set(["sea", "N", "single", "middle-h", "E", "middle-v", "W", "S"]),
    );
  });
  for (const l of fleetLevels)
    it(`${l.id}: independent components, row-enumeration uniqueness, bounded CSP and certificate corruption`, () => {
      expect(validFleetProblem(l)).toBe(true);
      const board = Array.from({ length: l.size * l.size }, (_, i) =>
        l.certificate.occupied.includes(i),
      );
      expect(oracle(l, board)).toBe(true);
      expect(checkFleet(l, board).valid).toBe(true);
      const independent = rowOracle(l),
        search = solveFleet(l);
      expect(independent).toHaveLength(1);
      expect(search.status).toBe("complete");
      expect(search.solutions).toEqual(independent);
      expect(search.solutions[0]).toEqual(board);
      expect(search.nodes).toBe(l.certificate.nodes);
      expect(search.nodes).toBeLessThan(FLEET_NODE_LIMIT);
      const corrupted = {
        ...l,
        certificate: { occupied: [], unique: true as const, nodes: 200001 },
      };
      expect(checkFleet(corrupted, board).valid).toBe(true);
      expect(solveFleet(corrupted).solutions).toEqual(independent);
      expect(checkFleet(corrupted, Array(board.length).fill(false)).valid).toBe(
        false,
      );
      // Every one-cell certificate mutation must fail either its row or column total.
      for (let cell = 0; cell < board.length; cell++) {
        const bad = [...board];
        bad[cell] = !bad[cell];
        expect(checkFleet(l, bad).valid).toBe(false);
        expect(oracle(l, bad)).toBe(false);
      }
    });
  it("accepts alternative valid boards, deduplicates identical ships, and never calls a sampled choice forced", () => {
    const expected = rowOracle(flexible),
      search = solveFleet(flexible, initialFleetMarks(flexible), {
        maxSolutions: 8,
      });
    expect(expected).toHaveLength(2);
    expect(search.status).toBe("complete");
    expect(search.solutions).toHaveLength(2);
    expect(new Set(search.solutions.map((b) => b.join())).size).toBe(2);
    for (const b of expected) {
      expect(checkFleet(flexible, b).valid).toBe(true);
      expect(
        fleetWon(
          flexible,
          b.map((v) => (v ? "ship" : "sea")),
        ),
      ).toBe(true);
    }
    expect(fleetHint(flexible, initialFleetMarks(flexible)).text).toContain(
      "不是必填",
    );
  });
  it("independently rejects wrong inventory, diagonal touching, crooked ships and fragment mismatches", () => {
    const cases: Array<[FleetProblem, number[]]> = [
      [
        {
          ...flexible,
          fleet: [2, 2],
          rowTotals: [2, 0, 2],
          colTotals: [2, 0, 2],
        },
        [0, 2, 6, 8],
      ],
      [{ ...flexible, rowTotals: [1, 1, 0], colTotals: [1, 1, 0] }, [0, 4]],
      [
        { ...flexible, fleet: [3], rowTotals: [2, 1, 0], colTotals: [1, 2, 0] },
        [0, 1, 4],
      ],
      [{ ...flexible, clues: [{ cell: 0, fragment: "N" }] }, [0, 8]],
    ];
    for (const [l, cells] of cases) {
      const board = Array.from({ length: 9 }, (_, i) => cells.includes(i));
      expect(checkFleet(l, board).valid).toBe(false);
      expect(oracle(l, board)).toBe(false);
    }
    const l = { ...flexible, clues: [{ cell: 0, fragment: "ship" as const }] };
    expect(solveFleet(l).solutions).toHaveLength(1);
    expect(
      fleetFragment(
        3,
        [true, false, false, false, false, false, false, false, true],
        0,
      ),
    ).toBe("single");
  });
  it("keeps exhausted budgets inconclusive and detects actual-state contradictions only after exhaustive search", () => {
    const l = fleetLevels[8],
      marks = initialFleetMarks(l),
      budget = solveFleet(l, marks, { maxNodes: 0 });
    expect(budget.status).toBe("budget");
    expect(budget.nodes).toBe(0);
    expect(fleetHint(l, marks, 0).text).toContain("不能判断");
    expect(fleetHint(l, marks, 0).cell).toBeNull();
    expect(
      solveFleet(l, marks, { maxNodes: NaN, maxSolutions: NaN }).status,
    ).toBe("complete");
    const bad = [...marks],
      wrong = bad.findIndex(
        (m, i) => m === "unknown" && !l.certificate.occupied.includes(i),
      );
    bad[wrong] = "ship";
    const impossible = solveFleet(l, bad);
    expect(impossible.status).toBe("complete");
    expect(impossible.solutions).toHaveLength(0);
    expect(fleetHint(l, bad).text).toContain("互相矛盾");
    const good = [...marks],
      cell = good.findIndex((m) => m === "unknown");
    good[cell] = l.certificate.occupied.includes(cell) ? "ship" : "sea";
    const hint = fleetHint(l, good);
    expect(hint.cell).not.toBe(cell);
    expect(hint.mark).toBe(
      l.certificate.occupied.includes(hint.cell!) ? "ship" : "sea",
    );
    expect(hint.text).toContain("必定");
  });
  it("validates domain and mark inputs; keeps edits/fill/undo immutable and clues fixed", () => {
    const l = fleetLevels[0],
      s = deepFreeze(createFleetState(l));
    expect(editFleet(l, s, 12, "ship")).toBe(s);
    expect(editFleet(l, s, -1, "ship")).toBe(s);
    const next = editFleet(l, s, 0, "ship");
    expect(next.history[0]).toBe(s.marks);
    expect(s.marks[0]).toBe("unknown");
    const fill = fillFleetSea(l, deepFreeze(next));
    expect(fill.marks).not.toContain("unknown");
    expect(undoFleet(l, fill).marks).toEqual(next.marks);
    const win = {
      marks: Array.from({ length: 16 }, (_, i): FleetMark =>
        l.certificate.occupied.includes(i) ? "ship" : "sea",
      ),
      history: [s.marks],
    };
    expect(editFleet(l, win, 0, "sea")).toBe(win);
    expect(fillFleetSea(l, win)).toBe(win);
    expect(undoFleet(l, win)).toBe(win);
    expect(validFleetProblem({ ...l, size: 7 })).toBe(false);
    expect(validFleetProblem({ ...l, fleet: [4] })).toBe(false);
    expect(validFleetProblem({ ...l, clues: [...l.clues, ...l.clues] })).toBe(
      false,
    );
    expect(solveFleet(l, []).status).toBe("invalid");
    const conflict = initialFleetMarks(l);
    conflict[12] = "ship";
    expect(solveFleet(l, conflict).status).toBe("invalid");
  });
});

describe("FleetLogic DOM journeys (jsdom, not browser rendering)", () => {
  for (const [level, l] of fleetLevels.entries())
    it(`${l.id}: tools, fixed clues, reset, pause, undo, complete, readonly`, () => {
      let p = { ...props(), level };
      const view = render(
          <StrictMode>
            <FleetLogic {...p} />
          </StrictMode>,
        ),
        cell = (index: number) =>
          view.container.querySelector<HTMLButtonElement>(
            `[data-fleet-cell="${index}"]`,
          )!,
        board = () =>
          Array.from(
            view.container.querySelectorAll<HTMLButtonElement>(
              "[data-fleet-cell]",
            ),
          ).map((b) => b.dataset.mark),
        brush = (mark: FleetMark) =>
          fireEvent.click(
            view.container.querySelector(`[data-fleet-brush="${mark}"]`)!,
          );
      const free = initialFleetMarks(l).findIndex((m) => m === "unknown"),
        original = board();
      fireEvent.click(cell(l.clues[0].cell));
      expect(board()).toEqual(original);
      expect(cell(l.clues[0].cell).getAttribute("aria-label")).toContain(
        "固定线索",
      );
      fireEvent.click(cell(free));
      expect(cell(free).dataset.mark).toBe("ship");
      p = { ...p, resetToken: 1 };
      view.rerender(
        <StrictMode>
          <FleetLogic {...p} />
        </StrictMode>,
      );
      expect(board()).toEqual(original);
      brush("sea");
      fireEvent.click(cell(free));
      expect(cell(free).dataset.mark).toBe("sea");
      p = { ...p, paused: true, hintToken: 1, undoToken: 1 };
      view.rerender(
        <StrictMode>
          <FleetLogic {...p} />
        </StrictMode>,
      );
      fireEvent.click(cell(free));
      expect(cell(free).dataset.mark).toBe("sea");
      expect(
        view.container.querySelector("[data-fleet-status]")!.textContent,
      ).toContain("暂停");
      p = { ...p, paused: false };
      view.rerender(
        <StrictMode>
          <FleetLogic {...p} />
        </StrictMode>,
      );
      expect(cell(free).dataset.mark).toBe("sea");
      p = { ...p, undoToken: 2 };
      view.rerender(
        <StrictMode>
          <FleetLogic {...p} />
        </StrictMode>,
      );
      expect(board()).toEqual(original);
      p = { ...p, hintToken: 2 };
      view.rerender(
        <StrictMode>
          <FleetLogic {...p} />
        </StrictMode>,
      );
      expect(board()).toEqual(original);
      expect(
        view.container.querySelector("[data-fleet-status]")!.textContent,
      ).toContain("必定");
      brush("ship");
      for (const i of l.certificate.occupied)
        if (!l.clues.some((c) => c.cell === i)) fireEvent.click(cell(i));
      expect(p.onComplete).not.toHaveBeenCalled();
      fireEvent.click(view.container.querySelector("[data-fleet-fill-sea]")!);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        view.container.querySelector('[data-fleet-won="true"]'),
      ).not.toBeNull();
      const complete = board();
      p = { ...p, undoToken: 3, hintToken: 3 };
      view.rerender(
        <StrictMode>
          <FleetLogic {...p} />
        </StrictMode>,
      );
      brush("unknown");
      fireEvent.click(cell(free));
      expect(board()).toEqual(complete);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      p = { ...p, resetToken: 2 };
      view.rerender(
        <StrictMode>
          <FleetLogic {...p} />
        </StrictMode>,
      );
      expect(board()).toEqual(original);
      expect(
        view.container.querySelector('[data-fleet-won="false"]'),
      ).not.toBeNull();
    });
  it("supports keyboard navigation through fixed clues and non-destructive hints", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(<FleetLogic {...p} />),
      first = view.container.querySelector<HTMLButtonElement>(
        '[data-fleet-cell="0"]',
      )!;
    first.focus();
    await user.keyboard("s{ArrowRight}w");
    const second = view.container.querySelector<HTMLButtonElement>(
      '[data-fleet-cell="1"]',
    )!;
    expect(document.activeElement).toBe(second);
    expect(first.dataset.mark).toBe("ship");
    expect(second.dataset.mark).toBe("sea");
    await user.keyboard("u");
    expect(second.dataset.mark).toBe("unknown");
    await user.keyboard("{ArrowLeft}{Enter}");
    expect(document.activeElement).toBe(first);
    expect(first.dataset.mark).toBe("ship");
  });
  it("rejects a fully marked wrong board without false completion", () => {
    const p = props(),
      view = render(<FleetLogic {...p} />);
    fireEvent.click(view.container.querySelector("[data-fleet-fill-sea]")!);
    fireEvent.click(view.container.querySelector("[data-fleet-check]")!);
    expect(p.onComplete).not.toHaveBeenCalled();
    expect(
      view.container.querySelector("[data-fleet-status]")!.textContent,
    ).toContain("行");
  });
});

describe("FleetLogic viewport and browser-shortcut regressions", () => {
  it("reveals keyboard-selected cells only inside the horizontal board viewport (synthetic geometry)", async () => {
    const user = userEvent.setup(),
      view = render(<FleetLogic {...props()} level={6} />),
      viewport = view.container.querySelector<HTMLDivElement>(
        "[data-fleet-viewport]",
      )!;
    viewport.scrollTop = 29;
    vi.spyOn(viewport, "getBoundingClientRect").mockImplementation(() => ({
      left: 0,
      right: 180,
      top: 0,
      bottom: 400,
      width: 180,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));
    const cells = Array.from(
      view.container.querySelectorAll<HTMLButtonElement>("[data-fleet-cell]"),
    );
    for (const cell of cells)
      vi.spyOn(cell, "getBoundingClientRect").mockImplementation(() => {
        const left =
          10 + (Number(cell.dataset.fleetCell) % 6) * 52 - viewport.scrollLeft;
        return {
          left,
          right: left + 44,
          top: 10,
          bottom: 54,
          width: 44,
          height: 44,
          x: left,
          y: 10,
          toJSON: () => ({}),
        };
      });
    const pageScroll = vi.spyOn(window, "scrollTo");
    cells[0].focus();
    await user.keyboard(
      "{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}",
    );
    expect(document.activeElement).toBe(cells[5]);
    expect(viewport.scrollLeft).toBeGreaterThan(0);
    const scrolled = viewport.scrollLeft;
    await user.keyboard(
      "{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}",
    );
    expect(document.activeElement).toBe(cells[0]);
    expect(viewport.scrollLeft).toBeLessThan(scrolled);
    expect(viewport.scrollTop).toBe(29);
    expect(pageScroll).not.toHaveBeenCalled();
    pageScroll.mockRestore();
    expect(view.getByText(/窄屏可左右滑动海图/)).toBeTruthy();
  });
  it("does not paint or prevent Ctrl, Command, or Alt shortcuts", () => {
    const view = render(<FleetLogic {...props()} />),
      cell = view.container.querySelector<HTMLButtonElement>(
        '[data-fleet-cell="0"]',
      )!;
    for (const modifier of ["ctrlKey", "metaKey", "altKey"])
      for (const key of ["s", "w", "u", "ArrowRight"]) {
        const event = new KeyboardEvent("keydown", {
          key,
          [modifier]: true,
          bubbles: true,
          cancelable: true,
        });
        cell.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
    expect(cell.dataset.mark).toBe("unknown");
    expect(cell.tabIndex).toBe(0);
  });
});
