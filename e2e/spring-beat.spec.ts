import { expect, test, type Locator, type Page } from "@playwright/test";
import { captureErrors, chooseLevel, openGame } from "./helpers";
import { springTraces } from "./fixtures/spring-beat-data";
import { STORAGE_KEY } from "../src/lib/progress";

const title = "弹簧节拍";
const id = "spring-beat";
const paths = [
  "W",
  "R",
  "WR",
  "RWR",
  "LWWR",
  "LWWL",
  "WWLWW",
  "LLWRW",
  "LWRLWW",
  "RRWWLL",
  "WWWLRLW",
  "RWWWLWLR",
];
const boardId = (n: number) => id + "-" + String(n).padStart(2, "0");
const root = (p: Page) => p.locator(".sb-game");
const studio = (p: Page) => p.getByRole("region", { name: "弹簧操作台" });
const choose = (p: Page, move: string) =>
  p.locator('[data-sb-action="' + move + '"]');
const named = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true });
const apply = (p: Page) => named(p, "推进一拍");
const preview = (p: Page) => p.locator(".sb-preview");
const hit = (l: Locator, touch: boolean) =>
  touch ? l.tap() : l.press("Space");
const attr = (p: Page, key: string, value: string | number) =>
  expect(root(p)).toHaveAttribute("data-sb-" + key, String(value));
const completed = (p: Page) =>
  p.evaluate(
    ([key, id]) =>
      JSON.parse(localStorage.getItem(key) ?? "{}").completed?.[id] ?? [],
    [STORAGE_KEY, id],
  );

async function replay(
  p: Page,
  touch: boolean,
  level: number,
  path: string,
  length = path.length,
) {
  const { trace } = springTraces[boardId(level)][path];
  await attr(p, "history", "");
  await attr(p, "state", trace[0].join(","));
  for (let i = 0; i < length; i++) {
    const move = path[i];
    await hit(choose(p, move), touch);
    await expect(choose(p, move)).toHaveAttribute("aria-pressed", "true");
    const stamp = trace[i + 1].join(",");
    await attr(p, "projection", stamp);
    await attr(p, "state", trace[i].join(","));
    await attr(p, "beat", i);
    await hit(apply(p), touch);
    await attr(p, "state", stamp);
    await attr(p, "beat", i + 1);
    await attr(p, "history", path.slice(0, i + 1));
  }
}
async function wins(p: Page, level: number) {
  await attr(p, "won", "true");
  await expect(p.locator(".status.success")).toHaveText(
    "在目标拍同时对准了位置和速度！",
  );
  await expect.poll(() => completed(p)).toContain(level - 1);
}

for (let start = 0; start < 12; start += 4) {
  test(
    "Spring routes " + (start + 1) + "–" + (start + 4),
    async ({ page, isMobile }) => {
      const errors = captureErrors(page);
      await openGame(page, title);
      for (let i = start; i < start + 4; i++) {
        await chooseLevel(page, i);
        await attr(page, "id", boardId(i + 1));
        await expect(apply(page)).toBeDisabled();
        if (i === 0) {
          await hit(choose(page, "L"), isMobile);
          await attr(page, "error", "stock");
          await expect(apply(page)).toBeDisabled();
          await attr(page, "state", "1,0,0,0");
        }
        await replay(page, isMobile, i + 1, paths[i]);
        await wins(page, i + 1);
        if (i === 0) {
          await hit(named(page, "下一关"), isMobile);
          await attr(page, "id", boardId(2));
        }
      }
      expect(errors).toEqual([]);
    },
  );
}

test("Center can still be moving, and a missed gate never spends a push", async ({
  page,
  isMobile,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 2);
  await replay(page, isMobile, 3, "LR");
  await attr(page, "state", "0,1,0,0");
  await attr(page, "won", "false");
  await expect(page.locator(".sb-now")).toContainText("→ +1");
  await expect(page.locator(".sb-status")).toContainText("位置对了，速度不对");
  await expect.poll(() => completed(page)).not.toContain(2);
  await hit(named(page, "撤销"), isMobile);
  await attr(page, "state", "-1,-1,0,1");
  await attr(page, "beat", 1);
  await chooseLevel(page, 3);
  await hit(choose(page, "L"), isMobile);
  await attr(page, "error", "gate");
  await attr(page, "projection", "-1,0,0,2");
  await expect(preview(page)).toContainText("未通过第 1 拍");
  await expect(apply(page)).toBeDisabled();
  await attr(page, "state", "0,0,1,2");
  await attr(page, "history", "");
  await studio(page).screenshot({
    path: info.outputPath("gate-preview.png"),
    animations: "disabled",
  });
  await replay(page, isMobile, 4, "RWR");
  await wins(page, 4);
  expect(errors).toEqual([]);
});

test("Hints preserve another valid opening, and identify a dead legal path", async ({
  page,
  isMobile,
}) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 5);
  await replay(page, isMobile, 6, "LWWL");
  await wins(page, 6);
  await hit(named(page, "重来"), isMobile);
  await hit(choose(page, "W"), isMobile);
  await attr(page, "projection", "1,1,2,1");
  await hit(named(page, "提示"), isMobile);
  await expect(page.locator(".sb-status")).toContainText("仍有路线");
  await expect(choose(page, "W")).toHaveAttribute("aria-pressed", "true");
  await attr(page, "state", "-1,1,2,1");
  await attr(page, "beat", 0);
  await hit(named(page, "暂停"), isMobile);
  await expect(apply(page)).toBeDisabled();
  await hit(named(page, "继续游戏"), isMobile);
  await expect(apply(page)).toBeEnabled();
  await replay(page, isMobile, 6, "WWRL");
  await wins(page, 6);
  await hit(named(page, "重来"), isMobile);
  await replay(page, isMobile, 6, "LRWW");
  await wins(page, 6);
  await chooseLevel(page, 9);
  await hit(choose(page, "W"), isMobile);
  await hit(apply(page), isMobile);
  await hit(named(page, "提示"), isMobile);
  await expect(page.locator(".sb-status")).toContainText("已无法");
  await attr(page, "history", "W");
  await attr(page, "state", "1,2,2,2");
  await hit(named(page, "撤销"), isMobile);
  await attr(page, "beat", 0);
  await replay(page, isMobile, 10, "RRWWLL");
  await wins(page, 10);
  expect(errors).toEqual([]);
});

test("Final board rejects the gate, and an early stop must stay until beat 8", async ({
  page,
  isMobile,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, title);
  await chooseLevel(page, 11);
  await replay(page, isMobile, 12, "RRWWW", 4);
  await hit(choose(page, "W"), isMobile);
  await attr(page, "error", "gate");
  await attr(page, "state", "-2,0,2,0");
  await attr(page, "projection", "0,2,2,0");
  await expect(preview(page)).toContainText("未通过第 5 拍");
  await expect(apply(page)).toBeDisabled();
  await attr(page, "beat", 4);
  await attr(page, "history", "RRWW");
  await hit(choose(page, "R"), isMobile);
  await attr(page, "error", "stock");
  await expect(preview(page)).toContainText("推力已用完");
  const screenshot = async (name: string) => {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth === innerWidth,
      ),
    ).toBe(true);
    expect(
      await studio(page)
        .locator("button")
        .evaluateAll((bs) =>
          bs.every((b) => {
            const r = b.getBoundingClientRect();
            return r.width >= 44 && r.height >= 44;
          }),
        ),
    ).toBe(true);
    await expect(page.getByLabel("选择关卡", { exact: true })).toHaveValue(
      "11",
    );
    await expect(page.locator(".sb-beats li")).toHaveCount(8);
    await studio(page).screenshot({
      path: info.outputPath(name + ".png"),
      animations: "disabled",
    });
  };
  await hit(choose(page, "W"), isMobile);
  await screenshot("late-gate");
  if (isMobile) {
    await page.setViewportSize({ width: 360, height: 844 });
    await screenshot("late-gate-360");
  }
  for (const order of ["WWLWLWWR", "RWWWLWLR", "RWWRLWLW"]) {
    await hit(named(page, "重来"), isMobile);
    if (order === "RWWRLWLW") {
      await replay(page, isMobile, 12, order, 7);
      await attr(page, "state", "0,0,0,0");
      await attr(page, "beat", 7);
      await attr(page, "won", "false");
      await expect(page.locator(".sb-status")).toContainText("还没到目标拍");
      await hit(choose(page, "W"), isMobile);
      await attr(page, "projection", "0,0,0,0");
      await hit(apply(page), isMobile);
      await attr(page, "history", order);
      await attr(page, "beat", 8);
    } else await replay(page, isMobile, 12, order);
    if (order === "WWLWLWWR") {
      await attr(page, "won", "false");
      await attr(page, "state", "0,-1,0,1");
      await expect.poll(() => completed(page)).not.toContain(11);
    } else {
      await attr(page, "state", "0,0,0,0");
      await wins(page, 12);
    }
  }
  await page.reload();
  await expect.poll(() => completed(page)).toContain(11);
  expect(errors).toEqual([]);
});

test("The spring moves along the rail; reduced motion settles immediately with state intact", async ({
  page,
  isMobile,
}) => {
  const errors = captureErrors(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openGame(page, title);
  const cart = page.locator("[data-sb-motion]");
  const original = await cart.getAttribute("transform");
  await cart.evaluate((node) => {
    const seen: string[] = [];
    const observer = new MutationObserver(() => {
      const state = node.getAttribute("data-sb-motion");
      if (state) seen.push(state);
      node.setAttribute("data-test-sb-motion", seen.join(","));
    });
    observer.observe(node, {
      attributes: true,
      attributeFilter: ["data-sb-motion", "transform"],
    });
  });
  await replay(page, isMobile, 1, "W");
  await wins(page, 1);
  await expect(cart).toHaveAttribute("data-test-sb-motion", /moving/);
  await expect(cart).toHaveAttribute("data-sb-motion", "settled");
  expect(await cart.getAttribute("transform")).not.toBe(original);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await chooseLevel(page, 3);
  await expect(cart).toHaveAttribute("data-sb-motion", "reduced");
  await hit(choose(page, "L"), isMobile);
  await expect(preview(page)).toContainText("未通过第 1 拍");
  await expect(apply(page)).toBeDisabled();
  await replay(page, isMobile, 4, "RWR");
  await wins(page, 4);
  await expect(cart).toHaveAttribute("data-sb-motion", "reduced");
  expect(errors).toEqual([]);
});
