// SPDX-License-Identifier: GPL-3.0-only
import type {
  RGB,
  SpectralFilter,
  SpectralLevel,
  SpectralBoard,
} from "./spectralFiltersLogic";
const rgb = (r: number, g: number, b: number, d = 1): RGB => [
  [r, d],
  [g, d],
  [b, d],
];
const white = rgb(1, 1, 1);
const filter = (
  id: string,
  name: string,
  transmission: RGB,
  cost = 1,
): SpectralFilter => ({ id, name, transmission, cost });
const R = filter("r", "红通片", rgb(1, 0, 0)),
  G = filter("g", "绿通片", rgb(0, 1, 0)),
  B = filter("b", "蓝通片", rgb(0, 0, 1));
const C = filter("c", "青通片", rgb(0, 1, 1)),
  M = filter("m", "品红通片", rgb(1, 0, 1)),
  Y = filter("y", "黄通片", rgb(1, 1, 0));
const D = filter("d", "半透片 A", rgb(1, 1, 1, 2)),
  D2 = filter("d2", "半透片 B", rgb(1, 1, 1, 2));
const r = filter("soft-r", "保红半透", rgb(2, 1, 1, 2), 2),
  g = filter("soft-g", "保绿半透", rgb(1, 2, 1, 2), 2),
  b = filter("soft-b", "保蓝半透", rgb(1, 1, 2, 2), 2);
export const spectralFiltersLevels: readonly SpectralLevel[] = [
  {
    id: "sf-01",
    title: "保留一个通道",
    lesson: "透射率 0 会挡住该通道，1 会完整保留。",
    beams: [white],
    slotsPerBeam: 1,
    filters: [R, G, B],
    target: rgb(1, 0, 0),
    budget: 1,
  },
  {
    id: "sf-02",
    title: "两个通道的光",
    lesson: "一片滤片可以同时让两个通道通过。",
    beams: [white],
    slotsPerBeam: 1,
    filters: [C, M, Y],
    target: rgb(0, 1, 1),
    budget: 1,
  },
  {
    id: "sf-03",
    title: "不均匀的光源",
    lesson: "每个通道都用自己的入射强度乘透射率。",
    beams: [rgb(2, 1, 1)],
    slotsPerBeam: 1,
    filters: [D, r, g],
    target: [
      [1, 1],
      [1, 2],
      [1, 2],
    ],
    budget: 2,
  },
  {
    id: "sf-04",
    title: "交集留下蓝光",
    lesson: "叠放两片时，透射率相乘；顺序不影响结果。",
    beams: [white],
    slotsPerBeam: 2,
    filters: [C, M, Y, D],
    target: rgb(0, 0, 1),
    budget: 2,
  },
  {
    id: "sf-05",
    title: "半透再半透",
    lesson: "两片半透的总透射率是四分之一。库存中的两片分别使用。",
    beams: [rgb(2, 2, 2)],
    slotsPerBeam: 2,
    filters: [D, D2, R, C],
    target: rgb(1, 1, 1, 2),
    budget: 2,
  },
  {
    id: "sf-06",
    title: "逐通道相乘",
    lesson: "柔和滤片保留部分光；比较三个精确分数。",
    beams: [rgb(2, 1, 1)],
    slotsPerBeam: 2,
    filters: [r, g, D, B],
    target: [
      [1, 1],
      [1, 2],
      [1, 4],
    ],
    budget: 4,
  },
  {
    id: "sf-07",
    title: "两束光相加",
    lesson: "两束光混合时，三个通道分别相加。",
    beams: [white, white],
    slotsPerBeam: 1,
    filters: [R, G, B, C],
    target: rgb(1, 1, 0),
    budget: 2,
  },
  {
    id: "sf-08",
    title: "亮源与弱源",
    lesson: "同一滤片放在哪束光上会改变输出。",
    beams: [rgb(2, 2, 2), white],
    slotsPerBeam: 1,
    filters: [D, R, G, C],
    target: rgb(2, 1, 1),
    budget: 2,
  },
  {
    id: "sf-09",
    title: "共享库存",
    lesson: "只有一片半透片。为两束不同的光分配资源。",
    beams: [rgb(2, 1, 0), rgb(0, 1, 2)],
    slotsPerBeam: 1,
    filters: [D, filter("half-b", "蓝减半", rgb(2, 2, 1, 2), 2), R, G],
    target: [
      [1, 1],
      [3, 2],
      [1, 1],
    ],
    budget: 3,
  },
  {
    id: "sf-10",
    title: "先乘后加",
    lesson: "先分别计算每束光的叠片输出，再进行混合。",
    beams: [white, rgb(2, 1, 1)],
    slotsPerBeam: 2,
    filters: [C, M, Y, D, R],
    target: [
      [2, 1],
      [1, 2],
      [3, 2],
    ],
    budget: 3,
  },
  {
    id: "sf-11",
    title: "四片调配",
    lesson: "四个槽位与成本限制一起决定可用的组合。",
    beams: [rgb(2, 2, 1), rgb(1, 2, 2)],
    slotsPerBeam: 2,
    filters: [r, g, b, D, C, Y],
    target: [
      [9, 4],
      [3, 2],
      [1, 1],
    ],
    budget: 6,
  },
  {
    id: "sf-12",
    title: "分数光谱工作台",
    lesson: "用不同的部分透射组合，同时匹配三个分数目标。",
    beams: [rgb(2, 1, 2), rgb(1, 2, 1)],
    slotsPerBeam: 2,
    filters: [r, g, b, D, D2, C],
    target: [
      [5, 4],
      [5, 4],
      [1, 1],
    ],
    budget: 7,
  },
];
// Certificates are examples for replay tests; public targets above are separately authored.
const certificates: readonly SpectralBoard[] = [
  [0],
  [0],
  [0],
  [0, 1],
  [0, 1],
  [0, 1],
  [0, 1],
  [0, 1],
  [0, 1],
  [0, 3, 1, -1],
  [0, 5, 2, 3],
  [0, 3, 1, 2],
];
export function getSpectralCertificate(index: number): SpectralBoard | null {
  return Number.isInteger(index) && certificates[index]
    ? [...certificates[index]]
    : null;
}
