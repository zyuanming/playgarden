// SPDX-License-Identifier: GPL-3.0-only
/** A fictional integer energy puzzle, not an operating model for a real grid. */
export type EnergyPeriod = { renewable: number; demand: number; price: number };
export type EnergyAction = { generator: number; battery: number };
// battery > 0: charging INPUT; battery < 0: discharge OUTPUT; zero: idle.
export type EnergyPublic = {
  periods: EnergyPeriod[];
  capacity: number;
  initial: number;
  reserve: number;
  generatorLimit: number;
  chargeLimit: number;
  dischargeLimit: number;
  chargeLoss: number;
  budget: number;
};
export type EnergyLevel = EnergyPublic & {
  id: string;
  title: string;
  lesson: string;
  certificate: { actions: EnergyAction[]; cost: number; finalCharge: number };
};
export type EnergyBoard = { time: number; charge: number; cost: number };
export type EnergyStep = {
  before: EnergyBoard;
  action: EnergyAction;
  after: EnergyBoard;
  spill: number;
  loss: number;
};
export type EnergyState = { board: EnergyBoard; history: EnergyStep[] };
export type EnergyPreview = {
  valid: boolean;
  reason: string;
  next: EnergyBoard;
  spill: number;
  loss: number;
  supply: number;
  consumption: number;
};
export const ENERGY_STATE_LIMIT = 143,
  ENERGY_TRANSITION_LIMIT = 5005;
const integer = (n: number, lo: number, hi: number) =>
  Number.isInteger(n) && n >= lo && n <= hi;
export function publicEnergy(l: EnergyPublic): EnergyPublic {
  return {
    periods: l.periods.map((p) => ({ ...p })),
    capacity: l.capacity,
    initial: l.initial,
    reserve: l.reserve,
    generatorLimit: l.generatorLimit,
    chargeLimit: l.chargeLimit,
    dischargeLimit: l.dischargeLimit,
    chargeLoss: l.chargeLoss,
    budget: l.budget,
  };
}
export function validEnergyLevel(l: EnergyPublic): boolean {
  return (
    l.periods.length >= 2 &&
    l.periods.length <= 12 &&
    integer(l.capacity, 1, 10) &&
    integer(l.initial, 0, l.capacity) &&
    integer(l.reserve, 0, l.capacity) &&
    integer(l.generatorLimit, 0, 4) &&
    integer(l.chargeLimit, 0, 3) &&
    integer(l.dischargeLimit, 0, 3) &&
    integer(l.chargeLoss, 0, 1) &&
    integer(l.budget, 0, 10000) &&
    l.periods.every(
      (p) =>
        integer(p.renewable, 0, 20) &&
        integer(p.demand, 0, 20) &&
        integer(p.price, 1, 20),
    )
  );
}
export function energyActions(l: EnergyPublic): EnergyAction[] {
  const actions: EnergyAction[] = [];
  for (let generator = 0; generator <= l.generatorLimit; generator++) {
    actions.push({ generator, battery: 0 });
    for (let battery = l.chargeLoss + 1; battery <= l.chargeLimit; battery++)
      actions.push({ generator, battery });
    for (let n = 1; n <= l.dischargeLimit; n++)
      actions.push({ generator, battery: -n });
  }
  return actions;
}
export function energyPreview(
  l: EnergyPublic,
  board: EnergyBoard,
  action: EnergyAction,
): EnergyPreview {
  const fail = (reason: string): EnergyPreview => ({
    valid: false,
    reason,
    next: { ...board },
    spill: 0,
    loss: 0,
    supply: 0,
    consumption: 0,
  });
  if (!integer(board.time, 0, l.periods.length - 1))
    return fail("全部时段已结束；若目标未达成，请撤销。");
  if (!integer(board.charge, 0, l.capacity) || !integer(board.cost, 0, 10000))
    return fail("储能或费用状态无效。");
  if (
    !integer(action.generator, 0, l.generatorLimit) ||
    !integer(action.battery, -l.dischargeLimit, l.chargeLimit)
  )
    return fail("超过发电机或电池功率限制。");
  const input = Math.max(0, action.battery),
    output = Math.max(0, -action.battery),
    loss = input ? l.chargeLoss : 0;
  if (input && input <= loss)
    return fail("充电输入必须大于本次损耗，至少存入 1 单位。");
  if (output > board.charge)
    return fail(`电池只有 ${board.charge} 单位，不能放出 ${output} 单位。`);
  const charge = board.charge + input - loss - output;
  if (charge > l.capacity)
    return fail(`充电后为 ${charge}，超过容量 ${l.capacity}。`);
  const p = l.periods[board.time],
    supply = p.renewable + action.generator + output,
    consumption = p.demand + input;
  if (supply < consumption)
    return fail(
      `供给 ${supply} 小于用电与充电输入 ${consumption}，缺少 ${consumption - supply} 单位。`,
    );
  const spill = supply - consumption;
  return {
    valid: true,
    reason: `需求全部满足；弃电 ${spill}，充电损耗 ${loss}。`,
    next: {
      time: board.time + 1,
      charge,
      cost: board.cost + action.generator * p.price,
    },
    spill,
    loss,
    supply,
    consumption,
  };
}
export function createEnergyState(l: EnergyPublic): EnergyState {
  return { board: { time: 0, charge: l.initial, cost: 0 }, history: [] };
}
export function energyWon(l: EnergyPublic, board: EnergyBoard): boolean {
  return (
    board.time === l.periods.length &&
    integer(board.charge, l.reserve, l.capacity) &&
    integer(board.cost, 0, l.budget)
  );
}
export function moveEnergy(
  l: EnergyPublic,
  state: EnergyState,
  action: EnergyAction,
): EnergyState {
  if (energyWon(l, state.board)) return state;
  const p = energyPreview(l, state.board, action);
  if (!p.valid) return state;
  return {
    board: { ...p.next },
    history: [
      ...state.history,
      {
        before: { ...state.board },
        action: { ...action },
        after: { ...p.next },
        spill: p.spill,
        loss: p.loss,
      },
    ],
  };
}
export function undoEnergy(l: EnergyPublic, state: EnergyState): EnergyState {
  if (energyWon(l, state.board) || !state.history.length) return state;
  return {
    board: { ...state.history.at(-1)!.before },
    history: state.history.slice(0, -1),
  };
}
export type EnergyTable = {
  costs: number[][];
  choices: (EnergyAction | null)[][];
  states: number;
  transitions: number;
};
/** Exact suffix DP. Already-spent cost is not a state dimension; every future cost is nonnegative.
 * ≤ (12+1)(10+1)=143 states and ≤12*11*35=4620 attempted transitions. */
export function solveEnergy(l: EnergyPublic): EnergyTable {
  if (!validEnergyLevel(l)) throw new Error("Invalid energy puzzle bounds");
  const n = l.periods.length,
    actions = energyActions(l);
  const costs = Array.from({ length: n + 1 }, () =>
    Array<number>(l.capacity + 1).fill(Infinity),
  );
  const choices = Array.from({ length: n + 1 }, () =>
    Array<EnergyAction | null>(l.capacity + 1).fill(null),
  );
  for (let s = l.reserve; s <= l.capacity; s++) costs[n][s] = 0;
  let transitions = 0;
  for (let t = n - 1; t >= 0; t--)
    for (let s = 0; s <= l.capacity; s++)
      for (const a of actions) {
        transitions++;
        const p = energyPreview(l, { time: t, charge: s, cost: 0 }, a);
        if (!p.valid) continue;
        const cost = p.next.cost + costs[t + 1][p.next.charge];
        if (cost < costs[t][s]) {
          costs[t][s] = cost;
          choices[t][s] = { ...a };
        }
      }
  return { costs, choices, transitions, states: (n + 1) * (l.capacity + 1) };
}
export const energyBatteryLabel = (battery: number, loss = 0) =>
  battery === 0
    ? "电池待机"
    : battery < 0
      ? `放电 ${-battery}`
      : `充入 ${battery}（存 ${battery - loss}）`;
export type EnergyHint = {
  action: EnergyAction | null;
  minimum: number;
  undo: number;
  text: string;
};
export function energyHint(
  l: EnergyPublic,
  state: EnergyState,
  table = solveEnergy(l),
): EnergyHint {
  const b = state.board,
    suffix = table.costs[b.time]?.[b.charge] ?? Infinity,
    minimum = b.cost + suffix;
  if (energyWon(l, b))
    return {
      action: null,
      minimum: b.cost,
      undo: 0,
      text: "已满足全部需求、最终储备和预算，可以回看时间线。",
    };
  if (minimum <= l.budget) {
    const action = table.choices[b.time][b.charge];
    return {
      action: action ? { ...action } : null,
      minimum,
      undo: 0,
      text: `从当前记录继续，最低总费用是 ${minimum} / ${l.budget} 枚。下一时段可选发电 ${action!.generator}、${energyBatteryLabel(action!.battery, l.chargeLoss)}。它属于一条最低费用可行方案。`,
    };
  }
  let undo = 0;
  for (let i = state.history.length - 1; i >= 0; i--) {
    const prev = state.history[i].before;
    if (prev.cost + table.costs[prev.time][prev.charge] <= l.budget) {
      undo = state.history.length - i;
      break;
    }
  }
  return {
    action: null,
    minimum,
    undo,
    text: `${Number.isFinite(minimum) ? `保持当前记录，最低总费用也要 ${minimum} 枚，超过预算 ${l.budget}。` : "保持当前记录，后续无法同时满足需求和最终储备。"}${undo ? `至少撤销 ${undo} 个时段，才能回到仍有预算内方案的前缀。` : "请重来，重新安排充放电。"}`,
  };
}
