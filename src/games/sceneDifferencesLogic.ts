// SPDX-License-Identifier: GPL-3.0-only
// Original picture descriptors. Every compared property has a visible SVG effect.
export type SceneItem = {
  kind: "flower" | "tree" | "bird" | "pot" | "lamp" | "butterfly";
  color: string;
  count: number;
  mirror: boolean;
};
export type DifferenceLesson = {
  title: string;
  lesson: string;
  left: SceneItem[];
  right: SceneItem[];
  sky: string;
};
const colors = [
  "#e59a68",
  "#e4c157",
  "#70a894",
  "#a189c0",
  "#e18ba4",
  "#639eb8",
];
const kinds: SceneItem["kind"][] = [
  "flower",
  "tree",
  "bird",
  "pot",
  "lamp",
  "butterfly",
];
function scene(
  title: string,
  lesson: string,
  seed: number,
  changes: ("color" | "count" | "mirror" | "kind" | null)[],
  sky: string,
): DifferenceLesson {
  const left = Array.from({ length: 9 }, (_, i): SceneItem => ({
    kind: kinds[(i + seed) % 6],
    color: colors[(i * 2 + seed) % 6],
    count: 1 + ((i + seed) % 3),
    mirror: (i + seed) % 2 === 0,
  }));
  const right = left.map((item, i) => {
    const change = changes[i];
    return !change
      ? { ...item }
      : change === "color"
        ? { ...item, color: colors[(colors.indexOf(item.color) + 1) % 6] }
        : change === "count"
          ? { ...item, count: (item.count % 3) + 1 }
          : change === "mirror"
            ? { ...item, mirror: !item.mirror }
            : { ...item, kind: kinds[(kinds.indexOf(item.kind) + 2) % 6] };
  });
  return { title, lesson, left, right, sky };
}
export const sceneDifferencesLevels: DifferenceLesson[] = [
  scene(
    "清晨的花架",
    "先从颜色和数量开始。每个编号区域最多藏着一处不同。",
    0,
    ["color", null, "count", null, "color", "count", null, "color", null],
    "#e6f2f1",
  ),
  scene(
    "果园小路",
    "树上的果子和花盆上的标记，也值得数一数。",
    1,
    [null, "count", null, "color", "count", null, "color", null, "count"],
    "#edf2dc",
  ),
  scene(
    "黄昏温室",
    "颜色相近时，比较同一区域的轮廓与细节。",
    2,
    ["kind", "color", null, null, "count", null, "kind", "color", null],
    "#f5e5dd",
  ),
  scene(
    "转身的伙伴",
    "看清底部小旗指向哪边：左右朝向也可能改变。",
    3,
    ["mirror", null, "color", "mirror", null, "count", null, null, "mirror"],
    "#e8e2f1",
  ),
  scene(
    "雨后茶园",
    "从左到右比较，不要被旁边已经找到的圆圈带跑。",
    4,
    [null, "kind", "count", null, "mirror", "color", null, "count", null],
    "#dfeee8",
  ),
  scene(
    "灯下花房",
    "同一种物件可能换了颜色、数量或方向。每次只认一处。",
    5,
    ["count", "mirror", null, "kind", null, null, "color", null, "mirror"],
    "#e3e9f4",
  ),
  scene(
    "午后的布置",
    "先看整体，再看数目。错点不会扣分，也不会倒计时。",
    7,
    ["kind", null, "mirror", null, "count", "color", null, "kind", null],
    "#f4efd9",
  ),
  scene(
    "花园观察家",
    "综合观察外形、颜色、数量和小旗方向，找齐最后五处。",
    11,
    [null, "mirror", "kind", "count", null, "color", "mirror", null, null],
    "#e6efe1",
  ),
];
export const differentSceneItem = (a: SceneItem, b: SceneItem) =>
  a.kind !== b.kind ||
  a.color !== b.color ||
  a.count !== b.count ||
  a.mirror !== b.mirror;
export const sceneDifferenceIndices = (level: DifferenceLesson) =>
  level.left.flatMap((item, i) =>
    differentSceneItem(item, level.right[i]) ? [i] : [],
  );
export const sceneDifferencesWon = (
  level: DifferenceLesson,
  found: readonly number[],
) => {
  const answer = sceneDifferenceIndices(level);
  return (
    found.length === answer.length &&
    new Set(found).size === found.length &&
    found.every((i) => answer.includes(i))
  );
};
export const sceneKindNames: Record<SceneItem["kind"], string> = {
  flower: "花朵",
  tree: "果树",
  bird: "小鸟",
  pot: "花盆",
  lamp: "灯笼",
  butterfly: "蝴蝶",
};
export function sceneDifferenceReason(a: SceneItem, b: SceneItem) {
  return a.kind !== b.kind
    ? "物件的种类不同"
    : a.color !== b.color
      ? "物件的颜色不同"
      : a.count !== b.count
        ? "点点的数量不同"
        : "底部小旗的朝向不同";
}
