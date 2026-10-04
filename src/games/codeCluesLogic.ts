// SPDX-License-Identifier: MIT
/** Original bounded symbol deduction rules. Hints deliberately accept public data only. */
export const CODE_SYMBOLS = [
  { glyph: "○", label: "圆" },
  { glyph: "△", label: "三角" },
  { glyph: "□", label: "方" },
  { glyph: "◇", label: "菱" },
  { glyph: "☆", label: "星" },
] as const;
export type CodeFeedback = {
  guess: number[];
  exact: number;
  misplaced: number;
};
export type CodePublic = {
  slots: number;
  symbols: number;
  initialClues: CodeFeedback[];
};
export type CodeLevel = CodePublic & {
  id: string;
  title: string;
  lesson: string;
  secret: number[];
  /** A learning transcript, including wrong exploratory guesses and its final solution. */
  certificate: { guesses: number[][] };
};
export type CodeSnapshot = { draft: number[]; transcript: CodeFeedback[] };
export type CodeState = CodeSnapshot & { history: CodeSnapshot[] };
export const CODE_COMPARISON_LIMIT = 625 * 625;
export function publicCode(level: CodePublic): CodePublic {
  return {
    slots: level.slots,
    symbols: level.symbols,
    initialClues: level.initialClues.map(cloneFeedback),
  };
}
function cloneFeedback(row: CodeFeedback): CodeFeedback {
  return { ...row, guess: [...row.guess] };
}
export function validCode(
  puzzle: CodePublic,
  code: readonly number[],
): boolean {
  return (
    code.length === puzzle.slots &&
    code.every((s) => Number.isInteger(s) && s >= 0 && s < puzzle.symbols)
  );
}
export function validCodePublic(p: CodePublic): boolean {
  return (
    Number.isInteger(p.slots) &&
    p.slots >= 2 &&
    p.slots <= 4 &&
    Number.isInteger(p.symbols) &&
    p.symbols >= 2 &&
    p.symbols <= 5 &&
    p.initialClues.every(
      (c) =>
        validCode(p, c.guess) &&
        Number.isInteger(c.exact) &&
        Number.isInteger(c.misplaced) &&
        c.exact >= 0 &&
        c.misplaced >= 0 &&
        c.exact + c.misplaced <= p.slots,
    )
  );
}
export function codeFeedback(
  secret: readonly number[],
  guess: readonly number[],
): Pick<CodeFeedback, "exact" | "misplaced"> {
  if (
    secret.length !== guess.length ||
    secret.some((n) => !Number.isInteger(n) || n < 0 || n > 4) ||
    guess.some((n) => !Number.isInteger(n) || n < 0 || n > 4)
  )
    throw new Error("Invalid symbol sequence");
  let exact = 0,
    common = 0;
  const a = [0, 0, 0, 0, 0],
    b = [0, 0, 0, 0, 0];
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) exact++;
    a[secret[i]]++;
    b[guess[i]]++;
  }
  for (let i = 0; i < 5; i++) common += Math.min(a[i], b[i]);
  return { exact, misplaced: common - exact };
}
export function codeDomain(p: CodePublic): number[][] {
  if (!validCodePublic(p)) return [];
  const output: number[][] = [];
  for (let value = 0; value < p.symbols ** p.slots; value++) {
    let n = value;
    const code = Array<number>(p.slots);
    for (let slot = p.slots - 1; slot >= 0; slot--) {
      code[slot] = n % p.symbols;
      n = Math.floor(n / p.symbols);
    }
    output.push(code);
  }
  return output;
}
export function codeCandidates(
  p: CodePublic,
  transcript: readonly CodeFeedback[],
): number[][] {
  const clues = [...p.initialClues, ...transcript];
  if (
    clues.some(
      (c) =>
        !validCode(p, c.guess) ||
        !Number.isInteger(c.exact) ||
        !Number.isInteger(c.misplaced) ||
        c.exact < 0 ||
        c.misplaced < 0 ||
        c.exact + c.misplaced > p.slots,
    )
  )
    return [];
  return codeDomain(p).filter((candidate) =>
    clues.every((clue) => {
      const result = codeFeedback(candidate, clue.guess);
      return result.exact === clue.exact && result.misplaced === clue.misplaced;
    }),
  );
}
export const codeLabel = (code: readonly number[]) =>
  code
    .map(
      (s) => `${CODE_SYMBOLS[s]?.glyph ?? "?"}${CODE_SYMBOLS[s]?.label ?? "?"}`,
    )
    .join(" · ");
export const codeWon = (p: CodePublic, state: CodeSnapshot) =>
  state.transcript.at(-1)?.exact === p.slots;
export const createCodeState = (p: CodePublic): CodeState => ({
  draft: Array(p.slots).fill(0),
  transcript: [],
  history: [],
});
function codeSnapshot(s: CodeSnapshot): CodeSnapshot {
  return { draft: [...s.draft], transcript: s.transcript.map(cloneFeedback) };
}
export function editCode(
  p: CodePublic,
  state: CodeState,
  slot: number,
  symbol: number,
): CodeState {
  if (
    codeWon(p, state) ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= p.slots ||
    !Number.isInteger(symbol) ||
    symbol < 0 ||
    symbol >= p.symbols ||
    state.draft[slot] === symbol
  )
    return state;
  const draft = [...state.draft];
  draft[slot] = symbol;
  return {
    draft,
    transcript: state.transcript.map(cloneFeedback),
    history: [...state.history, codeSnapshot(state)],
  };
}
export function submitCode(level: CodeLevel, state: CodeState): CodeState {
  if (
    codeWon(level, state) ||
    !validCode(level, state.draft) ||
    !validCode(level, level.secret)
  )
    return state;
  const guess = [...state.draft],
    feedback = codeFeedback(level.secret, guess);
  return {
    draft: [...guess],
    transcript: [
      ...state.transcript.map(cloneFeedback),
      { guess, ...feedback },
    ],
    history: [...state.history, codeSnapshot(state)],
  };
}
export function undoCode(p: CodePublic, state: CodeState): CodeState {
  if (codeWon(p, state) || !state.history.length) return state;
  return {
    ...codeSnapshot(state.history.at(-1)!),
    history: state.history.slice(0, -1),
  };
}
export type CodeHint = {
  guess: number[] | null;
  candidates: number;
  worst: number;
  comparisons: number;
  text: string;
};
/** Exact ONE-STEP minimax. Stable ties prefer still-possible codes, then lexicographic order.
 * It is not a globally optimal whole-game strategy. A step performs at most `budget` scores. */
export function createCodeSearch(
  p: CodePublic,
  transcript: readonly CodeFeedback[],
) {
  const domain = codeDomain(p),
    candidates = codeCandidates(p, transcript);
  const candidateKeys = new Set(candidates.map((c) => c.join("")));
  let gi = 0,
    ci = 0,
    comparisons = 0,
    bestWorst = Infinity,
    best: number[] | null = null,
    bestPossible = false;
  let groups = new Map<number, number>(),
    worst = 0;
  let done = candidates.length <= 1 || !domain.length;
  if (candidates.length === 1) {
    best = candidates[0];
    bestWorst = 1;
  }
  function result(): CodeHint {
    return {
      guess: best ? [...best] : null,
      candidates: candidates.length,
      worst: Number.isFinite(bestWorst) ? bestWorst : 0,
      comparisons,
      text: !candidates.length
        ? "公开线索与记录相互矛盾，无法给出可靠建议。请撤销最近的提交或重来。"
        : candidates.length === 1
          ? `公开记录只剩 1 种可能：${codeLabel(best!)}。可填入后提交。`
          : `还有 ${candidates.length} 种可能。建议试 ${codeLabel(best!)}；按下一次反馈分组，最大一组有 ${bestWorst} 种。这是单步最坏情况最小的选择，不保证全局最少次数。`,
    };
  }
  return {
    get done() {
      return done;
    },
    get comparisons() {
      return comparisons;
    },
    step(budget = 2048): CodeHint | null {
      if (!Number.isInteger(budget) || budget < 1)
        throw new Error("Positive scoring budget required");
      let used = 0;
      while (!done && used < budget) {
        const feedback = codeFeedback(candidates[ci], domain[gi]);
        const key = feedback.exact * 5 + feedback.misplaced;
        const count = (groups.get(key) ?? 0) + 1;
        groups.set(key, count);
        worst = Math.max(worst, count);
        comparisons++;
        used++;
        ci++;
        if (ci === candidates.length) {
          const possible = candidateKeys.has(domain[gi].join(""));
          if (
            worst < bestWorst ||
            (worst === bestWorst && possible && !bestPossible)
          ) {
            best = domain[gi];
            bestWorst = worst;
            bestPossible = possible;
          }
          gi++;
          ci = 0;
          groups = new Map();
          worst = 0;
          done = gi === domain.length;
        }
      }
      return done ? result() : null;
    },
  };
}
export async function findCodeHint(
  p: CodePublic,
  transcript: readonly CodeFeedback[],
  options: {
    signal?: AbortSignal;
    onProgress?: (comparisons: number) => void;
    chunk?: number;
  } = {},
): Promise<CodeHint | null> {
  const search = createCodeSearch(p, transcript);
  while (true) {
    if (options.signal?.aborted) return null;
    const result = search.step(options.chunk ?? 2048);
    if (options.signal?.aborted) return null;
    if (result) return result;
    options.onProgress?.(search.comparisons);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
