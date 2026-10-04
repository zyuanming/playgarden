// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaperFold from "../src/games/PaperFold";
import { paperFoldLevels } from "../src/games/paperFoldLevels";
import {
  PAPER_SEARCH_LIMIT,
  createPaperState,
  initialPaperBoard,
  movePaper,
  paperHint,
  paperStep,
  paperWon,
  searchPaper,
  undoPaper,
  validPaperBoard,
  validPaperLevel,
  type PaperAction,
  type PaperLevel,
} from "../src/games/paperFoldLogic";
afterEach(cleanup);
/** Independent oracle: each original square has a 3D integer position, never a stack array. */
type Atom = { x: number; y: number; z: number; hole: boolean };
type Oracle = { atoms: Atom[]; folds: number; punches: number; open: boolean };
const start = (l: PaperLevel): Oracle => ({
  atoms: Array.from({ length: l.width * l.height }, (_, i) => ({
    x: i % l.width,
    y: Math.floor(i / l.width),
    z: 0,
    hole: false,
  })),
  folds: 0,
  punches: 0,
  open: false,
});
function oracleStep(l: PaperLevel, s: Oracle, a: PaperAction): Oracle | null {
  if (s.open) return null;
  if (a.kind === "unfold") return s.punches ? { ...s, open: true } : null;
  if (a.kind === "punch") {
    if (!s.folds || s.punches >= l.maxPunches) return null;
    const x = a.cell % l.width,
      y = Math.floor(a.cell / l.width);
    if (!s.atoms.some((p) => p.x === x && p.y === y && !p.hole)) return null;
    return {
      ...s,
      punches: s.punches + 1,
      atoms: s.atoms.map((p) => ({
        ...p,
        hole: p.hole || (p.x === x && p.y === y),
      })),
    };
  }
  if (s.punches || s.folds >= l.maxFolds) return null;
  const c = l.creases.find((c) => c.id === a.crease);
  if (!c) return null;
  const moving = (p: Atom) =>
    c.side === "low" ? p[c.axis] < c.at : p[c.axis] >= c.at;
  if (!s.atoms.some(moving) || s.atoms.every(moving)) return null;
  const atoms = s.atoms.map((p) => {
    if (!moving(p)) return { ...p };
    const v = 2 * c.at - 1 - p[c.axis],
      q = { ...p, [c.axis]: v };
    const sourceMax = Math.max(
      ...s.atoms.filter((r) => r.x === p.x && r.y === p.y).map((r) => r.z),
    );
    const destinationTop = Math.max(
      -1,
      ...s.atoms
        .filter((r) => !moving(r) && r.x === q.x && r.y === q.y)
        .map((r) => r.z),
    );
    q.z = destinationTop + 1 + sourceMax - p.z;
    return q;
  });
  if (
    atoms.some((p) => p.x < 0 || p.x >= l.width || p.y < 0 || p.y >= l.height)
  )
    return null;
  return { ...s, atoms, folds: s.folds + 1 };
}
const oracleWon = (l: PaperLevel, s: Oracle) =>
  s.open && s.atoms.every((p, i) => p.hole === l.target.includes(i));
function oracleSearch(l: PaperLevel, s = start(l)) {
  const queue: [Oracle, number][] = [[s, 0]],
    seen = new Set([JSON.stringify(s)]);
  for (let i = 0; i < queue.length; i++) {
    const [current, d] = queue[i];
    if (oracleWon(l, current)) return d;
    if (current.atoms.some((p, i) => p.hole && !l.target.includes(i))) continue;
    const actions: PaperAction[] = [
      ...l.creases.map((c) => ({ kind: "fold" as const, crease: c.id })),
      ...Array.from({ length: l.width * l.height }, (_, cell) => ({
        kind: "punch" as const,
        cell,
      })),
      { kind: "unfold" },
    ];
    for (const a of actions) {
      const next = oracleStep(l, current, a);
      if (!next || next.atoms.some((p, i) => p.hole && !l.target.includes(i)))
        continue;
      const key = JSON.stringify(next);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([next, d + 1]);
    }
  }
  return null;
}
const props = () => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
});
function clickAction(container: HTMLElement, a: PaperAction) {
  const selector =
    a.kind === "fold"
      ? `[data-paper-fold="${a.crease}"]`
      : a.kind === "punch"
        ? `[data-paper-cell="${a.cell}"]`
        : "[data-paper-unfold]";
  fireEvent.click(container.querySelector(selector)!);
}
const snapshot = (container: HTMLElement) =>
  container
    .querySelector("[data-paper-state]")!
    .getAttribute("data-paper-state");
describe("PaperFold independent original-square oracle", () => {
  for (const l of paperFoldLevels)
    it(`${l.id}: authored target, layer order, certificate, shortest oracle`, () => {
      expect(validPaperLevel(l)).toBe(true);
      let s = createPaperState(l),
        o = start(l);
      const initial = JSON.stringify(s);
      for (const a of l.certificate.actions) {
        const previous = JSON.stringify(s),
          old = s;
        s = movePaper(l, s, a);
        expect(s).not.toBe(old);
        expect(JSON.stringify(old)).toBe(previous);
        o = oracleStep(l, o, a)!;
        expect(o).not.toBeNull();
        for (let i = 0; i < l.width * l.height; i++)
          expect(s.board.stacks[i]).toEqual(
            o.atoms
              .map((p, key) => ({ ...p, key }))
              .filter((p) => p.y * l.width + p.x === i)
              .sort((a, b) => a.z - b.z)
              .map((p) => p.key),
          );
        expect(s.board.holes).toEqual(
          o.atoms.flatMap((p, i) => (p.hole ? [i] : [])),
        );
      }
      expect(oracleWon(l, o)).toBe(true);
      expect(paperWon(l, s.board)).toBe(true);
      expect(JSON.stringify(createPaperState(l))).toBe(initial);
      expect(undoPaper(l, s)).toBe(s);
      expect(movePaper(l, s, { kind: "punch", cell: 0 })).toBe(s);
      expect(
        paperStep(l, s.board, { kind: "fold", crease: l.creases[0].id }),
      ).toBeNull();
      const result = searchPaper(l);
      expect(result.status).toBe("solved");
      expect(result.actions.length).toBe(oracleSearch(l));
      expect(result.visited).toBeLessThanOrEqual(PAPER_SEARCH_LIMIT);
    });
  it("ignores certificates including throwing getters, and hints work from actual detours", () => {
    const l = paperFoldLevels[11],
      copy = { ...l };
    Object.defineProperty(copy, "certificate", {
      get() {
        throw new Error("certificate must not be read");
      },
    });
    let s = createPaperState(l);
    s = movePaper(l, s, { kind: "fold", crease: "D" });
    expect(s.history).toHaveLength(1);
    expect(searchPaper(copy, s.board)).toEqual(searchPaper(l, s.board));
    expect(paperHint(copy, s.board)).toBe(paperHint(l, s.board));
    const r = searchPaper(copy, s.board);
    expect(r.status).toBe("solved");
    for (const a of r.actions) s = movePaper(copy, s, a);
    expect(paperWon(copy, s.board)).toBe(true);
  });
  it("accepts alternate fold directions and punch orders without requiring the witness", () => {
    const l = paperFoldLevels[3];
    let s = createPaperState(l);
    const actions = [
      l.certificate.actions[0],
      l.certificate.actions[2],
      l.certificate.actions[1],
      l.certificate.actions[3],
    ];
    for (const a of actions) s = movePaper(l, s, a);
    expect(paperWon(l, s.board)).toBe(true);
    const square = paperFoldLevels[2],
      r = searchPaper(
        square,
        paperStep(square, initialPaperBoard(square), {
          kind: "fold",
          crease: "C",
        })!,
      );
    expect(r.status).toBe("solved");
  });
  it("validates budgets, malformed data, empty sides, outside folds and repeated punching", () => {
    const l = paperFoldLevels[0],
      s = createPaperState(l);
    expect(paperStep(l, s.board, { kind: "punch", cell: 0 })).toBeNull();
    expect(paperStep(l, s.board, { kind: "unfold" })).toBeNull();
    expect(
      paperStep(l, s.board, { kind: "fold", crease: "missing" }),
    ).toBeNull();
    expect(validPaperLevel({ ...l, width: 7 })).toBe(false);
    expect(searchPaper({ ...l, width: Number.POSITIVE_INFINITY }).status).toBe(
      "invalid",
    );
    expect(validPaperLevel({ ...l, maxFolds: 4 })).toBe(false);
    expect(validPaperLevel({ ...l, maxPunches: 3 })).toBe(false);
    expect(validPaperLevel({ ...l, target: [0, 0] })).toBe(false);
    expect(
      validPaperBoard(l, { ...s.board, stacks: s.board.stacks.map(() => [0]) }),
    ).toBe(false);
    expect(searchPaper(l, { ...s.board, folds: -1 }).status).toBe("invalid");
    const folded = paperStep(l, s.board, { kind: "fold", crease: "A" })!;
    expect(paperStep(l, folded, { kind: "punch", cell: -1 })).toBeNull();
    expect(paperStep(l, folded, { kind: "punch", cell: 99 })).toBeNull();
    expect(paperStep(l, folded, { kind: "punch", cell: 0 })).toBeNull();
    const punched = paperStep(l, folded, { kind: "punch", cell: 2 })!;
    expect(paperStep(l, punched, { kind: "fold", crease: "B" })).toBeNull();
    expect(paperStep(l, punched, { kind: "punch", cell: 2 })).toBeNull();
    const outside = {
      ...l,
      creases: [{ id: "X", axis: "x" as const, at: 1, side: "high" as const }],
    };
    expect(
      paperStep(outside, initialPaperBoard(outside), {
        kind: "fold",
        crease: "X",
      }),
    ).toBeNull();
    const empty = { ...l, maxFolds: 3 };
    expect(paperStep(empty, folded, { kind: "fold", crease: "A" })).toBeNull();
  });
  it("reports cancellation/caps honestly, and only claims impossible after exhaustive sound pruning", () => {
    const l = paperFoldLevels[11];
    expect(searchPaper(l, initialPaperBoard(l), { limit: 1 }).status).toBe(
      "limited",
    );
    expect(
      searchPaper(l, initialPaperBoard(l), { cancelled: () => true }).status,
    ).toBe("cancelled");
    const impossible = { ...paperFoldLevels[0], target: [0] };
    expect(searchPaper(impossible).status).toBe("unreachable");
    expect(oracleSearch(impossible)).toBeNull();
    const basic = paperFoldLevels[0];
    let s = movePaper(basic, createPaperState(basic), {
      kind: "fold",
      crease: "A",
    });
    s = movePaper(basic, s, { kind: "punch", cell: 3 });
    s = movePaper(basic, s, { kind: "unfold" });
    expect(paperWon(basic, s.board)).toBe(false);
    expect(searchPaper(basic, s.board).status).toBe("unreachable");
    expect(undoPaper(basic, s).board.phase).toBe("punching");
  });
});
describe("PaperFold 12 rendered journeys and interruption", () => {
  it("repairs internal reset/level focus without scrolling or stealing external focus", () => {
    const p = props();
    const content = (resetToken: number, level: number) => (
      <StrictMode>
        <button data-shell-reset>Shell reset</button>
        <PaperFold {...p} resetToken={resetToken} level={level} />
      </StrictMode>
    );
    const v = render(content(0, 0));
    const host = v.container.querySelector(
      "[data-paper-host]",
    ) as HTMLDivElement;
    const focus = vi.spyOn(host, "focus");
    (
      v.container.querySelector('[data-paper-cell="2"]') as HTMLButtonElement
    ).focus();
    expect(document.activeElement).not.toBe(document.body);
    v.rerender(content(1, 0));
    expect(v.container.querySelector("[data-paper-host]")).toBe(host);
    expect(document.activeElement).toBe(host);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockClear();
    (
      v.container.querySelector('[data-paper-cell="2"]') as HTMLButtonElement
    ).focus();
    v.rerender(content(1, 1));
    expect(document.activeElement).toBe(host);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    const shell = v.container.querySelector(
      "[data-shell-reset]",
    ) as HTMLButtonElement;
    shell.focus();
    focus.mockClear();
    v.rerender(content(2, 1));
    expect(document.activeElement).toBe(shell);
    v.rerender(content(2, 2));
    expect(document.activeElement).toBe(shell);
    expect(focus).not.toHaveBeenCalled();
    focus.mockRestore();
  });
  it("renders and completes even when the certificate getter throws", () => {
    const l = paperFoldLevels[0],
      actions = [...l.certificate.actions],
      descriptor = Object.getOwnPropertyDescriptor(l, "certificate")!;
    Object.defineProperty(l, "certificate", {
      configurable: true,
      get() {
        throw new Error("runtime certificate access");
      },
    });
    try {
      const p = props(),
        v = render(<PaperFold {...p} />);
      for (const a of actions) clickAction(v.container, a);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(l, "certificate", descriptor);
    }
  });
  paperFoldLevels.forEach((l, level) =>
    it(`plays real controls for ${l.id}`, () => {
      const p = { ...props(), level },
        v = render(<PaperFold {...p} />);
      expect(v.getByText(/目标孔：/)).toBeTruthy();
      for (const a of l.certificate.actions) clickAction(v.container, a);
      expect(v.container.querySelector("[data-paper-won=true]")).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      const end = snapshot(v.container);
      for (const button of v.container.querySelectorAll(
        "button:not([data-paper-preview])",
      ))
        fireEvent.click(button);
      v.rerender(<PaperFold {...p} hintToken={4} undoToken={8} />);
      expect(snapshot(v.container)).toBe(end);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    }),
  );
  it("freezes pause, consumes stale tokens, preserves local/Shell focus, and resets cleanly", () => {
    const p = props(),
      v = render(
        <StrictMode>
          <button data-shell>Shell</button>
          <PaperFold {...p} />
        </StrictMode>,
      );
    const fold = v.container.querySelector(
      '[data-paper-fold="A"]',
    ) as HTMLButtonElement;
    fold.focus();
    fireEvent.click(fold);
    expect(document.activeElement).toBe(fold);
    const state = snapshot(v.container);
    v.rerender(
      <StrictMode>
        <button data-shell>Shell</button>
        <PaperFold {...p} paused undoToken={2} hintToken={3} />
      </StrictMode>,
    );
    clickAction(v.container, { kind: "punch", cell: 2 });
    expect(snapshot(v.container)).toBe(state);
    const shell = v.container.querySelector(
      "[data-shell]",
    ) as HTMLButtonElement;
    shell.focus();
    v.rerender(
      <StrictMode>
        <button data-shell>Shell</button>
        <PaperFold {...p} undoToken={2} hintToken={3} />
      </StrictMode>,
    );
    expect(snapshot(v.container)).toBe(state);
    expect(document.activeElement).toBe(shell);
    v.rerender(
      <StrictMode>
        <button data-shell>Shell</button>
        <PaperFold {...p} undoToken={3} hintToken={4} />
      </StrictMode>,
    );
    expect(JSON.parse(snapshot(v.container)!).folds).toBe(0);
    expect(document.activeElement).toBe(shell);
    v.rerender(
      <StrictMode>
        <PaperFold {...p} level={11} resetToken={2} />
      </StrictMode>,
    );
    expect(JSON.parse(snapshot(v.container)!).stacks).toHaveLength(36);
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("supports native keyboard, stable punched-cell focus, fallback, and no modified shortcut interception", async () => {
    const p = props(),
      v = render(<PaperFold {...p} />),
      user = userEvent.setup();
    await user.tab();
    const fold = v.container.querySelector('[data-paper-fold="A"]')!;
    expect(document.activeElement).toBe(fold);
    await user.keyboard("{Enter}");
    const cell = v.container.querySelector(
      '[data-paper-cell="2"]',
    ) as HTMLButtonElement;
    cell.focus();
    await user.keyboard(" ");
    expect(document.activeElement).toBe(cell);
    for (const key of [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "z",
    ]) {
      const e = new KeyboardEvent("keydown", {
        key,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      cell.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(cell);
    }
    const unfold = v.container.querySelector(
      "[data-paper-unfold]",
    ) as HTMLButtonElement;
    unfold.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(unfold);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    fireEvent.click(v.container.querySelector("[data-paper-preview]")!);
    expect(v.getByText("3D 预览不可用")).toBeTruthy();
    fireEvent.click(v.container.querySelector("[data-paper-preview]")!);
    expect(v.queryByText("3D 预览不可用")).toBeNull();
    v.rerender(<PaperFold {...p} resetToken={1} />);
    for (const a of paperFoldLevels[0].certificate.actions)
      clickAction(v.container, a);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("can undo a wrong unfolded attempt and continue rather than falsely lock", () => {
    const p = props(),
      v = render(<PaperFold {...p} />);
    clickAction(v.container, { kind: "fold", crease: "A" });
    clickAction(v.container, { kind: "punch", cell: 3 });
    clickAction(v.container, { kind: "unfold" });
    expect(p.onComplete).not.toHaveBeenCalled();
    fireEvent.click(v.container.querySelector("[data-paper-undo]")!);
    fireEvent.click(v.container.querySelector("[data-paper-undo]")!);
    clickAction(v.container, { kind: "punch", cell: 2 });
    clickAction(v.container, { kind: "unfold" });
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
});
