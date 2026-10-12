// SPDX-License-Identifier: GPL-3.0-only
// Narrow browser-focus regression; no puzzle completion or state injection.
import {expect,test,type Frame,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {captureErrors} from './helpers';
const FRAME='iframe[title="Black Hole Square 原版游戏"]';
type State={current:number;moves:number;paused:boolean;settled:boolean;board:number[];canvas:{width:number;height:number;x:number;y:number}};
test('Black Hole Square: real tab departure cancels a held gesture',async({page},info)=>{
  test.setTimeout(60000);
  const mobile=info.project.name==='mobile',errors=captureErrors(page),events:unknown[]=[];
  let frame:Frame|null=null,other:Page|null=null;
  const firstPlan=JSON.parse(readFileSync(new URL('./fixtures/black-hole-square-input-plans.json',import.meta.url),'utf8')).levels[0] as {initial:number[];checkpoints:number[][]};
  const touch=mobile?await page.context().newCDPSession(page):null;
  const state=async()=>frame!.evaluate(()=>(window as unknown as {__blackHoleSquareSnapshot:()=>State}).__blackHoleSquareSnapshot());
  try{
    await page.goto('/');await page.getByRole('textbox',{name:'搜索游戏'}).fill('Black Hole Square');
    await page.locator('.game-card').filter({hasText:/Black Hole Square/i}).getByRole('button',{name:/^开始玩/}).first().click();
    const handle=await page.locator(FRAME).elementHandle();frame=await handle!.contentFrame();
    await expect.poll(async()=>frame!.evaluate(()=>typeof (window as unknown as {__blackHoleSquareSnapshot?:unknown}).__blackHoleSquareSnapshot)).toBe('function');
    const next=page.getByRole('button',{name:'下一页 / 跳过',exact:true});
    for(const current of [1,2]){await expect(next).toBeEnabled();await next.click();await expect.poll(async()=>(await state()).current).toBe(current);}
    await expect.poll(async()=>{const s=await state();return s.settled&&!s.paused&&Math.abs(s.canvas.x-(s.canvas.width-320)/2)<1;}).toBe(true);
    const initial=await state();expect(initial.moves).toBe(0);expect(initial.board).toEqual(firstPlan.initial);
    await frame.evaluate(()=>{
      const w=window as unknown as {__focusEvents:unknown[]};w.__focusEvents=[];
      window.addEventListener('blur',()=>w.__focusEvents.push({event:'blur',focused:document.hasFocus()}));
      window.addEventListener('message',e=>{if(e.data?.source==='playgarden-host'&&e.data.type==='cancel')w.__focusEvents.push({event:'host-cancel',focused:document.hasFocus()});});
    });
    await page.locator(FRAME).scrollIntoViewIfNeeded();const b=await page.locator(FRAME).boundingBox();if(!b)throw Error('Missing frame');
    const point={x:b.x+(136+initial.canvas.x)/initial.canvas.width*b.width,y:b.y+(134+initial.canvas.y)/initial.canvas.height*b.height};
    expect(point.x).toBeGreaterThan(0);expect(point.x).toBeLessThan(page.viewportSize()!.width);
    expect(point.y).toBeGreaterThan(0);expect(point.y).toBeLessThan(page.viewportSize()!.height);
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
    else{await page.mouse.move(point.x,point.y);await page.mouse.down();}
    await expect.poll(()=>frame!.evaluate(()=>document.hasFocus())).toBe(true);
    other=await page.context().newPage();await other.goto('about:blank');await other.bringToFront();
    await expect.poll(()=>page.evaluate(()=>document.hasFocus())).toBe(false);
    await expect.poll(()=>frame!.evaluate(()=>(window as unknown as {__focusEvents:{event:string;focused:boolean}[]}).__focusEvents.some(e=>['blur','host-cancel'].includes(e.event)&&!e.focused))).toBe(true);
    events.push({case:'real background tab',hostHasFocus:await page.evaluate(()=>document.hasFocus()),events:await frame.evaluate(()=>(window as unknown as {__focusEvents:unknown[]}).__focusEvents)});
    await page.bringToFront();await expect.poll(()=>page.evaluate(()=>document.hasFocus())).toBe(true);
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
    await expect.poll(async()=>(await state()).paused).toBe(false);
    await page.waitForTimeout(150);expect((await state()).board).toEqual(initial.board);expect((await state()).moves).toBe(0);
    // A new ordinary gesture still works; the interrupted one earned nothing.
    if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
    await expect.poll(async()=>(await state()).moves).toBe(1);
    await expect.poll(async()=>(await state()).board).toEqual(firstPlan.checkpoints[0]);
    events.push({case:'fresh gesture after return',state:await state()});
    await page.screenshot({path:info.outputPath('black-hole-square-return-from-real-tab.png'),fullPage:true});
    expect(errors).toEqual([]);
  }finally{
    const finalEvents=frame&&!frame.isDetached()?await frame.evaluate(()=>(window as unknown as {__focusEvents?:unknown[]}).__focusEvents??[]):[];
    writeFileSync(info.outputPath('black-hole-square-real-tab-focus.json'),JSON.stringify({project:info.project.name,events,finalEvents,errors},null,2));
    if(other)await other.close();if(touch)await touch.detach();
  }
});
