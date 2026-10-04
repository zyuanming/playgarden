import { test, expect } from "@playwright/test";
import { openGame, chooseLevel, complete, captureErrors } from "./helpers";
import { binaryCourierLevels } from "../src/games/binaryCourierLogic";
import {
  sortingNetworkLevels,
  sortingPairKey,
} from "../src/games/sortingNetworkLogic";
import {
  voxelViewsLevels,
  voxelViewsCertificates,
} from "../src/games/voxelViewsLogic";
import { cubeNetLevels, cubeNetCertificates } from "../src/games/cubeNetLogic";
test("all consumable bit-operation deliveries", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "位流快递");
  await expect(page.locator("[data-binary-game]")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("binary-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < binaryCourierLevels.length; level++) {
    await chooseLevel(page, level);
    for (const card of binaryCourierLevels[level].solution)
      await page.locator(`[data-binary-card="${card}"]`).click();
    expect(await page.locator("[data-binary-card]").evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === "1"))).toBe(true);
    await complete(page, info, "binary", level);
  }
  expect(errors).toEqual([]);
});
test("all universally verified sorting networks", async ({ page }, info) => {
  const errors = captureErrors(page);
  await openGame(page, "排序网络");
  await expect(page.locator("[data-sorting-game]")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("sorting-network-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < sortingNetworkLevels.length; level++) {
    await chooseLevel(page, level);
    const config = sortingNetworkLevels[level];
    solution: for (const [stage, gates] of config.solution.entries())
      for (const [slot, pair] of gates.entries()) {
        if (
          (await page
            .locator("[data-sorting-game]")
            .getAttribute("data-sorting-won")) === "true"
        )
          break solution;
        if (config.fixed[stage][slot] !== null) continue;
        const control = page.locator(
            `[data-sorting-stage="${stage}"][data-sorting-slot="${slot}"]`,
          ),
          value = sortingPairKey(pair);
        if ((await control.inputValue()) !== value)
          await control.selectOption(value);
      }
    expect(await page.locator("[data-sorting-stage]").evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === "1"))).toBe(true);
    if(level === 11) {
      const diagram=page.getByLabel("排序网络示意图，可横向滚动",{exact:true});
      if(await diagram.evaluate(node=>node.scrollWidth>node.clientWidth)) {
        await diagram.focus();
        for(let key=0;key<12;key++) await page.keyboard.press("ArrowRight");
        await expect.poll(()=>diagram.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);
        await expect(page.getByText("左右滑动查看全部阶段与输出",{exact:false})).toBeVisible();
        await page.screenshot({path:info.outputPath("sorting-network-scroll-output.png"),fullPage:true,animations:"disabled"});
      }
    }
    await complete(page, info, "sorting-network", level);
  }
  expect(errors).toEqual([]);
});
test("all exact voxel projections with actual WebGL", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "三视方块");
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("voxel-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < voxelViewsLevels.length; level++) {
    await chooseLevel(page, level);
    for (const cell of voxelViewsCertificates[level])
      if (voxelViewsLevels[level].locked[cell] !== 1)
        await page.locator(`[data-voxel-cell="${cell}"]`).click();
    expect(await page.locator("[data-voxel-cell]").evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === "1"))).toBe(true);
    await complete(page, info, "voxel", level);
  }
  expect(errors).toEqual([]);
});
test("all valid labeled cube nets with actual folded WebGL", async ({
  page,
}, info) => {
  const errors = captureErrors(page);
  await openGame(page, "立方纸模");
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("cube-net-start.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (let level = 0; level < cubeNetLevels.length; level++) {
    await chooseLevel(page, level);
    for (const [face, cell] of cubeNetCertificates[level].entries())
      if (cubeNetLevels[level].fixed[face] === undefined) {
        await page.locator(`[data-net-face="${face}"]`).click();
        await page.locator(`[data-net-cell="${cell}"]`).click();
      }
    await page.locator('[data-net-action="preview"]').click();
    await expect(page.locator("canvas")).toBeVisible();
    expect(await page.locator("[data-net-cell]").evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === "1"))).toBe(true);
    await complete(page, info, "cube-net", level);
  }
  expect(errors).toEqual([]);
});
