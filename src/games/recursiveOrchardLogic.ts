// SPDX-License-Identifier: GPL-3.0-only
type Bud = "A" | "B";
type Leaf = Bud | "X" | "Y";
export type Tree = Leaf | readonly [Tree, Tree];
type Card = { bud: Bud; grows: Tree };
function parse(source: string): Tree {
  let at = 0;
  function node(): Tree {
    const c = source[at++];
    if (c === "(") {
      const left = node(),
        right = node();
      if (source[at++] !== ")") throw Error("Invalid tree branch");
      return [left, right];
    }
    if (c === "A" || c === "B" || c === "X" || c === "Y") return c;
    throw Error("Invalid tree leaf");
  }
  const tree = node();
  if (at !== source.length) throw Error("Invalid tree notation");
  return tree;
}
export const notation = (tree: Tree): string =>
  typeof tree === "string"
    ? tree
    : `(${notation(tree[0])}${notation(tree[1])})`;
export const leaves = (tree: Tree): number =>
  typeof tree === "string" ? 1 : leaves(tree[0]) + leaves(tree[1]);
export const matches = (tree: Tree, bud: Bud): number =>
  typeof tree === "string"
    ? Number(tree === bud)
    : matches(tree[0], bud) + matches(tree[1], bud);
export type TreeLevel = {
  id: string;
  start: Tree;
  target: Tree;
  cards: Card[];
  turns: number;
  leafLimit: number;
  solution: number[];
};
const data = [
  ["A", "(XY)", "A(AB) AX BY", "3/8", "1-2-3"],
  ["A", "(YX)", "A(AB) A(BA) AX BY", "3/8", "2-3-4"],
  ["(AB)", "((XX)Y)", "A(AA) B(BA) AX BY", "3/10", "1-3-4"],
  ["(BA)", "((YY)(YX))", "B(BB) A(BA) AX BY A(AB)", "4/12", "1-2-3-4"],
  ["(AB)", "((XY)((XY)X))", "A(AB) A(AX) AX B(AX) B(BA) BY", "4/10", "4-1-3-6"],
  [
    "(AB)",
    "((Y(XY))((Y(XY))(XY)))",
    "B(YA) AX B(AB) BY A(YB) A(AX)",
    "5/10",
    "3-5-3-2-4",
  ],
  [
    "(BA)",
    "(((Y(YX))(YX))(YX))",
    "B(XA) A(BA) BY A(XB) B(BA) AX",
    "5/10",
    "5-5-2-3-6",
  ],
  [
    "(BA)",
    "(((YX)X)(((YX)X)X))",
    "AX B(AA) BY A(BA) A(BX) B(BA)",
    "5/10",
    "4-6-6-1-3",
  ],
  [
    "B",
    "((X(XY))((X(XY))(XY)))",
    "B(AB) A(XB) AX BY A(AA) B(AA)",
    "6/14",
    "1-1-2-1-3-4",
  ],
  [
    "(BA)",
    "((Y(X(X(XY))))(X(X(XY))))",
    "BY B(AA) B(YA) A(AB) AX A(XA)",
    "6/14",
    "3-6-6-4-1-5",
  ],
  [
    "A",
    "(X((X((YX)X))(X((YX)X))))",
    "AX A(XB) A(AX) BY B(BA) B(AA)",
    "7/14",
    "2-6-2-5-5-1-4",
  ],
  [
    "B",
    "((((XY)(YY))X)(((XY)(YY))X))",
    "B(AX) B(BB) A(AB) AX BY",
    "7/14",
    "2-1-3-2-3-4-5",
  ],
] as const;
export const treeLevels: TreeLevel[] = data.map(
  ([start, target, cards, bounds, solution], i) => {
    const [turns, leafLimit] = bounds.split("/").map(Number);
    return {
      id: `recursive-orchard-${String(i + 1).padStart(3, "0")}`,
      start: parse(start),
      target: parse(target),
      cards: cards
        .split(" ")
        .map((card) => ({ bud: card[0] as Bud, grows: parse(card.slice(1)) })),
      turns,
      leafLimit,
      solution: solution.split("-").map(Number),
    };
  },
);
function rewrite(tree: Tree, card: Card): Tree {
  if (typeof tree === "string") return tree === card.bud ? card.grows : tree;
  return [rewrite(tree[0], card), rewrite(tree[1], card)];
}
export function predict(level: TreeLevel, state: Tree, index: number) {
  const card = level.cards[index];
  if (!card) return { count: 0, fits: false };
  const count = matches(state, card.bud);
  return {
    count,
    fits: leaves(state) + count * (leaves(card.grows) - 1) <= level.leafLimit,
  };
}
export function apply(
  level: TreeLevel,
  state: Tree,
  used: number,
  index: number,
): { tree: Tree; count: number } | { reason: string } {
  if (won(level, state)) return { reason: "目标已经达成。" };
  if (used >= level.turns) return { reason: "步数已用完，可以撤销后再试。" };
  const { count, fits } = predict(level, state, index);
  if (!count) return { reason: "树上没有这张卡能影响的芽。" };
  if (!fits)
    return { reason: `这次生长会超过 ${level.leafLimit} 个末端，树保持不变。` };
  return { tree: rewrite(state, level.cards[index]), count };
}
export const won = (level: TreeLevel, tree: Tree) =>
  notation(tree) === notation(level.target);

// Existing branches and mature leaves cannot change. BFS prunes any prefix
// incompatible with the ordered target, and chooses a shortest viable replay.
function compatible(tree: Tree, target: Tree): boolean {
  if (typeof tree === "string")
    return tree === "A" || tree === "B" || tree === target;
  return (
    typeof target !== "string" &&
    compatible(tree[0], target[0]) &&
    compatible(tree[1], target[1])
  );
}
export function hint(
  level: TreeLevel,
  tree: Tree,
  used: number,
): { kind: "move"; index: number } | { kind: "dead" | "budget" } {
  if (!compatible(tree, level.target)) return { kind: "dead" };
  const queue = [{ tree, used, first: -1 }];
  const seen = new Set([notation(tree)]);
  for (let i = 0; i < queue.length; i++) {
    if (i >= 6000) return { kind: "budget" };
    const row = queue[i];
    if (row.used >= level.turns) continue;
    for (let card = 0; card < level.cards.length; card++) {
      const result = apply(level, row.tree, row.used, card);
      if ("reason" in result || !compatible(result.tree, level.target))
        continue;
      const first = row.first < 0 ? card : row.first;
      if (won(level, result.tree)) return { kind: "move", index: first };
      const key = notation(result.tree);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ tree: result.tree, used: row.used + 1, first });
      }
    }
  }
  return { kind: "dead" };
}
