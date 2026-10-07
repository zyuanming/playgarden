import { expect, type Page } from "@playwright/test";
import {
  cells,
  occupied,
  clearLines,
  type Piece,
} from "../src/vendor/falling/core";
export async function openFalling(page: Page, url = "/") {
  await page.goto(url);
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("落块花园");
  await page
    .getByRole("button", { name: "开始玩落块花园", exact: true })
    .click();
  await expect(page.locator(".falling-garden")).toBeVisible();
}
export async function freezeFalling(page: Page) {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
}
export async function startFallingUI(page: Page) {
  await page
    .locator(".falling-overlay")
    .getByRole("button", { name: "开始", exact: true })
    .click();
  await expect(page.locator(".falling-board")).toBeFocused();
}
export async function clearRealLine(page: Page) {
  for (let n = 0; n < 80; n++) {
    const root = page.locator(".falling-garden");
    if (Number(await root.getAttribute("data-falling-lines")) > 0) return;
    const raw = (await root.getAttribute("data-falling-board"))!
        .split(",")
        .map(Number),
      p = JSON.parse((await root.getAttribute("data-falling-piece"))!) as Piece;
    let choice: { rot: number; x: number; value: number } | undefined;
    for (let rot = 0; rot < 4; rot++) {
      let valid = true;
      for (let r = 1; r <= rot; r++)
        if (occupied(raw, { ...p, rotation: r })) valid = false;
      if (!valid) continue;
      for (let x = -3; x < 10; x++) {
        let q = { ...p, rotation: rot, x },
          walk = { ...p, rotation: rot };
        if (occupied(raw, q)) continue;
        while (walk.x !== x) {
          walk = { ...walk, x: walk.x + Math.sign(x - walk.x) };
          if (occupied(raw, walk)) {
            valid = false;
            break;
          }
        }
        if (!valid) {
          valid = true;
          continue;
        }
        while (!occupied(raw, { ...q, y: q.y + 1 })) q = { ...q, y: q.y + 1 };
        const b = [...raw];
        for (const [cx, cy] of cells(q)) b[cy * 10 + cx] = p.kind + 1;
        const c = clearLines(b);
        let holes = 0;
        const heights: number[] = [];
        for (let col = 0; col < 10; col++) {
          let found = false,
            h = 0;
          for (let row = 0; row < 20; row++) {
            if (c.board[row * 10 + col]) {
              if (!found) h = 20 - row;
              found = true;
            } else if (found) holes++;
          }
          heights.push(h);
        }
        const rough = heights
            .slice(1)
            .reduce((s, h, i) => s + Math.abs(h - heights[i]), 0),
          value =
            c.cleared * 10 -
            holes * 9 -
            heights.reduce((s, h) => s + h, 0) * 0.6 -
            rough * 0.4;
        if (!choice || value > choice.value) choice = { rot, x, value };
      }
    }
    if (!choice) throw Error("No reachable legal placement");
    for (let r = 0; r < choice.rot; r++)
      await page.getByRole("button", { name: "旋转", exact: true }).click();
    for (let x = p.x; x !== choice.x; x += Math.sign(choice.x - x))
      await page
        .getByRole("button", {
          name: choice.x < x ? "左移" : "右移",
          exact: true,
        })
        .click();
    await page.getByRole("button", { name: "落到底", exact: true }).click();
    await expect(root).toHaveAttribute("data-falling-phase", "playing");
  }
  throw Error("No line cleared after 80 real placements");
}
