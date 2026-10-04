// @vitest-environment jsdom
import { createElement as h, act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GameProps } from "../src/lib/types";
import MemoryGarden from "../src/games/MemoryGarden";
import LightsOut from "../src/games/LightsOut";
import {
  createMemoryState,
  flipMemoryCard,
  makeMemoryCards,
  memoryFaces,
  memoryHint,
  memoryLevels,
  memorySolution,
  memoryWon,
  settleMemoryTurn,
  undoMemoryTurn,
} from "../src/games/memoryLogic";
import {
  applyLightMoves,
  createLightsOutState,
  lightNeighbors,
  lightsOutLevels,
  lightsOutSolved,
  playLight,
  solveLightsOut,
  toggleLight,
  undoLight,
} from "../src/games/lightsOutLogic";

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const props = (level = 0): GameProps => ({
  level,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onComplete: vi.fn(),
  onStatus: vi.fn(),
});
const memoryButtons = () => screen.getAllByRole("button");
const litButtons = () => screen.getAllByRole("button");

describe("Memory Garden deterministic rules", () => {
  it("ships twelve increasingly large deterministic layouts", () => {
    expect(memoryLevels).toHaveLength(12);
    expect(memoryLevels.map((level) => level.pairs)).toEqual([
      3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18,
    ]);
    expect(makeMemoryCards(18, 129)).toEqual(makeMemoryCards(18, 129));
    expect(makeMemoryCards(18, 129)).not.toEqual(makeMemoryCards(18, 128));
    expect(() => makeMemoryCards(19, 0)).toThrow(RangeError);
  });
  memoryLevels.forEach((config, level) => {
    it(`level ${level + 1} has exactly two of every face and wins only after all pairs`, () => {
      expect(config.cards).toHaveLength(config.pairs * 2);
      for (let face = 0; face < config.pairs; face++)
        expect(config.cards.filter((value) => value === face)).toHaveLength(2);
      let state = createMemoryState();
      for (const [first, second] of memorySolution(config)) {
        expect(memoryWon(config, state)).toBe(false);
        state = flipMemoryCard(config, state, first);
        expect(memoryWon(config, state)).toBe(false);
        state = flipMemoryCard(config, state, second);
        expect(new Set(state.matched).size).toBe(state.matched.length);
      }
      expect(memoryWon(config, state)).toBe(true);
      expect(state.turns).toBe(config.pairs);
      expect(flipMemoryCard(config, state, 0)).toBe(state);
    });
  });
  it("locks mismatches, ignores invalid cards, and freezes settlement while paused", () => {
    const config = memoryLevels[0];
    const first = 0,
      second = config.cards.findIndex((face) => face !== config.cards[first]);
    const fresh = createMemoryState();
    expect(flipMemoryCard(config, fresh, first, true)).toBe(fresh);
    for (const index of [-1, 99, 0.5, NaN])
      expect(flipMemoryCard(config, fresh, index)).toBe(fresh);
    const one = flipMemoryCard(config, fresh, first);
    expect(flipMemoryCard(config, one, first)).toBe(one);
    const two = flipMemoryCard(config, one, second);
    expect(two.turns).toBe(1);
    expect(two.matched).toEqual([]);
    expect(flipMemoryCard(config, two, 2)).toBe(two);
    expect(settleMemoryTurn(two, true)).toBe(two);
    expect(undoMemoryTurn(two, true)).toBe(two);
    expect(settleMemoryTurn(two).open).toEqual([]);
    expect(two.open).toEqual([first, second]);
    expect(undoMemoryTurn(two)).toEqual(fresh);
    expect(undoMemoryTurn(settleMemoryTurn(two))).toEqual(fresh);
  });
  it("undo restores a whole matching turn or an unfinished first flip", () => {
    const config = memoryLevels[0];
    const [first, second] = memorySolution(config)[0];
    const fresh = createMemoryState();
    const one = flipMemoryCard(config, fresh, first);
    const pair = flipMemoryCard(config, one, second);
    expect(pair.matched).toEqual([first, second]);
    expect(undoMemoryTurn(pair)).toEqual(fresh);
    expect(undoMemoryTurn(one)).toEqual(fresh);
    expect(undoMemoryTurn(fresh)).toBe(fresh);
    expect(fresh.matched).toEqual([]);
  });
  it("hints always name an unmatched matching pair and respect the first open card", () => {
    for (const config of memoryLevels) {
      const first = config.cards.length - 1;
      const state = flipMemoryCard(config, createMemoryState(), first);
      const hint = memoryHint(config, state);
      expect(hint[0]).toBe(first);
      expect(hint[0]).not.toBe(hint[1]);
      expect(config.cards[hint[0]]).toBe(config.cards[hint[1]]);
    }
  });
});

describe("Lights Out exact solver and state rules", () => {
  it("has twelve nondecreasing minimum-move challenges", () => {
    expect(lightsOutLevels).toHaveLength(12);
    expect(lightsOutLevels.map((level) => level.size)).toEqual([
      3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5,
    ]);
    expect(lightsOutLevels.map((level) => level.solution.length)).toEqual([
      2, 3, 4, 4, 5, 6, 7, 7, 8, 9, 10, 11,
    ]);
  });
  lightsOutLevels.forEach((config, level) => {
    it(`level ${level + 1} starts unsolved and supports both generated inverse and exact solution`, () => {
      expect(lightsOutSolved(config.initial)).toBe(false);
      expect(
        lightsOutSolved(
          applyLightMoves(config.initial, config.size, config.scramble),
        ),
      ).toBe(true);
      expect(
        lightsOutSolved(
          applyLightMoves(config.initial, config.size, config.solution),
        ),
      ).toBe(true);
      let state = createLightsOutState(config);
      config.solution.forEach((index) => {
        expect(lightsOutSolved(state.board)).toBe(false);
        const previous = state;
        state = playLight(state, config.size, index);
        expect(undoLight(state)).toEqual(previous);
      });
      expect(lightsOutSolved(state.board)).toBe(true);
      expect(state.moves).toBe(config.solution.length);
      expect(playLight(state, config.size, 0)).toBe(state);
      for (let i = 0; i < config.size ** 2; i++) {
        const moved = toggleLight(config.initial, config.size, i);
        const recovery = solveLightsOut(moved, config.size);
        expect(recovery).not.toBeNull();
        expect(
          lightsOutSolved(applyLightMoves(moved, config.size, recovery!)),
        ).toBe(true);
      }
    });
  });
  it("never wraps edges and each switch is its own inverse", () => {
    expect(lightNeighbors(3, 0).sort()).toEqual([0, 1, 3]);
    expect(lightNeighbors(3, 2).sort()).toEqual([1, 2, 5]);
    expect(lightNeighbors(3, 4).sort()).toEqual([1, 3, 4, 5, 7]);
    const original = lightsOutLevels[11].initial;
    for (let i = 0; i < 25; i++)
      expect(toggleLight(toggleLight(original, 5, i), 5, i)).toEqual(original);
    expect(lightsOutSolved([])).toBe(false);
    expect(toggleLight(original, 5, -1)).toEqual(original);
    expect(solveLightsOut([true], 3)).toBeNull();
  });
  it("rejects an unreachable 4×4 board and recognizes empty solutions", () => {
    const impossible = Array<boolean>(16).fill(false);
    impossible[0] = true;
    expect(solveLightsOut(impossible, 4)).toBeNull();
    expect(solveLightsOut(Array<boolean>(25).fill(false), 5)).toEqual([]);
  });
  it("confirms the exact solver against brute force on all 512 3×3 boards", () => {
    const best = new Map<string, number>();
    for (let mask = 0; mask < 512; mask++) {
      const moves = Array.from({ length: 9 }, (_, i) => i).filter(
        (i) => mask & (1 << i),
      );
      const board = applyLightMoves(Array<boolean>(9).fill(false), 3, moves);
      const key = board.map(Number).join("");
      best.set(key, Math.min(best.get(key) ?? Infinity, moves.length));
    }
    for (const [key, count] of best)
      expect(
        solveLightsOut(
          [...key].map((v) => v === "1"),
          3,
        )?.length,
      ).toBe(count);
  });
  it("pause blocks moves and undo; undo restores the exact previous board", () => {
    const state = createLightsOutState(lightsOutLevels[0]);
    expect(playLight(state, 3, 0, true)).toBe(state);
    expect(playLight(state, 3, -1)).toBe(state);
    const moved = playLight(state, 3, 0);
    expect(undoLight(moved, true)).toBe(moved);
    expect(undoLight(moved)).toEqual(state);
    expect(undoLight(state)).toBe(state);
    expect(state.board).toEqual(lightsOutLevels[0].initial);
  });
});

describe("Memory Garden component behavior", () => {
  memoryLevels.forEach((config, level) => {
    it(`level ${level + 1} is playable through semantic buttons and completes once`, () => {
      const base = props(level);
      const view = render(h(MemoryGarden, base));
      const buttons = memoryButtons();
      expect(base.onComplete).not.toHaveBeenCalled();
      memorySolution(config).forEach(([first, second]) => {
        fireEvent.click(buttons[first]);
        expect(base.onComplete).not.toHaveBeenCalled();
        fireEvent.click(buttons[second]);
      });
      expect(base.onComplete).toHaveBeenCalledOnce();
      view.rerender(h(MemoryGarden, { ...base, hintToken: 1 }));
      expect(base.onComplete).toHaveBeenCalledOnce();
    });
  });
  it("hidden card accessible names never reveal face identities, including while paused", () => {
    const base = props();
    const view = render(h(MemoryGarden, base));
    expect(
      screen.getAllByRole("button", { name: /未翻开的卡片/ }),
    ).toHaveLength(6);
    for (const face of memoryFaces)
      expect(
        screen.queryByRole("button", { name: new RegExp(face.name) }),
      ).toBeNull();
    fireEvent.click(memoryButtons()[0]);
    view.rerender(h(MemoryGarden, { ...base, paused: true }));
    expect(screen.getAllByRole("button", { name: /已暂停/ })).toHaveLength(6);
    for (const face of memoryFaces)
      expect(
        screen.queryByRole("button", { name: new RegExp(face.name) }),
      ).toBeNull();
    expect(
      memoryButtons().every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
    view.rerender(h(MemoryGarden, base));
    expect(screen.getAllByRole("button", { name: /已翻开/ })).toHaveLength(1);
  });
  it("mismatch delay freezes on pause and resumes only the remaining interval", async () => {
    vi.useFakeTimers();
    const base = props();
    const config = memoryLevels[0];
    const other = config.cards.findIndex((face) => face !== config.cards[0]);
    const view = render(h(MemoryGarden, base));
    fireEvent.click(memoryButtons()[0]);
    fireEvent.click(memoryButtons()[other]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    view.rerender(h(MemoryGarden, { ...base, paused: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    view.rerender(h(MemoryGarden, base));
    expect(screen.getAllByRole("button", { name: /已翻开/ })).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });
    expect(screen.getAllByRole("button", { name: /已翻开/ })).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(51);
    });
    expect(screen.queryByRole("button", { name: /已翻开/ })).toBeNull();
    expect(base.onComplete).not.toHaveBeenCalled();
  });
  it("undo cancels a pending mismatch timer and reset does not replay old tokens", async () => {
    vi.useFakeTimers();
    const base = props();
    const config = memoryLevels[0];
    const other = config.cards.findIndex((face) => face !== config.cards[0]);
    const view = render(h(MemoryGarden, base));
    fireEvent.click(memoryButtons()[0]);
    fireEvent.click(memoryButtons()[other]);
    view.rerender(h(MemoryGarden, { ...base, undoToken: 1 }));
    expect(
      screen.getAllByRole("button", { name: /未翻开的卡片/ }),
    ).toHaveLength(6);
    fireEvent.click(memoryButtons()[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getAllByRole("button", { name: /已翻开/ })).toHaveLength(1);
    view.rerender(
      h(MemoryGarden, { ...base, resetToken: 1, undoToken: 1, hintToken: 1 }),
    );
    expect(
      screen.getAllByRole("button", { name: /未翻开的卡片/ }),
    ).toHaveLength(6);
    expect(
      document.querySelectorAll(".mlg-memory-card.is-hinted"),
    ).toHaveLength(0);
    expect(base.onComplete).not.toHaveBeenCalled();
  });
  it("hints identify a usable pair, pause ignores hint/undo, and level changes reset cleanly", () => {
    const base = props();
    const view = render(h(MemoryGarden, base));
    view.rerender(h(MemoryGarden, { ...base, hintToken: 1 }));
    expect(
      document.querySelectorAll(".mlg-memory-card.is-hinted"),
    ).toHaveLength(2);
    fireEvent.click(memoryButtons()[0]);
    view.rerender(
      h(MemoryGarden, { ...base, paused: true, hintToken: 2, undoToken: 1 }),
    );
    view.rerender(h(MemoryGarden, { ...base, hintToken: 2, undoToken: 1 }));
    expect(screen.getAllByRole("button", { name: /已翻开/ })).toHaveLength(1);
    view.rerender(h(MemoryGarden, { ...base, level: 11 }));
    expect(
      screen.getAllByRole("button", { name: /未翻开的卡片/ }),
    ).toHaveLength(36);
    expect(base.onComplete).not.toHaveBeenCalled();
  });
});

describe("Lights Out component behavior", () => {
  lightsOutLevels.forEach((config, level) => {
    it(`level ${level + 1} completes only after its final required switch`, () => {
      const base = props(level);
      const view = render(h(LightsOut, base));
      const buttons = litButtons();
      config.solution.forEach((index) => {
        expect(base.onComplete).not.toHaveBeenCalled();
        fireEvent.click(buttons[index]);
      });
      expect(base.onComplete).toHaveBeenCalledOnce();
      view.rerender(h(LightsOut, { ...base, paused: true }));
      view.rerender(h(LightsOut, base));
      expect(base.onComplete).toHaveBeenCalledOnce();
    });
  });
  it("pause prevents interaction, undo restores switches, and reset resets the entire round", () => {
    const base = props(7);
    const view = render(h(LightsOut, base));
    const initial = litButtons().map((button) =>
      button.getAttribute("aria-pressed"),
    );
    fireEvent.click(litButtons()[4]);
    const moved = litButtons().map((button) =>
      button.getAttribute("aria-pressed"),
    );
    expect(moved).not.toEqual(initial);
    view.rerender(h(LightsOut, { ...base, paused: true, undoToken: 1 }));
    fireEvent.click(litButtons()[2]);
    expect(
      litButtons().map((button) => button.getAttribute("aria-pressed")),
    ).toEqual(moved);
    view.rerender(h(LightsOut, { ...base, undoToken: 2 }));
    expect(
      litButtons().map((button) => button.getAttribute("aria-pressed")),
    ).toEqual(initial);
    fireEvent.click(litButtons()[4]);
    view.rerender(h(LightsOut, { ...base, resetToken: 1, undoToken: 2 }));
    expect(
      litButtons().map((button) => button.getAttribute("aria-pressed")),
    ).toEqual(initial);
    expect(base.onComplete).not.toHaveBeenCalled();
  });
  it("repeated hints solve a changed board and changing level never carries completion forward", () => {
    const base = props(4);
    const view = render(h(LightsOut, base));
    fireEvent.click(litButtons()[0]);
    for (
      let hintToken = 1;
      hintToken < 17 &&
      !(base.onComplete as ReturnType<typeof vi.fn>).mock.calls.length;
      hintToken++
    ) {
      view.rerender(h(LightsOut, { ...base, hintToken }));
      const suggested = document.querySelector<HTMLButtonElement>(
        ".mlg-light.is-hinted",
      );
      expect(suggested).not.toBeNull();
      fireEvent.click(suggested!);
    }
    expect(base.onComplete).toHaveBeenCalledOnce();
    view.rerender(h(LightsOut, { ...base, level: 11 }));
    expect(litButtons()).toHaveLength(25);
    expect(base.onComplete).toHaveBeenCalledOnce();
    expect(
      screen.getAllByRole("button", { name: /灯亮着/ }).length,
    ).toBeGreaterThan(0);
  });
});
