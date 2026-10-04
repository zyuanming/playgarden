// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IceStops from "../src/games/IceStops";
import { iceStopsLevels } from "../src/games/iceStopsLevels";
import {
  ICE_DIRECTIONS,
  ICE_STATE_LIMIT,
  createIceState,
  iceHint,
  iceStep,
  iceWon,
  moveIce,
  searchIce,
  undoIce,
  validIceProblem,
  type IceMove,
  type IcePositions,
  type IceProblem,
} from "../src/games/iceStopsLogic";
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
/** Independent geometric ray oracle: list every blocker on a directed ray, then stop one cell before the nearest. */
function ray(l: IceProblem, p: IcePositions, m: IceMove): IcePositions | null {
  const w = l.rows[0].length,
    h = l.rows.length,
    x = p[m.puck] % w,
    y = Math.floor(p[m.puck] / w);
  const [dx, dy] = ({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] } as const)[
    m.direction
  ];
  const blockers: number[] = [];
  for (let yy = -1; yy <= h; yy++)
    for (let xx = -1; xx <= w; xx++) {
      const distance = (xx - x) * dx + (yy - y) * dy;
      if (distance <= 0 || (dx === 0 ? xx !== x : yy !== y)) continue;
      if (
        yy < 0 ||
        xx < 0 ||
        yy >= h ||
        xx >= w ||
        l.rows[yy][xx] === "#" ||
        p.includes(yy * w + xx)
      )
        blockers.push(distance);
    }
  const distance = Math.min(...blockers) - 1;
  if (!distance) return null;
  const result = [...p] as [number, number, number];
  result[m.puck] = (y + dy * distance) * w + x + dx * distance;
  return result;
}
function oracleSearch(l: IceProblem, start: IcePositions = l.start) {
  const queue = [{ p: start, d: 0 }],
    seen = new Set([start.join()]);
  for (let head = 0; head < queue.length; head++) {
    const { p, d } = queue[head];
    if (p.every((c, i) => c === l.goals[i]))
      return { distance: d, visited: seen.size };
    for (let puck = 0; puck < 3; puck++)
      for (const direction of ICE_DIRECTIONS) {
        const next = ray(l, p, { puck, direction });
        if (next && !seen.has(next.join())) {
          seen.add(next.join());
          queue.push({ p: next, d: d + 1 });
        }
      }
  }
  return { distance: null, visited: seen.size };
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

describe("IceStops exact movement and authored certificates", () => {
  it("has twelve distinct bounded original maps and increasing nontrivial routes", () => {
    expect(iceStopsLevels).toHaveLength(12);
    expect(new Set(iceStopsLevels.map((l) => l.rows.join("/"))).size).toBe(12);
    expect(iceStopsLevels.map((l) => l.certificate.shortest)).toEqual([
      3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
    expect(ICE_STATE_LIMIT).toBe(24360);
  });
  for (const l of iceStopsLevels)
    it(`${l.id}: independent ray shortest path and certificate corruption`, () => {
      expect(validIceProblem(l)).toBe(true);
      const independent = oracleSearch(l),
        search = searchIce(l);
      expect(search.status).toBe("solved");
      expect(search.moves.length).toBe(independent.distance);
      expect(search.moves.length).toBe(l.certificate.shortest);
      expect(search.visited).toBe(l.certificate.visited);
      expect(search.visited).toBeLessThanOrEqual(ICE_STATE_LIMIT);
      let state = createIceState(l);
      const before = JSON.stringify(state);
      deepFreeze(state);
      for (const move of l.certificate.moves) {
        const expected = ray(l, state.positions, move);
        expect(expected).not.toBeNull();
        expect(iceStep(l, state.positions, move)).toEqual(expected);
        state = moveIce(l, state, move);
      }
      expect(iceWon(l, state.positions)).toBe(true);
      expect(before).toBe(JSON.stringify(createIceState(l)));
      expect(undoIce(l, state)).toBe(state);
      expect(moveIce(l, state, { puck: 0, direction: "N" })).toBe(state);
      const corrupted = {
        ...l,
        certificate: { moves: [], shortest: 999, visited: 0 },
      };
      expect(searchIce(corrupted).moves).toEqual(search.moves);
      expect(iceWon(corrupted, state.positions)).toBe(true);
    });
  it("level four teaches temporarily moving an already parked puck", () => {
    const l = iceStopsLevels[3];
    let p = l.start,
      departed = false;
    for (const m of l.certificate.moves) {
      if (p[m.puck] === l.goals[m.puck]) departed = true;
      p = ray(l, p, m)!;
    }
    expect(departed).toBe(true);
  });
  it("agrees with the independent ray for every labeled state/action on a small board", () => {
    const l = iceStopsLevels[0],
      cells = Array.from({ length: 8 }, (_, i) => i);
    for (const a of cells)
      for (const b of cells)
        for (const c of cells) {
          if (new Set([a, b, c]).size !== 3) continue;
          for (let puck = 0; puck < 3; puck++)
            for (const direction of ICE_DIRECTIONS)
              expect(iceStep(l, [a, b, c], { puck, direction })).toEqual(
                ray(l, [a, b, c], { puck, direction }),
              );
        }
  });
  it("passes goals without stopping, allows a parked puck to move, and preserves labels", () => {
    const l: IceProblem = {
      id: "test",
      title: "",
      lesson: "",
      rows: ["......"],
      start: [0, 4, 5],
      goals: [2, 1, 3],
    };
    expect(iceStep(l, l.start, { puck: 0, direction: "E" })).toEqual([3, 4, 5]);
    const parked = {
      ...l,
      start: [0, 2, 5] as IcePositions,
      goals: [3, 2, 0] as IcePositions,
    };
    expect(iceStep(parked, parked.start, { puck: 1, direction: "E" })).toEqual([
      0, 4, 5,
    ]);
    expect(iceWon(l, [1, 2, 3])).toBe(false);
  });
  it("distinguishes proven unreachable from invalid and hints from the actual off-certificate state", () => {
    const stuck: IceProblem = {
      id: "stuck",
      title: "",
      lesson: "",
      rows: ["..."],
      start: [0, 1, 2],
      goals: [2, 1, 0],
    };
    expect(searchIce(stuck).status).toBe("unreachable");
    expect(iceHint(stuck, stuck.start).text).toContain("穷尽");
    expect(searchIce({ ...stuck, start: [0, 0, 2] }).status).toBe("invalid");
    expect(iceStep(stuck, stuck.start, { puck: 3, direction: "N" })).toBeNull();
    expect(validIceProblem({ ...stuck, rows: ["......."] })).toBe(false);
    const l = iceStopsLevels[7],
      off = iceStep(l, l.start, { puck: 1, direction: "S" })!;
    const expected = oracleSearch(l, off),
      hint = iceHint(l, off);
    expect(hint.text).toContain(String(expected.distance));
    expect(hint.move).toEqual(searchIce(l, off).moves[0]);
  });
  it("undo is immutable and blocked moves do not grow history", () => {
    const l = iceStopsLevels[0],
      s = deepFreeze(createIceState(l));
    expect(moveIce(l, s, { puck: 0, direction: "N" })).toBe(s);
    const next = moveIce(l, s, l.certificate.moves[0]);
    expect(next.history[0]).toBe(s.positions);
    expect(undoIce(l, deepFreeze(next)).positions).toEqual(s.positions);
    expect(next.history).toHaveLength(1);
  });
});

describe("IceStops DOM journeys (jsdom, not browser rendering)", () => {
  for (const [level, l] of iceStopsLevels.entries())
    it(`${l.id}: reset, pause token consumption, undo, route, and read-only completion`, () => {
      let p = { ...props(), level };
      const view = render(
        <StrictMode>
          <IceStops {...p} />
        </StrictMode>,
      );
      const positions = () =>
        Array.from(
          view.container.querySelectorAll<HTMLButtonElement>("[data-ice-puck]"),
        ).map((b) => Number(b.dataset.position));
      const move = (m: IceMove) => {
        fireEvent.click(
          view.container.querySelector(`[data-ice-puck="${m.puck}"]`)!,
        );
        fireEvent.click(
          view.container.querySelector(
            `[data-ice-direction="${m.direction}"]`,
          )!,
        );
      };
      move(l.certificate.moves[0]);
      expect(positions()).not.toEqual(l.start);
      p = { ...p, resetToken: 1 };
      view.rerender(
        <StrictMode>
          <IceStops {...p} />
        </StrictMode>,
      );
      expect(positions()).toEqual(l.start);
      move(l.certificate.moves[0]);
      const snapshot = positions();
      p = { ...p, paused: true, hintToken: 1, undoToken: 1 };
      view.rerender(
        <StrictMode>
          <IceStops {...p} />
        </StrictMode>,
      );
      move(l.certificate.moves[1]);
      expect(positions()).toEqual(snapshot);
      expect(
        view.container.querySelector("[data-ice-status]")!.textContent,
      ).toContain("暂停");
      p = { ...p, paused: false };
      view.rerender(
        <StrictMode>
          <IceStops {...p} />
        </StrictMode>,
      );
      expect(positions()).toEqual(snapshot);
      p = { ...p, undoToken: 2 };
      view.rerender(
        <StrictMode>
          <IceStops {...p} />
        </StrictMode>,
      );
      expect(positions()).toEqual(l.start);
      p = { ...p, hintToken: 2 };
      view.rerender(
        <StrictMode>
          <IceStops {...p} />
        </StrictMode>,
      );
      expect(positions()).toEqual(l.start);
      expect(
        view.container.querySelector("[data-ice-status]")!.textContent,
      ).toContain("最少还需");
      for (const m of l.certificate.moves) move(m);
      expect(positions()).toEqual(l.goals);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        view.container.querySelector('[data-ice-won="true"]'),
      ).not.toBeNull();
      p = { ...p, undoToken: 3, hintToken: 3 };
      view.rerender(
        <StrictMode>
          <IceStops {...p} />
        </StrictMode>,
      );
      move(l.certificate.moves[0]);
      expect(positions()).toEqual(l.goals);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      p = { ...p, resetToken: 2 };
      view.rerender(
        <StrictMode>
          <IceStops {...p} />
        </StrictMode>,
      );
      expect(positions()).toEqual(l.start);
      expect(
        view.container.querySelector('[data-ice-won="false"]'),
      ).not.toBeNull();
    });
  it("keeps keyboard focus on a puck while its grid position changes", async () => {
    const user = userEvent.setup(),
      view = render(<IceStops {...props()} />),
      puck = view.container.querySelector<HTMLButtonElement>(
        '[data-ice-puck="0"]',
      )!;
    puck.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(puck);
    await user.keyboard("2{ArrowDown}");
    expect(
      view.container
        .querySelector('[data-ice-puck="1"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(view.getByRole("group", { name: /冰面/ })).toBeTruthy();
  });
});

describe("IceStops viewport and exposed-clue regressions", () => {
  it("reveals a moving stable-focus puck horizontally without page or vertical scrolling (synthetic geometry)", async () => {
    const user = userEvent.setup(),
      view = render(<IceStops {...props()} level={6} />);
    const viewport = view.container.querySelector<HTMLDivElement>(
        "[data-ice-viewport]",
      )!,
      puck = view.container.querySelector<HTMLButtonElement>(
        '[data-ice-puck="0"]',
      )!;
    viewport.scrollTop = 37;
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
    vi.spyOn(puck, "getBoundingClientRect").mockImplementation(() => {
      const left =
        10 + (Number(puck.dataset.position) % 6) * 60 - viewport.scrollLeft;
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
    puck.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(puck);
    expect(viewport.scrollLeft).toBeGreaterThan(0);
    const scrolled = viewport.scrollLeft;
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(puck);
    expect(viewport.scrollLeft).toBeLessThan(scrolled);
    expect(viewport.scrollTop).toBe(37);
    expect(pageScroll).not.toHaveBeenCalled();
    pageScroll.mockRestore();
    expect(view.getByText(/窄屏可左右滑动冰面/)).toBeTruthy();
  });
  it("keeps all goal coordinates visible when level four's B covers A's target", () => {
    const p = { ...props(), level: 3 },
      view = render(<IceStops {...p} />),
      legend = view.container.querySelector("[data-ice-goal-legend]")!;
    expect(
      view.container.querySelector('[data-ice-goal="0"]')!.textContent,
    ).toContain("第 1 行 · 第 5 列");
    expect(
      view.container
        .querySelector('[data-ice-puck="1"]')!
        .getAttribute("aria-label"),
    ).toContain("位于 A 目标（另一枚冰盘的目标）");
    const text = legend.textContent;
    view.rerender(<IceStops {...p} paused />);
    expect(legend.textContent).toBe(text);
    expect(legend.querySelectorAll("[data-ice-goal]")).toHaveLength(3);
  });
  it("leaves browser modifier shortcuts and their default behavior alone", () => {
    const view = render(<IceStops {...props()} />),
      board = view.getByRole("group", { name: /冰面/ }),
      before = view.container
        .querySelector('[data-ice-puck="0"]')!
        .getAttribute("data-position");
    for (const modifier of ["ctrlKey", "metaKey", "altKey"])
      for (const key of ["ArrowDown", "2"]) {
        const event = new KeyboardEvent("keydown", {
          key,
          [modifier]: true,
          bubbles: true,
          cancelable: true,
        });
        board.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
    expect(
      view.container
        .querySelector('[data-ice-puck="0"]')!
        .getAttribute("data-position"),
    ).toBe(before);
    expect(
      view.container
        .querySelector('[data-ice-puck="0"]')!
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
