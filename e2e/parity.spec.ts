// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator, type Page } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";
import { parityLevels } from "../src/games/parityLevels";

type Direction = "u" | "d" | "l" | "r";
type Position = { values: number[]; cursor: number; moves: number };
type Checkpoint = {
  index: number;
  mode: "vanilla" | "b&w";
  values: number[];
  colors: string;
  cursor: number;
  route: string;
  target: number;
};

// Original story.json boundaries, not generated replacements. Levels 50 and 100
// retain the upstream solutions. The two introductory routes were planned only
// for these exact boards; this journey does not run a solver or campaign sweep.
const checkpoints: Checkpoint[] = [
  {
    index: 0, mode: "vanilla", values: [1, 0, 0, 1, 1, 0, 1, 1, 0],
    colors: "wwwwwwwww", cursor: 0, route: "rrdd", target: 1,
  },
  {
    index: 49, mode: "vanilla", values: [6, 6, 5, 4, 4, 3, 5, 5, 5],
    colors: "wwwwwwwww", cursor: 7, route: "rllurrlruddllurrulld", target: 7,
  },
  {
    index: 50, mode: "b&w", values: [0, 3, 0, 3, -2, 3, 0, 2, 0],
    colors: "wbwbwbwbw", cursor: 8, route: "uuddluududludd", target: 1,
  },
  {
    index: 99, mode: "b&w", values: [4, 2, 8, 10, 11, 6, 7, 4, 6],
    colors: "wwbbbwbww", cursor: 5, route: "luldudrldrulrurlrldd", target: 6,
  },
];

const directions: Direction[] = ["u", "d", "l", "r"];
const keys: Record<Direction, string> = {
  u: "ArrowUp", d: "ArrowDown", l: "ArrowLeft", r: "ArrowRight",
};
const rootOf = (page: Page) => page.locator(".parity-layout");
const boardOf = (page: Page) => page.locator(".parity-board");
const cell = (page: Page, index: number) => page.locator(`[data-parity-cell="${index}"]`);
const arrow = (page: Page, direction: Direction) => page.locator(`[data-parity-direction="${direction}"]`);
const shell = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const initial = (checkpoint: Checkpoint): Position => ({
  values: [...checkpoint.values], cursor: checkpoint.cursor, moves: 0,
});

function destination(cursor: number, direction: Direction): number | null {
  const x = cursor % 3, y = Math.floor(cursor / 3);
  if (direction === "u") return y > 0 ? cursor - 3 : null;
  if (direction === "d") return y < 2 ? cursor + 3 : null;
  if (direction === "l") return x > 0 ? cursor - 1 : null;
  return x < 2 ? cursor + 1 : null;
}

// Deliberately independent of the implementation: only the arrival cell changes.
function advance(before: Position, direction: Direction, checkpoint: Checkpoint): Position {
  const cursor = destination(before.cursor, direction);
  expect(cursor, `route remains adjacent in original level ${checkpoint.index + 1}`).not.toBeNull();
  const values = [...before.values];
  values[cursor!] += checkpoint.colors[cursor!] === "b" ? -1 : 1;
  return { values, cursor: cursor!, moves: before.moves + 1 };
}

async function activate(control: Locator, mobile: boolean) {
  if (mobile) await control.tap();
  else await control.click();
}

async function swipe(page: Page, direction: Direction) {
  const board = boardOf(page);
  await board.scrollIntoViewIfNeeded();
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2;
  const dx = direction === "l" ? -1 : direction === "r" ? 1 : 0;
  const dy = direction === "u" ? -1 : direction === "d" ? 1 : 0;
  const session = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    const observed: unknown[] = [];
    (window as unknown as { parityTouchTrace: unknown[] }).parityTouchTrace = observed;
    for (const type of ["pointerdown", "pointerup", "pointercancel", "gotpointercapture", "lostpointercapture", "click"]) {
      document.addEventListener(type, event => {
        const pointer = event as PointerEvent, target = event.target as HTMLElement;
        observed.push({ type, target: target.closest("button")?.textContent ?? target.className, x: pointer.clientX, y: pointer.clientY, pointerId: pointer.pointerId, time: performance.now() });
      }, true);
    }
  });
  try {
    // Chromium creates trusted touch/pointer input from this temporary protocol
    // session. This does not dispatch synthetic DOM events or inject game state.
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [{ x, y, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
    });
    for (const distance of [20, 40, 60]) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ x: x + dx * distance, y: y + dy * distance, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
      });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    // Let Chromium finish this trusted gesture before detaching its temporary
    // input session. Switching immediately to Playwright's session produced
    // pointerdown/up on the next toolbar tap but no browser-generated click.
    await page.waitForTimeout(400);
  } finally {
    await session.detach();
  }
}

async function expectPosition(page: Page, position: Position, won = false) {
  const root = rootOf(page);
  await expect(root).toHaveAttribute("data-parity-values", position.values.join(","));
  await expect(root).toHaveAttribute("data-parity-cursor", String(position.cursor));
  await expect(root).toHaveAttribute("data-parity-moves", String(position.moves));
  await expect(root).toHaveAttribute("data-parity-won", String(won));
  await expect(boardOf(page).locator("[data-parity-cell] strong")).toHaveText(position.values.map(String));
  await expect(cell(page, position.cursor)).toHaveAttribute("aria-current", "location");
}

async function move(
  page: Page, before: Position, direction: Direction,
  checkpoint: Checkpoint, mobile: boolean, input: "cell" | "direction" | "keyboard" | "swipe",
) {
  const after = advance(before, direction, checkpoint);
  if (input === "swipe") await swipe(page, direction);
  else if (input === "keyboard") {
    await boardOf(page).focus();
    await boardOf(page).press(keys[direction]);
  } else if (input === "cell") await activate(cell(page, after.cursor), mobile);
  else await activate(arrow(page, direction), mobile);
  await expectPosition(page, after, after.values.every(value => value === after.values[0]));
  return after;
}

async function checkLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const smallOrClipped = await rootOf(page).locator("button").evaluateAll(buttons => buttons.flatMap(button => {
    const box = button.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth
      ? [] : [{ label: button.getAttribute("aria-label") || button.textContent, width: box.width, height: box.height }];
  }));
  expect(smallOrClipped).toEqual([]);
}

async function enterFromLobby(page: Page) {
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("步步同数");
  await page.getByRole("button", { name: /^(?:开始玩|继续玩)步步同数$/ }).click();
  await expect(rootOf(page)).toBeVisible();
  await expect(page.locator(".game-surface .loading")).toHaveCount(0);
}

async function reenter(page: Page) {
  await page.reload();
  await enterFromLobby(page);
}

async function readRound(page: Page, index: number) {
  return page.evaluate(key => localStorage.getItem(key), `playgarden.parity.v1.round.${index}`);
}

test("Parity original mode boundaries: continuous moves, recovery, earned wins and clean remount", async ({ page, isMobile }, info) => {
  test.setTimeout(180000);
  const errors = captureErrors(page);
  await openGame(page, "步步同数");
  expect(parityLevels).toHaveLength(100);
  await expect(page.getByLabel("选择关卡", { exact: true }).locator("option")).toHaveCount(100);
  const completed: number[] = [];
  const finished = new Map<number, Position>();

  for (const checkpoint of checkpoints) {
    const { index } = checkpoint, puzzle = parityLevels[index];
    expect(puzzle.id).toBe(`parity-${index + 1}`);
    expect(puzzle.number).toBe(index + 1);
    expect(puzzle.mode).toBe(checkpoint.mode);
    expect(puzzle.contents).toEqual(checkpoint.values);
    expect(puzzle.colors.join("")).toBe(checkpoint.colors);
    expect(puzzle.initialSelected.y * 3 + puzzle.initialSelected.x).toBe(checkpoint.cursor);
    if (index === 49 || index === 99) expect(puzzle.solution?.join("")).toBe(checkpoint.route);

    await chooseLevel(page, index);
    await activate(shell(page, "重来"), isMobile);
    await expect(rootOf(page)).toHaveAttribute("data-parity-id", puzzle.id);
    await expect(rootOf(page)).toHaveAttribute("data-parity-mode", checkpoint.mode);
    await expect(boardOf(page).locator("[data-parity-cell]")).toHaveCount(9);
    let position = initial(checkpoint);
    await expectPosition(page, position);
    await checkLayout(page);
    await page.screenshot({ path: info.outputPath(`parity-${index + 1}-start.png`), fullPage: true, animations: "disabled" });

    // A nonadjacent tile receives a real mouse/touch input, without Playwright's
    // aria-disabled auto-wait. No synthetic events or game/storage writes occur.
    const invalidIndex = checkpoint.values.findIndex((_, candidate) =>
      Math.abs(candidate % 3 - position.cursor % 3) + Math.abs(Math.floor(candidate / 3) - Math.floor(position.cursor / 3)) > 1,
    );
    const invalid = cell(page, invalidIndex);
    await expect(invalid).toHaveAttribute("aria-disabled", "true");
    expect(await invalid.evaluate(button => (button as HTMLButtonElement).disabled)).toBe(false);
    await invalid.scrollIntoViewIfNeeded();
    const box = await invalid.boundingBox();
    expect(box).not.toBeNull();
    if (isMobile) await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    else await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expectPosition(page, position);
    const blockedDirection = directions.find(direction => destination(position.cursor, direction) === null)!;
    await expect(arrow(page, blockedDirection)).toBeDisabled();
    if (!isMobile) {
      await boardOf(page).focus();
      await boardOf(page).press(keys[blockedDirection]);
      await expectPosition(page, position);
    }

    const route = checkpoint.route.split("") as Direction[];
    if (index === 0 || index === 50) {
      // Both rule sets retain a continuous cursor. Level 51 first enters a black
      // tile (-1), then a white tile (+1); the starting cell is never incremented.
      const first = await move(page, position, route[0], checkpoint, isMobile, "cell");
      // On mobile level 1, a right swipe from the board center moves the cursor
      // from cell 1 to 2. It must not also click cell 5 under the release point:
      // the exact board/history checks and subsequent undo verify one move only.
      const second = await move(page, first, route[1], checkpoint, isMobile,
        isMobile && index === 0 ? "swipe" : "direction");
      await expect.poll(async () => JSON.parse((await readRound(page, index)) || "null")?.history)
        .toEqual([first.cursor, second.cursor]);
      const saved = await readRound(page, index);
      await activate(shell(page, "提示"), isMobile);
      if (isMobile && index === 0) console.log("PARITY_TOUCH_TRACE", await page.evaluate(() => (window as unknown as { parityTouchTrace: unknown[] }).parityTouchTrace));
      await expect(page.locator(".status")).toContainText("提示");
      await expectPosition(page, second);
      expect(await readRound(page, index)).toBe(saved);

      await activate(shell(page, "暂停"), isMobile);
      await expect(page.locator(".pause-overlay")).toBeVisible();
      for (const button of [shell(page, "撤销"), shell(page, "提示"), arrow(page, route[0]), cell(page, second.cursor)]) {
        await expect(button).toBeDisabled();
      }
      expect(await rootOf(page).locator("[data-parity-cell], [data-parity-direction]").evaluateAll(buttons =>
        buttons.every(button => (button as HTMLButtonElement).disabled),
      )).toBe(true);
      if (!isMobile) {
        await boardOf(page).focus();
        await boardOf(page).press(keys[route[2]]);
      }
      await expectPosition(page, second);
      await page.screenshot({ path: info.outputPath(`parity-${index + 1}-paused.png`), fullPage: true, animations: "disabled" });
      await activate(shell(page, "继续游戏"), isMobile);
      await expectPosition(page, second);

      await reenter(page);
      await expect(page.getByLabel("选择关卡", { exact: true })).toHaveValue(String(index));
      await expect(rootOf(page)).toHaveAttribute("data-parity-id", puzzle.id);
      await expectPosition(page, second);
      await activate(shell(page, "撤销"), isMobile);
      await expectPosition(page, first);
      await activate(shell(page, "撤销"), isMobile);
      await expectPosition(page, initial(checkpoint));
      await move(page, initial(checkpoint), route[0], checkpoint, isMobile, "direction");
      await activate(shell(page, "重来"), isMobile);
      await expectPosition(page, initial(checkpoint));
      await reenter(page);
      await expectPosition(page, initial(checkpoint));
      position = initial(checkpoint);
    }

    const arrivals: number[] = [];
    for (const [step, direction] of route.entries()) {
      const input = !isMobile && step % 3 === 0 ? "keyboard" : step % 2 === 0 ? "cell" : "direction";
      position = await move(page, position, direction, checkpoint, isMobile, input);
      arrivals.push(position.cursor);
    }
    expect(position.values).toEqual(Array(9).fill(checkpoint.target));
    await expectPosition(page, position, true);
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(page.locator(".game-main")).toHaveAttribute("data-level", String(index));
    await expect(page.getByLabel("选择关卡", { exact: true })).toHaveValue(String(index));
    await expect(shell(page, "撤销")).toBeDisabled();
    expect(await rootOf(page).locator("[data-parity-cell], [data-parity-direction]").evaluateAll(buttons =>
      buttons.every(button => (button as HTMLButtonElement).disabled),
    )).toBe(true);
    if (!isMobile) {
      await boardOf(page).focus();
      await boardOf(page).press(keys[route[0]]);
      await expectPosition(page, position, true);
    }
    completed.push(index);
    finished.set(index, position);
    await expect.poll(async () => JSON.parse((await readRound(page, index)) || "null"))
      .toEqual({ version: 1, id: puzzle.id, history: arrivals });
    await expect.poll(() => page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem("playgarden.progress.v2") || "{}");
      return [...(progress.completed?.parity || [])].sort((a: number, b: number) => a - b);
    })).toEqual(completed);
    await checkLayout(page);
    await page.screenshot({ path: info.outputPath(`parity-${index + 1}-won.png`), fullPage: true, animations: "disabled" });
  }

  // The shell may choose the first unfinished level after a completed save.
  // Explicitly reopen the final original board and verify its earned win survives.
  await reenter(page);
  await chooseLevel(page, 99);
  await expectPosition(page, finished.get(99)!, true);
  await expect(page.locator(".status")).toHaveClass(/success/);
  await expect(shell(page, "返回大厅")).toBeVisible();
  await chooseLevel(page, 0);
  await expectPosition(page, finished.get(0)!, true);
  await activate(shell(page, "重来"), isMobile);
  await expectPosition(page, initial(checkpoints[0]));
  await activate(shell(page, "返回游戏大厅"), isMobile);
  await expect(rootOf(page)).toHaveCount(0);
  await enterFromLobby(page);
  // Completed-level selection may resume elsewhere; explicitly remount level 1.
  await chooseLevel(page, 0);
  await expectPosition(page, initial(checkpoints[0]));
  const once = await move(page, initial(checkpoints[0]), "r", checkpoints[0], isMobile, isMobile ? "cell" : "keyboard");
  expect(once.moves).toBe(1);
  await activate(shell(page, "撤销"), isMobile);
  await expectPosition(page, initial(checkpoints[0]));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed.parity)).toEqual(completed);
  if (isMobile) await page.setViewportSize({ width: 320, height: 844 });
  await checkLayout(page);
  await page.screenshot({ path: info.outputPath(`parity-clean-remount${isMobile ? "-320" : ""}.png`), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});
