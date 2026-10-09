// SPDX-License-Identifier: GPL-3.0-only
// Integration owner runs one final invocation across desktop and mobile projects.
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
import { matchstickEquationsLevels, type MatchTransfer } from "../src/games/matchstickEquationsLogic";
const root = (page: Page) => page.locator(".mseq-game");
async function activate(page:Page, info:TestInfo, selector:string) { const node=page.locator(selector); if(info.project.name==="mobile") await node.tap(); else { await node.focus();await node.press("Enter"); } }
async function transfer(page:Page,info:TestInfo,move:MatchTransfer) {
  await activate(page,info,`[data-match-token="${move.from.token}"]`); await activate(page,info,`[data-match-segment="${move.from.segment}"]`);
  await activate(page,info,`[data-match-token="${move.to.token}"]`); await activate(page,info,`[data-match-segment="${move.to.segment}"]`);
}
async function win(page:Page,info:TestInfo,index:number) {
  for(const move of matchstickEquationsLevels[index].witness) {if(await root(page).getAttribute("data-matchstick-won")==="true") break;await transfer(page,info,move);}
  await expect(root(page)).toHaveAttribute("data-matchstick-won","true"); await expect(page.locator(".status")).toHaveClass(/success/);
  expect(await root(page).locator("button").evaluateAll(nodes=>nodes.every(node=>(node as HTMLButtonElement).disabled))).toBe(true);
}
test("Matchsticks: physical transfers, incomplete glyphs, undo, pause, first and final victory",async({page},info)=>{
  const errors=captureErrors(page);await openGame(page,"火柴等式");
  const initial=await root(page).getAttribute("data-matchstick-board");
  await page.screenshot({path:info.outputPath("matchstick-first.png"),fullPage:true,animations:"disabled"});
  // Pick and cancel is not a move. Use a nonwinning deliberate move for undo/restart.
  await activate(page,info,'[data-match-token="0"]');await activate(page,info,'[data-match-segment="0"]');
  await expect(root(page)).toHaveAttribute("data-matchstick-board",initial!);await expect(root(page)).toHaveAttribute("data-matchstick-moves","0");
  await page.getByRole("button",{name:"暂停",exact:true}).click();
  expect(await root(page).locator("button").evaluateAll(nodes=>nodes.every(node=>(node as HTMLButtonElement).disabled))).toBe(true);
  await page.getByRole("button",{name:"继续游戏",exact:true}).click();
  await page.getByRole("button",{name:"取消拿起",exact:true}).click();
  await transfer(page,info,{from:{token:0,segment:0},to:{token:0,segment:1}});
  await expect(root(page)).toHaveAttribute("data-matchstick-moves","1");await expect(root(page)).toHaveAttribute("data-matchstick-won","false");
  await page.getByRole("button",{name:"提示",exact:true}).click();await expect(page.locator(".mseq-feedback")).toContainText("剩余次数");
  await page.getByRole("button",{name:"撤销",exact:true}).click();await expect(root(page)).toHaveAttribute("data-matchstick-board",initial!);
  await transfer(page,info,{from:{token:0,segment:0},to:{token:0,segment:1}});await page.getByRole("button",{name:"重来",exact:true}).click();await expect(root(page)).toHaveAttribute("data-matchstick-board",initial!);
  await page.getByRole("button",{name:"提示",exact:true}).click();await expect(root(page)).toHaveAttribute("data-matchstick-board",initial!);
  await win(page,info,0);await expect(page.getByRole("button",{name:"撤销",exact:true})).toBeDisabled();
  await chooseLevel(page,9);await win(page,info,9);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await root(page).locator("button").evaluateAll(nodes=>nodes.every(node=>{const r=node.getBoundingClientRect();return r.width>=44&&r.height>=44;}))).toBe(true);
  await page.screenshot({path:info.outputPath("matchstick-final.png"),fullPage:true,animations:"disabled"});
  const completed=await page.evaluate(()=>JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed["matchstick-equations"]);expect(completed).toEqual(expect.arrayContaining([0,9]));expect(errors).toEqual([]);
});
