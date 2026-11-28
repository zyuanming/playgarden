import { expect,test,type Page } from "@playwright/test";
import { captureErrors,chooseLevel,openGame } from "./helpers";
import { STORAGE_KEY } from "../src/lib/progress";

const title = "图形序列";
const root = (p:Page) => p.locator(".figure-sequence");
const rule = (p:Page,code:string) => p.locator('[data-rule-card="'+code+'"]');
const frame = (p:Page,step:number) => p.locator('[data-step="'+step+'"]');
const status = (p:Page) => p.locator(".fs-status");
const button = (p:Page,name:string) => p.getByRole("button",{name,exact:true});
const activate = (loc:ReturnType<Page["locator"]>,touch:boolean) => touch ? loc.tap() : loc.press("Enter");
const hit = (p:Page,touch:boolean,name:string) => activate(button(p,name),touch);
const choose = (p:Page,touch:boolean,code:string) => activate(rule(p,code),touch);
const completion = (p:Page) => p.evaluate(key => JSON.parse(localStorage.getItem(key)??"{}").completed?.["figure-sequence"]??[],STORAGE_KEY);
async function done(p:Page,index:number) {
  await expect(root(p)).toHaveAttribute("data-won","true");
  await expect(p.locator(".status.success")).toHaveText("规则对上了每张已知图，留白也补齐了！");
  await expect.poll(()=>completion(p)).toContain(index);
}

const solutions = [
  ["R", [55, 436, 472, 91]],
  ["T", [461, 477, 461, 477]],
  ["H", [249, 444, 249, 444]],
  ["E", [284, 438, 284, 438]],
  ["RT", [400, 88, 72, 3, 19]],
  ["HK", [42, 42, 43, 46, 47, 47]],
  ["LC", [390, 45, 360, 390, 195, 360]],
  ["VR", [377, 125, 407, 470, 377, 125]],
  ["RK", [426, 234, 235, 175, 174, 426, 427]],
  ["TH", [218, 202, 418, 434, 218, 202, 418]],
  ["EV", [370, 472, 31, 181, 370, 472, 31, 181]],
  ["KR", [124, 125, 407, 406, 376, 377, 215, 214]],
] as const;
for(let start=0;start<solutions.length;start+=4) {
  const end=Math.min(solutions.length,start+4);
  test("Matching rules on levels "+(start+1)+"–"+end,async({page,isMobile})=>{
    const errors=captureErrors(page);
    await openGame(page,title);
    for(let i=start;i<end;i++){
      await chooseLevel(page,i);
      await expect(root(page)).toHaveAttribute("data-board","figure-sequence-"+String(i+1).padStart(2,"0"));
      await expect(button(page,"确认规则")).toBeDisabled();
      const [answer,values]=solutions[i];
      await choose(page,isMobile,answer);
      await expect(root(page)).toHaveAttribute("data-attempts","0");
      await expect(root(page)).toHaveAttribute("data-won","false");
      expect(await completion(page)).not.toContain(i);
      await expect(page.locator('[data-frame-state="conflict"]')).toHaveCount(0);
      for(const [step,bits] of values.entries()) await expect(frame(page,step)).toHaveAttribute("data-prediction",String(bits));
      await hit(page,isMobile,"确认规则");
      await done(page,i);
    }
    expect(errors).toEqual([]);
  });
}

test("Clear a preview without recording a submission and compare the middle steps",async({page,isMobile})=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  await chooseLevel(page,0);
  await choose(page,isMobile,"L");
  await expect(frame(page,1)).toHaveAttribute("data-frame-state","conflict");
  await expect(frame(page,2)).toHaveAttribute("data-frame-state","clue");
  await expect(frame(page,3)).toHaveAttribute("data-bits","436");
  await hit(page,isMobile,"清除预览");
  await expect(frame(page,3)).toHaveAttribute("data-frame-state","blank");
  await expect(root(page)).toHaveAttribute("data-attempts","0");
  await choose(page,isMobile,"R");
  await expect(frame(page,3)).toHaveAttribute("data-bits","91");
  await hit(page,isMobile,"撤销");
  await expect(frame(page,3)).toHaveAttribute("data-frame-state","blank");
  await chooseLevel(page,4);
  await choose(page,isMobile,"RL");
  await expect(frame(page,1)).toHaveAttribute("data-frame-state","clue");
  await expect(frame(page,2)).toHaveAttribute("data-frame-state","conflict");
  await hit(page,isMobile,"提示");
  await expect(status(page)).toContainText("第一次不符在第 2 步");
  await expect(root(page)).toHaveAttribute("data-attempts","0");
  expect(await completion(page)).not.toContain(4);
  expect(errors).toEqual([]);
});

test("Level 8’s two plausible rules differ at only a middle clue",async({page,isMobile})=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  await chooseLevel(page,7);
  for(const [idx,code] of ["VE","VC"].entries()) {
    await choose(page,isMobile,code);
    await expect(page.locator('[data-frame-state="conflict"]')).toHaveCount(1);
    await expect(frame(page,3)).toHaveAttribute("data-frame-state","conflict");
    await expect(frame(page,5)).toHaveAttribute("data-prediction","125");
    await hit(page,isMobile,"提示");
    await expect(frame(page,3)).toHaveAttribute("data-active","true");
    await expect(status(page)).toContainText("第一次不符在第 3 步");
    await expect(root(page)).toHaveAttribute("data-attempts",String(idx));
    await hit(page,isMobile,"确认规则");
    await expect(root(page)).toHaveAttribute("data-won","false");
    expect(await completion(page)).not.toContain(7);
  }
  await choose(page,isMobile,"VR");
  await expect(frame(page,2)).toHaveAttribute("data-bits","407");
  await hit(page,isMobile,"确认规则");
  await done(page,7);
  expect(errors).toEqual([]);
});

test("Finale rejects the same-ending rule, predicts both hidden frames, and persists a real win",async({page,isMobile},info)=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  await chooseLevel(page,11);
  await choose(page,isMobile,"KL");
  await expect(frame(page,7)).toHaveAttribute("data-prediction","214");
  await expect(page.locator('[data-frame-state="conflict"]')).toHaveCount(2);
  await expect(frame(page,3)).toHaveAttribute("data-frame-state","conflict");
  await expect(frame(page,4)).toHaveAttribute("data-frame-state","conflict");
  await hit(page,isMobile,"确认规则");
  await expect(status(page)).toContainText("第 3 步不是这张图");
  expect(await completion(page)).not.toContain(11);
  if(isMobile){
    for(const width of [360,390]){
      await page.setViewportSize({width,height:844});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const c=await page.locator(".fs-card").evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));
      expect(Math.min(...c)).toBeGreaterThanOrEqual(44);
      await page.screenshot({path:info.outputPath("figure-sequence-"+width+".png"),fullPage:true,animations:"disabled"});
    }
  }
  await choose(page,isMobile,"KR");
  await expect(frame(page,2)).toHaveAttribute("data-bits","407");
  await expect(frame(page,5)).toHaveAttribute("data-bits","377");
  await expect(root(page)).toHaveAttribute("data-won","false");
  await hit(page,isMobile,"确认规则");
  await done(page,11);
  await page.reload();
  await expect.poll(()=>completion(page)).toContain(11);
  expect(errors).toEqual([]);
});

const addedReplays: [string,[number,number][]][] = [
  ["T",[[3,22]]],
  ["K",[[3,55]]],
  ["E",[[3,180]]],
  ["H",[[3,41]]],
  ["V",[[3,282]]],
  ["C",[[3,335]]],
  ["L",[[3,257]]],
  ["R",[[3,455]]],
  ["V",[[3,329]]],
  ["C",[[3,274]]],
  ["K",[[3,103]]],
  ["T",[[3,82]]],
  ["E",[[3,133]]],
  ["H",[[3,373]]],
  ["L",[[3,40]]],
  ["R",[[3,68]]],
  ["R",[[3,130]]],
  ["H",[[3,94]]],
  ["T",[[3,49]]],
  ["V",[[3,440]]],
  ["K",[[3,57]]],
  ["C",[[3,105]]],
  ["TV",[[2,136]]],
  ["EK",[[2,227],[4,72]]],
  ["HE",[[2,137]]],
  ["CV",[[2,277],[4,17]]],
  ["VE",[[2,58]]],
  ["TC",[[2,333],[4,24]]],
  ["VC",[[2,133],[4,7]]],
  ["CE",[[2,446]]],
  ["HL",[[2,82],[4,28]]],
  ["CT",[[2,357]]],
  ["VT",[[2,320]]],
  ["CH",[[2,356],[4,12]]],
  ["KC",[[2,339]]],
  ["HT",[[2,53],[4,13]]],
  ["LH",[[2,390]]],
  ["EH",[[2,176],[4,50]]],
  ["VR",[[2,3]]],
  ["HC",[[2,113],[4,89]]],
  ["RH",[[2,65],[4,5]]],
  ["KE",[[2,200]]],
  ["KT",[[2,55]]],
  ["VL",[[2,385],[5,76]]],
  ["RH",[[1,275],[2,86]]],
  ["RE",[[1,161],[2,11],[3,38]]],
  ["RC",[[2,320],[4,260]]],
  ["RV",[[1,328],[2,13],[5,328]]],
  ["KC",[[2,85],[3,84],[5,272]]],
  ["LC",[[1,334],[3,200],[4,397]]],
  ["RT",[[1,136],[2,152],[3,26]]],
  ["CK",[[1,312],[3,124],[4,125]]],
  ["RC",[[3,195],[4,390]]],
  ["RH",[[1,315],[4,222],[5,315]]],
  ["RV",[[1,259],[3,265]]],
  ["KC",[[3,495],[4,170],[5,171]]],
  ["LT",[[1,307],[2,291],[3,78]]],
  ["EK",[[1,296],[3,387],[4,386]]],
  ["RC",[[2,260],[4,5],[5,260]]],
  ["RV",[[1,126],[3,222]]],
  ["RH",[[2,419],[3,236],[5,206]]],
  ["KC",[[3,238],[4,427],[5,426]]],
  ["RE",[[1,477],[2,375],[3,501]]],
  ["CK",[[1,66],[3,262],[4,263]]],
  ["RC",[[1,506],[4,251]]],
  ["LC",[[1,50],[2,375],[3,351]]],
  ["RH",[[1,86],[2,275],[5,86]]],
  ["RC",[[3,61],[4,376],[5,211]]],
  ["RV",[[1,13],[4,193],[5,13]]],
  ["LT",[[1,239],[2,255],[3,507]]],
  ["RT",[[1,375],[3,485],[4,501]]],
  ["KC",[[2,426],[3,427],[5,239]]],
  ["CK",[[1,210],[2,211],[3,406]]],
  ["LC",[[1,340],[3,80],[4,277]]],
  ["RC",[[2,151],[4,121],[5,151]]],
  ["RE",[[1,351],[2,501],[3,477]]],
  ["RV",[[2,233],[3,143],[5,107]]],
  ["RH",[[1,236],[2,425],[5,236]]],
  ["EK",[[1,402],[3,313],[4,312]]],
  ["RC",[[2,316],[4,151],[5,316]]],
  ["RH",[[1,209],[4,368],[5,209]]],
  ["RV",[[1,29],[2,344]]],
  ["CK",[[1,182],[2,183],[3,498]]],
  ["RE",[[1,307],[3,94],[4,244]]],
  ["LT",[[1,102],[2,118],[3,283]]],
  ["RC",[[3,135],[4,450],[5,105]]],
  ["RV",[[1,444],[3,498]]],
  ["LC",[[1,69],[3,4],[4,321]]],
];

for(let start=0;start<addedReplays.length;start+=8) {
  const end=Math.min(addedReplays.length,start+8);
  test("Expanded campaign "+(start+13)+"–"+(end+12),async({page,isMobile})=>{
    const errors=captureErrors(page);
    await openGame(page,title);
    for(let j=start;j<end;j++){
      const i=j+12;
      await chooseLevel(page,i);
      await expect(root(page)).toHaveAttribute("data-board","figure-sequence-"+(i+1));
      const [answer,hidden]=addedReplays[j];
      await choose(page,isMobile,answer);
      await expect(root(page)).toHaveAttribute("data-won","false");
      expect(await completion(page)).not.toContain(i);
      await expect(page.locator('[data-frame-state="conflict"]')).toHaveCount(0);
      for(const [step,bits] of hidden){
        await expect(frame(page,step)).toHaveAttribute("data-frame-state","prediction");
        await expect(frame(page,step)).toHaveAttribute("data-prediction",String(bits));
      }
      await hit(page,isMobile,"确认规则");
      await done(page,i);
    }
    expect(errors).toEqual([]);
  });
}

test("Original progress survives reload and next advances from 12 to 13",async({page,isMobile})=>{
  await openGame(page,title);
  await chooseLevel(page,11);
  await choose(page,isMobile,"KR");
  await hit(page,isMobile,"确认规则");
  await done(page,11);
  await page.reload();
  await expect.poll(()=>completion(page)).toEqual([11]);
  await openGame(page,title);
  await chooseLevel(page,11);
  await choose(page,isMobile,"KR");
  await hit(page,isMobile,"确认规则");
  await done(page,11);
  await hit(page,isMobile,"下一关");
  await expect(root(page)).toHaveAttribute("data-board","figure-sequence-13");
  expect(await completion(page)).toEqual([11]);
  await choose(page,isMobile,"H");
  await expect(frame(page,1)).toHaveAttribute("data-frame-state","conflict");
  await hit(page,isMobile,"确认规则");
  expect(await completion(page)).toEqual([11]);
  await choose(page,isMobile,"T");
  await expect(frame(page,3)).toHaveAttribute("data-prediction","22");
  await hit(page,isMobile,"确认规则");
  await done(page,12);
  await page.reload();
  await expect.poll(()=>completion(page)).toEqual([11,12]);
});

test("Level 100's identical final frames conceal separate conflicts",async({page,isMobile},info)=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  await chooseLevel(page,99);
  await expect(page.locator(".fs-card")).toHaveCount(6);
  await expect(page.locator('[data-frame-state="blank"]')).toHaveCount(3);
  for(const [code,step,bits] of [["CL",5,[6,8]],["VC",2,[0,8]]] as const){
    await choose(page,isMobile,code);
    await expect(frame(page,6)).toHaveAttribute("data-prediction","1");
    await expect(page.locator('[data-frame-state="conflict"]')).toHaveCount(1);
    await expect(frame(page,step)).toHaveAttribute("data-frame-state","conflict");
    for(const bit of bits) await expect(frame(page,step).locator(".fs-cell").nth(bit)).toHaveAttribute("data-difference","true");
    await expect(frame(page,step).locator('[data-difference="true"]')).toHaveCount(bits.length);
    await hit(page,isMobile,"确认规则");
    await expect(status(page)).toContainText("第 "+step+" 步不是这张图");
    await expect(root(page)).toHaveAttribute("data-won","false");
    expect(await completion(page)).not.toContain(99);
    if(isMobile){
      const width=code==="CL"?360:390;
      await page.setViewportSize({width,height:844});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const sizes=await page.locator(".fs-card").evaluateAll(cards=>cards.map(c=>[c.clientWidth,c.scrollWidth,c.getBoundingClientRect().height]));
      expect(sizes.every(([inside,scroll,height])=>inside>=scroll&&height>=44)).toBe(true);
      await page.locator(".fs-panel").screenshot({path:info.outputPath("figure-100-"+width+".png"),animations:"disabled"});
    }
  }
  await choose(page,isMobile,"LC");
  for(const [step,bits] of [[1,69],[3,4],[4,321]]) await expect(frame(page,step)).toHaveAttribute("data-prediction",String(bits));
  expect(await completion(page)).not.toContain(99);
  await hit(page,isMobile,"确认规则");
  await done(page,99);
  expect(errors).toEqual([]);
});
