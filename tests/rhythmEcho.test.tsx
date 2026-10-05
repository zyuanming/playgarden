// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import RhythmEcho from "../src/games/RhythmEcho";
import { rhythmEchoLevels } from "../src/games/rhythmEchoLevels";
import { rhythmEchoSolutions } from "../src/games/rhythmEchoSolutions";
import {
  RHYTHM_UNIT_MS,
  beginRhythm,
  changeRhythmMode,
  createRhythmState,
  enterRhythm,
  replayRhythm,
  rhythmHint,
  rhythmIntervalMatches,
  rhythmTarget,
  rhythmToleranceMs,
  rhythmWon,
  undoRhythm,
  type RhythmInterval,
  type RhythmLevel,
} from "../src/games/rhythmEchoLogic";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
/** Independent positional grammar oracle: map output positions back to source positions. */
function motifOracle(level: RhythmLevel): number[] {
  const result: number[] = [];
  for (const part of level.parts)
    for (let copy = 0; copy < part.repeat; copy++)
      for (let slot = 0; slot < level.motif.length; slot++) {
        const index =
          part.transform === "reverse"
            ? level.motif.length - slot - 1
            : part.transform === "rotate"
              ? (slot + 1) % level.motif.length
              : slot;
        result.push(
          level.motif[index] + (part.transform === "lengthen" ? 1 : 0),
        );
      }
  return result;
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
const game = (container: HTMLElement) =>
  container.querySelector("[data-rhythm-echo-game]")!;
const ready = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>("[data-rhythm-echo-ready]")!;
const replay = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>("[data-rhythm-echo-replay]")!;
const play = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>("[data-rhythm-echo-play]")!;
const tap = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>("[data-rhythm-echo-tap]")!;
const token = (container: HTMLElement, value: number) =>
  container.querySelector<HTMLButtonElement>(
    `[data-rhythm-echo-token="${value}"]`,
  )!;
const mode = (container: HTMLElement, value: string) =>
  container.querySelector<HTMLButtonElement>(
    `[data-rhythm-echo-mode-button="${value}"]`,
  )!;
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
// jsdom queues a zero-delay native <details> toggle event on mount.
// Drain that browser event before counting the game's timeout jobs.
const clockCount = () => {
  advance(0);
  return vi.getTimerCount();
};

describe("RhythmEcho public motif rules and equal-mode validation", () => {
  it("has twelve distinct authored phrases teaching repeat, reverse, lengthening, and rotation", () => {
    expect(rhythmEchoLevels).toHaveLength(12);
    expect(
      new Set(rhythmEchoLevels.map((level) => motifOracle(level).join())).size,
    ).toBe(12);
    expect(rhythmEchoLevels[0].parts).toHaveLength(1);
    expect(rhythmEchoLevels.at(-1)!.parts).toHaveLength(4);
    expect(
      new Set(
        rhythmEchoLevels.flatMap((level) =>
          level.parts.map((part) => part.transform),
        ),
      ),
    ).toEqual(new Set(["forward", "reverse", "rotate", "lengthen"]));
    expect(
      Math.max(...rhythmEchoLevels.map((level) => motifOracle(level).length)),
    ).toBe(9);
  });
  for (const [index, level] of rhythmEchoLevels.entries())
    it(`${level.id}: independent grammar, certificate and equivalent untimed/live success`, () => {
      const target = motifOracle(level);
      expect(rhythmTarget(level)).toEqual(target);
      expect(rhythmEchoSolutions[index]).toEqual(target);
      for (const modeName of ["tokens", "live"] as const) {
        let state = beginRhythm(
          changeRhythmMode(createRhythmState(), modeName),
        );
        for (const interval of target)
          state = enterRhythm(
            level,
            deepFreeze(state),
            modeName === "tokens" ? interval : interval * RHYTHM_UNIT_MS,
          );
        expect(state.phase).toBe("complete");
        expect(rhythmWon(level, state)).toBe(true);
        expect(enterRhythm(level, state, 1)).toBe(state);
        expect(undoRhythm(state)).toBe(state);
        expect(replayRhythm(state)).toBe(state);
        expect(changeRhythmMode(state, "live")).toBe(state);
      }
      const poisoned = {
        ...level,
        solution: [99, 99],
        certificate: { intervals: [] },
      };
      expect(rhythmTarget(poisoned)).toEqual(target);
    });
  it("uses inclusive generous boundary tolerances while rejecting outside, malformed, and wrong token values", () => {
    expect(
      [1, 2, 3].map((value) => rhythmToleranceMs(value as RhythmInterval)),
    ).toEqual([450, 700, 1050]);
    for (const value of [1, 2, 3] as const) {
      const ms = value * RHYTHM_UNIT_MS,
        tolerance = rhythmToleranceMs(value);
      expect(rhythmIntervalMatches(value, ms - tolerance, "live")).toBe(true);
      expect(rhythmIntervalMatches(value, ms + tolerance, "live")).toBe(true);
      expect(rhythmIntervalMatches(value, ms - tolerance - 1, "live")).toBe(
        false,
      );
      expect(rhythmIntervalMatches(value, ms + tolerance + 1, "live")).toBe(
        false,
      );
      expect(rhythmIntervalMatches(value, value, "tokens")).toBe(true);
      expect(rhythmIntervalMatches(value, ms, "tokens")).toBe(false);
      expect(rhythmIntervalMatches(value, NaN, "live")).toBe(false);
    }
    const l = rhythmEchoLevels[0],
      initial = createRhythmState(),
      recall = beginRhythm(initial);
    expect(enterRhythm(l, initial, 1)).toBe(initial);
    expect(beginRhythm(initial, true)).toBe(initial);
    for (const invalid of [0, 4, 1.5, NaN, Infinity, -1])
      expect(enterRhythm(l, recall, invalid)).toBe(recall);
    expect(enterRhythm(l, recall, 1, true)).toBe(recall);
    const one = enterRhythm(l, recall, 1);
    expect(undoRhythm(one, true)).toBe(one);
    expect(replayRhythm(one, true)).toBe(one);
    expect(changeRhythmMode(one, "live", true)).toBe(one);
    expect(replayRhythm(one).entered).toEqual([1]);
    expect(beginRhythm(replayRhythm(one)).entered).toEqual([1]);
    expect(changeRhythmMode(one, "live").entered).toEqual([]);
  });
  it("keeps failed attempts recoverable and hints the first mismatch", () => {
    const level = rhythmEchoLevels[0];
    let state = beginRhythm(createRhythmState());
    state = enterRhythm(level, state, 1);
    state = enterRhythm(level, state, 2);
    state = enterRhythm(level, state, 1);
    expect(state.phase).toBe("recall");
    expect(enterRhythm(level, state, 1)).toBe(state);
    expect(rhythmHint(level, state)).toMatchObject({ step: 1, interval: 1 });
    state = undoRhythm(undoRhythm(state));
    expect(state.entered).toEqual([1]);
    state = enterRhythm(level, state, 1);
    state = enterRhythm(level, state, 1);
    expect(state.phase).toBe("complete");
  });
});

describe("RhythmEcho controls, focus and paused shell contract", () => {
  for (const [index, target] of rhythmEchoSolutions.entries())
    it(`completes level ${index + 1} without audio or timing in default mode`, () => {
      const p = { ...props(), level: index },
        { container, rerender } = render(
          <StrictMode>
            <RhythmEcho {...p} />
          </StrictMode>,
        );
      expect(game(container).getAttribute("data-rhythm-echo-mode")).toBe(
        "tokens",
      );
      expect(
        container.querySelectorAll("[data-rhythm-echo-score]"),
      ).toHaveLength(target.length);
      fireEvent.click(ready(container));
      expect(
        container.querySelectorAll("[data-rhythm-echo-score]"),
      ).toHaveLength(0);
      expect(
        container.querySelector('[aria-label="公开的乐句规则"]'),
      ).toBeTruthy();
      for (const value of target) fireEvent.click(token(container, value));
      expect(game(container).getAttribute("data-rhythm-echo-won")).toBe("true");
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      const snapshot = game(container).getAttribute("data-rhythm-echo-entered");
      rerender(
        <StrictMode>
          <RhythmEcho {...p} hintToken={1} undoToken={1} />
        </StrictMode>,
      );
      fireEvent.click(mode(container, "live"));
      fireEvent.click(replay(container));
      fireEvent.click(token(container, 1));
      expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe(
        snapshot,
      );
      expect(game(container).getAttribute("data-rhythm-echo-mode")).toBe(
        "tokens",
      );
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    });
  it("supports replay retaining the answer, wrong-attempt hints, undo and switch-mode restart", () => {
    const p = props(),
      { container, rerender } = render(<RhythmEcho {...p} />);
    fireEvent.click(ready(container));
    fireEvent.click(token(container, 2));
    fireEvent.click(token(container, 1));
    fireEvent.click(replay(container));
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe(
      "2,1",
    );
    fireEvent.click(ready(container));
    fireEvent.click(token(container, 1));
    expect(container.querySelector(".re-wrong")).toBeTruthy();
    rerender(<RhythmEcho {...p} hintToken={1} />);
    expect(container.querySelector(".re-hint")?.textContent).toContain(
      "第 1 个间隔",
    );
    rerender(<RhythmEcho {...p} hintToken={1} undoToken={1} />);
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe(
      "2,1",
    );
    fireEvent.click(mode(container, "live"));
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe("");
    expect(game(container).getAttribute("data-rhythm-echo-mode")).toBe("live");
    fireEvent.click(mode(container, "tokens"));
    expect(token(container, 1).disabled).toBe(false);
  });
  it("consumes paused hint/undo without changing an answer and preserves externally focused Shell controls", () => {
    const p = props(),
      { container, rerender } = render(
        <>
          <button data-shell>Shell pause</button>
          <RhythmEcho {...p} />
        </>,
      );
    fireEvent.click(ready(container));
    fireEvent.click(token(container, 1));
    const shell = container.querySelector<HTMLButtonElement>("[data-shell]")!;
    shell.focus();
    rerender(
      <>
        <button data-shell>Shell pause</button>
        <RhythmEcho {...p} paused hintToken={1} undoToken={1} />
      </>,
    );
    fireEvent.click(token(container, 2));
    fireEvent.click(mode(container, "live"));
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe("1");
    expect(document.activeElement).toBe(shell);
    expect(container.querySelector(".re-hint")).toBeNull();
    rerender(
      <>
        <button data-shell>Shell pause</button>
        <RhythmEcho {...p} hintToken={1} undoToken={1} />
      </>,
    );
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe("1");
    rerender(
      <>
        <button data-shell>Shell pause</button>
        <RhythmEcho {...p} resetToken={1} />
      </>,
    );
    expect(game(container).getAttribute("data-rhythm-echo-phase")).toBe(
      "observe",
    );
    expect(document.activeElement).toBe(shell);
  });
  it("does not intercept modified keys, suppresses held-key repeat, and has no global keyboard handler", () => {
    const { container } = render(<RhythmEcho {...props()} />);
    fireEvent.click(ready(container));
    fireEvent.click(mode(container, "live"));
    for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
      const event = new KeyboardEvent("keydown", {
        key: " ",
        repeat: true,
        bubbles: true,
        cancelable: true,
        [modifier]: true,
      });
      tap(container).dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      fireEvent.click(tap(container), { [modifier]: true });
    }
    expect(tap(container).getAttribute("aria-label")).toContain("设定间隔起点");
    const repeated = new KeyboardEvent("keydown", {
      key: " ",
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    tap(container).dispatchEvent(repeated);
    expect(repeated.defaultPrevented).toBe(true);
    const outside = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);
  });
});

describe("RhythmEcho bounded clocks and interruption lifecycle", () => {
  it("pauses one preview clock exactly and resumes its remaining interval", () => {
    vi.useFakeTimers();
    const p = props(),
      { container, rerender, unmount } = render(
        <StrictMode>
          <RhythmEcho {...p} />
        </StrictMode>,
      );
    fireEvent.click(play(container));
    expect(clockCount()).toBe(1);
    expect(game(container).getAttribute("data-rhythm-echo-playhead")).toBe("0");
    advance(400);
    rerender(
      <StrictMode>
        <RhythmEcho {...p} paused />
      </StrictMode>,
    );
    expect(clockCount()).toBe(0);
    advance(30000);
    expect(game(container).getAttribute("data-rhythm-echo-playhead")).toBe("0");
    rerender(
      <StrictMode>
        <RhythmEcho {...p} />
      </StrictMode>,
    );
    advance(599);
    expect(game(container).getAttribute("data-rhythm-echo-playhead")).toBe("0");
    advance(1);
    expect(game(container).getAttribute("data-rhythm-echo-playhead")).toBe("1");
    expect(clockCount()).toBe(1);
    unmount();
    expect(clockCount()).toBe(0);
    advance(30000);
    expect(p.onComplete).not.toHaveBeenCalled();
  });
  it("finishes preview on its last beat and cancels it on Ready, stop, reset, level change and unmount", () => {
    vi.useFakeTimers();
    const p = props(),
      { container, rerender, unmount } = render(<RhythmEcho {...p} />);
    fireEvent.click(play(container));
    for (let i = 1; i <= 3; i++) {
      advance(1000);
      expect(game(container).getAttribute("data-rhythm-echo-playhead")).toBe(
        String(i),
      );
    }
    advance(650);
    expect(game(container).getAttribute("data-rhythm-echo-playhead")).toBe(
      "idle",
    );
    expect(clockCount()).toBe(0);
    fireEvent.click(play(container));
    advance(300);
    fireEvent.click(play(container));
    expect(clockCount()).toBe(0);
    fireEvent.click(play(container));
    advance(300);
    fireEvent.click(ready(container));
    advance(5000);
    expect(game(container).getAttribute("data-rhythm-echo-playhead")).toBe(
      "idle",
    );
    expect(clockCount()).toBe(0);
    fireEvent.click(replay(container));
    fireEvent.click(play(container));
    advance(300);
    rerender(<RhythmEcho {...p} resetToken={1} />);
    expect(clockCount()).toBe(0);
    fireEvent.click(play(container));
    advance(300);
    rerender(<RhythmEcho {...p} resetToken={1} level={1} />);
    expect(clockCount()).toBe(0);
    advance(9000);
    expect(game(container).getAttribute("data-rhythm-echo-playhead")).toBe(
      "idle",
    );
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe("");
    fireEvent.click(play(container));
    unmount();
    expect(clockCount()).toBe(0);
  });
  it("live input accepts generous boundaries, pauses invalidate only the unfinished interval, undo reanchors", () => {
    vi.useFakeTimers();
    const p = props(),
      { container, rerender } = render(<RhythmEcho {...p} />);
    fireEvent.click(mode(container, "live"));
    fireEvent.click(ready(container));
    fireEvent.click(tap(container));
    advance(550);
    fireEvent.click(tap(container));
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe(
      "550",
    );
    advance(200);
    rerender(<RhythmEcho {...p} paused />);
    advance(30000);
    fireEvent.click(tap(container));
    rerender(<RhythmEcho {...p} />);
    fireEvent.click(tap(container));
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe(
      "550",
    );
    advance(1450);
    fireEvent.click(tap(container));
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe(
      "550,1450",
    );
    rerender(<RhythmEcho {...p} undoToken={1} />);
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe(
      "550",
    );
    advance(20000);
    fireEvent.click(tap(container));
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe(
      "550",
    );
    advance(1000);
    fireEvent.click(tap(container));
    advance(1000);
    fireEvent.click(tap(container));
    expect(game(container).getAttribute("data-rhythm-echo-won")).toBe("true");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    expect(clockCount()).toBe(0);
  });
  it("replay and reset cancel the live anchor; elapsed wall time cannot poison a new attempt", () => {
    vi.useFakeTimers();
    const p = props(),
      { container, rerender } = render(<RhythmEcho {...p} />);
    fireEvent.click(mode(container, "live"));
    fireEvent.click(ready(container));
    fireEvent.click(tap(container));
    advance(500);
    fireEvent.click(replay(container));
    advance(30000);
    fireEvent.click(ready(container));
    fireEvent.click(tap(container));
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe("");
    advance(1000);
    fireEvent.click(tap(container));
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe(
      "1000",
    );
    rerender(<RhythmEcho {...p} resetToken={1} />);
    expect(game(container).getAttribute("data-rhythm-echo-mode")).toBe(
      "tokens",
    );
    fireEvent.click(mode(container, "live"));
    fireEvent.click(ready(container));
    advance(30000);
    fireEvent.click(tap(container));
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe("");
  });
});

describe("RhythmEcho wrong-tap and page visibility recovery", () => {
  it("an incorrect live interval remains visible and can be undone, reanchored and corrected", () => {
    vi.useFakeTimers();
    const p = props(),
      { container, rerender } = render(<RhythmEcho {...p} />);
    fireEvent.click(mode(container, "live"));
    fireEvent.click(ready(container));
    fireEvent.click(tap(container));
    advance(100);
    fireEvent.click(tap(container));
    advance(1000);
    fireEvent.click(tap(container));
    advance(1000);
    fireEvent.click(tap(container));
    expect(game(container).getAttribute("data-rhythm-echo-won")).toBe("false");
    expect(p.onComplete).not.toHaveBeenCalled();
    expect(container.querySelector(".re-wrong")?.textContent).toContain(
      "0.10 秒",
    );
    rerender(<RhythmEcho {...p} hintToken={1} />);
    expect(container.querySelector(".re-hint")?.textContent).toContain(
      "第 1 个间隔",
    );
    for (let undoToken = 1; undoToken <= 3; undoToken++)
      rerender(<RhythmEcho {...p} hintToken={1} undoToken={undoToken} />);
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe("");
    advance(20000);
    fireEvent.click(tap(container));
    for (let i = 0; i < 3; i++) {
      advance(1000);
      fireEvent.click(tap(container));
    }
    expect(game(container).getAttribute("data-rhythm-echo-won")).toBe("true");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("suspends preview on hidden pages and drops unfinished live intervals on return", () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("visible");
    const p = props(),
      { container, unmount } = render(<RhythmEcho {...p} />);
    fireEvent.click(play(container));
    advance(250);
    visibility.mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(clockCount()).toBe(0);
    advance(20000);
    expect(game(container).getAttribute("data-rhythm-echo-playhead")).toBe("0");
    visibility.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    advance(749);
    expect(game(container).getAttribute("data-rhythm-echo-playhead")).toBe("0");
    advance(1);
    expect(game(container).getAttribute("data-rhythm-echo-playhead")).toBe("1");
    fireEvent.click(ready(container));
    fireEvent.click(mode(container, "live"));
    fireEvent.click(tap(container));
    advance(1000);
    fireEvent.click(tap(container));
    advance(300);
    visibility.mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    advance(20000);
    visibility.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    fireEvent.click(tap(container));
    expect(game(container).getAttribute("data-rhythm-echo-entered")).toBe(
      "1000",
    );
    advance(1000);
    fireEvent.click(tap(container));
    advance(1000);
    fireEvent.click(tap(container));
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    unmount();
    visibility.mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(clockCount()).toBe(0);
    visibility.mockRestore();
  });
});

describe("RhythmEcho keyed round focus recovery", () => {
  it("never moves external Shell focus on reset or level changes", () => {
    const p = props();
    const { container, rerender } = render(
      <>
        <button data-external>Shell level</button>
        <RhythmEcho {...p} />
      </>,
    );
    const shell =
      container.querySelector<HTMLButtonElement>("[data-external]")!;
    const host = container.querySelector<HTMLDivElement>(
      "[data-rhythm-echo-host]",
    )!;
    const focus = vi.spyOn(host, "focus");
    shell.focus();
    rerender(
      <>
        <button data-external>Shell level</button>
        <RhythmEcho {...p} resetToken={1} />
      </>,
    );
    expect(document.activeElement).toBe(shell);
    rerender(
      <>
        <button data-external>Shell level</button>
        <RhythmEcho {...p} resetToken={1} level={1} />
      </>,
    );
    expect(document.activeElement).toBe(shell);
    expect(focus).not.toHaveBeenCalled();
  });
  it("repairs removed internal focus on reset and level changes, using preventScroll", () => {
    const p = props(),
      { container, rerender } = render(<RhythmEcho {...p} />);
    const host = container.querySelector<HTMLDivElement>(
      "[data-rhythm-echo-host]",
    )!;
    const focused = ready(container);
    focused.focus();
    const focus = vi.spyOn(host, "focus");
    rerender(<RhythmEcho {...p} resetToken={1} />);
    expect(focused.isConnected).toBe(false);
    expect(document.activeElement).toBe(host);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    ready(container).focus();
    focus.mockClear();
    rerender(<RhythmEcho {...p} resetToken={1} level={1} />);
    expect(document.activeElement).toBe(host);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});

describe("RhythmEcho disabled-control focus recovery", () => {
  it("recovers Ready, pause, wrong-full and completed token focus without scrolling", () => {
    const p = props(),
      { container, rerender } = render(<RhythmEcho {...p} />);
    const host = container.querySelector<HTMLDivElement>(
      "[data-rhythm-echo-host]",
    )!;
    const focus = vi.spyOn(host, "focus");
    ready(container).focus();
    fireEvent.click(ready(container));
    expect(document.activeElement).toBe(host);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    token(container, 1).focus();
    rerender(<RhythmEcho {...p} paused />);
    expect(document.activeElement).toBe(host);
    rerender(<RhythmEcho {...p} />);
    fireEvent.click(token(container, 2));
    fireEvent.click(token(container, 1));
    token(container, 1).focus();
    fireEvent.click(token(container, 1));
    expect(document.activeElement).toBe(host);
    rerender(<RhythmEcho {...p} resetToken={1} />);
    fireEvent.click(ready(container));
    fireEvent.click(token(container, 1));
    fireEvent.click(token(container, 1));
    token(container, 1).focus();
    fireEvent.click(token(container, 1));
    expect(document.activeElement).toBe(host);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
  });
  it("recovers focused live drum when page visibility suspends input", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("visible");
    const { container } = render(<RhythmEcho {...props()} />);
    fireEvent.click(ready(container));
    fireEvent.click(mode(container, "live"));
    tap(container).focus();
    const host = container.querySelector<HTMLDivElement>(
      "[data-rhythm-echo-host]",
    )!;
    const focus = vi.spyOn(host, "focus");
    visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(document.activeElement).toBe(host);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    visibility.mockRestore();
  });
});
