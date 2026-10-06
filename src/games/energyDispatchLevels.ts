// SPDX-License-Identifier: GPL-3.0-only
import type { EnergyLevel } from "./energyDispatchLogic";
/** Twelve authored fictional timelines with explicit feasible certificates. */
export const energyDispatchLevels: EnergyLevel[] = [
  {
    id: "ed-01",
    title: "阳光留到傍晚",
    lesson: "把白天多余的能量存起来，留给缺电的时段。先看完整时间线，再推进。",
    periods: [
      {
        renewable: 3,
        demand: 1,
        price: 2,
      },
      {
        renewable: 0,
        demand: 2,
        price: 4,
      },
      {
        renewable: 1,
        demand: 2,
        price: 3,
      },
    ],
    capacity: 3,
    initial: 0,
    reserve: 0,
    generatorLimit: 3,
    chargeLimit: 2,
    dischargeLimit: 2,
    chargeLoss: 0,
    budget: 3,
    certificate: {
      actions: [
        {
          generator: 0,
          battery: 2,
        },
        {
          generator: 0,
          battery: -2,
        },
        {
          generator: 1,
          battery: 0,
        },
      ],
      cost: 3,
      finalCharge: 0,
    },
  },
  {
    id: "ed-02",
    title: "便宜时多一点",
    lesson:
      "价格不同，电池也能保存发电机的能量。今天的省钱可能需要今天先花钱。",
    periods: [
      {
        renewable: 0,
        demand: 1,
        price: 1,
      },
      {
        renewable: 1,
        demand: 2,
        price: 4,
      },
      {
        renewable: 0,
        demand: 2,
        price: 5,
      },
      {
        renewable: 2,
        demand: 1,
        price: 2,
      },
    ],
    capacity: 3,
    initial: 1,
    reserve: 1,
    generatorLimit: 3,
    chargeLimit: 2,
    dischargeLimit: 2,
    chargeLoss: 0,
    budget: 3,
    certificate: {
      actions: [
        {
          generator: 3,
          battery: 2,
        },
        {
          generator: 0,
          battery: -1,
        },
        {
          generator: 0,
          battery: -2,
        },
        {
          generator: 0,
          battery: 1,
        },
      ],
      cost: 3,
      finalCharge: 1,
    },
  },
  {
    id: "ed-03",
    title: "容量不是无限",
    lesson: "太阳能超过电池容量时会弃电。功率和容量是两种不同的限制。",
    periods: [
      {
        renewable: 5,
        demand: 1,
        price: 3,
      },
      {
        renewable: 0,
        demand: 2,
        price: 5,
      },
      {
        renewable: 0,
        demand: 2,
        price: 4,
      },
      {
        renewable: 1,
        demand: 2,
        price: 2,
      },
    ],
    capacity: 3,
    initial: 0,
    reserve: 0,
    generatorLimit: 3,
    chargeLimit: 3,
    dischargeLimit: 2,
    chargeLoss: 0,
    budget: 7,
    certificate: {
      actions: [
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 0,
          battery: -2,
        },
        {
          generator: 1,
          battery: -1,
        },
        {
          generator: 1,
          battery: 0,
        },
      ],
      cost: 6,
      finalCharge: 0,
    },
  },
  {
    id: "ed-04",
    title: "高峰前的准备",
    lesson: "未来价格公开可见。提前准备电量，但也为接下来的免费能量留位置。",
    periods: [
      {
        renewable: 0,
        demand: 2,
        price: 1,
      },
      {
        renewable: 3,
        demand: 1,
        price: 4,
      },
      {
        renewable: 1,
        demand: 3,
        price: 3,
      },
      {
        renewable: 0,
        demand: 2,
        price: 6,
      },
      {
        renewable: 2,
        demand: 2,
        price: 2,
      },
    ],
    capacity: 4,
    initial: 1,
    reserve: 1,
    generatorLimit: 3,
    chargeLimit: 3,
    dischargeLimit: 2,
    chargeLoss: 0,
    budget: 6,
    certificate: {
      actions: [
        {
          generator: 3,
          battery: 1,
        },
        {
          generator: 0,
          battery: 2,
        },
        {
          generator: 0,
          battery: -2,
        },
        {
          generator: 0,
          battery: -2,
        },
        {
          generator: 1,
          battery: 1,
        },
      ],
      cost: 5,
      finalCharge: 1,
    },
  },
  {
    id: "ed-05",
    title: "带着储备回家",
    lesson: "结束时的储备也是目标；最后一个时段不能把电池用光。",
    periods: [
      {
        renewable: 3,
        demand: 1,
        price: 4,
      },
      {
        renewable: 0,
        demand: 3,
        price: 5,
      },
      {
        renewable: 4,
        demand: 1,
        price: 2,
      },
      {
        renewable: 0,
        demand: 3,
        price: 6,
      },
      {
        renewable: 1,
        demand: 2,
        price: 3,
      },
    ],
    capacity: 5,
    initial: 0,
    reserve: 2,
    generatorLimit: 3,
    chargeLimit: 3,
    dischargeLimit: 3,
    chargeLoss: 0,
    budget: 13,
    certificate: {
      actions: [
        {
          generator: 1,
          battery: 3,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 3,
          battery: 2,
        },
      ],
      cost: 13,
      finalCharge: 2,
    },
  },
  {
    id: "ed-06",
    title: "每次充电有损耗",
    lesson: "每次正充电会损失 1 单位输入。少量反复充电可能比集中充电更贵。",
    periods: [
      {
        renewable: 4,
        demand: 1,
        price: 2,
      },
      {
        renewable: 0,
        demand: 2,
        price: 5,
      },
      {
        renewable: 1,
        demand: 3,
        price: 4,
      },
      {
        renewable: 4,
        demand: 1,
        price: 2,
      },
      {
        renewable: 0,
        demand: 2,
        price: 6,
      },
      {
        renewable: 2,
        demand: 3,
        price: 3,
      },
    ],
    capacity: 5,
    initial: 1,
    reserve: 1,
    generatorLimit: 4,
    chargeLimit: 3,
    dischargeLimit: 3,
    chargeLoss: 1,
    budget: 12,
    certificate: {
      actions: [
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 0,
          battery: -2,
        },
        {
          generator: 2,
          battery: 0,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 0,
          battery: -2,
        },
        {
          generator: 1,
          battery: 0,
        },
      ],
      cost: 11,
      finalCharge: 1,
    },
  },
  {
    id: "ed-07",
    title: "两个用电高峰",
    lesson:
      "同一块电池要穿过两个高峰。按整个后续过程比较，而不是只看这一格价格。",
    periods: [
      {
        renewable: 0,
        demand: 2,
        price: 1,
      },
      {
        renewable: 5,
        demand: 1,
        price: 4,
      },
      {
        renewable: 1,
        demand: 3,
        price: 2,
      },
      {
        renewable: 0,
        demand: 3,
        price: 7,
      },
      {
        renewable: 4,
        demand: 1,
        price: 3,
      },
      {
        renewable: 0,
        demand: 3,
        price: 6,
      },
      {
        renewable: 2,
        demand: 2,
        price: 2,
      },
    ],
    capacity: 6,
    initial: 2,
    reserve: 2,
    generatorLimit: 4,
    chargeLimit: 3,
    dischargeLimit: 3,
    chargeLoss: 0,
    budget: 6,
    certificate: {
      actions: [
        {
          generator: 3,
          battery: 1,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 0,
          battery: -2,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 1,
          battery: 1,
        },
      ],
      cost: 5,
      finalCharge: 2,
    },
  },
  {
    id: "ed-08",
    title: "损耗与价差",
    lesson: "充电损耗会缩小价差的好处。价格便宜，不代表所有充电都值得。",
    periods: [
      {
        renewable: 4,
        demand: 1,
        price: 3,
      },
      {
        renewable: 0,
        demand: 3,
        price: 6,
      },
      {
        renewable: 2,
        demand: 2,
        price: 1,
      },
      {
        renewable: 0,
        demand: 3,
        price: 5,
      },
      {
        renewable: 5,
        demand: 1,
        price: 4,
      },
      {
        renewable: 0,
        demand: 3,
        price: 7,
      },
      {
        renewable: 1,
        demand: 2,
        price: 2,
      },
      {
        renewable: 2,
        demand: 3,
        price: 4,
      },
    ],
    capacity: 6,
    initial: 1,
    reserve: 2,
    generatorLimit: 4,
    chargeLimit: 3,
    dischargeLimit: 3,
    chargeLoss: 1,
    budget: 26,
    certificate: {
      actions: [
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 3,
          battery: 3,
        },
        {
          generator: 2,
          battery: -1,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 4,
          battery: 3,
        },
        {
          generator: 1,
          battery: 0,
        },
      ],
      cost: 25,
      finalCharge: 2,
    },
  },
  {
    id: "ed-09",
    title: "储备不能忘",
    lesson: "预算、容量和最终储备一起生效。预留到终点的能量也占用电池空间。",
    periods: [
      {
        renewable: 0,
        demand: 2,
        price: 1,
      },
      {
        renewable: 5,
        demand: 1,
        price: 5,
      },
      {
        renewable: 0,
        demand: 4,
        price: 6,
      },
      {
        renewable: 2,
        demand: 2,
        price: 2,
      },
      {
        renewable: 0,
        demand: 3,
        price: 7,
      },
      {
        renewable: 5,
        demand: 1,
        price: 3,
      },
      {
        renewable: 1,
        demand: 3,
        price: 4,
      },
      {
        renewable: 0,
        demand: 3,
        price: 6,
      },
    ],
    capacity: 7,
    initial: 3,
    reserve: 3,
    generatorLimit: 4,
    chargeLimit: 3,
    dischargeLimit: 3,
    chargeLoss: 0,
    budget: 20,
    certificate: {
      actions: [
        {
          generator: 3,
          battery: 1,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 1,
          battery: -3,
        },
        {
          generator: 3,
          battery: 3,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 1,
          battery: -1,
        },
        {
          generator: 0,
          battery: -3,
        },
      ],
      cost: 19,
      finalCharge: 3,
    },
  },
  {
    id: "ed-10",
    title: "十段长日",
    lesson: "没有倒计时。逐段检查供需守恒，尤其注意充电输入与实际存入不同。",
    periods: [
      {
        renewable: 4,
        demand: 1,
        price: 4,
      },
      {
        renewable: 0,
        demand: 3,
        price: 5,
      },
      {
        renewable: 1,
        demand: 2,
        price: 1,
      },
      {
        renewable: 5,
        demand: 1,
        price: 3,
      },
      {
        renewable: 0,
        demand: 4,
        price: 7,
      },
      {
        renewable: 0,
        demand: 2,
        price: 2,
      },
      {
        renewable: 4,
        demand: 1,
        price: 5,
      },
      {
        renewable: 1,
        demand: 3,
        price: 3,
      },
      {
        renewable: 0,
        demand: 3,
        price: 6,
      },
      {
        renewable: 3,
        demand: 2,
        price: 2,
      },
    ],
    capacity: 8,
    initial: 2,
    reserve: 3,
    generatorLimit: 4,
    chargeLimit: 3,
    dischargeLimit: 3,
    chargeLoss: 1,
    budget: 26,
    certificate: {
      actions: [
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 4,
          battery: 3,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 1,
          battery: -3,
        },
        {
          generator: 2,
          battery: 0,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 2,
          battery: 0,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 2,
          battery: 3,
        },
      ],
      cost: 25,
      finalCharge: 3,
    },
  },
  {
    id: "ed-11",
    title: "峰谷交错",
    lesson: "价格峰值不等于需求峰值。电池的机会取决于后面整段时间线。",
    periods: [
      {
        renewable: 0,
        demand: 2,
        price: 1,
      },
      {
        renewable: 5,
        demand: 1,
        price: 5,
      },
      {
        renewable: 1,
        demand: 3,
        price: 2,
      },
      {
        renewable: 0,
        demand: 4,
        price: 7,
      },
      {
        renewable: 4,
        demand: 1,
        price: 4,
      },
      {
        renewable: 0,
        demand: 2,
        price: 3,
      },
      {
        renewable: 2,
        demand: 3,
        price: 6,
      },
      {
        renewable: 5,
        demand: 1,
        price: 2,
      },
      {
        renewable: 0,
        demand: 4,
        price: 8,
      },
      {
        renewable: 1,
        demand: 2,
        price: 3,
      },
      {
        renewable: 0,
        demand: 3,
        price: 5,
      },
    ],
    capacity: 9,
    initial: 3,
    reserve: 4,
    generatorLimit: 4,
    chargeLimit: 3,
    dischargeLimit: 3,
    chargeLoss: 0,
    budget: 32,
    certificate: {
      actions: [
        {
          generator: 4,
          battery: 2,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 3,
          battery: 1,
        },
        {
          generator: 1,
          battery: -3,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 0,
          battery: -2,
        },
        {
          generator: 0,
          battery: -1,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 1,
          battery: -3,
        },
        {
          generator: 2,
          battery: 1,
        },
        {
          generator: 0,
          battery: -3,
        },
      ],
      cost: 31,
      finalCharge: 4,
    },
  },
  {
    id: "ed-12",
    title: "完整调度日",
    lesson:
      "综合考虑损耗、功率、容量和储备。允许任何满足目标的调度，不必复现固定方案。",
    periods: [
      {
        renewable: 4,
        demand: 1,
        price: 3,
      },
      {
        renewable: 0,
        demand: 3,
        price: 6,
      },
      {
        renewable: 2,
        demand: 3,
        price: 2,
      },
      {
        renewable: 5,
        demand: 1,
        price: 5,
      },
      {
        renewable: 0,
        demand: 4,
        price: 8,
      },
      {
        renewable: 1,
        demand: 2,
        price: 3,
      },
      {
        renewable: 0,
        demand: 3,
        price: 7,
      },
      {
        renewable: 5,
        demand: 1,
        price: 2,
      },
      {
        renewable: 0,
        demand: 4,
        price: 6,
      },
      {
        renewable: 2,
        demand: 2,
        price: 4,
      },
      {
        renewable: 0,
        demand: 3,
        price: 7,
      },
      {
        renewable: 3,
        demand: 2,
        price: 2,
      },
    ],
    capacity: 10,
    initial: 3,
    reserve: 4,
    generatorLimit: 4,
    chargeLimit: 3,
    dischargeLimit: 3,
    chargeLoss: 1,
    budget: 63,
    certificate: {
      actions: [
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 4,
          battery: 3,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 1,
          battery: -3,
        },
        {
          generator: 4,
          battery: 3,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 0,
          battery: 3,
        },
        {
          generator: 3,
          battery: -1,
        },
        {
          generator: 3,
          battery: 3,
        },
        {
          generator: 0,
          battery: -3,
        },
        {
          generator: 2,
          battery: 3,
        },
      ],
      cost: 62,
      finalCharge: 4,
    },
  },
];
