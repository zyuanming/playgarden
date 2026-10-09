// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { openGame, chooseLevel, captureErrors } from "./helpers";
const root=(page:Page)=>page.locator(".pyrcard-game");
async function press(page:Page,info:TestInfo,selector:string){const button=page.locator(selector);if(info.project.name==="mobile")await button.tap();else{await button.focus();await button.press("Enter");}}
async function card(page:Page,info:TestInfo,id:number){await press(page,info,id<0?"[data-pyramid-waste]":`[data-pyramid-card="${id}"]`);}
async function draw(page:Page,info:TestInfo){await press(page,info,".pyrcard-draw");}
async function win(page:Page){await expect(root(page)).toHaveAttribute("data-pyramid-won","true");await expect(page.locator(".status")).toHaveClass(/success/);await expect(page.getByRole("button",{name:"撤销",exact:true})).toBeDisabled();expect(await root(page).locator("button").evaluateAll(bs=>bs.every(b=>(b as HTMLButtonElement).disabled))).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
test("Pyramid cards: first and last teaching deals, finite stock and lock",async({page},info)=>{
 const errors=captureErrors(page);await openGame(page,"金字塔纸牌");const initial=await root(page).getAttribute("data-pyramid-state");
 await page.screenshot({path:info.outputPath("pyramid-first-start.png"),fullPage:true,animations:"disabled"});
 await expect(page.locator('[data-pyramid-card="0"]')).toBeDisabled();await card(page,info,3);await card(page,info,4);await expect(root(page)).toHaveAttribute("data-pyramid-moves","1");
 await page.getByRole("button",{name:"暂停",exact:true}).click();expect(await root(page).locator("button").evaluateAll(bs=>bs.every(b=>(b as HTMLButtonElement).disabled))).toBe(true);await page.getByRole("button",{name:"继续游戏",exact:true}).click();
 await page.getByRole("button",{name:"撤销",exact:true}).click();await expect(root(page)).toHaveAttribute("data-pyramid-state",initial!);await card(page,info,5);await page.getByRole("button",{name:"重来",exact:true}).click();await expect(root(page)).toHaveAttribute("data-pyramid-state",initial!);
 await page.getByRole("button",{name:"提示",exact:true}).click();await expect(page.locator(".pyrcard-hinted").first()).toBeVisible();await expect(root(page)).toHaveAttribute("data-pyramid-state",initial!);
 for(const i of [3,4,5,1,2,0])await card(page,info,i);await win(page);await page.screenshot({path:info.outputPath("pyramid-first-win.png"),fullPage:true,animations:"disabled"});
 await chooseLevel(page,7);await page.screenshot({path:info.outputPath("pyramid-final-start.png"),fullPage:true,animations:"disabled"});
 const finalInitial=await root(page).getAttribute("data-pyramid-state");await card(page,info,6);await card(page,info,8);await expect(page.locator(".pyrcard-feedback")).toContainText("不是 13");await expect(root(page)).toHaveAttribute("data-pyramid-state",finalInitial!);await card(page,info,8);
 await card(page,info,6);await card(page,info,7);await draw(page,info);await card(page,info,-1);await card(page,info,8);await card(page,info,3);await card(page,info,4);await card(page,info,1);await card(page,info,9);await card(page,info,5);await draw(page,info);await card(page,info,-1);await card(page,info,2);await card(page,info,0);await win(page);
 await page.screenshot({path:info.outputPath("pyramid-final-win.png"),fullPage:true,animations:"disabled"});expect(await root(page).locator("button").evaluateAll(bs=>bs.every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44;}))).toBe(true);
 const completed=await page.evaluate(()=>JSON.parse(localStorage.getItem("playgarden.progress.v2")!).completed["pyramid-cards"]);expect(completed).toEqual(expect.arrayContaining([0,7]));expect(errors).toEqual([]);
});
