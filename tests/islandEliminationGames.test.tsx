// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import HitoriGarden from "../src/games/HitoriGarden";
import NurikabeGarden from "../src/games/NurikabeGarden";
import {
  createHitoriState,
  cycleHitoriCell,
  getHitoriHint,
  hitoriConflicts,
  hitoriLevels,
  isHitoriSolved,
  setHitoriCell,
  solveHitori,
  undoHitori,
  validHitoriLevel,
  type HitoriLevel,
} from "../src/games/hitoriLogic";
import {
  createNurikabeState,
  cycleNurikabeCell,
  getNurikabeHint,
  isNurikabeSolved,
  nurikabeConflicts,
  nurikabeLevels,
  setNurikabeCell,
  solveNurikabe,
  undoNurikabe,
  validNurikabeLevel,
  type NurikabeLevel,
} from "../src/games/nurikabeLogic";
import {
  ISLAND_HISTORY_LIMIT,
  islandHint,
  type IslandCell,
} from "../src/games/islandEliminationCore";
import {
  hitoriCertificates,
  nurikabeCertificates,
} from "./fixtures/islandEliminationCertificates";
import {
  certifyHitori,
  certifyNurikabe,
  oracleHitori,
  oracleNurikabe,
} from "./fixtures/islandEliminationOracle";
afterEach(cleanup);
const props = (change: Partial<GameProps> = {}): GameProps => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
  ...change,
});
const cell = (i: number): HTMLButtonElement =>
  document.querySelector(`[data-island-cell="${i}"]`)!;
const values = () =>
  [...document.querySelectorAll("[data-island-cell]")].map((e) =>
    Number(e.getAttribute("data-value")),
  );
const mark = (i: number, v: number) => {
  fireEvent.focus(cell(i));
  fireEvent.keyDown(cell(i), { key: String(v) });
};
const keys = (boards: readonly number[][]) =>
  boards.map((b) => b.join("")).sort();
function words(base: number, length: number): number[][] {
  return Array.from({ length: base ** length }, (_, i) =>
    Array.from({ length }, (_, j) => Math.floor(i / base ** j) % base),
  );
}

describe("independently certified original Hitori and Nurikabe levels", () => {
  it("has twelve distinct boards per game, increasing board sizes, no runtime certificates", () => {
    for (const levels of [hitoriLevels, nurikabeLevels]) {
      expect(levels).toHaveLength(12);
      expect(levels.map((l) => l.size)).toEqual([
        3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6,
      ]);
      expect(new Set(levels.map((l) => JSON.stringify(l))).size).toBe(12);
    }
  });
  hitoriLevels.forEach((level, index) =>
    it(`certifies Hitori ${index + 1} uniquely by independent row masks`, () => {
      expect(validHitoriLevel(level)).toBe(true);
      const independent = certifyHitori(level),
        runtime = solveHitori(level);
      expect(independent.solutions).toEqual([hitoriCertificates[index].board]);
      expect(runtime.status).toBe("complete");
      expect(runtime.solutions).toEqual(independent.solutions);
      expect(oracleHitori(level, hitoriCertificates[index].board)).toBe(true);
      expect(runtime.nodes).toBeLessThan(12000);
    }),
  );
  nurikabeLevels.forEach((level, index) =>
    it(`certifies Nurikabe ${index + 1} uniquely by independent island shapes`, () => {
      expect(validNurikabeLevel(level)).toBe(true);
      const independent = certifyNurikabe(level),
        runtime = solveNurikabe(level);
      expect(independent.solutions).toEqual([
        nurikabeCertificates[index].board,
      ]);
      expect(runtime.status).toBe("complete");
      expect(runtime.solutions).toEqual(independent.solutions);
      expect(oracleNurikabe(level, nurikabeCertificates[index].board)).toBe(
        true,
      );
      expect(runtime.nodes).toBeLessThan(12000);
    }),
  );
  it("exhaustively agrees on every 2x2 Hitori numeric board and every partial marking", () => {
    for (const digits of words(2, 4)) {
      const level: HitoriLevel = {
        title: "exhaustive",
        size: 2,
        numbers: digits.map((v) => v + 1),
      };
      const solutions = words(2, 4).filter((b) => oracleHitori(level, b));
      for (const full of words(2, 4))
        expect(isHitoriSolved(level, full)).toBe(oracleHitori(level, full));
      for (const encoded of words(3, 4)) {
        const board = encoded.map((v) => v - 1),
          expected = solutions.filter((s) =>
            board.every((v, i) => v === -1 || v === s[i]),
          ),
          actual = solveHitori(level, board, 100);
        expect(actual.status).toBe("complete");
        expect(keys(actual.solutions)).toEqual(keys(expected));
      }
    }
  });
  it("exhaustively agrees on every valid 2x2 Nurikabe clue layout and partial marking", () => {
    for (const digits of words(4, 4)) {
      const level: NurikabeLevel = {
        title: "exhaustive",
        size: 2,
        clues: digits.flatMap((v, i) => (v ? [{ index: i, area: v }] : [])),
      };
      if (!validNurikabeLevel(level)) continue;
      const solutions = words(2, 4).filter((b) => oracleNurikabe(level, b));
      for (const full of words(2, 4))
        expect(isNurikabeSolved(level, full)).toBe(oracleNurikabe(level, full));
      for (const encoded of words(3, 4)) {
        const board = encoded.map((v) => v - 1);
        if (level.clues.some((c) => board[c.index] !== 0)) continue;
        const expected = solutions.filter((s) =>
            board.every((v, i) => v === -1 || v === s[i]),
          ),
          actual = solveNurikabe(level, board, 100);
        expect(actual.status).toBe("complete");
        expect(keys(actual.solutions)).toEqual(keys(expected));
      }
    }
  });
});

describe("honest current-position hints, validation and deterministic immutable history", () => {
  it("teaches the Hitori sandwich, duplicate and separated-black rules from the current marks", () => {
    const level = hitoriLevels[0],
      board = createHitoriState(level).board;
    expect(getHitoriHint(level, board)).toMatchObject({
      kind: "deduction",
      index: 1,
      value: 0,
      reason: expect.stringContaining("夹心法"),
    });
    board[1] = 0;
    expect(getHitoriHint(level, board)).toMatchObject({
      kind: "deduction",
      index: 4,
      value: 1,
      reason: expect.stringContaining("避免重复"),
    });
    board[4] = 1;
    expect(getHitoriHint(level, board)).toMatchObject({
      kind: "deduction",
      index: 3,
      value: 0,
      reason: expect.stringContaining("黑格分隔"),
    });
    const withoutLocalRule = hitoriCertificates[0].board.slice();
    withoutLocalRule[8] = -1;
    expect(getHitoriHint(level, withoutLocalRule)).toMatchObject({
      kind: "deduction",
      index: 8,
      value: 0,
      reason: expect.stringContaining("已完整检查当前标记的所有可行延伸"),
    });
  });
  it("teaches why a completed Nurikabe island must have a sea boundary", () => {
    const level = nurikabeLevels[0],
      board = createNurikabeState(level).board;
    expect(getNurikabeHint(level, board)).toMatchObject({
      kind: "deduction",
      index: 4,
      value: 1,
      reason: expect.stringContaining("这座岛已连成 1 格"),
    });
    board[4] = 1;
    expect(getNurikabeHint(level, board)).toMatchObject({
      kind: "deduction",
      index: 6,
      value: 1,
      reason: expect.stringContaining("小岛封边"),
    });
  });
  for (const game of ["hitori", "nurikabe"] as const)
    it(`${game} hints derive from current constraints on every level, with honest budgets and repair`, () => {
      const levels = game === "hitori" ? hitoriLevels : nurikabeLevels,
        certificates =
          game === "hitori" ? hitoriCertificates : nurikabeCertificates;
      levels.forEach((_, index) => {
        const initial =
          game === "hitori"
            ? createHitoriState(hitoriLevels[index])
            : createNurikabeState(nurikabeLevels[index]);
        const get = (b: readonly number[], budget?: number) =>
          game === "hitori"
            ? getHitoriHint(hitoriLevels[index], b, budget)
            : getNurikabeHint(nurikabeLevels[index], b, budget);
        expect(get(initial.board, 0)?.kind).toBe("unavailable");
        const before = initial.board.slice(),
          hint = get(initial.board);
        expect(initial.board).toEqual(before);
        expect(hint?.kind).toBe("deduction");
        if (hint?.kind === "deduction") {
          expect(hint.value).toBe(certificates[index].board[hint.index]);
          const partial = initial.board.slice();
          partial[hint.index] = hint.value;
          const next = get(partial);
          expect(next?.kind).toBe("deduction");
          if (next?.kind === "deduction")
            expect(next.value).toBe(certificates[index].board[next.index]);
        }
        const solution = certificates[index].board;
        // Rule explanations must remain sound through an entire hint-led solve,
        // including their transition to the explicitly searched fallback.
        const guided = initial.board.slice();
        while (guided.includes(-1)) {
          const step = get(guided),
            beforeStep = guided.slice();
          expect(step?.kind).toBe("deduction");
          expect(guided).toEqual(beforeStep);
          if (step?.kind !== "deduction") break;
          expect(guided[step.index]).toBe(-1);
          expect(step.value).toBe(solution[step.index]);
          guided[step.index] = step.value;
        }
        expect(guided).toEqual(solution);
        expect(get(solution)).toBeNull();
        const wrong = solution.slice(),
          editable = initial.board.findIndex((v) => v === -1);
        wrong[editable] = 1 - wrong[editable];
        const repair = get(wrong);
        expect(repair?.kind).toBe("repair");
        if (repair?.kind === "repair") {
          expect(repair.index).toBe(editable);
          expect(repair.value).toBe(-1);
        }
      });
    });
  it("never treats interrupted or capped search as a proof", () => {
    expect(
      islandHint(
        [-1],
        () => ({ solutions: [[0]], nodes: 1, status: "budget" }),
        false,
        ["white", "black"],
      ),
    ).toMatchObject({ kind: "unavailable" });
    expect(
      islandHint(
        [-1],
        () => ({ solutions: [[0], [1]], nodes: 1, status: "limit" }),
        false,
        ["white", "black"],
      ),
    ).toMatchObject({ kind: "unavailable" });
  });
  it("validates inputs and enforces pause, fixed clues, copy-on-write and 300-step history", () => {
    expect(validHitoriLevel({ ...hitoriLevels[0], size: 7 })).toBe(false);
    expect(validHitoriLevel({ ...hitoriLevels[0], numbers: [NaN] })).toBe(
      false,
    );
    expect(validNurikabeLevel({ ...nurikabeLevels[0], clues: [] })).toBe(false);
    expect(
      validNurikabeLevel({
        ...nurikabeLevels[0],
        clues: [{ index: 0, area: 999 }],
      }),
    ).toBe(false);
    expect(
      validNurikabeLevel({
        ...nurikabeLevels[0],
        clues: [null],
      } as unknown as NurikabeLevel),
    ).toBe(false);
    expect(solveHitori(hitoriLevels[0], []).status).toBe("invalid");
    expect(solveNurikabe(nurikabeLevels[0], []).status).toBe("invalid");
    expect(solveHitori(hitoriLevels[0], undefined, 0).status).toBe("invalid");
    expect(solveNurikabe(nurikabeLevels[0], undefined, 2, -1).status).toBe(
      "invalid",
    );
    const h = createHitoriState(hitoriLevels[0]),
      n = createNurikabeState(nurikabeLevels[0]);
    expect(cycleHitoriCell(h, 0, true)).toBe(h);
    expect(setHitoriCell(h, -1, 1)).toBe(h);
    expect(setHitoriCell(h, 0, 2 as IslandCell)).toBe(h);
    expect(undoHitori(h)).toBe(h);
    const edited = cycleHitoriCell(h, 0);
    expect(h.board[0]).toBe(-1);
    expect(edited.board[0]).toBe(1);
    expect(undoHitori(edited).board).toEqual(h.board);
    expect(undoHitori(edited, true)).toBe(edited);
    const fixed = nurikabeLevels[0].clues[0].index;
    expect(cycleNurikabeCell(n, nurikabeLevels[0], fixed)).toBe(n);
    const i = n.board.findIndex((v) => v === -1);
    expect(setNurikabeCell(n, nurikabeLevels[0], i, 1, true)).toBe(n);
    const ne = cycleNurikabeCell(n, nurikabeLevels[0], i);
    expect(undoNurikabe(ne).board).toEqual(n.board);
    let long = h;
    for (let k = 0; k < 350; k++) long = cycleHitoriCell(long, 0);
    expect(long.history).toHaveLength(ISLAND_HISTORY_LIMIT);
  });
  it("reports direct duplicate, shade adjacency, island collision and 2x2 sea conflicts", () => {
    const h: HitoriLevel = { title: "test", size: 2, numbers: [1, 1, 2, 2] };
    expect(hitoriConflicts(h, [0, 0, -1, -1])).toEqual([0, 1]);
    expect(hitoriConflicts(h, [1, 1, -1, -1])).toEqual([0, 1]);
    const n: NurikabeLevel = {
      title: "test",
      size: 3,
      clues: [
        { index: 0, area: 1 },
        { index: 8, area: 1 },
      ],
    };
    expect(nurikabeConflicts(n, [0, 1, 1, -1, 1, 1, -1, -1, 0])).toEqual(
      expect.arrayContaining([1, 2, 4, 5]),
    );
    expect(nurikabeConflicts(n, [0, 0, 0, 0, 0, 0, 0, 0, 0])).toHaveLength(9);
  });
});

for (const game of ["hitori", "nurikabe"] as const)
  describe(`${game} DOM`, () => {
    const Game = game === "hitori" ? HitoriGarden : NurikabeGarden,
      certificates =
        game === "hitori" ? hitoriCertificates : nurikabeCertificates;
    const paint = (mode: "cycle" | IslandCell) =>
      screen.getByRole("button", {
        name:
          mode === "cycle"
            ? "循环标记"
            : mode === 1
              ? game === "hitori"
                ? "黑格画笔"
                : "海水画笔"
              : mode === 0
                ? game === "hitori"
                  ? "白格画笔"
                  : "岛屿画笔"
                : "清空画笔",
      });
    it("paints the final board with one tap per editable cell instead of cycling through unwanted states", () => {
      const p = props({ level: 11 });
      render(<Game {...p} />);
      const initial = values(),
        solution = certificates[11].board;
      let taps = 0;
      for (const value of [1, 0] as const) {
        fireEvent.click(paint(value));
        expect(paint(value).getAttribute("aria-pressed")).toBe("true");
        solution.forEach((v, i) => {
          if (v === value && initial[i] === -1) {
            fireEvent.click(cell(i));
            taps++;
            expect(values()[i]).toBe(value);
          }
        });
      }
      expect(taps).toBe(initial.filter((v) => v === -1).length);
      expect(values()).toEqual(solution);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect((paint(0) as HTMLButtonElement).disabled).toBe(true);
    });
    it("keeps paint mode separate from selection, history, direct keys, hints and lifecycle tokens", async () => {
      let p = props();
      const view = render(<Game {...p} />),
        editable = values().flatMap((v, i) => (v === -1 ? [i] : [])),
        [i, j] = editable,
        initial = values(),
        user = userEvent.setup();
      expect(paint("cycle").getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByText("先试一条规则：")).toBeTruthy();
      fireEvent.click(paint(0));
      expect(values()).toEqual(initial);
      fireEvent.click(cell(i));
      fireEvent.click(cell(j));
      fireEvent.click(cell(j));
      expect(values()[i]).toBe(0);
      expect(values()[j]).toBe(0);
      expect(cell(j).getAttribute("data-selected")).toBe("true");
      expect(document.querySelector(".ie-selection")?.textContent).toContain(
        `第 ${Math.floor(j / 3) + 1} 行第 ${(j % 3) + 1} 列`,
      );
      p = { ...p, undoToken: 1 };
      view.rerender(<Game {...p} />);
      // Repainting the same value adds no undo entry.
      expect(values()[j]).toBe(-1);
      expect(values()[i]).toBe(0);
      expect(paint(0).getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(paint(-1));
      fireEvent.click(cell(i));
      expect(values()).toEqual(initial);
      cell(i).focus();
      await user.keyboard("1");
      expect(values()[i]).toBe(1);
      await user.keyboard("0");
      expect(values()[i]).toBe(0);
      await user.keyboard("{Enter}");
      expect(values()[i]).toBe(-1);
      fireEvent.click(paint(0));
      cell(i).focus();
      await user.keyboard(" ");
      expect(values()[i]).toBe(0);
      await user.keyboard("{Delete}");
      expect(values()[i]).toBe(-1);
      if (game === "nurikabe") {
        const fixed = nurikabeLevels[0].clues[0].index;
        for (const mode of [1, -1] as const) {
          fireEvent.click(paint(mode));
          fireEvent.click(cell(fixed));
          expect(values()[fixed]).toBe(0);
        }
      }
      fireEvent.click(paint(1));
      p = { ...p, hintToken: 1 };
      view.rerender(<Game {...p} />);
      const hinted = document.querySelector(".is-hinted")!;
      expect(hinted.getAttribute("data-selected")).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: "采用这一步" }));
      const hintValue = game === "hitori" ? 0 : 1;
      expect(hinted.getAttribute("data-value")).toBe(String(hintValue));
      expect(paint(1).getAttribute("aria-pressed")).toBe("true");
      p = { ...p, paused: true };
      view.rerender(<Game {...p} />);
      const paused = values();
      expect((paint(0) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(paint(0));
      fireEvent.click(cell(i));
      expect(values()).toEqual(paused);
      p = { ...p, paused: false };
      view.rerender(<Game {...p} />);
      expect(paint(1).getAttribute("aria-pressed")).toBe("true");
      p = { ...p, resetToken: 1 };
      view.rerender(<Game {...p} />);
      expect(values()).toEqual(initial);
      expect(paint("cycle").getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(paint(0));
      p = { ...p, level: 1 };
      view.rerender(<Game {...p} />);
      expect(paint("cycle").getAttribute("aria-pressed")).toBe("true");
      expect(screen.queryByText("先试一条规则：")).toBeNull();
    });
    certificates.forEach((certificate, index) =>
      it(`solves original level ${index + 1} and reports completion once`, () => {
        const p = props({ level: index }),
          view = render(
            <StrictMode>
              <Game {...p} />
            </StrictMode>,
          );
        certificate.board.forEach((v, i) => {
          if (cell(i).getAttribute("data-fixed") !== "true") mark(i, v);
        });
        expect(values()).toEqual(certificate.board);
        expect(
          document
            .querySelector("[data-island-game]")
            ?.getAttribute("data-complete"),
        ).toBe("true");
        expect(p.onComplete).toHaveBeenCalledTimes(1);
        fireEvent.click(cell(0));
        view.rerender(
          <StrictMode>
            <Game {...p} hintToken={1} />
          </StrictMode>,
        );
        expect(p.onComplete).toHaveBeenCalledTimes(1);
      }),
    );
    it("consumes paused tokens; reset and level switches do not replay old hints/undo", () => {
      let p = props();
      const view = render(<Game {...p} />),
        i = values().findIndex((v) => v === -1);
      fireEvent.click(cell(i));
      expect(values()[i]).toBe(1);
      p = { ...p, paused: true, hintToken: 1, undoToken: 1 };
      view.rerender(<Game {...p} />);
      expect(cell(i).disabled).toBe(true);
      fireEvent.keyDown(cell(i), { key: "0" });
      expect(values()[i]).toBe(1);
      expect(document.querySelector("[data-island-hint]")).toBeNull();
      p = { ...p, paused: false };
      view.rerender(<Game {...p} />);
      expect(values()[i]).toBe(1);
      expect(document.querySelector("[data-island-hint]")).toBeNull();
      p = { ...p, undoToken: 2 };
      view.rerender(<Game {...p} />);
      expect(values()[i]).toBe(-1);
      p = { ...p, hintToken: 2 };
      view.rerender(<Game {...p} />);
      expect(
        document
          .querySelector("[data-island-hint]")
          ?.getAttribute("data-island-hint"),
      ).toBe("deduction");
      fireEvent.click(screen.getByRole("button", { name: "采用这一步" }));
      expect(values().filter((v) => v === -1).length).toBe(
        (game === "hitori" ? 9 : 9 - nurikabeLevels[0].clues.length) - 1,
      );
      p = { ...p, resetToken: 1 };
      view.rerender(<Game {...p} />);
      expect(values()[i]).toBe(-1);
      expect(document.querySelector("[data-island-hint]")).toBeNull();
      p = { ...p, level: 1 };
      view.rerender(<Game {...p} />);
      expect(document.querySelector("[data-island-hint]")).toBeNull();
      expect(p.onComplete).not.toHaveBeenCalled();
    });
    it("supports mouse cycle, keyboard focus, direct marking, deletion, fixed clues and same-token callback updates", async () => {
      const p = props(),
        view = render(<Game {...p} />),
        i = values().findIndex((v) => v === -1),
        user = userEvent.setup();
      fireEvent.click(cell(i));
      expect(values()[i]).toBe(1);
      fireEvent.click(cell(i));
      expect(values()[i]).toBe(0);
      fireEvent.click(cell(i));
      expect(values()[i]).toBe(-1);
      cell(i).focus();
      await user.keyboard(" ");
      expect(values()[i]).toBe(1);
      await user.keyboard("{Enter}");
      expect(values()[i]).toBe(0);
      await user.keyboard("{Delete}");
      expect(values()[i]).toBe(-1);
      await user.keyboard("{ArrowRight}");
      const expected = Math.floor(i / 3) * 3 + Math.min(2, (i % 3) + 1);
      expect(document.activeElement).toBe(cell(expected));
      mark(i, 0);
      expect(values()[i]).toBe(0);
      view.rerender(<Game {...p} onStatus={vi.fn()} onComplete={vi.fn()} />);
      expect(values()[i]).toBe(0);
      if (game === "nurikabe") {
        const fixed = nurikabeLevels[0].clues[0].index;
        fireEvent.click(cell(fixed));
        expect(values()[fixed]).toBe(0);
      }
    });
    it("undo after winning cannot report a second completion, while reset starts a fresh attempt", () => {
      let p = props();
      const view = render(<Game {...p} />);
      const solution = certificates[0].board;
      solution.forEach((v, i) => {
        if (cell(i).getAttribute("data-fixed") !== "true") mark(i, v);
      });
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      p = { ...p, undoToken: 1 };
      view.rerender(<Game {...p} />);
      const missing = values().findIndex((v) => v === -1);
      expect(missing).toBeGreaterThanOrEqual(0);
      mark(missing, solution[missing]);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      p = { ...p, resetToken: 1 };
      view.rerender(<Game {...p} />);
      solution.forEach((v, i) => {
        if (cell(i).getAttribute("data-fixed") !== "true") mark(i, v);
      });
      expect(p.onComplete).toHaveBeenCalledTimes(2);
    });
  });
