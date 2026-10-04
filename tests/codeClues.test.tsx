// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CodeClues from "../src/games/CodeClues";
import { codeCluesLevels } from "../src/games/codeCluesLevels";
import {
  CODE_COMPARISON_LIMIT,
  codeCandidates,
  codeDomain,
  codeFeedback,
  codeWon,
  createCodeSearch,
  createCodeState,
  editCode,
  findCodeHint,
  publicCode,
  submitCode,
  undoCode,
  validCode,
  validCodePublic,
  type CodeFeedback,
  type CodePublic,
} from "../src/games/codeCluesLogic";
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
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
// Independent feedback: remove exact positions first, then consume unmatched symbols one at a time.
function oracleFeedback(secret: readonly number[], guess: readonly number[]) {
  let exact = 0,
    misplaced = 0;
  const rest: number[] = [],
    pending: number[] = [];
  secret.forEach((s, i) => {
    if (s === guess[i]) exact++;
    else {
      rest.push(s);
      pending.push(guess[i]);
    }
  });
  for (const symbol of pending) {
    const i = rest.indexOf(symbol);
    if (i >= 0) {
      misplaced++;
      rest.splice(i, 1);
    }
  }
  return { exact, misplaced };
}
function independentDomain(slots: number, symbols: number): number[][] {
  let codes: number[][] = [[]];
  for (let i = 0; i < slots; i++)
    codes = codes.flatMap((c) =>
      Array.from({ length: symbols }, (_, s) => [...c, s]),
    );
  return codes;
}
function independentCandidates(p: CodePublic, transcript: CodeFeedback[]) {
  return independentDomain(p.slots, p.symbols).filter((c) =>
    [...p.initialClues, ...transcript].every((row) => {
      const f = oracleFeedback(c, row.guess);
      return f.exact === row.exact && f.misplaced === row.misplaced;
    }),
  );
}
function finishSearch(p: CodePublic, rows: CodeFeedback[] = []) {
  const search = createCodeSearch(p, rows);
  let result = search.step(317);
  while (!result) result = search.step(317);
  return result;
}
function fill(container: HTMLElement, guess: number[]) {
  guess.forEach((symbol, i) =>
    fireEvent.change(
      container.querySelector(`[data-code-clues-slot="${i}"]`)!,
      { target: { value: String(symbol) } },
    ),
  );
}
const submit = (container: HTMLElement) =>
  fireEvent.click(container.querySelector("[data-code-clues-submit]")!);

describe("CodeClues independent deduction and certificates", () => {
  it("has twelve distinct bounded authored learning sequences with meaningful candidate reduction", () => {
    expect(codeCluesLevels).toHaveLength(12);
    expect(new Set(codeCluesLevels.map((l) => l.id)).size).toBe(12);
    expect(new Set(codeCluesLevels.map((l) => l.title)).size).toBe(12);
    expect(codeCluesLevels.map((l) => l.slots)).toEqual([
      2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4,
    ]);
    for (const level of codeCluesLevels) {
      expect(validCodePublic(level)).toBe(true);
      expect(validCode(level, level.secret)).toBe(true);
      expect(codeDomain(level).length).toBeLessThanOrEqual(625);
      level.initialClues.forEach((row) =>
        expect(oracleFeedback(level.secret, row.guess)).toEqual({
          exact: row.exact,
          misplaced: row.misplaced,
        }),
      );
      let state = createCodeState(level);
      const rows: CodeFeedback[] = [],
        counts = [independentCandidates(level, rows).length];
      expect(counts[0]).toBeGreaterThan(1);
      expect(level.certificate.guesses.length).toBeGreaterThanOrEqual(3);
      level.certificate.guesses.forEach((guess, index) => {
        expect(codeWon(level, state)).toBe(false);
        guess.forEach((symbol, slot) => {
          state = editCode(level, freeze(state), slot, symbol);
        });
        state = submitCode(level, freeze(state));
        const feedback = oracleFeedback(level.secret, guess);
        rows.push({ guess, ...feedback });
        counts.push(independentCandidates(level, rows).length);
        expect(state.transcript.at(-1)).toEqual({ guess, ...feedback });
        expect(codeCandidates(level, rows)).toEqual(
          independentCandidates(level, rows),
        );
        expect(codeWon(level, state)).toBe(
          index === level.certificate.guesses.length - 1,
        );
      });
      expect(counts.at(-1)).toBe(1);
      expect(
        counts.filter((n, i) => i > 0 && n < counts[i - 1]).length,
      ).toBeGreaterThanOrEqual(2);
      expect(state.transcript.length).toBe(level.certificate.guesses.length);
    }
  });
  it("matches an independent repeated-symbol oracle exhaustively", () => {
    const codes = independentDomain(4, 3);
    for (const secret of codes)
      for (const guess of codes)
        expect(codeFeedback(secret, guess)).toEqual(
          oracleFeedback(secret, guess),
        );
    expect(codeFeedback([0, 0, 2], [0, 2, 2])).toEqual({
      exact: 2,
      misplaced: 0,
    });
    expect(codeFeedback([0, 0, 1, 2], [1, 1, 0, 0])).toEqual({
      exact: 0,
      misplaced: 3,
    });
    expect(() => codeFeedback([5], [0])).toThrow();
  });
  it("computes exact one-step minimax with stable candidate-first ties", () => {
    for (const level of [
      codeCluesLevels[0],
      codeCluesLevels[4],
      codeCluesLevels[8],
    ]) {
      const candidates = independentCandidates(level, []),
        candidateKeys = new Set(candidates.map((c) => c.join("")));
      const options = independentDomain(level.slots, level.symbols).map(
        (guess) => {
          const groups = new Map<string, number>();
          candidates.forEach((c) => {
            const f = oracleFeedback(c, guess),
              key = `${f.exact}/${f.misplaced}`;
            groups.set(key, (groups.get(key) ?? 0) + 1);
          });
          return {
            guess,
            worst: Math.max(...groups.values()),
            candidate: candidateKeys.has(guess.join("")),
          };
        },
      );
      options.sort(
        (a, b) =>
          a.worst - b.worst ||
          Number(b.candidate) - Number(a.candidate) ||
          a.guess.join("").localeCompare(b.guess.join("")),
      );
      const hint = finishSearch(publicCode(level));
      expect(hint.guess).toEqual(options[0].guess);
      expect(hint.worst).toBe(options[0].worst);
      expect(hint.text).toContain("不保证全局");
    }
  });
  it("bounds and chunks the maximum 625 by 625 comparison without truncating", () => {
    const p = { slots: 4, symbols: 5, initialClues: [] },
      search = createCodeSearch(p, []);
    expect(search.step(37)).toBeNull();
    expect(search.comparisons).toBe(37);
    let result = search.step(2048);
    while (!result) result = search.step(2048);
    expect(result.comparisons).toBe(CODE_COMPARISON_LIMIT);
    expect(result.candidates).toBe(625);
    expect(result.guess).toHaveLength(4);
    expect(() => search.step(0)).toThrow();
  });
  it("cannot learn the secret or certificate: identical public transcripts produce identical hints", () => {
    for (const level of codeCluesLevels) {
      const first = level.certificate.guesses[0],
        rows = [{ guess: [...first], ...oracleFeedback(level.secret, first) }];
      const corrupted = {
        ...level,
        secret: Array(level.slots).fill(99),
        certificate: { guesses: [[99]] },
      };
      expect(finishSearch(publicCode(corrupted), rows)).toEqual(
        finishSearch(publicCode(level), rows),
      );
      const guarded = {
        ...level,
        get secret(): number[] {
          throw new Error("Secret accessed by hint");
        },
        get certificate(): { guesses: number[][] } {
          throw new Error("Certificate accessed by hint");
        },
      };
      expect(finishSearch(publicCode(guarded), rows)).toEqual(
        finishSearch(publicCode(level), rows),
      );
    }
  });
  it("handles contradictions, one candidate and cancellation honestly", async () => {
    const p = { slots: 2, symbols: 2, initialClues: [] };
    const contradiction = finishSearch(p, [
      { guess: [0, 0], exact: 2, misplaced: 0 },
      { guess: [0, 0], exact: 0, misplaced: 0 },
    ]);
    expect(contradiction.guess).toBeNull();
    expect(contradiction.text).toContain("矛盾");
    expect(
      finishSearch(p, [{ guess: [0, 1], exact: 2, misplaced: 0 }]).guess,
    ).toEqual([0, 1]);
    const controller = new AbortController(),
      work = findCodeHint({ slots: 4, symbols: 5, initialClues: [] }, [], {
        signal: controller.signal,
        chunk: 1,
      });
    controller.abort();
    expect(await work).toBeNull();
    expect(
      codeCandidates(p, [{ guess: [8, 0], exact: 0, misplaced: 0 }]),
    ).toEqual([]);
    expect(validCodePublic({ slots: 5, symbols: 5, initialClues: [] })).toBe(
      false,
    );
  });
  it("keeps immutable edit/submit history, accepts any winning sequence, and blocks post-win mutations", () => {
    const l = codeCluesLevels[0],
      original = freeze(createCodeState(l));
    expect(editCode(l, original, -1, 0)).toBe(original);
    expect(editCode(l, original, 0, 7)).toBe(original);
    const changed = editCode(l, original, 0, 2),
      submitted = submitCode(l, freeze(changed));
    expect(original.transcript).toEqual([]);
    expect(changed.transcript).toEqual([]);
    expect(undoCode(l, submitted)).toEqual(changed);
    expect(undoCode(l, changed)).toEqual(original);
    let alternate = editCode(l, original, 1, 1);
    alternate = submitCode(l, alternate);
    expect(codeWon(l, alternate)).toBe(true);
    expect(alternate.transcript).toHaveLength(1);
    expect(undoCode(l, alternate)).toBe(alternate);
    expect(editCode(l, alternate, 0, 2)).toBe(alternate);
    expect(submitCode(l, alternate)).toBe(alternate);
  });
});

describe("CodeClues rendered play and interruptions", () => {
  it.each(codeCluesLevels.map((l, i) => [i, l] as const))(
    "replays all learning guesses for level %i through labelled controls",
    (index, level) => {
      const p = { ...props(), level: index },
        view = render(<CodeClues {...p} />);
      level.certificate.guesses.forEach((guess, step) => {
        fill(view.container, guess);
        submit(view.container);
        expect(
          view.container.querySelectorAll(".cc-history .cc-feedback"),
        ).toHaveLength(step + 1);
        const row = view.container.querySelectorAll(".cc-history .cc-feedback")[
          step
        ];
        const f = oracleFeedback(level.secret, guess);
        expect(row.textContent).toContain(`就位 ${f.exact}`);
        expect(row.textContent).toContain(`错位 ${f.misplaced}`);
        if (step < level.certificate.guesses.length - 1)
          expect(p.onComplete).not.toHaveBeenCalled();
      });
      expect(
        view.container.querySelector("[data-code-clues-won=true]"),
      ).not.toBeNull();
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      submit(view.container);
      view.rerender(<CodeClues {...p} undoToken={1} />);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        view.container.querySelector("[data-code-clues-won=true]"),
      ).not.toBeNull();
      expect(
        view.container.querySelector(".cc-history")?.textContent,
      ).toContain("错位");
    },
  );
  it("supports keyboard selection and one completion per StrictMode round", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(
        <StrictMode>
          <CodeClues {...p} />
        </StrictMode>,
      );
    const second = view.getByLabelText("第 2 格符号");
    await user.selectOptions(second, "1");
    const button = view.getByRole("button", { name: "提交这组猜测" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <CodeClues {...p} resetToken={2} />
      </StrictMode>,
    );
    fill(view.container, [0, 1]);
    submit(view.container);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
  });
  it("reveals each new feedback row without stealing focus or preventing manual history scrolling", async () => {
    const user = userEvent.setup(),
      p = props(),
      view = render(<CodeClues {...p} />),
      history = view.getByRole("list", {
        name: "猜测与反馈记录，可滚动回看",
      });
    // jsdom has no layout; give the transcript increasing scroll geometry.
    Object.defineProperty(history, "scrollHeight", {
      configurable: true,
      get: () => history.querySelectorAll(".cc-feedback").length * 120,
    });
    await user.tab();
    await user.tab();
    await user.tab();
    const control = view.getByRole("button", { name: "提交这组猜测" });
    expect(document.activeElement).toBe(control);
    for (let i = 1; i <= 7; i++) {
      await user.keyboard("{Enter}");
      expect(history.scrollTop).toBe(i * 120);
      expect(document.activeElement).toBe(control);
      expect(history.lastElementChild?.textContent).toContain(
        `第 ${i} 次 · 最新反馈`,
      );
      expect(history.textContent?.match(/最新反馈/g)).toHaveLength(1);
    }
    await user.tab();
    expect(document.activeElement).toBe(history);
    history.scrollTop = 20;
    fireEvent.scroll(history);
    // Unrelated state changes must not snap the reader back to the bottom.
    view.rerender(<CodeClues {...p} paused />);
    view.rerender(<CodeClues {...p} />);
    expect(history.scrollTop).toBe(20);
    expect(document.activeElement).toBe(history);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(control);
    await user.keyboard("{Enter}");
    expect(history.scrollTop).toBe(960);
    expect(document.activeElement).toBe(control);
    view.rerender(<CodeClues {...p} undoToken={1} />);
    expect(history.scrollTop).toBe(840);
    expect(history.lastElementChild?.textContent).toContain(
      "第 7 次 · 最新反馈",
    );
    expect(document.activeElement).toBe(control);
  });
  it("undoes edits and submissions and consumes paused tokens without replay", () => {
    const p = props(),
      view = render(<CodeClues {...p} />);
    fill(view.container, [2, 0]);
    submit(view.container);
    view.rerender(<CodeClues {...p} undoToken={1} />);
    expect(
      view.container.querySelector("[data-code-clues-guesses='0']"),
    ).not.toBeNull();
    expect(
      (view.getByLabelText("第 1 格符号") as HTMLSelectElement).value,
    ).toBe("2");
    view.rerender(<CodeClues {...p} paused undoToken={2} hintToken={1} />);
    expect(
      (view.getByRole("button", { name: "提交这组猜测" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    view.rerender(<CodeClues {...p} undoToken={2} hintToken={1} />);
    expect(
      (view.getByLabelText("第 1 格符号") as HTMLSelectElement).value,
    ).toBe("2");
    view.rerender(<CodeClues {...p} undoToken={3} hintToken={1} />);
    expect(
      (view.getByLabelText("第 1 格符号") as HTMLSelectElement).value,
    ).toBe("0");
  });
  it.each(["edit", "pause", "reset", "level", "cancel", "unmount"])(
    "invalidates pending chunked hints on %s",
    async (action) => {
      vi.useFakeTimers();
      const p = { ...props(), level: 11 },
        view = render(<CodeClues {...p} />);
      view.rerender(<CodeClues {...p} hintToken={1} />);
      expect(
        view.container.querySelector("[data-code-clues-cancel]"),
      ).not.toBeNull();
      if (action === "edit") fill(view.container, [1, 0, 0, 0]);
      if (action === "pause")
        view.rerender(<CodeClues {...p} hintToken={1} paused />);
      if (action === "reset")
        view.rerender(<CodeClues {...p} hintToken={1} resetToken={1} />);
      if (action === "level")
        view.rerender(<CodeClues {...p} hintToken={1} level={0} />);
      if (action === "cancel")
        fireEvent.click(
          view.container.querySelector("[data-code-clues-cancel]")!,
        );
      if (action === "unmount") view.unmount();
      const statuses = p.onStatus.mock.calls.length;
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(view.container.querySelector("[data-code-clues-hint]")).toBeNull();
      expect(p.onStatus.mock.calls.length).toBe(statuses);
    },
  );
  it("shows a completed public hint and fills it only on explicit request", async () => {
    const p = props(),
      view = render(<CodeClues {...p} />);
    view.rerender(<CodeClues {...p} hintToken={1} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      view.container.querySelector("[data-code-clues-hint]")?.textContent,
    ).toContain("单步");
    fireEvent.click(
      view.container.querySelector("[data-code-clues-use-hint]")!,
    );
    expect(
      view.container.querySelector("[data-code-clues-guesses='0']"),
    ).not.toBeNull();
    expect(view.container.querySelector("[data-code-clues-hint]")).toBeNull();
  });
});
