// SPDX-License-Identifier: GPL-3.0-only
export type Tool = "C" | "S";
export type Material = "P" | "M" | "G" | "X";
export type Supplies = readonly [number, number];
export type Counts = readonly [number, number, number];
export type Node =
  | { material: Material }
  | {
      id: string;
      tool: Tool;
      parts: readonly [Node, Node];
      pure: Material | null;
    };

export type Blueprint = {
  id: string;
  items: readonly string[];
  tools: Supplies;
  goal: Counts;
};
export type Board = Blueprint & { objects: readonly Node[] };
export type JointState = "sealed" | "available" | "empty" | "opened" | "sorted";
export const toolNames = { C: "卡扣", S: "螺丝" };
export const materialNames = { P: "纸", M: "金属", G: "玻璃", X: "残余" };
export const materialKeys = ["P", "M", "G"] as const;
const pure = (node: Node) => ("material" in node ? node.material : node.pure);
const toolSlot = (tool: Tool) => (tool === "C" ? 0 : 1);

export function makeBoard(blueprint: Blueprint): Board {
  let serial = 0;
  const objects = blueprint.items.map((source) => {
    let index = 0;
    const consume = (expected: string) => {
      if (source[index++] !== expected) throw Error("Invalid workshop joint");
    };
    function read(): Node {
      const kind = source[index++];
      if (kind === "P" || kind === "M" || kind === "G" || kind === "X") {
        return { material: kind };
      }
      if (kind !== "S" && kind !== "C") throw Error("Unknown workshop part");
      const id = String.fromCharCode(65 + serial++);
      consume("(");
      const first = read();
      consume(",");
      const second = read();
      consume(")");
      const firstPure = pure(first);
      return {
        id,
        tool: kind,
        parts: [first, second],
        pure: firstPure === pure(second) ? firstPure : null,
      };
    }
    const node = read();
    if (index !== source.length) throw Error("Trailing workshop part");
    return node;
  });
  return { ...blueprint, objects };
}

export function inspect(board: Board, order: readonly string[]) {
  const opened = new Set(order);
  const bins: [number, number, number] = [0, 0, 0];
  const tools: [number, number] = [...board.tools];
  const joints: Record<string, JointState> = {};
  const exposed: { id: string; tool: Tool }[] = [];

  function traverse(node: Node, accessible: boolean, sorted = false) {
    if ("material" in node) {
      const index = materialKeys.findIndex((key) => key === node.material);
      if (accessible && index !== -1) bins[index]++;
      return;
    }
    if (!accessible) {
      joints[node.id] = "sealed";
      for (const part of node.parts) traverse(part, false);
    } else if (sorted || node.pure) {
      joints[node.id] = "sorted";
      for (const part of node.parts) traverse(part, true, true);
    } else if (opened.has(node.id)) {
      joints[node.id] = "opened";
      tools[toolSlot(node.tool)]--;
      for (const part of node.parts) traverse(part, true);
    } else {
      exposed.push(node);
      for (const part of node.parts) traverse(part, false);
    }
  }

  for (const object of board.objects) traverse(object, true);
  for (const { id, tool } of exposed) {
    joints[id] = tools[toolSlot(tool)] > 0 ? "available" : "empty";
  }
  const won = board.goal.every((quota, index) => bins[index] >= quota);
  return { bins, tools, joints, won };
}

export function nextJoint(
  board: Board,
  order: readonly string[],
): string | null {
  const visited = new Set<string>();
  function search(path: readonly string[]): string[] | null {
    const key = [...path].sort().join("");
    if (visited.has(key)) return null;
    visited.add(key);
    const current = inspect(board, path);
    if (current.won) return [];
    for (const [id, state] of Object.entries(current.joints)) {
      if (state !== "available") continue;
      const tail = search([...path, id]);
      if (tail) return [id, ...tail];
    }
    return null;
  }
  return search(order)?.[0] ?? null;
}
