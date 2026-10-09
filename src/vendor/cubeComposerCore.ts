// SPDX-License-Identifier: MIT
// Cube Composer pure rules, faithfully translated from PureScript.
// Copyright (c) 2015–2016 David Peter. Original commit a891ffe5de79b072819da04718820d0452b9a201.
// Full permission notice: vendor/cube-composer-original/upstream/LICENSE.
export type Cube = "Cyan" | "Brown" | "Red" | "Orange" | "Yellow";
/** Columns are ordered left-to-right; cubes in each column are bottom-to-top. */
export type Wall = readonly (readonly Cube[])[];
export type Transformer = (wall: Wall) => Wall;
const sameStack = (a: readonly Cube[], b: readonly Cube[]) => a.length === b.length && a.every((cube, i) => cube === b[i]);
export const sameCubeWall = (a: Wall, b: Wall) => a.length === b.length && a.every((stack, i) => sameStack(stack, b[i]));
const replace = (from: Cube, to: readonly Cube[]): Transformer => wall => wall.map(stack => stack.flatMap(cube => cube === from ? to : [cube]));
const reject = (color: Cube): Transformer => wall => wall.map(stack => stack.filter(cube => cube !== color)).filter(stack => stack.length > 0);
const stack = (color: Cube): Transformer => wall => wall.map(column => [...column, color]);
const partition = (color: Cube): Transformer => wall => [...wall.filter(column => !column.includes(color)), ...wall.filter(column => column.includes(color))];

// Compare every member to the original first column of its run, not the growing result.
const stackEqualColumns: Transformer = wall => {
  const result: Cube[][] = [];
  for (let i = 0; i < wall.length;) {
    const first = wall[i], joined = [...first];
    let j = i + 1;
    while (j < wall.length && sameStack(first, wall[j])) { joined.push(...wall[j]); j++; }
    result.push(joined); i = j;
  }
  return result;
};
const cxToX = (column: readonly Cube[]): Cube[] => {
  const result: Cube[] = [];
  for (let i = 0; i < column.length; i++) {
    if (column[i] === "Cyan" && i + 1 < column.length) result.push(column[++i]);
    else result.push(column[i]);
  }
  return result;
};
const ooToC = (column: readonly Cube[]): Cube[] => {
  const result: Cube[] = [];
  for (let i = 0; i < column.length; i++) {
    if (column[i] === "Orange" && column[i + 1] === "Orange") { result.push("Cyan"); i++; }
    else result.push(column[i]);
  }
  return result;
};
/** Original toDigit treats every non-orange cube as one; only the first 3 slots count. */
export const cubeNumber = (column: readonly Cube[]) => column.slice(0, 3).reduce((sum, cube, i) => sum + (cube === "Orange" ? 0 : 1 << i), 0);
const toColumn = (number: number): Cube[] => [1, 2, 4].map(bit => (number & bit) === bit ? "Brown" : "Orange");
const numbers = (operation: (number: number) => number): Transformer => wall => wall.map(column => toColumn(operation(cubeNumber(column))));

/** IDs are chapter scoped. Repeated IDs have the same original semantics. */
const functions: Readonly<Record<string, Transformer>> = {
  replaceYbyR: replace("Yellow", ["Red"]),
  stackY: stack("Yellow"),
  replaceYbyYR: replace("Yellow", ["Yellow", "Red"]),
  rejectY: reject("Yellow"),
  mapYtoYR: replace("Yellow", ["Yellow", "Red"]),
  mapCtoRC: replace("Cyan", ["Red", "Cyan"]),
  rejectC: reject("Cyan"),
  filterContainsR: wall => wall.filter(column => column.includes("Red")).filter(column => column.length > 0),
  stackR: stack("Red"),
  mapReverse: wall => wall.map(column => [...column].reverse()),
  replaceYbyB: replace("Yellow", ["Brown"]),
  replaceYbyBY: replace("Yellow", ["Brown", "Yellow"]),
  replaceBbyOO: replace("Brown", ["Orange", "Orange"]),
  rejectO: reject("Orange"),
  stackEqualColumns,
  mapXtoOX: wall => wall.map(column => column.flatMap(cube => ["Orange" as Cube, cube])),
  mapCXtoX: wall => wall.map(cxToX),
  mapOOtoC: wall => wall.map(ooToC),
  mapCtoO: replace("Cyan", ["Orange"]),
  replaceRbyC: replace("Red", ["Cyan"]),
  replaceCbyY: replace("Cyan", ["Yellow"]),
  partitionContainsC: partition("Cyan"),
  partitionContainsR: partition("Red"),
  mapAdd1: numbers(n => n + 1),
  mapSub1: numbers(n => n - 1),
  mapMul2: numbers(n => n * 2),
  mapPow2: numbers(n => n * n),
  filterEven: wall => wall.filter(column => cubeNumber(column) % 2 === 0),
};
export function validCubeProgram(program: unknown, allowed: readonly string[]): program is string[] {
  return Array.isArray(program) && program.length <= allowed.length && new Set(program).size === program.length
    && program.every(id => typeof id === "string" && allowed.includes(id) && Object.hasOwn(functions, id));
}
/** A malformed, duplicate or out-of-chapter program cannot be executed. */
export function cubeSteps(initial: Wall, program: readonly string[], allowed: readonly string[]): Wall[] {
  if (!validCubeProgram(program, allowed)) return [initial];
  const result: Wall[] = [initial];
  for (const id of program) result.push(functions[id](result[result.length - 1]));
  return result;
}
