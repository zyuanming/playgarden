/** Original number-combining puzzles. Fractions are normalized exactly, never rounded. */
export type Rational = { numerator: number; denominator: number };
export type ArithmeticOperator = "+" | "−" | "×" | "÷";
export type ArithmeticToken = {
  id: string;
  value: Rational;
  expression: string;
  /** Indexes of the original cards, so equal-valued cards remain distinct. */
  leaves: number[];
};
export type ArithmeticMove = {
  leftId: string;
  rightId: string;
  operator: ArithmeticOperator;
};
export type ArithmeticSnapshot = {
  tokens: ArithmeticToken[];
  nextId: number;
};
export type ArithmeticState = ArithmeticSnapshot & {
  target: Rational;
  history: ArithmeticSnapshot[];
  log: string[];
};
export type ArithmeticLevel = {
  title: string;
  numbers: [number, number, number, number];
  target: number;
  idea: string;
  solution: ArithmeticMove[];
};

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return Math.abs(a);
}
export function rational(numerator: number, denominator = 1): Rational {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    denominator === 0
  )
    throw new RangeError(
      "A rational needs safe integers and a nonzero denominator.",
    );
  if (numerator === 0) return { numerator: 0, denominator: 1 };
  const divisor = gcd(numerator, denominator);
  const sign = denominator < 0 ? -1 : 1;
  return {
    numerator: (sign * numerator) / divisor,
    denominator: (sign * denominator) / divisor,
  };
}
export function rationalEqual(a: Rational, b: Rational): boolean {
  // All arithmetic results are normalized; this also accepts equivalent input fractions.
  const left = rational(a.numerator, a.denominator),
    right = rational(b.numerator, b.denominator);
  return (
    left.numerator === right.numerator && left.denominator === right.denominator
  );
}
export function formatRational(value: Rational): string {
  return value.denominator === 1
    ? String(value.numerator)
    : `${value.numerator}/${value.denominator}`;
}
export function calculateRational(
  a: Rational,
  b: Rational,
  operator: ArithmeticOperator,
): Rational | null {
  let numerator: number, denominator: number;
  switch (operator) {
    case "+":
      numerator = a.numerator * b.denominator + b.numerator * a.denominator;
      denominator = a.denominator * b.denominator;
      break;
    case "−":
      numerator = a.numerator * b.denominator - b.numerator * a.denominator;
      denominator = a.denominator * b.denominator;
      break;
    case "×":
      numerator = a.numerator * b.numerator;
      denominator = a.denominator * b.denominator;
      break;
    case "÷":
      if (b.numerator === 0) return null;
      numerator = a.numerator * b.denominator;
      denominator = a.denominator * b.numerator;
      break;
    default:
      return null;
  }
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator))
    return null;
  return rational(numerator, denominator);
}
export function createArithmeticState(
  level: Pick<ArithmeticLevel, "numbers" | "target">,
): ArithmeticState {
  return {
    target: rational(level.target),
    tokens: level.numbers.map((value, index) => ({
      id: `n${index}`,
      value: rational(value),
      expression: String(value),
      leaves: [index],
    })),
    nextId: 0,
    history: [],
    log: [],
  };
}
export function isArithmeticSolved(state: ArithmeticState): boolean {
  return (
    state.tokens.length === 1 &&
    rationalEqual(state.tokens[0].value, state.target)
  );
}
export function arithmeticMove(
  state: ArithmeticState,
  move: ArithmeticMove,
): ArithmeticState {
  if (isArithmeticSolved(state) || move.leftId === move.rightId) return state;
  const left = state.tokens.find((token) => token.id === move.leftId);
  const right = state.tokens.find((token) => token.id === move.rightId);
  if (!left || !right) return state;
  const value = calculateRational(left.value, right.value, move.operator);
  if (!value) return state;
  const token: ArithmeticToken = {
    id: `m${state.nextId}`,
    value,
    expression: `(${left.expression} ${move.operator} ${right.expression})`,
    leaves: [...left.leaves, ...right.leaves],
  };
  return {
    ...state,
    tokens: [
      ...state.tokens.filter(
        (item) => item.id !== left.id && item.id !== right.id,
      ),
      token,
    ],
    nextId: state.nextId + 1,
    history: [...state.history, { tokens: state.tokens, nextId: state.nextId }],
    log: [
      ...state.log,
      `${formatRational(left.value)} ${move.operator} ${formatRational(right.value)} = ${formatRational(value)}`,
    ],
  };
}
export function undoArithmetic(state: ArithmeticState): ArithmeticState {
  const previous = state.history.at(-1);
  return previous
    ? {
        ...state,
        ...previous,
        history: state.history.slice(0, -1),
        log: state.log.slice(0, -1),
      }
    : state;
}

/** A complete exact DFS from the CURRENT cards. Returned IDs can be clicked in order. */
export function solveArithmetic(
  state: ArithmeticState,
): ArithmeticMove[] | null {
  const deadEnds = new Set<string>();
  function search(current: ArithmeticState): ArithmeticMove[] | null {
    if (isArithmeticSolved(current)) return [];
    if (current.tokens.length <= 1) return null;
    const key = current.tokens
      .map((token) => formatRational(token.value))
      .sort()
      .join(";");
    if (deadEnds.has(key)) return null;
    for (let i = 0; i < current.tokens.length; i++) {
      for (let j = i + 1; j < current.tokens.length; j++) {
        const a = current.tokens[i],
          b = current.tokens[j];
        const candidates: ArithmeticMove[] = [
          { leftId: a.id, rightId: b.id, operator: "+" },
          { leftId: a.id, rightId: b.id, operator: "×" },
          { leftId: a.id, rightId: b.id, operator: "−" },
          { leftId: b.id, rightId: a.id, operator: "−" },
          { leftId: a.id, rightId: b.id, operator: "÷" },
          { leftId: b.id, rightId: a.id, operator: "÷" },
        ];
        const seenValues = new Set<string>();
        for (const move of candidates) {
          const next = arithmeticMove(current, move);
          if (next === current) continue;
          const result = formatRational(next.tokens.at(-1)!.value);
          if (seenValues.has(result)) continue;
          seenValues.add(result);
          const remaining = search(next);
          if (remaining !== null) return [move, ...remaining];
        }
      }
    }
    deadEnds.add(key);
    return null;
  }
  return search(state);
}
export type ArithmeticHint =
  { move: ArithmeticMove; undoSteps: 0 } | { move: null; undoSteps: number };
export function arithmeticHint(state: ArithmeticState): ArithmeticHint {
  const solution = solveArithmetic(state);
  if (solution !== null) return { move: solution[0] ?? null, undoSteps: 0 };
  let previous = state;
  for (let undoSteps = 1; undoSteps <= state.history.length; undoSteps++) {
    previous = undoArithmetic(previous);
    if (solveArithmetic(previous) !== null) return { move: null, undoSteps };
  }
  return { move: null, undoSteps: 0 };
}

const move = (
  leftId: string,
  operator: ArithmeticOperator,
  rightId: string,
): ArithmeticMove => ({ leftId, rightId, operator });
export const arithmeticLevels: ArithmeticLevel[] = [
  {
    title: "加在一起",
    numbers: [1, 2, 3, 4],
    target: 10,
    idea: "先从加法出发，让四张卡片变成一个数。",
    solution: [
      move("n0", "+", "n1"),
      move("m0", "+", "n2"),
      move("m1", "+", "n3"),
    ],
  },
  {
    title: "先凑一个六",
    numbers: [2, 3, 4, 1],
    target: 12,
    idea: "有时先加再减，能得到适合相乘的小伙伴。",
    solution: [
      move("n2", "+", "n1"),
      move("m0", "−", "n3"),
      move("m1", "×", "n0"),
    ],
  },
  {
    title: "两份小礼物",
    numbers: [2, 2, 3, 3],
    target: 12,
    idea: "数字相同的卡片也是不同的两张，都要用到。",
    solution: [
      move("n0", "×", "n2"),
      move("n1", "×", "n3"),
      move("m0", "+", "m1"),
    ],
  },
  {
    title: "向二十四出发",
    numbers: [1, 2, 3, 4],
    target: 24,
    idea: "想一想，哪两个数相乘能得到 24？",
    solution: [
      move("n0", "+", "n2"),
      move("n1", "+", "n3"),
      move("m0", "×", "m1"),
    ],
  },
  {
    title: "成双成对",
    numbers: [3, 3, 4, 4],
    target: 24,
    idea: "把卡片分成两组，每组先做一次运算。",
    solution: [
      move("n0", "×", "n2"),
      move("n1", "×", "n3"),
      move("m0", "+", "m1"),
    ],
  },
  {
    title: "搭一座小桥",
    numbers: [2, 4, 6, 8],
    target: 24,
    idea: "中间结果可以比目标大，再慢慢走回来。",
    solution: [
      move("n3", "×", "n1"),
      move("m0", "−", "n2"),
      move("m1", "−", "n0"),
    ],
  },
  {
    title: "负数也能帮忙",
    numbers: [2, 5, 3, 9],
    target: 24,
    idea: "小数减大数会得到负数，它也是合法的卡片。",
    solution: [
      move("n0", "−", "n1"),
      move("n2", "×", "n3"),
      move("m0", "+", "m1"),
    ],
  },
  {
    title: "乘法遇见除法",
    numbers: [2, 2, 6, 6],
    target: 24,
    idea: "把一个大数分成小份，再和另一组合作。",
    solution: [
      move("n2", "+", "n0"),
      move("n3", "÷", "n1"),
      move("m0", "×", "m1"),
    ],
  },
  {
    title: "四分之一的魔法",
    numbers: [1, 3, 4, 6],
    target: 24,
    idea: "分数不需要变成小数。除以小于 1 的数，结果会变大。",
    solution: [
      move("n1", "÷", "n2"),
      move("n0", "−", "m0"),
      move("n3", "÷", "m1"),
    ],
  },
  {
    title: "五的巧思",
    numbers: [1, 5, 5, 5],
    target: 24,
    idea: "先保留一个小小的分数，最后再相乘。",
    solution: [
      move("n0", "÷", "n1"),
      move("n2", "−", "m0"),
      move("m1", "×", "n3"),
    ],
  },
  {
    title: "三分之一的路",
    numbers: [3, 3, 8, 8],
    target: 24,
    idea: "相同的数字也能搭出不一样的分数。",
    solution: [
      move("n2", "÷", "n0"),
      move("n1", "−", "m0"),
      move("n3", "÷", "m1"),
    ],
  },
  {
    title: "从一百回来",
    numbers: [10, 10, 4, 4],
    target: 24,
    idea: "大胆试试较大的中间数，最后把它分成几份。",
    solution: [
      move("n0", "×", "n1"),
      move("m0", "−", "n2"),
      move("m1", "÷", "n3"),
    ],
  },
];
export const arithmeticSolutions = arithmeticLevels.map(
  (level) => level.solution,
);
export function verifyArithmeticLevel(level: ArithmeticLevel): boolean {
  if (level.numbers.length !== 4 || level.solution.length !== 3) return false;
  let state = createArithmeticState(level);
  for (const step of level.solution) {
    const next = arithmeticMove(state, step);
    if (next === state) return false;
    state = next;
  }
  return (
    isArithmeticSolved(state) &&
    [...state.tokens[0].leaves].sort().join(",") === "0,1,2,3"
  );
}
