// SPDX-License-Identifier: GPL-3.0-only
import { it, expect } from "vitest";
import {
  createSnake,
  startSnake,
  turnSnake,
  stepSnake,
  spawnFood,
  parseSnake,
  serializeSnake,
  type SnakeState,
} from "../src/vendor/snake/core";
it("queues two legal turns in order without reversing into the neck", () => {
  let s = startSnake(createSnake(7));
  expect(turnSnake(s, 3)).toBe(s);
  s = turnSnake(turnSnake(s, 0), 3);
  expect(s.queue).toEqual([0, 3]);
  expect(turnSnake(s, 2)).toBe(s);
  s = stepSnake(s);
  expect(s.body[0]).toBe(117);
  expect(s.direction).toBe(0);
  s = stepSnake(s);
  expect(s.body[0]).toBe(116);
  expect(s.direction).toBe(3);
});
it("eating grows once and puts the next fruit on an empty cell", () => {
  let s = startSnake(createSnake(7));
  for (let i = 0; i < 4; i++) s = stepSnake(s);
  expect(s.body).toHaveLength(5);
  expect(s.score).toBe(1);
  expect(s.body.includes(s.food!)).toBe(false);
  expect(s.food).not.toBeNull();
});
it("wall and body end the game while stepping into the vacated tail is legal", () => {
  let s = startSnake(createSnake(1));
  for (let i = 0; i < 11; i++) s = stepSnake(s);
  expect(s).toMatchObject({ phase: "dead", reason: "wall" });
  expect(stepSnake(s)).toBe(s);
  const loop: SnakeState = {
    ...startSnake(createSnake(1)),
    body: [17, 18, 34, 33],
    direction: 3,
    food: 100,
  };
  expect(stepSnake(turnSnake(loop, 2)).phase).toBe("playing");
  const blocked = { ...loop, body: [17, 18, 34, 33, 32, 16], score: 2 };
  expect(stepSnake(turnSnake(blocked, 2))).toMatchObject({
    phase: "dead",
    reason: "body",
  });
});
it("only a genuinely full board wins; no random retry limit causes false success", () => {
  const path: number[] = [];
  for (let row = 0; row < 16; row++)
    for (let col = 0; col < 16; col++)
      path.push(row * 16 + (row % 2 ? 15 - col : col));
  const body = path.slice(0, -1).reverse();
  const s: SnakeState = {
    body,
    direction: 3,
    queue: [],
    food: 240,
    seed: 8,
    score: 251,
    phase: "playing",
  };
  const won = stepSnake(s);
  expect(won.phase).toBe("won");
  expect(won.body).toHaveLength(256);
  expect(won.score).toBe(252);
  expect(won.food).toBeNull();
  expect(spawnFood(path.slice(1), 2).food).toBe(0);
});
it("round save preserves board and score but never replays queued turns", () => {
  let s = startSnake(createSnake(23));
  s = turnSnake(s, 0);
  const restored = parseSnake(serializeSnake(s))!;
  expect(restored.body).toEqual(s.body);
  expect(restored.queue).toEqual([]);
  expect(parseSnake("{")).toBeNull();
  expect(
    parseSnake(
      JSON.stringify({ version: 1, state: { ...s, body: [1, 2, 2, 3] } }),
    ),
  ).toBeNull();
  expect(
    parseSnake(JSON.stringify({ version: 1, state: { ...s, food: 133 } })),
  ).toBeNull();
});
