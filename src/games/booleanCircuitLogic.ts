// SPDX-License-Identifier: GPL-3.0-only
/** Original acyclic circuit puzzles. Gate indices only point backwards. */
export type CircuitOp = "AND" | "OR" | "NOT";
export type CircuitSource = "A" | "B" | "C" | `g${number}`;
export type CircuitGate = {
  op: CircuitOp | null;
  a: CircuitSource | null;
  b: CircuitSource | null;
};
export type CircuitLevel = {
  title: string;
  inputs: ("A" | "B" | "C")[];
  target: number[];
  lesson: string;
  solution: CircuitGate[];
};
export type CircuitState = { gates: CircuitGate[]; history: CircuitGate[][] };
export type CircuitMove =
  | { gate: number; field: "op"; value: CircuitOp }
  | { gate: number; field: "a" | "b"; value: CircuitSource };
export const circuitOps: CircuitOp[] = ["AND", "OR", "NOT"];
export const circuitOpLabels: Record<CircuitOp, string> = {
  AND: "与 AND",
  OR: "或 OR",
  NOT: "非 NOT",
};
export const CIRCUIT_MAX_GATES = 7;
export const circuitSourceLabel = (source: CircuitSource) =>
  source.startsWith("g")
    ? `门 ${Number(source.slice(1)) + 1}`
    : `输入 ${source}`;
export function circuitSources(
  level: CircuitLevel,
  gate: number,
): CircuitSource[] {
  return [
    ...level.inputs,
    ...Array.from({ length: gate }, (_, i) => `g${i}` as CircuitSource),
  ];
}
export function circuitInputs(
  level: CircuitLevel,
  row: number,
): Record<string, number> {
  return Object.fromEntries(
    level.inputs.map((name, i) => [
      name,
      (row >> (level.inputs.length - 1 - i)) & 1,
    ]),
  );
}
export function validCircuitLevel(level: CircuitLevel): boolean {
  return (
    level.inputs.length >= 1 &&
    level.inputs.length <= 3 &&
    new Set(level.inputs).size === level.inputs.length &&
    level.inputs.every((i) => ["A", "B", "C"].includes(i)) &&
    level.solution.length >= 1 &&
    level.solution.length <= CIRCUIT_MAX_GATES &&
    level.target.length === 2 ** level.inputs.length &&
    level.target.every((n) => n === 0 || n === 1)
  );
}
export function validCircuitGates(
  level: CircuitLevel,
  gates: readonly CircuitGate[],
): boolean {
  return (
    validCircuitLevel(level) &&
    gates.length === level.solution.length &&
    gates.every((gate, i) => {
      const sources = circuitSources(level, i);
      return (
        (gate.op === null || circuitOps.includes(gate.op)) &&
        (gate.a === null || sources.includes(gate.a)) &&
        (gate.b === null || sources.includes(gate.b))
      );
    })
  );
}
/** Null means an unconnected gate, never a guessed Boolean value. */
export function evaluateCircuit(
  level: CircuitLevel,
  gates: readonly CircuitGate[],
  row: number,
): (number | null)[] {
  if (
    !validCircuitGates(level, gates) ||
    !Number.isInteger(row) ||
    row < 0 ||
    row >= level.target.length
  )
    return [];
  const values: Record<string, number | null> = circuitInputs(level, row);
  return gates.map((gate, i) => {
    const a = gate.a === null ? null : values[gate.a],
      b = gate.b === null ? null : values[gate.b];
    const out =
      gate.op === null || a === null || (gate.op !== "NOT" && b === null)
        ? null
        : gate.op === "NOT"
          ? 1 - a
          : gate.op === "AND"
            ? a & b!
            : a | b!;
    values[`g${i}`] = out;
    return out;
  });
}
export function circuitTruthTable(
  level: CircuitLevel,
  gates: readonly CircuitGate[],
): (number | null)[] {
  return level.target.map(
    (_, row) => evaluateCircuit(level, gates, row).at(-1) ?? null,
  );
}
export function circuitWon(
  level: CircuitLevel,
  gates: readonly CircuitGate[],
): boolean {
  return (
    validCircuitGates(level, gates) &&
    gates.every((g) => g.op && g.a && (g.op === "NOT" || g.b)) &&
    circuitTruthTable(level, gates).every(
      (bit, row) => bit === level.target[row],
    )
  );
}
const cloneGates = (gates: readonly CircuitGate[]) =>
  gates.map((gate) => ({ ...gate }));
export const createCircuitState = (level: CircuitLevel): CircuitState => ({
  gates: level.solution.map(() => ({ op: null, a: null, b: null })),
  history: [],
});
export function applyCircuitMove(
  level: CircuitLevel,
  gates: readonly CircuitGate[],
  move: CircuitMove,
): CircuitGate[] | null {
  if (
    !validCircuitGates(level, gates) ||
    !Number.isInteger(move.gate) ||
    move.gate < 0 ||
    move.gate >= gates.length
  )
    return null;
  if (
    move.field === "op"
      ? !circuitOps.includes(move.value)
      : (move.field !== "a" && move.field !== "b") ||
        !circuitSources(level, move.gate).includes(move.value)
  )
    return null;
  if (move.field === "b" && gates[move.gate].op === "NOT") return null;
  if (gates[move.gate][move.field] === move.value) return null;
  const next = cloneGates(gates);
  if (move.field === "op") next[move.gate].op = move.value;
  else next[move.gate][move.field] = move.value;
  return next;
}
export function moveCircuit(
  level: CircuitLevel,
  state: CircuitState,
  move: CircuitMove,
): CircuitState {
  if (circuitWon(level, state.gates)) return state;
  const gates = applyCircuitMove(level, state.gates, move);
  return gates
    ? { gates, history: [...state.history, cloneGates(state.gates)] }
    : state;
}
export function undoCircuit(state: CircuitState): CircuitState {
  const gates = state.history.at(-1);
  return gates
    ? { gates: cloneGates(gates), history: state.history.slice(0, -1) }
    : state;
}
/** Bounded constructive hint: at most 3 × 7 comparisons. It openly follows a
 * certified design, rather than claiming to preserve every existing wire. */
export function circuitNextMove(
  level: CircuitLevel,
  gates: readonly CircuitGate[],
): CircuitMove | null {
  if (!validCircuitGates(level, gates) || circuitWon(level, gates)) return null;
  for (let gate = 0; gate < level.solution.length; gate++) {
    const goal = level.solution[gate],
      current = gates[gate];
    if (goal.op && current.op !== goal.op)
      return { gate, field: "op", value: goal.op };
    if (goal.a && current.a !== goal.a)
      return { gate, field: "a", value: goal.a };
    if (goal.op !== "NOT" && goal.b && current.b !== goal.b)
      return { gate, field: "b", value: goal.b };
  }
  return null;
}
export function circuitHint(
  level: CircuitLevel,
  gates: readonly CircuitGate[],
): string {
  if (circuitWon(level, gates)) return "全部输入组合都匹配了！";
  const move = circuitNextMove(level, gates);
  if (!move) return "当前电路无法检查，请重置后再试。";
  return `沿一条已验证的设计：门 ${move.gate + 1}${move.field === "op" ? `改为${circuitOpLabels[move.value]}` : `的${move.field === "a" ? "左" : "右"}端接${circuitSourceLabel(move.value)}`}。后续可能还要调整其他接线；这不一定是唯一答案。`;
}
const gate = (
  op: CircuitOp,
  a: CircuitSource,
  b: CircuitSource | null = null,
): CircuitGate => ({ op, a, b });
// Every target is explicitly authored. Tests use independent predicates and a
// separate interpreter to verify these constructive certificates.
export const booleanCircuitLevels: CircuitLevel[] = [
  {
    title: "双钥匙",
    inputs: ["A", "B"],
    target: [0, 0, 0, 1],
    lesson: "两把钥匙必须同时打开。与门只有在两个输入都是 1 时才输出 1。",
    solution: [gate("AND", "A", "B")],
  },
  {
    title: "任意通行",
    inputs: ["A", "B"],
    target: [0, 1, 1, 1],
    lesson: "任意一位访客按下开关就亮灯。或门允许两个开关同时打开。",
    solution: [gate("OR", "A", "B")],
  },
  {
    title: "夜间路灯",
    inputs: ["A"],
    target: [1, 0],
    lesson: "A 是白昼传感器。白天熄灯，夜晚开灯：用非门把信号反过来。",
    solution: [gate("NOT", "A")],
  },
  {
    title: "未全部到齐",
    inputs: ["A", "B"],
    target: [1, 1, 1, 0],
    lesson: "只要还有一个位置空着，就显示提醒。先判断全部到齐，再把判断反转。",
    solution: [gate("AND", "A", "B"), gate("NOT", "g0")],
  },
  {
    title: "安静探测器",
    inputs: ["A", "B"],
    target: [1, 0, 0, 0],
    lesson:
      "只有两个传感器都没有活动，安静灯才亮。门的输出可以成为下一扇门的输入。",
    solution: [gate("OR", "A", "B"), gate("NOT", "g0")],
  },
  {
    title: "许可与否决",
    inputs: ["A", "B"],
    target: [0, 0, 1, 0],
    lesson: "A 给出许可，B 发出否决。只有有许可而且没有否决时，通行灯才亮。",
    solution: [gate("NOT", "B"), gate("AND", "A", "g0")],
  },
  {
    title: "值班开关",
    inputs: ["A", "B", "C"],
    target: [0, 0, 0, 1, 0, 1, 0, 1],
    lesson:
      "A 或 B 发出请求后，还要 C 值班才能处理。三输入要检查全部八种情况。",
    solution: [gate("OR", "A", "B"), gate("AND", "g0", "C")],
  },
  {
    title: "共同伙伴",
    inputs: ["A", "B", "C"],
    target: [0, 0, 0, 1, 0, 0, 1, 1],
    lesson:
      "两支队伍分别是 A+B 和 B+C。至少一支完整队伍到场才开门。试着复用 B 信号。",
    solution: [
      gate("AND", "A", "B"),
      gate("AND", "B", "C"),
      gate("OR", "g0", "g1"),
    ],
  },
  {
    title: "恰好一个",
    inputs: ["A", "B"],
    target: [0, 1, 1, 0],
    lesson:
      "只能有一个请求，两个同时请求也不行。组合“至少一个”和“不是两个”来造出异或。",
    solution: [
      gate("OR", "A", "B"),
      gate("AND", "A", "B"),
      gate("NOT", "g1"),
      gate("AND", "g0", "g2"),
    ],
  },
  {
    title: "信号选择器",
    inputs: ["A", "B", "C"],
    target: [0, 1, 0, 1, 0, 0, 1, 1],
    lesson:
      "A 为 1 时输出跟随 B；A 为 0 时跟随 C。两条互斥的通路可以汇合到或门。",
    solution: [
      gate("NOT", "A"),
      gate("AND", "A", "B"),
      gate("AND", "g0", "C"),
      gate("OR", "g1", "g2"),
    ],
  },
  {
    title: "多数表决",
    inputs: ["A", "B", "C"],
    target: [0, 0, 0, 1, 0, 1, 1, 1],
    lesson:
      "三票里至少两票同意才通过。检查 AB、AC、BC 三种配对，再把结果汇合。",
    solution: [
      gate("AND", "A", "B"),
      gate("AND", "A", "C"),
      gate("AND", "B", "C"),
      gate("OR", "g0", "g1"),
      gate("OR", "g3", "g2"),
    ],
  },
  {
    title: "双人舱检验",
    inputs: ["A", "B", "C"],
    target: [0, 0, 0, 1, 0, 1, 1, 0],
    lesson:
      "舱内恰好两人才合格。组合“至少两人”与“并非三人”，并复用已建好的中间信号。",
    solution: [
      gate("AND", "A", "B"),
      gate("OR", "A", "B"),
      gate("AND", "g1", "C"),
      gate("OR", "g0", "g2"),
      gate("AND", "g0", "C"),
      gate("NOT", "g4"),
      gate("AND", "g3", "g5"),
    ],
  },
];
