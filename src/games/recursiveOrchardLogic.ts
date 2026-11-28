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
  ["(AB)","((((XY)X)X)X)","AX BX A(AX) A(BY)","4/8","3-3-4-2"], // 13
  ["B","((YX)((YX)X))","B(AB) BX A(YB) AY","4/8","1-1-3-2"], // 14
  ["(AB)","((Y(Y(YX)))X)","BX A(YA) A(YB) AY","4/8","2-2-3-1"], // 15
  ["B","(X((YY)(YY)))","BY B(XA) A(AA) AY","4/8","2-3-3-4"], // 16
  ["(BA)","((X(X(YY)))Y)","BX B(AA) B(XB) AY","4/8","3-3-2-4"], // 17
  ["(AB)","(X(((YX)Y)Y))","AX BY B(BY) B(YA)","4/8","3-3-4-1"], // 18
  ["(BA)","((Y(XX))((XX)X))","A(AX) AX B(YA) BY","4/8","1-3-1-2"], // 19
  ["(BA)","(((YX)X)(Y(YX)))","AX B(AX) BX A(YA)","4/8","4-2-4-1"], // 20
  ["(AB)","(((YY)Y)(X(YY)))","A(AY) AY BY B(XA)","4/8","1-4-1-2"], // 21
  ["(AB)","((X(XY))(Y(XY)))","A(XA) BX AY B(YA)","4/8","1-4-1-3"], // 22
  ["(BA)","((Y((YY)X))((YY)X))","B(YA) BY A(BX) AY","4/8","1-3-1-4"], // 23
  ["(BA)","((Y((XX)X))((XX)X))","BY AX B(YA) A(AX)","4/8","3-4-4-2"], // 24
  ["A","((X(YY))(X(YY)))","BX A(XB) AY A(AA) A(XA) B(BA)","4/10","4-5-4-3"], // 25
  ["(BA)","((XY)((XY)(YX)))","BY AX B(AY) B(BY) A(BA) A(YA)","4/10","5-6-3-2"], // 26
  ["(B(BA))","(Y(Y(Y(Y(XY)))))","A(XB) BY AY A(YA) B(BB) A(BB)","4/10","4-4-1-2"], // 27
  ["((AB)A)","((((XX)Y)X)((XX)Y))","AX B(AA) A(BX) A(BA) BX A(BY)","4/10","5-6-2-1"], // 28
  ["(B(BA))","((X(XY))((X(XY))(YY)))","A(YA) A(YB) B(YA) AX B(XB) BY","4/10","5-5-2-6"], // 29
  ["(BB)","((X(X(YY)))(X(X(YY))))","A(AX) B(XB) BX B(AA) A(AA) AY","4/10","2-2-4-6"], // 30
  ["(B(BA))","((X(Y(YY)))((X(Y(YY)))(YY)))","B(AY) AY A(BY) B(YA) BY B(XB)","4/10","6-4-3-5"], // 31
  ["(BA)","((((XX)X)(XX))Y)","B(BB) A(BX) A(BY) AY B(AB) BX","5/10","4-5-2-1-6"], // 32
  ["(AB)","((Y(Y(YY)))(X(YY)))","A(YA) B(XA) BX B(AB) A(BY) AY","5/10","1-1-2-1-6"], // 33
  ["((AB)A)","((X(X(X((XX)Y))))X)","B(AX) AX B(BY) A(BB) BY B(AB)","5/10","6-6-3-1-2"], // 34
  ["B","((((YY)X)(YY))(YY))","B(AX) B(BA) AX BY A(AB) A(BY)","5/10","2-2-1-6-4"], // 35
  ["A","(((XY)(YY))((XY)(YY)))","BY A(BB) B(XB) B(BY) B(BA) AX","5/10","2-5-3-2-1"], // 36
  ["(AB)","((Y(X(X(YX))))(X(X(YX))))","AX BX A(YB) A(BA) B(XA) B(AA)","5/10","3-5-4-3-2"], // 37
  ["((AB)A)","(((XY)(((XX)(XY))X))(XY))","A(BY) B(BA) AY A(XB) BX B(BX)","5/10","6-2-6-1-5"], // 38
  ["(B(BA))","(((Y(YX))X)(((Y(YX))X)X))","A(YA) B(XB) B(BY) AX BY B(AX)","5/10","4-6-1-1-4"], // 39
  ["(AA)","((X(X((XY)X)))(X(X((XY)X))))","BX AY B(AB) B(BB) A(XA) A(AX)","5/10","5-5-6-5-2"], // 40
  ["(AB)","((XX)(((XY)(XX))Y))","B(XA) B(BY) B(BA) AY BX A(BB)","5/11","2-3-2-6-5"], // 41
  ["(AB)","((XY)(X(X(X(XY)))))","BX B(XB) B(XA) A(BY) B(BX) AX","5/11","2-2-3-4-1"], // 42
  ["B","(((X(YX))(YX))(YX))","B(AB) A(XB) A(AB) BX AX B(YB)","5/11","1-3-2-6-4"], // 43
  ["(AB)","(((YX)(((YX)X)X))(YX))","A(BA) A(AX) B(BA) BY AX B(YA)","5/11","1-2-1-6-5"], // 44
  ["(AB)","(((XX)(XX))(((XX)(XX))Y))","A(AX) B(AY) B(XA) AX BY A(BA)","5/11","2-6-1-3-4"], // 45
  ["((AB)A)","(((YX)(Y(Y((YX)X))))(YX))","AY BX B(YA) B(AB) B(YB) A(YB)","5/11","5-5-4-6-2"], // 46
  ["(BB)","((Y(((YY)Y)X))(Y(((YY)Y)X)))","AY BY A(BX) A(BB) B(BA) B(YA)","5/11","6-3-5-6-1"], // 47
  ["(BB)","(((XY)((YY)Y))((XY)((YY)Y)))","B(AB) A(AA) B(BY) BY AX A(XB)","5/11","1-3-3-6-4"], // 48
  ["(AA)","((X(X(X(XY))))(X(X(X(XY)))))","BY A(XA) B(AX) AX A(XB) B(AA)","5/11","2-2-2-5-1"], // 49
  ["(BB)","((X(((YX)X)X))(X(((YX)X)X)))","A(BX) BY B(XA) B(YA) B(BX) AY","5/11","3-1-5-5-2"], // 50
  ["(BB)","((X(X(X(YY))))(X(X(X(YY)))))","B(BB) A(BX) B(AA) AX B(XB) BY","5/11","5-5-5-1-6"], // 51
  ["(AA)","((((Y(YX))X)X)(((Y(YX))X)X))","BY B(XB) B(AX) A(BA) A(BX) AY","5/11","5-3-4-5-1"], // 52
  ["(AA)","((Y((X(XX))X))(Y((X(XX))X)))","AX A(YB) A(BX) BX B(AB) A(XA)","5/11","2-5-6-3-4"], // 53
  ["(BB)","((Y(((YY)X)X))(Y(((YY)X)X)))","A(AX) B(BA) A(BA) AY A(BB) BY","5/11","2-1-1-5-6"], // 54
  ["(B(BA))","(((XX)Y)(((XX)Y)(((XX)X)(XX))))","B(BY) A(BX) B(AX) BX AX A(AB)","5/11","1-6-2-3-5"], // 55
  ["(B(BA))","((((XX)Y)(XX))((((XX)Y)(XX))X))","B(AB) A(YB) AX B(BX) A(BY) BX","5/11","3-1-5-4-6"], // 56
  ["(BA)","(((XX)((XX)X))(((XX)((XX)X))Y))","B(AB) A(XA) BX A(XB) A(BY) AY","5/11","5-1-1-4-3"], // 57
  ["((AB)A)","(((Y(XX))((X(Y(XX)))X))(Y(XX)))","B(BX) BY A(AA) B(XA) A(YB) AX","5/11","1-4-5-4-6"], // 58
  ["(BA)","(X(((Y(YY))(YY))(YY)))","B(YB) A(AB) B(YA) A(AA) AY BX","6/13","6-2-2-2-3-5"], // 59
  ["(AB)","(((XY)Y)((XY)((XY)X)))","AX B(AB) B(XA) BX A(AB) A(AY)","6/13","6-2-2-4-6-1"], // 60
  ["(AB)","((YY)((X(X(Y(YY))))X))","A(YA) B(YA) B(BX) BY AY B(XB)","6/13","3-6-6-2-1-5"], // 61
  ["A","((((YY)Y)((YY)(YY)))X)","AY A(BB) B(BY) A(AX) BY A(BA)","6/13","4-6-3-2-3-5"], // 62
  ["(AB)","((XX)(((Y(YX))(XX))(XX)))","B(BA) B(YB) BX B(AB) A(BX) AX","6/13","1-1-2-2-5-3"], // 63
  ["(BA)","((((X(XX))Y)Y)(X(X(XX))))","B(BY) BX B(AY) B(YA) A(XA) AX","6/13","1-5-3-5-5-6"], // 64
  ["(AB)","((((YY)Y)(YY))(((YY)(YY))X))","BY B(BB) AY A(AB) B(BX) A(BY)","6/13","5-2-4-6-2-1"], // 65
  ["(AA)","(((X(X(XX)))Y)((X(X(XX)))Y))","BY B(BB) AX A(AB) B(AX) B(AB)","6/13","4-1-4-6-5-3"], // 66
  ["(AA)","((Y(Y(X(XX))))(Y(Y(X(XX)))))","B(AA) AX B(YA) BY A(BA) A(XB)","6/13","5-5-4-6-1-2"], // 67
  ["B","(X((X((XY)(XY)))(X((XY)(XY)))))","B(XA) BX AY A(YB) A(BB) B(BX)","6/13","1-5-1-5-1-3"], // 68
  ["(AB)","(X((Y((YX)(YX)))(Y((YX)(YX)))))","A(BY) B(YB) BX A(BA) B(BB) AX","6/13","5-2-5-2-3-6"], // 69
  ["(B(BA))","(((X((XX)Y))X)(((X((XX)Y))X)Y))","A(XB) BX AY A(YB) B(AX) B(AY)","6/13","3-5-1-6-1-2"], // 70
  ["(B(BA))","(((XY)Y)(((XY)Y)((X((XY)Y))Y)))","B(BY) B(XA) BX AX A(AB) A(AY)","6/13","6-5-1-1-3-4"], // 71
  ["(BA)","((Y(Y(((XX)(XX))X)))((XX)(XX)))","B(AX) B(XA) A(AA) BX AX B(YB)","6/13","6-6-1-3-3-5"], // 72
  ["(AB)","((X(Y(Y(Y(YY)))))(Y(Y(Y(YY)))))","A(XB) AY A(BB) B(YB) BY A(YB)","6/13","1-4-4-4-4-5"], // 73
  ["(BB)","((X((X((XY)Y))Y))(X((X((XY)Y))Y)))","B(BX) A(XB) AY BY B(XA) A(BY)","6/13","5-6-5-6-5-3"], // 74
  ["(BB)","((((X((XY)Y))X)X)(((X((XY)Y))X)X))","B(AA) B(BX) BY B(XA) AX A(AY)","6/13","2-2-4-6-6-5"], // 75
  ["(BB)","(((((XY)Y)Y)(XX))((((XY)Y)Y)(XX)))","B(BY) B(BA) A(BB) AX B(BX) BX","6/13","2-1-1-1-3-6"], // 76
  ["A","((((YX)(YY))(YY))(((YX)(YY))(YY)))","B(BA) B(YA) A(BB) BY AX B(BX)","6/13","3-1-1-6-3-4"], // 77
  ["(BA)","(((((XX)Y)Y)(((XX)Y)Y))((((XX)Y)Y)Y))","A(AY) BY B(YA) A(AA) B(AA) AX","6/13","1-5-1-1-4-6"], // 78
  ["(BA)","(Y((X(((XX)X)((XX)X)))Y))","B(BA) B(BB) BY A(AB) AX B(AA)","7/14","4-3-4-2-1-6-5"], // 79
  ["(BA)","((Y((X(XX))((X(XX))(XX))))X)","AX B(AB) BY B(YA) B(AX) A(AB)","7/14","1-4-6-2-6-5-1"], // 80
  ["B","(X((((Y(XY))(XY))(XY))(XY)))","A(XB) A(AB) BY B(XA) AY A(BA)","7/14","4-2-2-2-2-4-5"], // 81
  ["B","(X((X(X(X(YY))))(X(X(X(YY))))))","A(XA) B(XB) BY A(AY) AX B(BB)","7/14","2-6-2-2-2-6-3"], // 82
  ["A","(X((X(X(Y(YY))))(X(X(Y(YY))))))","B(XA) AY A(XA) A(BB) BY A(BA)","7/14","3-4-1-3-6-4-5"], // 83
  ["(AB)","((Y((YX)((YX)((YX)((YX)X)))))(YX))","A(YB) B(YA) A(BA) AX BY A(YA)","7/14","6-3-3-3-3-2-4"], // 84
  ["(BA)","((X(X(X(Y(YY)))))(Y(X(X(Y(YY))))))","A(XB) B(BA) BY B(XB) AY A(YB)","7/14","4-6-4-4-2-6-3"], // 85
  ["(B(BA))","(Y(Y(((Y((YY)X))((YY)X))((YY)X))))","BY A(AB) B(AX) A(YB) B(AY) AY","7/14","1-2-2-4-3-4-1"], // 86
  ["((AB)A)","((((Y(Y(YY)))Y)(XX))((Y(Y(YY)))Y))","B(YB) AY BX B(YA) A(BA) B(XB)","7/14","6-3-5-1-1-4-2"], // 87
  ["B","((Y(X(YY)))((Y(X(YY)))(Y(X(YY)))))","B(YB) B(AB) B(XB) AY BY A(YB)","7/14","2-2-1-6-3-1-5"], // 88
  ["(BB)","((X(X(X((XY)Y))))(X(X(X((XY)Y)))))","B(AX) A(BA) BX A(BX) AY B(XA)","7/14","6-2-2-3-2-6-5"], // 89
  ["((AB)A)","(((Y(X(X(XY))))(XX))(Y(X(X(XY)))))","A(AB) B(XB) BX A(BX) B(XA) AY","7/14","2-3-1-2-2-5-6"], // 90
  ["B","(((Y((YY)(YY)))X)(((Y((YY)(YY)))X)Y))","B(BB) A(BX) B(AB) BX AY B(AY)","7/14","3-6-2-3-1-6-5"], // 91
  ["((AB)A)","(((XX)(Y(Y(Y((Y(XX))(Y(XX)))))))(XX))","B(YB) AX BY A(XA) B(BB) B(YA)","7/14","1-1-1-5-6-4-2"], // 92
  ["(BB)","((X(X(X(X(X(YY))))))(X(X(X(X(X(YY)))))))","A(BY) AY A(YA) BY B(XB) B(AA)","7/14","5-5-5-5-5-6-2"], // 93
  ["B","((Y((X(YY))(X(YY))))(Y((X(YY))(X(YY)))))","A(AA) AY B(AA) BX A(XA) A(AB)","7/14","3-6-2-3-5-1-2"], // 94
  ["(AB)","((Y(Y(Y(YY))))((Y(Y(Y(YY))))((Y(YY))X)))","BX AY A(YA) B(AB) B(BB) B(AX)","7/14","4-3-3-6-3-3-2"], // 95
  ["((AB)A)","((((X(XY))X)(X(((X(XY))Y)Y)))((X(XY))X))","B(XB) A(BX) BX B(AB) B(BY) AY","7/14","1-5-5-2-1-5-3"], // 96
  ["(B(BA))","((((YX)X)X)((((YX)X)X)(((YY)(YX))(YX))))","BY B(BY) A(BB) A(AB) B(BX) AX","7/14","5-5-4-4-5-3-1"], // 97
  ["(BB)","((Y(Y(Y(Y((YY)X)))))(Y(Y(Y(Y((YY)X))))))","BX A(AX) B(YB) A(AA) B(AX) AY","7/14","3-3-3-3-5-4-6"], // 98
  ["((AB)A)","((((XY)Y)(((Y((XY)Y))Y)((XY)Y)))((XY)Y))","B(XA) B(BY) AY BY B(BA) A(BA)","7/14","5-2-5-4-6-1-3"], // 99
  ["((AB)A)","((((Y((XX)(XX)))X)(YX))((Y((XX)(XX)))X))","B(YB) A(XB) A(BX) BX B(BB) AX","7/14","1-4-3-1-5-5-4"], // 100
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
