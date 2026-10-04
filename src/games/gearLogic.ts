/** A stage is an external mesh or an external mesh with ONE idler. Consecutive
 * stages are connected by a rigid shared shaft, not another gear mesh. */
export type GearFraction = { numerator: number; denominator: number };
export type GearStage = { driver: number[]; driven: number[]; idler: number[] };
export type GearSetting = {
  driver: number | null;
  driven: number | null;
  idler: number | null;
};
export type GearLevel = {
  title: string;
  input: GearFraction;
  target: GearFraction;
  stages: GearStage[];
  solution: GearSetting[];
  idea: string;
};
export type GearState = { settings: GearSetting[]; history: GearSetting[][] };
export type GearPart = keyof GearSetting;
export type GearMove = { stage: number; part: GearPart; teeth: number };
export const GEAR_SEARCH_LIMIT = 200_000;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export function gearFraction(numerator: number, denominator = 1): GearFraction {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    !denominator
  )
    throw new RangeError("Invalid exact gear fraction");
  const divisor = gcd(Math.abs(numerator), Math.abs(denominator));
  return {
    numerator:
      numerator === 0 ? 0 : (numerator / divisor) * Math.sign(denominator),
    denominator: Math.abs(denominator) / divisor,
  };
}
export function multiplyGearFractions(
  a: GearFraction,
  b: GearFraction,
): GearFraction {
  // Cross-cancel before multiplication so representable results remain exact.
  const left = gearFraction(a.numerator, a.denominator),
    right = gearFraction(b.numerator, b.denominator);
  const g1 = gcd(Math.abs(left.numerator), right.denominator),
    g2 = gcd(Math.abs(right.numerator), left.denominator);
  return gearFraction(
    (left.numerator / g1) * (right.numerator / g2),
    (left.denominator / g2) * (right.denominator / g1),
  );
}
export function equalGearFractions(a: GearFraction, b: GearFraction): boolean {
  const x = gearFraction(a.numerator, a.denominator),
    y = gearFraction(b.numerator, b.denominator);
  return x.numerator === y.numerator && x.denominator === y.denominator;
}
export function formatGearFraction(
  value: GearFraction,
  magnitude = false,
): string {
  const n = magnitude ? Math.abs(value.numerator) : value.numerator;
  return value.denominator === 1 ? String(n) : `${n}/${value.denominator}`;
}
export function gearDirection(value: GearFraction): string {
  return value.numerator < 0
    ? "逆时针"
    : value.numerator > 0
      ? "顺时针"
      : "静止";
}
const stage = (driver: number[], driven: number[], idler = [0]): GearStage => ({
  driver,
  driven,
  idler,
});
const setting = (driver: number, driven: number, idler = 0): GearSetting => ({
  driver,
  driven,
  idler,
});
function level(
  title: string,
  input: number,
  target: number | [number, number],
  stages: GearStage[],
  solution: GearSetting[],
  idea: string,
): GearLevel {
  return {
    title,
    input: gearFraction(input),
    target: Array.isArray(target)
      ? gearFraction(...target)
      : gearFraction(target),
    stages,
    solution,
    idea,
  };
}
export const gearLevels: GearLevel[] = [
  level(
    "认识一次啮合",
    60,
    -60,
    [stage([12], [12, 24, 36])],
    [setting(12, 12)],
    "两个外啮合齿轮转向相反。齿数一样时，转速大小一样。",
  ),
  level(
    "大齿轮慢下来",
    60,
    -30,
    [stage([12], [12, 24, 36])],
    [setting(12, 24)],
    "从动轮齿数加倍，转速就减半：60 × 12/24 = 30。",
  ),
  level(
    "小齿轮跑得快",
    60,
    -120,
    [stage([12, 24, 36], [12])],
    [setting(24, 12)],
    "大齿轮带小齿轮会提高转速，但不会凭空增加功率。",
  ),
  level(
    "分数也能精确",
    60,
    -40,
    [stage([12, 20, 24], [24, 30, 36])],
    [setting(20, 30)],
    "从动转速 = −主动转速 × 主动齿数 / 从动齿数。",
  ),
  level(
    "加一个惰轮",
    60,
    30,
    [stage([12], [12, 24, 36], [0, 12, 20])],
    [setting(12, 24, 12)],
    "惰轮增加一次反向；它的齿数在总传动比里约掉了。",
  ),
  level(
    "惰轮大小不改总比",
    60,
    40,
    [stage([12, 18, 24], [24, 30, 36], [0, 12, 24])],
    [setting(24, 36, 24)],
    "改变惰轮齿数只改变惰轮自己的转速，不改变最终速比。",
  ),
  level(
    "同轴两级减速",
    60,
    15,
    [stage([12], [12, 24, 36]), stage([12, 24], [24])],
    [setting(12, 24), setting(12, 24)],
    "第一级从动轮和第二级主动轮固定在同一根轴上，转速相同。",
  ),
  level(
    "不同齿数，共用一根轴",
    72,
    12,
    [stage([18], [24, 36]), stage([12, 18, 24], [36])],
    [setting(18, 36), setting(12, 36)],
    "同轴不是啮合，不会反向。只有每一级外啮合带来负号和齿数比。",
  ),
  level(
    "速度与方向一起设计",
    60,
    -20,
    [stage([12, 20], [24, 30], [0, 12]), stage([12, 24], [24, 36])],
    [setting(20, 30, 12), setting(12, 24)],
    "三个外啮合使输出反向；两个或四个外啮合使输出同向。",
  ),
  level(
    "两级加速器",
    48,
    120,
    [stage([12, 18, 24], [12, 24]), stage([12, 20, 30], [12, 24, 36])],
    [setting(24, 12), setting(30, 24)],
    "复合传动比逐级相乘。这需要同轴的两枚不同齿轮来连接两级。",
  ),
  level(
    "三级慢速观察台",
    60,
    -5,
    [
      stage([12], [18, 24, 30]),
      stage([12, 18], [24, 36]),
      stage([12, 24], [24, 36]),
    ],
    [setting(12, 24), setting(12, 24), setting(12, 36)],
    "三级各做一点减速，乘起来能得到很小的输出转速。",
  ),
  level(
    "精密传动总设计师",
    90,
    9,
    [
      stage([12, 18, 24], [24, 30, 36], [0, 12, 20]),
      stage([12, 18, 24], [24, 30, 36]),
      stage([12, 18], [24, 36], [0, 12]),
    ],
    [setting(12, 30, 20), setting(18, 36), setting(12, 24)],
    "先把目标拆成每一级的齿数比，再用惰轮调整总啮合次数的奇偶。",
  ),
];
const parts: GearPart[] = ["driver", "driven", "idler"];
const clone = (settings: GearSetting[]) => settings.map((s) => ({ ...s }));
export function createGearState(config: GearLevel): GearState {
  return {
    settings: config.stages.map((s) => ({
      driver: s.driver.length === 1 ? s.driver[0] : null,
      driven: s.driven.length === 1 ? s.driven[0] : null,
      idler: s.idler.length === 1 ? s.idler[0] : null,
    })),
    history: [],
  };
}
export function validGearSettings(
  config: GearLevel,
  settings: GearSetting[],
): boolean {
  return (
    settings.length === config.stages.length &&
    settings.every((s, i) =>
      parts.every(
        (p) =>
          s[p] === null ||
          (Number.isInteger(s[p]) &&
            config.stages[i][p].includes(s[p] as number)),
      ),
    )
  );
}
export function moveGear(
  config: GearLevel,
  state: GearState,
  move: GearMove,
): GearState {
  if (
    !Number.isInteger(move.stage) ||
    move.stage < 0 ||
    move.stage >= config.stages.length ||
    !parts.includes(move.part) ||
    !validGearSettings(config, state.settings)
  )
    return state;
  const options = config.stages[move.stage][move.part];
  if (
    options.length === 1 ||
    !options.includes(move.teeth) ||
    state.settings[move.stage][move.part] === move.teeth
  )
    return state;
  return {
    settings: state.settings.map((s, i) =>
      i === move.stage ? { ...s, [move.part]: move.teeth } : { ...s },
    ),
    history: [...state.history, clone(state.settings)],
  };
}
export function undoGear(state: GearState): GearState {
  return state.history.length
    ? {
        settings: clone(state.history[state.history.length - 1]),
        history: state.history.slice(0, -1),
      }
    : state;
}
export type GearStageResult = {
  driver: GearFraction;
  driven: GearFraction;
  idler: GearFraction | null;
  ratio: GearFraction;
  meshes: number;
};
export type GearResult = {
  output: GearFraction;
  stages: GearStageResult[];
  meshes: number;
};
/** Pure exact external-gear kinematics. An idler cancels algebraically:
 * (-driver/idler) × (-idler/driven) = +driver/driven. */
export function gearTransmission(
  input: GearFraction,
  settings: GearSetting[],
): GearResult | null {
  let speed: GearFraction;
  try {
    speed = gearFraction(input.numerator, input.denominator);
  } catch {
    return null;
  }
  const results: GearStageResult[] = [];
  let meshes = 0;
  for (const s of settings) {
    if (
      s.driver === null ||
      s.driven === null ||
      s.idler === null ||
      !Number.isSafeInteger(s.driver) ||
      !Number.isSafeInteger(s.driven) ||
      !Number.isSafeInteger(s.idler) ||
      s.driver <= 0 ||
      s.driven <= 0 ||
      s.idler < 0
    )
      return null;
    try {
      const driver = speed;
      const idler =
        s.idler > 0
          ? multiplyGearFractions(driver, gearFraction(-s.driver, s.idler))
          : null;
      const ratio = gearFraction((idler ? 1 : -1) * s.driver, s.driven);
      const driven = multiplyGearFractions(driver, ratio);
      const count = idler ? 2 : 1;
      results.push({ driver, driven, idler, ratio, meshes: count });
      speed = driven;
      meshes += count;
    } catch {
      return null;
    }
  }
  return { output: speed, stages: results, meshes };
}
export function isGearSolved(
  config: GearLevel,
  state: Pick<GearState, "settings">,
): boolean {
  if (!validGearSettings(config, state.settings)) return false;
  const result = gearTransmission(config.input, state.settings);
  return result !== null && equalGearFractions(result.output, config.target);
}
export function solveGears(
  config: GearLevel,
  state = createGearState(config),
  limit = GEAR_SEARCH_LIMIT,
): { settings: GearSetting[] | null; nodes: number; exhausted: boolean } {
  const settings = clone(createGearState(config).settings);
  const slots = config.stages.flatMap((s, i) =>
    parts.filter((p) => s[p].length > 1).map((p) => ({ stage: i, part: p })),
  );
  let nodes = 0,
    exhausted = false;
  const visit = (depth: number): GearSetting[] | null => {
    if (nodes >= limit) {
      exhausted = true;
      return null;
    }
    nodes++;
    if (depth === slots.length)
      return isGearSolved(config, { settings }) ? clone(settings) : null;
    const slot = slots[depth],
      existing = state.settings[slot.stage]?.[slot.part];
    const choices = [...config.stages[slot.stage][slot.part]].sort(
      (a, b) => Number(b === existing) - Number(a === existing) || a - b,
    );
    for (const value of choices) {
      settings[slot.stage][slot.part] = value;
      const solution = visit(depth + 1);
      if (solution) return solution;
      if (exhausted) return null;
    }
    settings[slot.stage][slot.part] = null;
    return null;
  };
  return { settings: visit(0), nodes, exhausted };
}
export function gearNextMove(
  config: GearLevel,
  state: GearState,
): GearMove | null {
  if (isGearSolved(config, state)) return null;
  const solution = solveGears(config, state).settings;
  if (!solution) return null;
  for (let i = 0; i < solution.length; i++)
    for (const part of parts)
      if (solution[i][part] !== state.settings[i][part])
        return { stage: i, part, teeth: solution[i][part]! };
  return null;
}
export const gearPartName: Record<GearPart, string> = {
  driver: "主动轮",
  driven: "从动轮",
  idler: "惰轮",
};
export function gearHint(config: GearLevel, state: GearState): string {
  if (isGearSolved(config, state)) return "传动匹配！输出转速和方向都正确。";
  const move = gearNextMove(config, state);
  if (!move) return "暂时没有找到组合；可重置后重新选择。";
  return `第 ${move.stage + 1} 级：${move.part === "idler" && move.teeth === 0 ? "移除惰轮，直接啮合" : `把${gearPartName[move.part]}换成 ${move.teeth} 齿`}。${move.part === "idler" ? "惰轮只改变输出方向，不改变总速比。" : "留意主动齿数 ÷ 从动齿数。"}`;
}
export function verifyGearLevel(config: GearLevel): boolean {
  return (
    config.stages.length > 0 &&
    config.stages.every((s) =>
      parts.every(
        (p) =>
          s[p].length > 0 &&
          new Set(s[p]).size === s[p].length &&
          s[p].every(
            (n) => Number.isSafeInteger(n) && (p === "idler" ? n >= 0 : n > 0),
          ),
      ),
    ) &&
    isGearSolved(config, { settings: config.solution }) &&
    !isGearSolved(config, createGearState(config))
  );
}
export const gearSolutions: GearMove[][] = gearLevels.map((config) =>
  config.solution.flatMap((s, stage) =>
    parts
      .filter((part) => config.stages[stage][part].length > 1)
      .map((part) => ({ stage, part, teeth: s[part]! })),
  ),
);
