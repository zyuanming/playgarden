import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { signpostLevels } from "../src/games/signpostLevels";
import {
  SIGNPOST_SAVE,
  initialSignpost,
  linkSignpost,
  solveSignpost,
} from "../src/games/signpostLogic";
const proofs = JSON.parse(readFileSync("docs/signpost/campaign.json", "utf8"))
  .levels as { id: string; solution: number[] }[];
test("Signpost existing chains, interruptions and persistence", async ({
  page,
}, info) => {
  test.setTimeout(360000);
  const errors = captureErrors(page);
  await openGame(page, "箭头路标");
  const root = page.locator(".signpost-layout"),
    cell = (i: number) => root.locator(`button[data-cell="${i}"]`);
  async function select(a: number) {
    if ((await root.getAttribute("data-signpost-selected")) !== String(a)) {
      if (await root.getAttribute("data-signpost-selected"))
        await root
          .getByRole("button", { name: "换个起点", exact: true })
          .click();
      await cell(a).click();
    }
  }
  async function link(a: number, b: number, keyboard = false) {
    await select(a);
    if (keyboard) {
      await cell(b).focus();
      await cell(b).press("Enter");
    } else await cell(b).click();
  }
  const p = signpostLevels[0],
    path = proofs[0].solution,
    fresh = initialSignpost(p).join(",");
  await cell(path[0]).focus();
  await cell(path[0]).press("Control+Enter");
  await expect(root).toHaveAttribute("data-signpost-selected", "");
  await expect(cell(path[0])).toBeFocused();
  await cell(0).focus();
  await cell(0).press("ArrowRight");
  await expect(cell(1)).toBeFocused();
  await link(path[0], path[1], true);
  const one = await root.getAttribute("data-signpost-state");
  await select(path[0]);
  await root.getByRole("button", { name: "断开出线", exact: true }).click();
  await expect(root).toHaveAttribute("data-signpost-state", fresh);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(root).toHaveAttribute("data-signpost-state", one!);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(cell(0)).toBeDisabled();
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await expect(root).toHaveAttribute("data-signpost-state", one!);
  await page.reload();
  await page.getByRole("textbox", { name: "搜索游戏" }).fill("箭头路标");
  await page
    .getByRole("button", { name: /开始玩箭头路标|继续玩箭头路标/ })
    .click();
  await expect(root).toHaveAttribute("data-signpost-state", one!);
  await page.getByRole("button", { name: "重来", exact: true }).click();
  await expect(root).toHaveAttribute("data-signpost-state", fresh);
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.locator(".hint")).toHaveCount(1);
  await expect(root).toHaveAttribute("data-signpost-state", fresh);
  await expect(root.getByRole("status")).toContainText("搜索");
  await page.screenshot({
    path: info.outputPath("signpost-hint.png"),
    fullPage: true,
  });
  // Find a locally accepted but globally incompatible edge; submit through controls.
  let bad: number[] | undefined;
  for (let a = 0; a < p.arrows.length && !bad; a++)
    for (let b = 0; b < p.arrows.length && !bad; b++) {
      const s = initialSignpost(p),
        r = linkSignpost(p, s, a, b);
      if (r.state !== s && solveSignpost(p, r.state).kind === "none")
        bad = [a, b];
    }
  expect(bad).toBeTruthy();
  await link(bad![0], bad![1]);
  await page.getByRole("button", { name: "提示", exact: true }).click();
  await expect(root.getByRole("status")).toContainText("无法组成完整路线");
  await page.screenshot({
    path: info.outputPath("signpost-incompatible.png"),
    fullPage: true,
  });

  await shell(page, "重来");
  await playBoard(page, 0, info.project.name === "mobile");
  expect(errors).toEqual([]);
});

const layout = (p: Page) => p.locator(".signpost-layout");
const cell = (p: Page, i: number) =>
  layout(p).locator(`button[data-cell="${i}"]`);
const tap = (touch: boolean, l: ReturnType<Page["locator"]>) =>
  touch ? l.tap() : l.click();
const activate = (p: Page, touch: boolean, i: number) =>
  touch ? cell(p, i).tap() : cell(p, i).press("Enter");
const shell = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true }).click();
async function playBoard(p: Page, index: number, touch: boolean, omit = -1) {
  const answer = proofs[index].solution;
  expect(proofs[index].id).toBe(signpostLevels[index].id);
  const edges = answer.slice(0, -1).map((_, i) => i);
  edges.push(...edges.splice(0, Math.floor(edges.length / 2)));
  let selected = await layout(p).getAttribute("data-signpost-selected");
  for (const k of edges) {
    if (k === omit) continue;
    const a = answer[k],
      b = answer[k + 1];
    if (selected !== String(a)) {
      if (selected)
        await tap(
          touch,
          layout(p).getByRole("button", { name: "换个起点", exact: true }),
        );
      await activate(p, touch, a);
    }
    await activate(p, touch, b);
    selected = await layout(p).getAttribute("data-signpost-selected");
  }
  await expect(layout(p)).toHaveAttribute("data-signpost-won", "true");
  await expect(p.locator(".status")).toHaveClass(/success/);
  await expect(cell(p, 0)).toBeDisabled();
}
const progress = (p: Page) =>
  p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed
        .signpost,
  );
for (let batch = 0; batch < 10; batch++) {
  const first = 30 + batch * 7;
  test(`Signpost append ${first + 1}–${first + 7}`, async ({
    page,
    isMobile,
  }, info) => {
    const errors = captureErrors(page);
    await openGame(page, "箭头路标");
    for (let index = first; index < first + 7; index++) {
      await chooseLevel(page, index);
      const root = layout(page),
        shots = [30, 44, 58, 72, 86, 99].includes(index);
      await expect(root).toHaveAttribute(
        "data-signpost-id",
        signpostLevels[index].id,
      );
      await expect(root.locator(".signpost-heading > span")).toHaveText(
        `${index + 1} / 100`,
      );
      if (shots)
        await page.screenshot({
          path: info.outputPath(`signpost-${index + 1}-start.png`),
          fullPage: true,
        });
      await playBoard(page, index, isMobile);
      if (shots) {
        expect(
          await root.locator(".signpost-cell").evaluateAll((cells) =>
            cells.every((c) => {
              const box = c.getBoundingClientRect(),
                number = c.querySelector("strong")!.getBoundingClientRect(),
                arrow = c
                  .querySelector(".signpost-arrow")!
                  .getBoundingClientRect();
              return (
                box.width >= 44 &&
                box.height >= 44 &&
                number.right <= arrow.left + 1
              );
            }),
          ),
        ).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`signpost-${index + 1}-won.png`),
          fullPage: true,
        });
      }
    }
    await expect
      .poll(() => progress(page))
      .toEqual(Array.from({ length: 7 }, (_, i) => first + i));
    expect(errors).toEqual([]);
  });
}

test("Signpost restores old 30 → 31 and hints on 100 without auto-linking", async ({
  page,
  isMobile,
}, info) => {
  const errors = captureErrors(page),
    old = 29;
  const blank = initialSignpost(signpostLevels[old]),
    partial = blank.slice(),
    route = proofs[old].solution;
  partial[route[0]] = route[1];
  await page.addInitScript(
    ([key, save]) => {
      if (localStorage.getItem(`${key}.selected`) === null) {
        localStorage.setItem(`${key}.selected`, "29");
        localStorage.setItem(`${key}.round.29`, save);
      }
    },
    [
      SIGNPOST_SAVE,
      JSON.stringify({ id: "signpost-30", history: [blank, partial] }),
    ],
  );
  await openGame(page, "箭头路标");
  const root = layout(page);
  await expect(root).toHaveAttribute("data-signpost-id", "signpost-30");
  await expect(root).toHaveAttribute("data-signpost-state", partial.join(","));
  await playBoard(page, old, isMobile, 0);
  await tap(
    isMobile,
    page.getByRole("button", { name: "下一关", exact: true }),
  );
  await expect(root).toHaveAttribute("data-signpost-id", "signpost-31");
  const a = proofs[30].solution[0],
    b = proofs[30].solution[1];
  await activate(page, isMobile, a);
  await activate(page, isMobile, b);
  const newSave = initialSignpost(signpostLevels[30]);
  newSave[a] = b;
  await expect(root).toHaveAttribute("data-signpost-state", newSave.join(","));
  await page.reload();
  await openGame(page, "箭头路标");
  await expect(root).toHaveAttribute("data-signpost-id", "signpost-31");
  await expect(root).toHaveAttribute("data-signpost-state", newSave.join(","));
  await expect.poll(() => progress(page)).toContain(old);
  await chooseLevel(page, 99);
  const lastBlank = initialSignpost(signpostLevels[99]).join(",");
  const hint = page.getByRole("button", { name: "提示", exact: true });
  await hint.evaluate((button) => {
    const board = document.querySelector(".signpost-layout")!;
    button.addEventListener("click", () => performance.mark("sp-hint-start"), {
      capture: true,
      once: true,
    });
    const observer = new MutationObserver(() => {
      if (board.querySelector("button.hint")) {
        performance.mark("sp-hint-done");
        observer.disconnect();
      }
    });
    observer.observe(board, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  });
  await tap(isMobile, hint);
  await expect(root.locator("button.hint")).toHaveCount(1);
  const ms = await page.evaluate(
    () =>
      performance.getEntriesByName("sp-hint-done")[0].startTime -
      performance.getEntriesByName("sp-hint-start")[0].startTime,
  );
  expect(ms).toBeGreaterThanOrEqual(0);
  expect(ms).toBeLessThan(2000);
  console.log(`Signpost 100 hint ${info.project.name}: ${ms.toFixed(1)} ms`);
  await expect(root).toHaveAttribute("data-signpost-state", lastBlank);
  await page.screenshot({
    path: info.outputPath("signpost-100-hint.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
