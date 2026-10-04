// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PipeCapacity from "../src/games/PipeCapacity";
import { pipeCapacityLevels } from "../src/games/pipeCapacityLevels";
import {
  PIPE_AUGMENT_LIMIT,
  assignPipe,
  createPipeState,
  pipeHint,
  pipeRoute,
  pipeWon,
  publicPipe,
  solvePipe,
  undoPipe,
  validPipe,
  type PipePublic,
} from "../src/games/pipeCapacityLogic";
import { routeBadges } from "../src/games/flowRailGeometry";
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
function frozen<T>(v: T): T {
  if (v && typeof v === "object") {
    Object.values(v).forEach(frozen);
    Object.freeze(v);
  }
  return v;
}
// Independent exhaustive integer enumeration. It does not call production flow,
// transition, cost, feasibility or certificate functions; domain <= 4^2*3^8 here.
function oracle(
  l: PipePublic,
  fixed: (number | null)[] = l.edges.map(() => null),
): { cost: number; flows: number[] }[] {
  const results: { cost: number; flows: number[] }[] = [],
    flows: number[] = [];
  function visit(e: number) {
    if (e < l.edges.length) {
      const vals =
        fixed[e] === null
          ? Array.from({ length: l.edges[e].capacity + 1 }, (_, v) => v)
          : [fixed[e]!];
      for (const v of vals) {
        flows[e] = v;
        visit(e + 1);
      }
      return;
    }
    const net = l.nodes.map(() => 0);
    let cost = 0;
    for (let j = 0; j < flows.length; j++) {
      const edge = l.edges[j];
      net[edge.from] += flows[j];
      net[edge.to] -= flows[j];
      cost += flows[j] * edge.cost;
    }
    if (
      net.every((v, i) => v === l.nodes[i].balance) &&
      (l.budget === undefined || cost <= l.budget)
    )
      results.push({ cost, flows: flows.slice() });
  }
  visit(0);
  return results.sort((a, b) => a.cost - b.cost);
}
describe("PipeCapacity public model and independent oracle", () => {
  it("contains twelve mechanically varied, bounded original levels", () => {
    expect(pipeCapacityLevels).toHaveLength(12);
    expect(
      new Set(pipeCapacityLevels.map((l) => JSON.stringify(l.edges))).size,
    ).toBe(12);
    for (const l of pipeCapacityLevels) expect(validPipe(l)).toBe(true);
  });
  it.each(pipeCapacityLevels)(
    "$id exact minimum agrees with independent exhaustive enumeration",
    (l) => {
      const p = frozen(publicPipe(l)),
        expected = oracle(p),
        solved = solvePipe(p);
      expect(expected.length).toBeGreaterThan(0);
      expect(solved.status).toBe("solved");
      expect(solved.cost).toBe(expected[0].cost);
      expect(
        expected.some(
          (s) => JSON.stringify(s.flows) === JSON.stringify(solved.flows),
        ),
      ).toBe(true);
      expect(solved.augmentations).toBeLessThanOrEqual(PIPE_AUGMENT_LIMIT);
      expect(
        expected.some(
          (s) =>
            s.cost === l.certificate.cost &&
            JSON.stringify(s.flows) === JSON.stringify(l.certificate.flows),
        ),
      ).toBe(true);
    },
  );
  it.each(pipeCapacityLevels)(
    "$id preserves partial values, including zero, and reports contradictions honestly",
    (l) => {
      for (let edge = 0; edge < l.edges.length; edge++) {
        for (const value of [0, l.edges[edge].capacity]) {
          const fixed = l.certificate.flows.map((v, i) =>
            i === edge ? value : i % 2 === 0 ? v : null,
          );
          const expected = oracle(l, fixed),
            r = solvePipe(l, fixed);
          expect(r.status).toBe(expected.length ? "solved" : "impossible");
          if (r.flows)
            fixed.forEach((v, i) => {
              if (v !== null) expect(r.flows![i]).toBe(v);
            });
        }
      }
    },
  );
  it("accepts alternate valid distributions, not only a certificate", () => {
    const l = pipeCapacityLevels[3],
      different = oracle(l).find(
        (r) => JSON.stringify(r.flows) !== JSON.stringify(l.certificate.flows),
      )!;
    expect(different).toBeTruthy();
    expect(pipeWon(l, different.flows)).toBe(true);
  });
  it("keeps unknown different from explicit zero in hints", () => {
    const l = pipeCapacityLevels[0],
      s = createPipeState(l),
      h = pipeHint(l, s);
    expect(h.value).toBe(3);
    const fixed = assignPipe(l, s, 0, 0);
    expect(solvePipe(l, fixed.flows).status).toBe("impossible");
    expect(pipeHint(l, fixed).edge).toBeUndefined();
    expect(pipeWon(l, [3, 1, null])).toBe(false);
  });
  it("does not mutate previous assignments or history", () => {
    const l = pipeCapacityLevels[0],
      s = frozen(createPipeState(l)),
      next = assignPipe(l, s, 0, 3);
    frozen(next);
    expect(s.flows).toEqual([null, null, null]);
    expect(undoPipe(next)).toEqual(s);
    expect(assignPipe(l, s, 0, 4)).toBe(s);
    expect(assignPipe(l, s, -1, 0)).toBe(s);
  });
  it("rejects malformed domains rather than searching outside bounds", () => {
    const l = publicPipe(pipeCapacityLevels[0]);
    expect(validPipe({ ...l, edges: [{ ...l.edges[0], capacity: 6 }] })).toBe(
      false,
    );
    expect(solvePipe({ ...l, budget: -1 }).status).toBe("invalid");
    expect(solvePipe(l, [NaN, 0, 0]).status).toBe("invalid");
    expect(
      validPipe({ ...l, nodes: [...l.nodes, ...l.nodes, ...l.nodes] }),
    ).toBe(false);
    expect(validPipe({ ...l, edges: [...l.edges, l.edges[0]] })).toBe(false);
  });
  it("minimum-cost impossibility reports the actual minimum", () => {
    const l = { ...publicPipe(pipeCapacityLevels[6]), budget: 3 },
      r = solvePipe(l);
    expect(r.status).toBe("impossible");
    expect(r.cost).toBe(4);
    expect(r.reason).toContain("最低费用是 4");
  });
  it("handles cyclic residual rerouting and arbitrary fixed assignments against enumeration", () => {
    for (let seed = 0; seed < 18; seed++) {
      const l: PipePublic = {
        nodes: [2, 0, 0, -2].map((balance, i) => ({
          label: String(i),
          balance,
          x: i,
          y: 0,
        })),
        edges: [
          { from: 0, to: 1, capacity: 2, cost: seed % 3 },
          { from: 0, to: 2, capacity: 2, cost: (seed + 1) % 3 },
          { from: 1, to: 2, capacity: 1, cost: 0 },
          { from: 2, to: 1, capacity: 1, cost: seed % 2 },
          { from: 1, to: 3, capacity: 2, cost: 2 },
          { from: 2, to: 3, capacity: 1, cost: 0 },
        ],
      };
      const fixed = l.edges.map((_, i) => (i === seed % 6 ? seed % 2 : null)),
        o = oracle(l, fixed),
        r = solvePipe(l, fixed);
      expect(r.status).toBe(o.length ? "solved" : "impossible");
      if (o.length) expect(r.cost).toBe(o[0].cost);
    }
  });
  it("does not access certificate getters and ignores corrupt witnesses", () => {
    const l = pipeCapacityLevels[0],
      original = Object.getOwnPropertyDescriptor(l, "certificate")!;
    try {
      Object.defineProperty(l, "certificate", {
        get() {
          throw new Error("certificate read");
        },
        configurable: true,
      });
      expect(solvePipe(publicPipe(l)).status).toBe("solved");
      expect(() => render(<PipeCapacity {...props()} />)).not.toThrow();
    } finally {
      Object.defineProperty(l, "certificate", original);
    }
    const bad = { ...l, certificate: { flows: [999], cost: -99 } };
    expect(solvePipe(bad).flows).toEqual(solvePipe(publicPipe(l)).flows);
  });
});
describe("PipeCapacity DOM controls (jsdom, not browser visual QA)", () => {
  it.each(pipeCapacityLevels.map((l, i) => ({ l, i })))(
    "$l.id complete UI replay, then one completion only",
    ({ l, i }) => {
      const p = { ...props(), level: i },
        view = render(
          <StrictMode>
            <PipeCapacity {...p} />
          </StrictMode>,
        );
      l.certificate.flows.forEach((value, edge) => {
        fireEvent.click(
          view.container.querySelector(`[data-pipe-edge="${edge}"]`)!,
        );
        fireEvent.click(
          view.container.querySelector(`[data-pipe-value="${value}"]`)!,
        );
      });
      expect(
        view.container.querySelector('[data-pipe-won="true"]'),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      view.rerender(
        <StrictMode>
          <PipeCapacity {...p} hintToken={1} />
        </StrictMode>,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it("pause, undo and reset keep complete immutable state and consume tokens", () => {
    const p = props(),
      v = render(<PipeCapacity {...p} />);
    fireEvent.click(v.container.querySelector('[data-pipe-value="3"]')!);
    v.rerender(<PipeCapacity {...p} paused hintToken={1} undoToken={1} />);
    expect(
      v.container.querySelector('[data-pipe-value="0"]')!.matches(":disabled"),
    ).toBe(true);
    v.rerender(<PipeCapacity {...p} hintToken={1} undoToken={1} />);
    expect(
      v.container
        .querySelector('[data-pipe-edge="0"]')
        ?.getAttribute("data-pipe-flow"),
    ).toBe("3");
    v.rerender(<PipeCapacity {...p} hintToken={1} undoToken={2} />);
    expect(
      v.container
        .querySelector('[data-pipe-edge="0"]')
        ?.getAttribute("data-pipe-flow"),
    ).toBe("?");
    fireEvent.click(v.container.querySelector('[data-pipe-value="2"]')!);
    v.rerender(<PipeCapacity {...p} resetToken={1} />);
    expect(
      v.container
        .querySelector('[data-pipe-edge="0"]')
        ?.getAttribute("data-pipe-flow"),
    ).toBe("?");
  });
  it("hints apply one current-state value and restore focus when removed", () => {
    const p = props(),
      v = render(<PipeCapacity {...p} />);
    v.rerender(<PipeCapacity {...p} hintToken={1} />);
    const use = v.container.querySelector<HTMLButtonElement>(
      "[data-pipe-use-hint]",
    )!;
    use.focus();
    fireEvent.click(use);
    expect(v.container.querySelectorAll('[data-pipe-flow="?"]')).toHaveLength(
      2,
    );
    expect(document.activeElement).toBe(
      v.container.querySelector('[data-pipe-edge="0"]'),
    );
    v.rerender(<PipeCapacity {...p} hintToken={2} />);
    const dismiss = v.container.querySelector<HTMLButtonElement>(
      "[data-pipe-dismiss-hint]",
    )!;
    dismiss.focus();
    fireEvent.click(dismiss);
    expect(document.activeElement).toBe(
      v.container.querySelector('[data-pipe-edge="0"]'),
    );
  });
  it("keyboard, touch-compatible click and full target text remain available", async () => {
    const user = userEvent.setup(),
      v = render(<PipeCapacity {...props()} />),
      row = v.container.querySelector<HTMLButtonElement>(
        '[data-pipe-edge="0"]',
      )!;
    row.focus();
    await user.keyboard("3");
    expect(row.getAttribute("data-pipe-flow")).toBe("3");
    await user.keyboard("{ArrowDown}1{ArrowDown}2");
    expect(v.container.querySelector('[data-pipe-won="true"]')).not.toBeNull();
    expect(v.container.querySelectorAll("[data-pipe-node]")).toHaveLength(4);
    expect(v.getByText("目标：流出 − 流入 = -2")).toBeTruthy();
  });
  it("modified keys in every nested control preserve DOM, focus and browser default", () => {
    const p = props(),
      v = render(<PipeCapacity {...p} hintToken={0} />);
    v.rerender(<PipeCapacity {...p} hintToken={1} />);
    for (const control of v.container.querySelectorAll<HTMLElement>("button")) {
      control.focus();
      const before = v.container.innerHTML;
      for (const modifier of ["ctrlKey", "metaKey", "altKey"])
        for (const key of [
          "0",
          "3",
          "ArrowDown",
          "ArrowUp",
          "Home",
          "End",
          "Delete",
          "Backspace",
          "Enter",
          " ",
        ]) {
          const e = new KeyboardEvent("keydown", {
            key,
            [modifier]: true,
            bubbles: true,
            cancelable: true,
          });
          fireEvent(control, e);
          expect(e.defaultPrevented).toBe(false);
          expect(v.container.innerHTML).toBe(before);
          expect(document.activeElement).toBe(control);
        }
    }
  });
});

it.each(pipeCapacityLevels)(
  "$id rendered pipe routes clear every unrelated station and label footprint",
  (l) => {
    const paths = l.edges.map((_, i) => pipeRoute(l, i));
    expect(new Set(paths.map((p) => JSON.stringify(p))).size).toBe(
      l.edges.length,
    );
    paths.forEach((path, e) => {
      expect(path.length).toBeGreaterThanOrEqual(2);
      for (let k = 1; k < path.length; k++) {
        const a = path[k - 1],
          b = path[k];
        expect(a.x === b.x || a.y === b.y).toBe(true);
        for (let node = 0; node < l.nodes.length; node++) {
          if (node === l.edges[e].from || node === l.edges[e].to) continue;
          const n = l.nodes[node],
            left = n.x - 35,
            right = n.x + 35,
            top = n.y - 33,
            bottom = n.y + 61;
          const intersects =
            a.x === b.x
              ? a.x >= left &&
                a.x <= right &&
                Math.max(a.y, b.y) >= top &&
                Math.min(a.y, b.y) <= bottom
              : a.y >= top &&
                a.y <= bottom &&
                Math.max(a.x, b.x) >= left &&
                Math.min(a.x, b.x) <= right;
          expect(intersects, `${l.id} edge ${e} through station ${node}`).toBe(
            false,
          );
        }
      }
    });
  },
);
it("pipe diagram has fixed-size readable geometry in a keyboard scroll viewport and freezes won state", () => {
  const p = props(),
    v = render(<PipeCapacity {...p} />),
    svg = v.container.querySelector(".pc-map")!,
    viewport = v.container.querySelector(".pc-map-wrap")!;
  expect(viewport.getAttribute("tabindex")).toBe("0");
  expect(Number(svg.getAttribute("width"))).toBeGreaterThan(400);
  expect(v.container.textContent).toContain("交叉不代表连接");
  for (const [
    edge,
    value,
  ] of pipeCapacityLevels[0].certificate.flows.entries()) {
    fireEvent.click(v.container.querySelector(`[data-pipe-edge="${edge}"]`)!);
    fireEvent.click(v.container.querySelector(`[data-pipe-value="${value}"]`)!);
  }
  const html = v.container.innerHTML;
  v.rerender(<PipeCapacity {...p} undoToken={1} />);
  expect(v.container.innerHTML).toBe(html);
  expect(p.onComplete).toHaveBeenCalledOnce();
});
it.each(pipeCapacityLevels)(
  "$id numbered pipe labels are distinct, readable and outside all station/target boxes",
  (l) => {
    const labels = routeBadges(
      l.nodes,
      l.edges.map((_, i) => pipeRoute(l, i)),
    );
    for (const [i, label] of labels.entries()) {
      expect(label.detached).toBe(false);
      for (const n of l.nodes) {
        const overlaps =
          label.x + 11 >= n.x - 35 &&
          label.x - 11 <= n.x + 35 &&
          label.y + 10 >= n.y - 33 &&
          label.y - 10 <= n.y + 61;
        expect(overlaps, `${l.id} label ${i} over ${n.label}`).toBe(false);
      }
      for (const other of labels.slice(0, i))
        expect(
          Math.abs(other.x - label.x) < 24 && Math.abs(other.y - label.y) < 22,
        ).toBe(false);
    }
  },
);
