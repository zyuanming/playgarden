// SPDX-License-Identifier: MIT
import { labQ as q } from "./ballisticsCircuitExact";
import {
  currentMoveFor,
  currentParts,
  type CurrentLevel,
  type CurrentMove,
} from "./currentCircuitLogic";
/** Explicit authored goals; certificates are replay evidence, never target generators. */
export const currentCircuitLevels: CurrentLevel[] = [
  {
    title: "一盏理想小灯",
    idea: "固定电阻时，用欧姆定律 I = V ÷ R 预测灯的电流。",
    lampA: 6,
    lampB: 6,
    options: {
      topology: ["single"],
      voltage: [3, 6, 9],
      common: [0],
      ballastA: [0],
      ballastB: [0],
    },
    goals: [{ quantity: "ia", target: q(1) }],
    certificate: {
      topology: "single",
      voltage: 6,
      common: 0,
      ballastA: 0,
      ballastB: 0,
    },
  },
  {
    title: "多余电压放在哪里",
    idea: "灯前增加串联电阻，会分走电压。电源电压与灯电压不再相同。",
    lampA: 6,
    lampB: 6,
    options: {
      topology: ["single"],
      voltage: [9],
      common: [0],
      ballastA: [0, 3, 6, 9],
      ballastB: [0],
    },
    goals: [
      { quantity: "ia", target: q(1) },
      { quantity: "va", target: q(6) },
    ],
    certificate: {
      topology: "single",
      voltage: 9,
      common: 0,
      ballastA: 3,
      ballastB: 0,
    },
  },
  {
    title: "同一条回路",
    idea: "串联灯的电流相等；阻值不同，分到的电压不同。",
    lampA: 4,
    lampB: 8,
    options: {
      topology: ["series"],
      voltage: [6, 9, 12],
      common: [0],
      ballastA: [0],
      ballastB: [0],
    },
    goals: [
      { quantity: "ia", target: q(1) },
      { quantity: "ib", target: q(1) },
      { quantity: "vb", target: q(8) },
    ],
    certificate: {
      topology: "series",
      voltage: 12,
      common: 0,
      ballastA: 0,
      ballastB: 0,
    },
  },
  {
    title: "让两灯有不同电流",
    idea: "两盏灯如果需要不同电流，必须有分流路径。接线方式是设计的一部分。",
    lampA: 6,
    lampB: 6,
    options: {
      topology: ["series", "parallel"],
      voltage: [12],
      common: [0],
      ballastA: [0, 6, 12],
      ballastB: [0, 6, 12],
    },
    goals: [
      { quantity: "ia", target: q(1) },
      { quantity: "ib", target: q(2) },
    ],
    certificate: {
      topology: "parallel",
      voltage: 12,
      common: 0,
      ballastA: 6,
      ballastB: 0,
    },
  },
  {
    title: "一边明，一边暗",
    idea: "两灯阻值相同，电流较大的一灯耗散功率较大。给一条支路加电阻，会减小该路电流。",
    lampA: 6,
    lampB: 6,
    options: {
      topology: ["parallel"],
      voltage: [12, 6, 9],
      common: [0],
      ballastA: [0, 3, 6],
      ballastB: [0, 3, 6],
    },
    goals: [
      { quantity: "ia", target: q(1) },
      { quantity: "ib", target: q(1, 2) },
    ],
    certificate: {
      topology: "parallel",
      voltage: 6,
      common: 0,
      ballastA: 0,
      ballastB: 6,
    },
  },
  {
    title: "公共电阻的作用",
    idea: "分流之前的电阻承载总电流。它的压降会同时降低两条支路的电压。",
    lampA: 6,
    lampB: 6,
    options: {
      topology: ["parallel"],
      voltage: [12],
      common: [0, 3, 9, 6],
      ballastA: [0],
      ballastB: [0],
    },
    goals: [
      { quantity: "ia", target: q(1, 2) },
      { quantity: "ib", target: q(1, 2) },
      { quantity: "sourceI", target: q(1) },
    ],
    certificate: {
      topology: "parallel",
      voltage: 12,
      common: 9,
      ballastA: 0,
      ballastB: 0,
    },
  },
  {
    title: "不同阻值，一样电流",
    idea: "支路总电阻包括灯与外加电阻。灯本身不同，也能通过支路设计获得相同电流。",
    lampA: 4,
    lampB: 8,
    options: {
      topology: ["parallel"],
      voltage: [12],
      common: [0, 2, 4, 6],
      ballastA: [0, 4, 8],
      ballastB: [0, 4, 8],
    },
    goals: [
      { quantity: "ia", target: q(1) },
      { quantity: "ib", target: q(1) },
      { quantity: "va", target: q(4) },
      { quantity: "vb", target: q(8) },
    ],
    certificate: {
      topology: "parallel",
      voltage: 12,
      common: 2,
      ballastA: 4,
      ballastB: 0,
    },
  },
  {
    title: "串联的电压账本",
    idea: "电源电压等于公共电阻压降加灯路端电压；灯路里还要分配灯与外加电阻的压降。",
    lampA: 4,
    lampB: 8,
    options: {
      topology: ["series"],
      voltage: [6, 9, 12],
      common: [0, 2, 4],
      ballastA: [0, 4, 8],
      ballastB: [0, 4, 8],
    },
    goals: [
      { quantity: "ia", target: q(1, 2) },
      { quantity: "vb", target: q(4) },
      { quantity: "busV", target: q(8) },
    ],
    certificate: {
      topology: "series",
      voltage: 9,
      common: 2,
      ballastA: 4,
      ballastB: 0,
    },
  },
  {
    title: "耦合的两条支路",
    idea: "有公共电阻时，修改一条支路会改变总电流和公共压降，因此另一盏灯也会变化。",
    lampA: 3,
    lampB: 6,
    options: {
      topology: ["parallel"],
      voltage: [6, 9, 12],
      common: [0, 2, 4, 6],
      ballastA: [0, 3, 6, 9],
      ballastB: [0, 3, 6, 9],
    },
    goals: [
      { quantity: "ia", target: q(1) },
      { quantity: "ib", target: q(1, 2) },
      { quantity: "busV", target: q(6) },
    ],
    certificate: {
      topology: "parallel",
      voltage: 9,
      common: 2,
      ballastA: 3,
      ballastB: 6,
    },
  },
  {
    title: "分数电流",
    idea: "电流可以是精确分数。将近似小数凑到看起来相同，仍不代表电路精确达标。",
    lampA: 4,
    lampB: 6,
    options: {
      topology: ["parallel"],
      voltage: [12],
      common: [0, 2, 4, 6],
      ballastA: [0, 2, 4, 6, 8],
      ballastB: [0, 2, 4, 6, 8],
    },
    goals: [
      { quantity: "ia", target: q(4, 3) },
      { quantity: "ib", target: q(2, 3) },
      { quantity: "busV", target: q(8) },
    ],
    certificate: {
      topology: "parallel",
      voltage: 12,
      common: 2,
      ballastA: 2,
      ballastB: 6,
    },
  },
  {
    title: "先判断，再接线",
    idea: "不能只看到相等电流就猜接法。结合灯路电压和可用电阻，排除不可能的网络。",
    lampA: 4,
    lampB: 8,
    options: {
      topology: ["parallel", "series"],
      voltage: [6, 9, 12],
      common: [0, 2, 4, 6],
      ballastA: [0, 4, 8],
      ballastB: [0, 4, 8],
    },
    goals: [
      { quantity: "ia", target: q(3, 8) },
      { quantity: "ib", target: q(3, 8) },
      { quantity: "busV", target: q(15, 2) },
    ],
    certificate: {
      topology: "series",
      voltage: 9,
      common: 4,
      ballastA: 0,
      ballastB: 8,
    },
  },
  {
    title: "电流总设计师",
    idea: "同时满足分流比例、灯路电压和总电流。把欧姆定律与节点电流守恒组合起来独立设计。",
    lampA: 3,
    lampB: 6,
    options: {
      topology: ["series", "parallel"],
      voltage: [3, 6, 9, 12],
      common: [0, 1, 2, 3, 4, 6],
      ballastA: [0, 3, 6, 9, 12],
      ballastB: [0, 3, 6, 9, 12],
    },
    goals: [
      { quantity: "ia", target: q(8, 9) },
      { quantity: "ib", target: q(4, 9) },
      { quantity: "busV", target: q(8) },
      { quantity: "sourceI", target: q(4, 3) },
    ],
    certificate: {
      topology: "parallel",
      voltage: 12,
      common: 3,
      ballastA: 6,
      ballastB: 12,
    },
  },
];
export const currentCircuitSolutions: CurrentMove[][] =
  currentCircuitLevels.map((c) => [
    ...currentParts
      .filter((p) => currentChoicesCount(c, p) > 1)
      .map((part) => currentMoveFor(part, c.certificate[part])),
    { part: "measure" },
  ]);
function currentChoicesCount(
  c: CurrentLevel,
  part: keyof CurrentLevel["options"],
): number {
  return c.options[part].length;
}
