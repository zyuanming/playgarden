import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { shikakuLevels } from "../src/games/shikakuLevels";
import { completeLevel, initialProgress, parseProgress } from "../src/lib/progress";
import legacy from "./fixtures/shikakuLegacy.json";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const report = JSON.parse(readFileSync(resolve(process.cwd(), "docs/shikaku/authoring-report.json"), "utf8")) as { contentHash: string; count: number; levels: { id: string }[] };

function canonical(index: number, partition: boolean) {
  const level = shikakuLevels[index], n = level.size;
  const variants: string[] = [];
  for (let symmetry = 0; symmetry < 8; symmetry++) {
    const transform = (cell: number) => {
      let row = Math.floor(cell / n), column = cell % n;
      if (symmetry >= 4) column = n - 1 - column;
      for (let turn = 0; turn < symmetry % 4; turn++) [row, column] = [column, n - 1 - row];
      return row * n + column;
    };
    const data = partition
      ? level.solution.map(([top, left, bottom, right]) => {
          const cells: number[] = [];
          for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) cells.push(transform(row * n + column));
          return cells.sort((a, b) => a - b).join(",");
        }).sort()
      : level.clues.map(clue => `${transform(clue.index)}:${clue.area}`).sort();
    variants.push(JSON.stringify([n, data]));
  }
  return variants.sort()[0];
}
describe("Shikaku appended campaign contract", () => {
  it("preserves all original objects and their current-save indices", () => {
    expect(shikakuLevels.slice(0, 12)).toEqual(legacy);
    let save = initialProgress();
    for (const level of [0, 1, 11]) save = completeLevel(save, "shikaku", level);
    expect(parseProgress(JSON.stringify(save)).completed.shikaku).toEqual([0, 1, 11]);
    expect([0, 1, 11].map(i => shikakuLevels[i].title)).toEqual(["三块苗圃", "花床转角", "园艺规划师"]);
  });
  it("has 200 distinct clue boards AND region structures modulo rotations/reflections", () => {
    expect(shikakuLevels).toHaveLength(200);
    expect(new Set(shikakuLevels.map((_, i) => canonical(i, false))).size).toBe(200);
    expect(new Set(shikakuLevels.map((_, i) => canonical(i, true))).size).toBe(200);
  });
  it("binds added stable IDs, grouping, versions and public content digest", () => {
    const added = shikakuLevels.slice(12);
    expect(added.map(level => level.id)).toEqual(Array.from({ length: 188 }, (_, i) => `shikaku-${String(i + 13).padStart(3, "0")}`));
    expect([1, 2, 3, 4].map(chapter => added.filter(level => level.chapter === chapter).length)).toEqual([28, 50, 50, 60]);
    expect(added.every(level => level.contentVersion === 1 && !!level.objective && level.size >= 4 && level.size <= 7)).toBe(true);
    const digest = createHash("sha256").update(JSON.stringify(shikakuLevels.map(level => ({ size: level.size, clues: level.clues })))).digest("hex");
    expect(digest).toBe(report.contentHash);
    expect(report.count).toBe(200);
    expect(report.levels.map(level => level.id)).toEqual(added.map(level => level.id));
  });
  it("keeps a fully earned current campaign small without adding a save schema", () => {
    let save = initialProgress();
    for (let index = 0; index < 200; index++) save = completeLevel(save, "shikaku", index);
    const raw = JSON.stringify(save), reloaded = parseProgress(raw);
    expect(reloaded.version).toBe(2);
    expect(reloaded.completed.shikaku).toEqual(Array.from({ length: 200 }, (_, i) => i));
    expect(new TextEncoder().encode(raw).length).toBeLessThan(5000);
  });
});
