// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator, type Page } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
type Tile = { id: number; a: number; b: number };
type Move = { id: number; side: "left" | "right" };
async function rack(page: Page): Promise<Tile[]> {
  return page
    .locator("[data-domino-tile]")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: Number(n.getAttribute("data-domino-tile")),
        a: Number(n.getAttribute("data-a")),
        b: Number(n.getAttribute("data-b")),
      })),
    );
}
// Independent endpoint reasoning; no engine imports or stored winning move list.
function solution(tiles: Tile[], left: number, right: number): Move[] | null {
  const seen = new Set<string>();
  function dfs(rest: Tile[], a: number, b: number): Move[] | null {
    if (!rest.length) return [];
    const key = `${a}:${b}:${rest.map((t) => t.id)}`;
    if (seen.has(key)) return null;
    seen.add(key);
    for (const tile of rest)
      for (const side of ["left", "right"] as const) {
        const end = side === "left" ? a : b;
        if (tile.a !== end && tile.b !== end) continue;
        const outer = tile.a === end ? tile.b : tile.a;
        const tail = dfs(
          rest.filter((t) => t.id !== tile.id),
          side === "left" ? outer : a,
          side === "right" ? outer : b,
        );
        if (tail) return [{ id: tile.id, side }, ...tail];
      }
    return null;
  }
  return dfs(tiles, left, right);
}
test("domino trail first/final chain and recoverable controls", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors = captureErrors(page);
  const act = async (l: Locator) =>
    info.project.name === "mobile" ? l.tap() : l.click();
  await openGame(page, "骨牌接龙");
  const game = page.locator("[data-domino-trail-game]"),
    tile = (id: number) => page.locator(`[data-domino-tile="${id}"]`);
  const initial = await game.getAttribute("data-chain");
  const start = JSON.parse(initial!) as Tile[];
  const first = solution(await rack(page), start[0].a, start.at(-1)!.b)![0];
  const move = async (m: Move) => {
    await act(tile(m.id));
    await act(page.locator(`[data-domino-end="${m.side}"]`));
  };
  await page.screenshot({
    path: info.outputPath("domino-trail-first-start.png"),
    fullPage: true,
  });
  if (info.project.name === "mobile") await act(tile(first.id));
  else {
    await tile(first.id).focus();
    await tile(first.id).press("Space");
  }
  await act(page.locator(`[data-domino-end="${first.side}"]`));
  await expect(game).toHaveAttribute("data-moves", "1");
  await act(page.getByRole("button", { name: "暂停", exact: true }));
  await expect(page.locator("[data-domino-tile]:enabled")).toHaveCount(0);
  await act(page.getByRole("button", { name: "继续游戏", exact: true }));
  await act(page.getByRole("button", { name: "撤销", exact: true }));
  await expect(game).toHaveAttribute("data-chain", initial!);
  await act(page.getByRole("button", { name: "提示", exact: true }));
  await expect(page.locator(".dt-rack .hinted")).toHaveCount(1);
  await move(first);
  await act(page.getByRole("button", { name: "重来", exact: true }));
  await expect(game).toHaveAttribute("data-chain", initial!);
  for (const level of [0, 7]) {
    if (level) {
      await chooseLevel(page, level);
      await expect(page.locator(".status")).toContainText("先选下面的一张骨牌");
    }
    const chain = JSON.parse(
      (await game.getAttribute("data-chain"))!,
    ) as Tile[];
    const tiles = await rack(page);
    const plan = solution(tiles, chain[0].a, chain.at(-1)!.b);
    expect(plan).not.toBeNull();
    for (const m of plan!) await move(m);
    await expect(game).toHaveAttribute("data-won", "true");
    await expect(page.locator(".status")).toHaveClass(/success/);
    await expect(page.locator("[data-domino-tile]")).toHaveCount(0);
    await expect(page.locator('[data-domino-end="left"]')).toBeDisabled();
    const final = JSON.parse(
      (await game.getAttribute("data-chain"))!,
    ) as Tile[];
    expect(final).toHaveLength(tiles.length + 1);
    expect(new Set(final.map((t) => t.id)).size).toBe(final.length);
    expect(final.every((t, i) => i === 0 || final[i - 1].b === t.a)).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`domino-trail-${level + 1}-won.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
