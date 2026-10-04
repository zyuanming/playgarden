// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RailwayTimetable from "../src/games/RailwayTimetable";
import { railwayTimetableLevels } from "../src/games/railwayTimetableLevels";
import {
  RAIL_ACTION_LIMIT,
  RAIL_STATE_LIMIT,
  RAIL_TRANSITION_LIMIT,
  advanceRail,
  createRailState,
  editRail,
  publicRail,
  railActions,
  railHint,
  railRoute,
  railPreview,
  railWon,
  solveRail,
  undoRail,
  validRail,
  type RailAction,
  type RailBoard,
  type RailPublic,
} from "../src/games/railwayTimetableLogic";
import { routeBadges } from "../src/games/flowRailGeometry";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const props = () => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
});
function freeze<T>(v: T): T {
  if (v && typeof v === "object") {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
}
// Independent discrete railway rules. No production transition, solver or certificate.
function independentActions(l: RailPublic): RailAction[] {
  const count = l.nodes.filter((n) => n.next.length === 2).length,
    out: RailAction[] = [];
  function choices(prefix: number[]) {
    if (prefix.length < count) {
      choices([...prefix, 0]);
      choices([...prefix, 1]);
      return;
    }
    for (const a of [false, true])
      for (const b of [false, true])
        if ((!a || l.holdAllowed[0]) && (!b || l.holdAllowed[1]))
          out.push({ switches: prefix, holds: [a, b] });
  }
  choices([]);
  return out;
}
function independentStep(
  l: RailPublic,
  positions: readonly number[],
  a: RailAction,
): [number, number] | null {
  const sw = l.nodes.flatMap((n, i) => (n.next.length === 2 ? [i] : [])),
    next = positions.map((p, train) => {
      if (p === l.goals[train] || a.holds[train]) return p;
      const track = l.nodes[p].next;
      if (!track.length) return p;
      const s = sw.indexOf(p);
      return track[s === -1 ? 0 : a.switches[s]];
    });
  if (next[0] === next[1]) return null;
  if (next[0] === positions[1] && next[1] === positions[0]) return null;
  return next as [number, number];
}
// Reverse graph distance from goals differs from runtime's forward path BFS.
function reverseDistances(l: RailPublic): Map<string, number> {
  const predecessors = new Map<string, string[]>(),
    actions = independentActions(l);
  for (let a = 0; a < l.nodes.length; a++)
    for (let b = 0; b < l.nodes.length; b++) {
      if (a === b) continue;
      const from = `${a},${b}`;
      for (const action of actions) {
        const next = independentStep(l, [a, b], action);
        if (!next) continue;
        const key = next.join(",");
        const pred = predecessors.get(key) ?? [];
        pred.push(from);
        predecessors.set(key, pred);
      }
    }
  const goal = l.goals.join(","),
    queue = [goal],
    distance = new Map([[goal, 0]]);
  for (let i = 0; i < queue.length; i++)
    for (const parent of predecessors.get(queue[i]) ?? []) {
      if (distance.has(parent)) continue;
      distance.set(parent, distance.get(queue[i])! + 1);
      queue.push(parent);
    }
  return distance;
}
function replayIndependent(
  l: RailPublic,
  actions: RailAction[],
  start = l.starts,
): [number, number] {
  let p: [number, number] = [...start];
  for (const a of actions) {
    expect(independentActions(l)).toContainEqual(a);
    const next = independentStep(l, p, a);
    expect(next).not.toBeNull();
    p = next!;
  }
  expect(p).toEqual(l.goals);
  if (l.deadline !== undefined)
    expect(actions.length).toBeLessThanOrEqual(l.deadline);
  return p;
}
function setControls(container: HTMLElement, action: RailAction) {
  action.switches.forEach((choice, s) =>
    fireEvent.click(
      container.querySelector(`[data-rail-switch="${s}:${choice}"]`)!,
    ),
  );
  action.holds.forEach((hold, t) => {
    const b = container.querySelector(`[data-rail-hold="${t}"]`)!;
    if (b.getAttribute("aria-pressed") !== String(hold)) fireEvent.click(b);
  });
}
describe("RailwayTimetable finite state model and independent schedule verification", () => {
  it("has twelve varied authored levels in the declared finite domain", () => {
    expect(railwayTimetableLevels).toHaveLength(12);
    expect(
      new Set(
        railwayTimetableLevels.map(
          (l) =>
            JSON.stringify(l.nodes.map((n) => n.next)) +
            JSON.stringify(l.goals),
        ),
      ).size,
    ).toBe(12);
    for (const l of railwayTimetableLevels) {
      expect(validRail(l)).toBe(true);
      expect(railActions(l).length).toBeLessThanOrEqual(RAIL_ACTION_LIMIT);
    }
  });
  it.each(railwayTimetableLevels)(
    "$id shortest search agrees with independent reverse distances and certificate replay",
    (l) => {
      const d = reverseDistances(l),
        r = solveRail(freeze(publicRail(l)));
      expect(r.status).toBe("solved");
      expect(r.actions.length).toBe(d.get(l.starts.join(",")));
      expect(l.certificate.ticks).toBe(l.certificate.actions.length);
      replayIndependent(l, l.certificate.actions);
      replayIndependent(l, r.actions);
      expect(r.explored).toBeLessThanOrEqual(RAIL_STATE_LIMIT);
      expect(r.transitions).toBeLessThanOrEqual(RAIL_TRANSITION_LIMIT);
    },
  );
  it.each(railwayTimetableLevels)(
    "$id simultaneous movement agrees with independent oracle for every position pair and control",
    (l) => {
      const p = publicRail(l);
      delete p.deadline;
      for (let a = 0; a < p.nodes.length; a++)
        for (let b = 0; b < p.nodes.length; b++) {
          if (a === b) continue;
          for (const action of independentActions(p)) {
            const next = independentStep(p, [a, b], action),
              actual = railPreview(p, { positions: [a, b], tick: 0 }, action),
              already = a === p.goals[0] && b === p.goals[1];
            expect(actual.valid).toBe(Boolean(next) && !already);
            if (actual.valid) expect(actual.next.positions).toEqual(next);
          }
        }
    },
  );
  it.each(railwayTimetableLevels)(
    "$id actual-state hints agree with reverse reachability from sampled non-initial positions",
    (l) => {
      const p = publicRail(l);
      delete p.deadline;
      const distances = reverseDistances(p);
      for (let a = 0; a < p.nodes.length; a += 2)
        for (let b = 0; b < p.nodes.length; b += 2) {
          if (a === b) continue;
          const board: RailBoard = { positions: [a, b], tick: 3 },
            r = solveRail(p, board),
            d = distances.get(`${a},${b}`);
          expect(r.status).toBe(d === undefined ? "impossible" : "solved");
          if (d !== undefined) expect(r.actions).toHaveLength(d);
        }
    },
  );
  it("rejects same-cell entry and head-on swaps but allows following a departed train", () => {
    const l = railwayTimetableLevels[0],
      s = createRailState(l);
    expect(railPreview(l, s.board, s.controls).valid).toBe(false);
    const a: RailAction = { switches: [0], holds: [false, true] },
      s1 = advanceRail(l, editRail(l, s, a));
    expect(
      railPreview(l, s1.board, { ...a, holds: [false, false] }).valid,
    ).toBe(true);
    const head = railwayTimetableLevels[2];
    expect(
      railPreview(
        head,
        { positions: [1, 2], tick: 1 },
        { switches: [0, 0], holds: [false, false] },
      ).reason,
    ).toContain("迎面");
  });
  it("a parked goal remains occupied even if its hold is released or its switch changes", () => {
    const l = railwayTimetableLevels[3],
      a: RailAction = { switches: [], holds: [false, false] };
    expect(railPreview(l, { positions: [2, 3], tick: 2 }, a).valid).toBe(false);
    expect(solveRail(l, { positions: [2, 3], tick: 2 }).status).toBe(
      "impossible",
    );
  });
  it("actual-state hint detects missed deadline and gives exact remaining lower bound", () => {
    const l = railwayTimetableLevels[11],
      s = createRailState(l);
    s.board.tick = 1;
    const r = solveRail(l, s.board);
    expect(r.status).toBe("impossible");
    expect(r.minimum).toBe(5);
    expect(railHint(l, s).action).toBeUndefined();
    expect(railHint(l, s).text).toContain("剩余 4 步");
  });
  it("undo restores both positions, time, switches and holds and is immutable", () => {
    const l = railwayTimetableLevels[0],
      initial = freeze(createRailState(l)),
      prepared = freeze(
        editRail(l, initial, { switches: [1], holds: [false, true] }),
      ),
      next = freeze(advanceRail(l, prepared)),
      edited = freeze(
        editRail(l, next, { switches: [0], holds: [true, false] }),
      );
    expect(undoRail(edited)).toEqual(prepared);
    expect(initial.board.positions).toEqual(l.starts);
    expect(next.history[0].controls).toEqual(prepared.controls);
  });
  it("alternate valid schedule with extra waiting is accepted without certificate equality", () => {
    const l = railwayTimetableLevels[0],
      actions = [
        { switches: [1], holds: [true, true] as [boolean, boolean] },
        ...l.certificate.actions,
      ];
    replayIndependent(l, actions);
    let s = createRailState(l);
    for (const a of actions) s = advanceRail(l, editRail(l, s, a));
    expect(railWon(l, s.board)).toBe(true);
    expect(s.board.tick).toBe(4);
  });
  it("no certificate getter is touched by rendering or solving", () => {
    const l = railwayTimetableLevels[0],
      descriptor = Object.getOwnPropertyDescriptor(l, "certificate")!;
    try {
      Object.defineProperty(l, "certificate", {
        configurable: true,
        get() {
          throw new Error("private certificate accessed");
        },
      });
      expect(solveRail(publicRail(l)).status).toBe("solved");
      expect(() => render(<RailwayTimetable {...props()} />)).not.toThrow();
    } finally {
      Object.defineProperty(l, "certificate", descriptor);
    }
    const bad = { ...l, certificate: { actions: [], ticks: -1 } };
    expect(solveRail(bad).actions).toEqual(solveRail(publicRail(l)).actions);
  });
  it("invalid models and unsupported controls are rejected within bounds", () => {
    const l = publicRail(railwayTimetableLevels[0]);
    expect(validRail({ ...l, nodes: Array(13).fill(l.nodes[0]) })).toBe(false);
    expect(validRail({ ...l, deadline: 25 })).toBe(false);
    expect(
      railPreview(
        l,
        { positions: [0, 0], tick: 0 },
        { switches: [0], holds: [false, false] },
      ).valid,
    ).toBe(false);
    expect(solveRail(l, { positions: [0, 1], tick: -1 }).status).toBe(
      "invalid",
    );
    const noHold = railwayTimetableLevels[4];
    expect(
      railPreview(noHold, createRailState(noHold).board, {
        switches: [0],
        holds: [false, true],
      }).valid,
    ).toBe(false);
  });
});
describe("RailwayTimetable complete DOM controls (jsdom only)", () => {
  it.each(railwayTimetableLevels.map((l, i) => ({ l, i })))(
    "$l.id all tick controls replay certificate and notify once",
    ({ l, i }) => {
      const p = { ...props(), level: i },
        v = render(
          <StrictMode>
            <RailwayTimetable {...p} />
          </StrictMode>,
        );
      for (const a of l.certificate.actions) {
        setControls(v.container, a);
        expect(
          v.container
            .querySelector("[data-rail-commit]")
            ?.getAttribute("aria-disabled"),
        ).toBe("false");
        fireEvent.click(v.container.querySelector("[data-rail-commit]")!);
      }
      expect(
        v.container.querySelector('[data-rail-won="true"]'),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      v.rerender(
        <StrictMode>
          <RailwayTimetable {...p} hintToken={1} />
        </StrictMode>,
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(v.container.querySelectorAll("[data-rail-track]")).toHaveLength(
        l.nodes.length,
      );
    },
  );
  it("conflict consumes no tick; pause blocks controls and undo restores a whole turn", () => {
    const p = props(),
      v = render(<RailwayTimetable {...p} />);
    fireEvent.click(v.container.querySelector("[data-rail-commit]")!);
    expect(v.container.querySelector('[data-rail-tick="0"]')).not.toBeNull();
    setControls(v.container, { switches: [1], holds: [false, true] });
    fireEvent.click(v.container.querySelector("[data-rail-commit]")!);
    setControls(v.container, { switches: [0], holds: [true, false] });
    v.rerender(<RailwayTimetable {...p} paused hintToken={1} undoToken={1} />);
    expect(
      (v.container.querySelector("[data-rail-commit]") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    v.rerender(<RailwayTimetable {...p} hintToken={1} undoToken={1} />);
    expect(v.container.querySelector('[data-rail-tick="1"]')).not.toBeNull();
    v.rerender(<RailwayTimetable {...p} hintToken={1} undoToken={2} />);
    expect(v.container.querySelector('[data-rail-tick="0"]')).not.toBeNull();
    expect(
      v.container
        .querySelector('[data-rail-switch="0:1"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      v.container
        .querySelector('[data-rail-hold="1"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    v.rerender(<RailwayTimetable {...p} resetToken={1} />);
    expect(
      v.container
        .querySelector('[data-rail-hold="1"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("false");
  });
  it("hints only set controls, keep actual positions, and cancellation restores focus", () => {
    const p = props(),
      v = render(<RailwayTimetable {...p} />);
    v.rerender(<RailwayTimetable {...p} hintToken={1} />);
    const use = v.container.querySelector<HTMLButtonElement>(
      "[data-rail-use-hint]",
    )!;
    use.focus();
    fireEvent.click(use);
    expect(v.container.querySelector('[data-rail-tick="0"]')).not.toBeNull();
    expect(document.activeElement).toBe(
      v.container.querySelector("[data-rail-commit]"),
    );
    fireEvent.click(v.container.querySelector("[data-rail-commit]")!);
    v.rerender(<RailwayTimetable {...p} hintToken={2} />);
    const dismiss = v.container.querySelector<HTMLButtonElement>(
      "[data-rail-dismiss-hint]",
    )!;
    dismiss.focus();
    fireEvent.click(dismiss);
    expect(document.activeElement).toBe(
      v.container.querySelector("[data-rail-commit]"),
    );
  });
  it("ordinary keyboard and touch-compatible clicks play the first round", async () => {
    const user = userEvent.setup(),
      p = props(),
      v = render(<RailwayTimetable {...p} />);
    const hold = v.container.querySelector<HTMLButtonElement>(
      '[data-rail-hold="1"]',
    )!;
    hold.focus();
    await user.keyboard("{Enter}n");
    expect(v.container.querySelector('[data-rail-tick="1"]')).not.toBeNull();
    await user.keyboard(" n");
    expect(v.container.querySelector('[data-rail-tick="2"]')).not.toBeNull();
    fireEvent.click(v.container.querySelector('[data-rail-switch="0:1"]')!);
    await user.keyboard("n");
    expect(p.onComplete).toHaveBeenCalledOnce();
  });
  it("modified browser commands leave every nested control, focus and defaults alone", () => {
    const p = props(),
      v = render(<RailwayTimetable {...p} />);
    v.rerender(<RailwayTimetable {...p} hintToken={1} />);
    for (const target of v.container.querySelectorAll<HTMLElement>(
      'button,[tabindex="0"]',
    )) {
      target.focus();
      const html = v.container.innerHTML;
      for (const mod of ["ctrlKey", "metaKey", "altKey"])
        for (const key of [
          "n",
          "ArrowLeft",
          "ArrowRight",
          "ArrowDown",
          "Home",
          "End",
          "Delete",
          "Enter",
          " ",
        ]) {
          const e = new KeyboardEvent("keydown", {
            key,
            [mod]: true,
            bubbles: true,
            cancelable: true,
          });
          fireEvent(target, e);
          expect(e.defaultPrevented).toBe(false);
          expect(v.container.innerHTML).toBe(html);
          expect(document.activeElement).toBe(target);
        }
    }
  });
  it("selected moving train is revealed within map scroll, without moving page focus", () => {
    const p = props(),
      v = render(<RailwayTimetable {...p} />),
      box = v.container.querySelector<HTMLElement>(".rt-map-viewport")!,
      node = v.container.querySelector<SVGGElement>(
        '[data-rail-map-node="2"]',
      )!,
      button =
        v.container.querySelector<HTMLButtonElement>("[data-rail-commit]")!;
    vi.spyOn(box, "getBoundingClientRect").mockReturnValue({
      left: 0,
      right: 200,
      top: 0,
      bottom: 150,
    } as DOMRect);
    vi.spyOn(node, "getBoundingClientRect").mockReturnValue({
      left: 300,
      right: 350,
      top: 180,
      bottom: 230,
    } as DOMRect);
    setControls(v.container, { switches: [0], holds: [false, true] });
    button.focus();
    fireEvent.click(button);
    expect(box.scrollLeft).toBeGreaterThan(0);
    expect(box.scrollTop).toBeGreaterThan(0);
    expect(document.activeElement).toBe(button);
  });
  it("there is no running clock; time only advances through an accepted action", () => {
    vi.useFakeTimers();
    const v = render(<RailwayTimetable {...props()} />);
    vi.advanceTimersByTime(600000);
    expect(v.container.querySelector('[data-rail-tick="0"]')).not.toBeNull();
  });
});

it.each(railwayTimetableLevels)(
  "$id rendered rail routes avoid every unrelated station including occupied goals and labels",
  (l) => {
    const edges = l.nodes.flatMap((n, from) =>
      n.next.map((to) => ({ from, to, path: railRoute(l, from, to) })),
    );
    expect(new Set(edges.map((e) => JSON.stringify(e.path))).size).toBe(
      edges.length,
    );
    for (const edge of edges) {
      expect(edge.path.length).toBeGreaterThanOrEqual(2);
      for (let k = 1; k < edge.path.length; k++) {
        const a = edge.path[k - 1],
          b = edge.path[k];
        expect(a.x === b.x || a.y === b.y).toBe(true);
        for (let station = 0; station < l.nodes.length; station++) {
          if (station === edge.from || station === edge.to) continue;
          const n = l.nodes[station],
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
          expect(
            intersects,
            `${l.id} ${edge.from}→${edge.to} through ${station}`,
          ).toBe(false);
        }
      }
    }
  },
);
it("winning train positions and controls stay frozen under external undo", () => {
  const p = props(),
    v = render(<RailwayTimetable {...p} />);
  for (const a of railwayTimetableLevels[0].certificate.actions) {
    setControls(v.container, a);
    fireEvent.click(v.container.querySelector("[data-rail-commit]")!);
  }
  const html = v.container.innerHTML;
  v.rerender(<RailwayTimetable {...p} undoToken={1} />);
  expect(v.container.innerHTML).toBe(html);
  expect(p.onComplete).toHaveBeenCalledOnce();
  expect(v.container.textContent).toContain("交叉不代表连接");
  expect(v.container.querySelectorAll("[data-rail-route]")).toHaveLength(4);
});
it.each(railwayTimetableLevels)(
  "$id numbered rail labels do not cover a station, target or another label",
  (l) => {
    const paths = l.nodes.flatMap((n, from) =>
        n.next.map((to) => railRoute(l, from, to)),
      ),
      labels = routeBadges(l.nodes, paths);
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
