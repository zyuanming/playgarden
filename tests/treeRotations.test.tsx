// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TreeRotations from "../src/games/TreeRotations";
import { treeRotationsLevels } from "../src/games/treeRotationsLevels";
import {
  TREE_STATE_LIMIT,
  createTreeState,
  initialTree,
  moveTree,
  searchTree,
  treeHint,
  treeMetrics,
  treeShape,
  treeStep,
  treeWon,
  undoTree,
  validSearchTree,
  validTreeLevel,
  type SearchTree,
  type TreeLevel,
  type TreeMove,
} from "../src/games/treeRotationsLogic";
afterEach(cleanup);
/** Independent representation: index = key, value = parent key; 0 means root. */
type Parents = number[];
function parentVector(t: SearchTree, n: number): Parents {
  const p = Array(n + 1).fill(-1);
  const walk = (t: SearchTree | null, parent: number) => {
    if (t) {
      p[t.key] = parent;
      walk(t.left, t.key);
      walk(t.right, t.key);
    }
  };
  walk(t, 0);
  return p;
}
const children = (p: Parents, key: number) =>
  p.flatMap((parent, k) => (parent === key ? [k] : []));
function vectorRotate(p: Parents, m: TreeMove): Parents | null {
  const pivot = children(p, m.key).find((k) =>
    m.direction === "left" ? k > m.key : k < m.key,
  );
  if (pivot === undefined) return null;
  const inner = children(p, pivot).find((k) =>
      m.direction === "left" ? k < pivot : k > pivot,
    ),
    q = [...p];
  q[pivot] = p[m.key];
  q[m.key] = pivot;
  if (inner !== undefined) q[inner] = m.key;
  return q;
}
function vectorTree(p: Parents, key = p.indexOf(0)): SearchTree {
  const c = children(p, key),
    left = c.find((k) => k < key),
    right = c.find((k) => k > key);
  return {
    key,
    left: left === undefined ? null : vectorTree(p, left),
    right: right === undefined ? null : vectorTree(p, right),
  };
}
function vectorStats(p: Parents, weights: readonly number[]) {
  const depths = p.map((_, i) => {
    if (!i) return 0;
    let d = 1,
      key = i;
    while (p[key] !== 0) {
      d++;
      key = p[key];
      if (d > p.length) throw new Error("cycle");
    }
    return d;
  });
  const branchHeight = (key: number): number =>
    1 + Math.max(0, ...children(p, key).map(branchHeight));
  const balanced = p.slice(1).every((_, i) => {
    const c = children(p, i + 1),
      left = c.find((k) => k < i + 1),
      right = c.find((k) => k > i + 1);
    return (
      Math.abs(
        (left ? branchHeight(left) : 0) - (right ? branchHeight(right) : 0),
      ) <= 1
    );
  });
  return {
    depths,
    height: Math.max(...depths),
    balanced,
    cost: depths.reduce((sum, d, i) => sum + (i ? d * weights[i - 1] : 0), 0),
  };
}
function vectorWon(l: TreeLevel, p: Parents) {
  const m = vectorStats(p, l.weights),
    g = l.goal;
  return (
    m.height <= g.maxHeight &&
    (!g.balanced || m.balanced) &&
    (g.root === undefined || p[g.root] === 0) &&
    (g.maxCost === undefined || m.cost <= g.maxCost)
  );
}
function vectorSearch(
  l: TreeLevel,
  start = parentVector(initialTree(l), l.order.length),
) {
  const queue: [Parents, number][] = [[start, 0]],
    seen = new Set([start.join()]);
  for (let i = 0; i < queue.length; i++) {
    const [p, d] = queue[i];
    if (vectorWon(l, p)) return d;
    for (let key = 1; key <= l.order.length; key++)
      for (const direction of ["right", "left"] as const) {
        const q = vectorRotate(p, { key, direction });
        if (!q || seen.has(q.join())) continue;
        seen.add(q.join());
        queue.push([q, d + 1]);
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
const shape = (c: HTMLElement) =>
  c.querySelector("[data-tree-shape]")!.getAttribute("data-tree-shape");
function clickMove(c: HTMLElement, m: TreeMove) {
  fireEvent.click(c.querySelector(`[data-tree-node="${m.key}"]`)!);
  fireEvent.click(c.querySelector(`[data-tree-rotate="${m.direction}"]`)!);
}
describe("TreeRotations independent parent-vector oracle", () => {
  it("checks every rotation on all 429 seven-key shapes, transferred subtrees, inverse and inorder", () => {
    const l = { ...treeRotationsLevels[8], goal: { maxHeight: 1 } },
      p = parentVector(initialTree(l), 7),
      queue = [p],
      seen = new Set([p.join()]);
    let transitions = 0;
    for (let i = 0; i < queue.length; i++)
      for (let key = 1; key <= 7; key++)
        for (const direction of ["left", "right"] as const) {
          const before = queue[i],
            t = vectorTree(before),
            oracle = vectorRotate(before, { key, direction }),
            actual = treeStep(l, t, { key, direction });
          if (!oracle) {
            expect(actual).toBeNull();
            continue;
          }
          transitions++;
          expect(parentVector(actual!, 7)).toEqual(oracle);
          expect(validSearchTree(l, actual!)).toBe(true);
          const pivot = oracle[key],
            inverse = treeStep(l, actual!, {
              key: pivot,
              direction: direction === "left" ? "right" : "left",
            });
          expect(inverse).toEqual(t);
          if (!seen.has(oracle.join())) {
            seen.add(oracle.join());
            queue.push(oracle);
          }
        }
    expect(seen.size).toBe(TREE_STATE_LIMIT);
    expect(transitions).toBe(429 * 6);
    expect(searchTree(l).status).toBe("unreachable");
    expect(searchTree(l).visited).toBe(429);
  });
  for (const l of treeRotationsLevels)
    it(`${l.id}: independent shortest, all public goals and immutable certificate`, () => {
      expect(validTreeLevel(l)).toBe(true);
      let s = createTreeState(l),
        p = parentVector(s.tree, l.order.length);
      expect(treeWon(l, s.tree)).toBe(false);
      const original = JSON.stringify(s);
      for (const move of l.certificate.moves) {
        const previous = JSON.stringify(s),
          old = s;
        p = vectorRotate(p, move)!;
        expect(p).not.toBeNull();
        s = moveTree(l, s, move);
        expect(s).not.toBe(old);
        expect(JSON.stringify(old)).toBe(previous);
        expect(parentVector(s.tree, l.order.length)).toEqual(p);
        expect(validSearchTree(l, s.tree)).toBe(true);
        const m = treeMetrics(s.tree, l.weights),
          o = vectorStats(p, l.weights);
        expect([m.height, m.cost, m.balanced]).toEqual([
          o.height,
          o.cost,
          o.balanced,
        ]);
      }
      expect(vectorWon(l, p)).toBe(true);
      expect(treeWon(l, s.tree)).toBe(true);
      expect(JSON.stringify(createTreeState(l))).toBe(original);
      expect(undoTree(l, s)).toBe(s);
      expect(moveTree(l, s, { key: s.tree.key, direction: "left" })).toBe(s);
      expect(
        treeStep(l, s.tree, { key: s.tree.key, direction: "right" }),
      ).toBeNull();
      expect(vectorSearch(l)).toBe(l.certificate.shortest);
      const r = searchTree(l);
      expect(r.moves.length).toBe(l.certificate.shortest);
      expect(r.visited).toBeLessThanOrEqual(429);
    });
  it("searches from actual detours, ignores damaged and throwing certificate getters", () => {
    const l = treeRotationsLevels[10],
      copy = { ...l };
    Object.defineProperty(copy, "certificate", {
      get() {
        throw new Error("must not read certificate");
      },
    });
    let s = moveTree(l, createTreeState(l), { key: 6, direction: "right" });
    expect(s.history).toHaveLength(1);
    const r = searchTree(copy, s.tree);
    expect(r).toEqual(searchTree(l, s.tree));
    expect(r.moves.length).toBe(vectorSearch(l, parentVector(s.tree, 7)));
    expect(treeHint(copy, s.tree)).toBe(treeHint(l, s.tree));
    for (const m of r.moves) s = moveTree(copy, s, m);
    expect(treeWon(copy, s.tree)).toBe(true);
  });
  it("accepts different valid goal shapes and weighted optima", () => {
    const l = treeRotationsLevels[3],
      impossible = { ...l, goal: { maxHeight: 1 } },
      queue = [initialTree(l)],
      seen = new Set([treeShape(queue[0])]),
      solutions = new Set<string>();
    for (let i = 0; i < queue.length; i++) {
      const t = queue[i];
      if (treeWon(l, t)) {
        expect(vectorWon(l, parentVector(t, 5))).toBe(true);
        solutions.add(treeShape(t));
      }
      for (let key = 1; key <= 5; key++)
        for (const direction of ["left", "right"] as const) {
          const next = treeStep(impossible, t, { key, direction });
          if (!next || seen.has(treeShape(next))) continue;
          seen.add(treeShape(next));
          queue.push(next);
        }
    }
    expect(seen.size).toBe(42);
    expect(solutions.size).toBeGreaterThan(1);
    const weighted = treeRotationsLevels[9];
    expect(treeMetrics(initialTree(weighted), weighted.weights).height).toBe(3);
    let s = createTreeState(weighted);
    for (const move of weighted.certificate.moves)
      s = moveTree(weighted, s, move);
    expect(treeMetrics(s.tree, weighted.weights).height).toBe(4);
    expect(treeWon(weighted, s.tree)).toBe(true);
  });
  it("rejects illegal indices, missing children, duplicate keys, cycles and limits", () => {
    const l = treeRotationsLevels[0],
      t = initialTree(l);
    expect(treeStep(l, t, { key: 0, direction: "left" })).toBeNull();
    expect(treeStep(l, t, { key: 99, direction: "right" })).toBeNull();
    expect(treeStep(l, t, { key: 1, direction: "right" })).toBeNull();
    expect(treeStep(l, t, { key: 1, direction: "up" as "left" })).toBeNull();
    expect(validTreeLevel({ ...l, order: [1, 1, 2] })).toBe(false);
    expect(validTreeLevel({ ...l, order: [1, 2, 3, 4, 5, 6, 7, 8] })).toBe(
      false,
    );
    expect(validTreeLevel({ ...l, weights: [1, -1, 2] })).toBe(false);
    const cycle: SearchTree = { key: 1, left: null, right: null };
    cycle.right = cycle;
    expect(validSearchTree(l, cycle)).toBe(false);
    expect(searchTree(l, cycle).status).toBe("invalid");
    expect(
      validSearchTree(l, {
        key: 2,
        left: { key: 3, left: null, right: null },
        right: { key: 1, left: null, right: null },
      }),
    ).toBe(false);
    expect(searchTree(l, t, { limit: 1 }).status).toBe("limited");
    expect(searchTree(l, t, { cancelled: () => true }).status).toBe(
      "cancelled",
    );
  });
});
describe("TreeRotations 12 rendered journeys and lifecycle", () => {
  it("repairs internal reset/level focus without scrolling or stealing external focus", () => {
    const p = props();
    const content = (resetToken: number, level: number) => (
      <StrictMode>
        <button data-shell-reset>Shell reset</button>
        <TreeRotations {...p} resetToken={resetToken} level={level} />
      </StrictMode>
    );
    const v = render(content(0, 0));
    const host = v.container.querySelector(
      "[data-tree-host]",
    ) as HTMLDivElement;
    const focus = vi.spyOn(host, "focus");
    (
      v.container.querySelector('[data-tree-node="1"]') as HTMLButtonElement
    ).focus();
    expect(document.activeElement).not.toBe(document.body);
    v.rerender(content(1, 0));
    expect(v.container.querySelector("[data-tree-host]")).toBe(host);
    expect(document.activeElement).toBe(host);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockClear();
    (
      v.container.querySelector('[data-tree-node="1"]') as HTMLButtonElement
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
  it("renders and completes without reading its certificate", () => {
    const l = treeRotationsLevels[0],
      moves = [...l.certificate.moves],
      descriptor = Object.getOwnPropertyDescriptor(l, "certificate")!;
    Object.defineProperty(l, "certificate", {
      configurable: true,
      get() {
        throw new Error("runtime certificate access");
      },
    });
    try {
      const p = props(),
        v = render(<TreeRotations {...p} />);
      for (const m of moves) clickMove(v.container, m);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(l, "certificate", descriptor);
    }
  });
  treeRotationsLevels.forEach((l, level) =>
    it(`plays native controls for ${l.id}`, () => {
      const p = { ...props(), level },
        v = render(<TreeRotations {...p} />);
      expect(v.getByText("本关公开目标")).toBeTruthy();
      for (const move of l.certificate.moves) clickMove(v.container, move);
      expect(
        v.container.querySelector("[data-tree-rotations-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      const end = shape(v.container);
      for (const button of v.container.querySelectorAll("button"))
        fireEvent.click(button);
      v.rerender(<TreeRotations {...p} hintToken={8} undoToken={4} />);
      expect(shape(v.container)).toBe(end);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    }),
  );
  it("consumes paused tokens, preserves selected/focused nodes and Shell focus, supports reset/new level", () => {
    const p = { ...props(), level: 8 },
      v = render(
        <StrictMode>
          <button data-shell>Shell</button>
          <TreeRotations {...p} />
        </StrictMode>,
      ),
      node = v.container.querySelector(
        '[data-tree-node="1"]',
      ) as HTMLButtonElement;
    node.focus();
    clickMove(v.container, treeRotationsLevels[8].certificate.moves[0]);
    expect(document.activeElement).toBe(node);
    const before = shape(v.container);
    v.rerender(
      <StrictMode>
        <button data-shell>Shell</button>
        <TreeRotations {...p} paused undoToken={4} hintToken={9} />
      </StrictMode>,
    );
    clickMove(v.container, { key: 7, direction: "right" });
    expect(shape(v.container)).toBe(before);
    const shell = v.container.querySelector(
      "[data-shell]",
    ) as HTMLButtonElement;
    shell.focus();
    v.rerender(
      <StrictMode>
        <button data-shell>Shell</button>
        <TreeRotations {...p} undoToken={4} hintToken={9} />
      </StrictMode>,
    );
    expect(shape(v.container)).toBe(before);
    expect(document.activeElement).toBe(shell);
    v.rerender(
      <StrictMode>
        <button data-shell>Shell</button>
        <TreeRotations {...p} undoToken={5} hintToken={10} />
      </StrictMode>,
    );
    expect(shape(v.container)).toBe(
      treeShape(initialTree(treeRotationsLevels[8])),
    );
    expect(document.activeElement).toBe(shell);
    clickMove(v.container, treeRotationsLevels[8].certificate.moves[0]);
    v.rerender(<TreeRotations {...p} resetToken={2} />);
    expect(shape(v.container)).toBe(
      treeShape(initialTree(treeRotationsLevels[8])),
    );
    v.rerender(<TreeRotations {...p} level={1} resetToken={2} />);
    expect(shape(v.container)).toBe(
      treeShape(initialTree(treeRotationsLevels[1])),
    );
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("uses native Enter/Space, keeps completion focus, and ignores modified shortcut keys", async () => {
    const p = props(),
      v = render(<TreeRotations {...p} />),
      user = userEvent.setup(),
      node = v.container.querySelector(
        '[data-tree-node="1"]',
      ) as HTMLButtonElement;
    node.focus();
    expect(document.activeElement).toBe(node);
    await user.keyboard(" ");
    for (const modifier of ["ctrlKey", "altKey", "metaKey"])
      for (const key of ["ArrowLeft", "ArrowRight", "z"]) {
        const e = new KeyboardEvent("keydown", {
          key,
          [modifier]: true,
          bubbles: true,
          cancelable: true,
        });
        node.dispatchEvent(e);
        expect(e.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(node);
      }
    const rotate = v.container.querySelector(
      '[data-tree-rotate="left"]',
    ) as HTMLButtonElement;
    rotate.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(rotate);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    v.rerender(<TreeRotations {...p} resetToken={1} />);
    clickMove(v.container, treeRotationsLevels[0].certificate.moves[0]);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("announces unavailable rotation, local undo works before completion, and selected key survives", () => {
    const p = { ...props(), level: 1 },
      v = render(<TreeRotations {...p} />);
    clickMove(v.container, { key: 3, direction: "left" });
    expect(v.getByRole("status").textContent).toContain("没有右孩子");
    clickMove(v.container, { key: 1, direction: "left" });
    const selected = v.container.querySelector('[data-tree-node="1"]')!;
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(v.container.querySelector("[data-tree-undo]")!);
    expect(shape(v.container)).toBe(
      treeShape(initialTree(treeRotationsLevels[1])),
    );
    expect(selected.getAttribute("aria-pressed")).toBe("true");
  });
});
