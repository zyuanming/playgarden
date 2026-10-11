// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator, type Frame } from '@playwright/test';
import { openGame, captureErrors } from './helpers';
type Live = { state:string; paused:boolean; localPaused:boolean; externalPaused:boolean; height:number; lives:number; timeElapsed:number; timeSinceLastCheckpoint:number; nextCheckpointHeight:number; isInvincible:boolean; timeSinceInvincible:number; physicsClock:number; frames:number; lastLoss:string; lossCount:number; resetCount:number; wonCount:number; ball:{position:number[];velocity:number[];radius:number};camera:{x:number;y:number};bar:{finalized:boolean;pointer:number|null;settleRemaining:number;position:number[];angle:number;width:number}; wind:{left:boolean;right:boolean};bodies:{id:number;position:number[];velocity:number[];angle:number;angularVelocity:number;shapeOffsets:number[][];shapeAngles:number[];fatal:boolean;ground:boolean;type:number;shapes:{radius?:number;width?:number;height?:number;vertices?:number[][]}[]}[] };

// Read-only feedback route independently diagnosed against unchanged original physics.
// It emits only mouse/touch endpoints; no game state, lives, RNG, clocks or terrain is written.
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function shapeDist(px:number,py:number,b:Live['bodies'][number],t:number){
 const bx=b.position[0]+b.velocity[0]*t,by=b.position[1]+b.velocity[1]*t;
 const a=b.angle+b.angularVelocity*t,ca=Math.cos(a),sa=Math.sin(a);
 const xx=ca*(px-bx)+sa*(py-by), yy=-sa*(px-bx)+ca*(py-by);
 let d=Infinity;
 b.shapes.forEach((q,i)=>{const ox=b.shapeOffsets[i][0],oy=b.shapeOffsets[i][1],a=b.shapeAngles[i],c=Math.cos(a),s=Math.sin(a),x=c*(xx-ox)+s*(yy-oy),y=-s*(xx-ox)+c*(yy-oy);
   if(q.radius)d=Math.min(d,Math.hypot(x,y)-q.radius);
   else if(q.width!==undefined&&q.height!==undefined)d=Math.min(d,Math.hypot(Math.max(0,Math.abs(x)-q.width/2),Math.max(0,Math.abs(y)-q.height/2)));
 });return d;
}
function plan(s:Live){
 const [x,y]=s.ball.position,[vx,vy]=s.ball.velocity;
 const bodies=s.bodies.filter(b=>b.type!==undefined&&b.type!==10&&!b.ground);
 let best={score:Infinity,dir:0,tx:0,nearest:Infinity,kind:""};
 for(const dir of [0,-1,1]){
  const tx=dir===0?vx:(dir*Math.max(2.9,vx*dir));
  let risk=0, nearest=Infinity;
  for(let t=.1;t<=2;t+=.1){
   const px=x+tx*t,py=y+vy*t-2.3*t*t;
   for(const b of bodies){
    let d=shapeDist(px,py,b,t);
    if(b.fatal && !s.isInvincible){nearest=Math.min(nearest,d); risk+=(Math.max(0,3.3-d)**2)*30*Math.exp(-t*.7);}
    else risk+=(Math.max(0,1.7-d)**2)*3*Math.exp(-t*.7);
   }
  }
  const score=risk+(dir?1:0)+Math.abs(tx)*.03;
  if(score<best.score)best={score,dir,tx,nearest,kind:""};
 }
 return best;
}

function decide(s:Live,lastAction:string|number=""){
 if(s.state!=="Active")return {action:null,lastAction};
  const p=plan(s); let action:number[]|null=null;
  const cx=s.camera.x+s.ball.position[0]*64,cy=s.camera.y-s.ball.position[1]*64;
  const [x,y]=s.ball.position,[vx,vy]=s.ball.velocity;
  const threats=s.bodies.filter(b=>b.fatal).map(b=>{let near=Infinity,tnear=0; for(let t=0;t<=.4;t+=.05){let d=Math.hypot(b.position[0]-x+(b.velocity[0]-vx)*t,b.position[1]-y+(b.velocity[1]-vy)*t);if(d<near){near=d;tnear=t;}}return {b,near,tnear};}).sort((a,b)=>a.near-b.near);
  const threat=threats[0];
  if(threat && threat.near<2.8 && !s.isInvincible){
   let dx=threat.b.position[0]-x,dy=threat.b.position[1]-y,d=Math.hypot(dx,dy);dx/=d;dy/=d; if(dy<-.3){dx-=((p.dir||Math.sign(vx)||1)*.6); const nd=Math.hypot(dx,dy);dx/=nd;dy/=nd;}
   const bx=cx+dx*63,by=cy-dy*63; const len=150;
   action=[bx-dy*len,by-dx*len,bx+dy*len,by+dx*len].map((z,i)=>clamp(z,16,i%2?1776:1008));p.kind='shield';
  }else if(p.dir&&Math.abs(s.ball.velocity[0]-p.tx)>.8){
   const dx=-p.dir*58;
   action=[cx+dx,cy-128,cx+dx,cy+128];
  }else if(lastAction){action=[32,100,64,100];}

 return {action,plan:p,lastAction:action?(p.kind||p.dir):""};
}


// Continuous WebGL screencast readbacks stalled ordinary input in the first CI trace.
// Keep DOM/source/action traces and explicit actual PNGs without recording every frame.
test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true } });

test('Descensus 2 original: genuine 1000m journey, loss, timer, bar physics, pause, records and teardown', async ({ page }, info) => {
 test.setTimeout(600000);
 const mobile=info.project.name==='mobile',errors=captureErrors(page),remote:string[]=[],failed:string[]=[];
 page.on('request',r=>{const u=new URL(r.url());if(/^https?:/.test(u.protocol)&&!['localhost','127.0.0.1'].includes(u.hostname))remote.push(u.href);});
 page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ERR_ABORTED'))failed.push(r.url());});
 const act=async(l:Locator)=>mobile?l.tap():l.click();
 const iframe=page.locator('iframe[title="Descensus 2 千米降落完整旅程"]'),frame=page.frameLocator('iframe[title="Descensus 2 千米降落完整旅程"]'),canvas=frame.locator('#viewport');
 let gameFrame:Frame|null=null;
 const read=async()=>{if(!gameFrame||gameFrame.isDetached())gameFrame=await (await iframe.elementHandle())!.contentFrame();if(!gameFrame)throw Error('No game frame');return await gameFrame.evaluate(()=> (window as unknown as {__descensusRead:()=>Live}).__descensusRead());};
 const cdp=mobile?await page.context().newCDPSession(page):null;
 async function draw(x1:number,y1:number,x2:number,y2:number,cancel=false){
  const box=(await canvas.boundingBox())!;const point=(x:number,y:number)=>({x:box.x+Math.max(16,Math.min(1008,x))*box.width/1024,y:box.y+Math.max(16,Math.min(1776,y))*box.height/1792});const a=point(x1,y1),b=point(x2,y2);
  if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});
  else{await page.mouse.move(a.x,a.y);await page.mouse.down();}
  for(let k=1;k<=3;k++){
   const q={x:a.x+(b.x-a.x)*k/3,y:a.y+(b.y-a.y)*k/3};
   if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...q,id:1}]});else await page.mouse.move(q.x,q.y);
   await page.waitForTimeout(16);
  }
  if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});else await page.mouse.up();
 }
 async function tapCanvas(x:number,y:number){const box=(await canvas.boundingBox())!;const position={x:x*box.width/1024,y:y*box.height/1792};if(mobile)await canvas.tap({position});else await canvas.click({position});}
 async function start(){await openGame(page,'千米降落');await expect(page.locator('[data-descensus-ready]')).toHaveAttribute('data-descensus-ready','true');await expect(iframe).toHaveAttribute('sandbox','allow-scripts');await canvas.scrollIntoViewIfNeeded();await act(frame.locator('#start'));await expect.poll(async()=>(await read()).state).toBe('Active');}
 await page.goto('/');await page.getByRole('textbox',{name:'搜索游戏'}).fill('千米降落');await expect(page.getByText('1000米旅程 · 仅保存完成纪录',{exact:true})).toBeVisible();await page.getByRole('textbox',{name:'搜索游戏'}).fill('小黑屋远行');await expect(page.getByText('完整战役 · 自动存档',{exact:true})).toBeVisible();
 await openGame(page,'千米降落');await expect(page.locator('[data-descensus-ready]')).toHaveAttribute('data-descensus-ready','true');await expect(page.getByLabel('选择关卡',{exact:true})).toHaveCount(0);await canvas.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('descensus-intro.png'),fullPage:true});
 await act(frame.locator('#start'));await expect.poll(async()=>(await read()).state).toBe('Active');expect((await read()).lives).toBe(5);
 // A real canvas gesture creates original p2 geometry; touch cancellation releases it.
 await draw(100,1050,900,1050,mobile);await expect.poll(async()=>(await read()).bar.width).toBeGreaterThan(.25);expect((await read()).bar.finalized).toBe(true);expect((await read()).bar.pointer).toBe(null);
 await act(frame.locator('#menu'));await expect.poll(async()=>(await read()).state).toBe('Menu');await tapCanvas(512,1792/3);await page.screenshot({path:info.outputPath('descensus-original-help.png'),fullPage:true});await tapCanvas(512,1792*.92);await tapCanvas(512,1792/2);await page.screenshot({path:info.outputPath('descensus-original-about.png'),fullPage:true});await tapCanvas(512,1792*.92);await tapCanvas(512,1792*4/6);await tapCanvas(1024/3,1792*.75);await tapCanvas(512,1792*4/6);await tapCanvas(1024*2/3,1792*.75);await expect.poll(async()=>(await read()).state).toBe('Active');expect((await read()).resetCount).toBe(2);expect((await read()).lives).toBe(5);
 await act(frame.locator('#pause'));await expect.poll(async()=>(await read()).paused).toBe(true);const frozen=await read();await page.waitForTimeout(500);expect(await read()).toEqual(frozen);
 await iframe.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('descensus-paused-viewport.png')});
 if(mobile){await page.setViewportSize({width:844,height:390});await expect.poll(async()=>{const box=await canvas.boundingBox();return !!box&&box.width>100&&box.height>200;}).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:390,height:844});await expect.poll(async()=>(await canvas.boundingBox())!.width<390).toBe(true);}
 await act(page.getByRole('button',{name:'暂停',exact:true}));await expect.poll(async()=>(await read()).externalPaused).toBe(true);await expect(frame.locator('#resume')).toBeHidden();await act(page.getByRole('button',{name:'继续游戏',exact:true}));expect((await read()).paused).toBe(true);await act(frame.locator('#resume'));await expect.poll(async()=>(await read()).paused).toBe(false);
 // A parent pause caused by clicking outside the iframe must not become a sticky blur pause.
 await act(page.getByRole('button',{name:'暂停',exact:true}));await expect.poll(async()=>(await read()).externalPaused).toBe(true);await act(page.getByRole('button',{name:'继续游戏',exact:true}));await expect.poll(async()=>(await read()).paused).toBe(false);
 // Playwright pages remain active (https://playwright.dev/docs/pages). Exercise
 // real iframe blur by clicking ordinary parent content, not a synthetic hidden event.
 await tapCanvas(512,1000);await expect.poll(()=>frame.locator('body').evaluate(()=>document.hasFocus())).toBe(true);
 await act(page.getByRole('heading',{name:'千米降落',exact:true}));await expect.poll(()=>frame.locator('body').evaluate(()=>document.hasFocus())).toBe(false);await expect.poll(async()=>(await read()).paused).toBe(true);const blurred=await read();await page.waitForTimeout(500);expect(await read()).toEqual(blurred);await act(frame.locator('#resume'));await expect.poll(async()=>(await read()).paused).toBe(false);
 // Fresh actual iframe, original seed and five lives. No state/RNG overrides.
 await page.getByRole('button',{name:'返回大厅',exact:true}).click();await expect(iframe).toHaveCount(0);await start();
 // Let the unchanged game fail naturally with no steering, then observe its automatic restart.
 const lossTypes=new Set<string>(),negative:unknown[]=[];let firstLoss:Live|null=null,invincible=false,seenLost=false;const negativeDeadline=Date.now()+180000;
 while(Date.now()<negativeDeadline){const s=await read();if(s.lastLoss)lossTypes.add(s.lastLoss);negative.push({state:s.state,height:s.height,lives:s.lives,loss:s.lastLoss,lossCount:s.lossCount,resetCount:s.resetCount,invincible:s.isInvincible});
  if(s.lossCount&&!firstLoss){firstLoss=s;expect(s.lives).toBeLessThan(5);await page.screenshot({path:info.outputPath('descensus-natural-loss.png'),fullPage:true});}
  invincible ||= s.isInvincible;seenLost ||= s.state==='Lost';if(s.resetCount>1)break;await page.waitForTimeout(100);
 }
 console.log(info.project.name,'natural loss and restart', (await read()).resetCount);
 await info.attach('natural-loss-and-restart.json',{body:JSON.stringify(negative),contentType:'application/json'});
 expect(firstLoss).not.toBeNull();expect(invincible).toBe(true);expect(seenLost).toBe(true);expect((await read()).resetCount).toBe(2);expect((await read()).lives).toBe(5);
 // A new original round: no RNG override, save injection, teleport or life edits.
 await act(page.getByRole('button',{name:'重来',exact:true}));await expect(page.locator('[data-descensus-ready]')).toHaveAttribute('data-descensus-ready','true');await act(frame.locator('#start'));await expect.poll(async()=>(await read()).state).toBe('Active');await canvas.scrollIntoViewIfNeeded();
 const trace:unknown[]=[],shots=new Set<string>(),terrain=new Set<number>(),checkpointValues=new Set<number>(),windZonesSeen=new Set<number>();const windZones=[[600,575],[500,475],[350,325],[275,250],[100,75],[75,50]];let priorCheckpoint=900;let lastAction:string|number='',minHeight=1000;const journeyDeadline=Date.now()+360000;
 try{
  while(Date.now()<journeyDeadline){const begun=Date.now(),s=await read();minHeight=Math.min(minHeight,s.height);checkpointValues.add(s.nextCheckpointHeight);if(s.lastLoss)lossTypes.add(s.lastLoss);if(s.nextCheckpointHeight<priorCheckpoint){expect(s.timeSinceLastCheckpoint,'Crossing100m resets the original30s clock').toBeLessThan(1000);priorCheckpoint=s.nextCheckpointHeight;}windZones.forEach(([top,bottom],i)=>{if(s.ball.position[1]<=top&&s.ball.position[1]>=bottom&&(i%2===0?s.wind.left:s.wind.right))windZonesSeen.add(i);});s.bodies.forEach(b=>{if(b.type!==undefined)terrain.add(b.type);});
   if(s.state==='Won')break;
   expect(s.resetCount,'Do not silently retry a lost journey').toBe(1);expect(s.state,'Original lives must survive this ordinary-input route').not.toBe('Lost');
   expect(s.paused,'The full journey must advance without test-time pauses').toBe(false);
   const decision=decide(s,lastAction);lastAction=decision.lastAction;
   trace.push({wall:begun,state:s.state,frame:s.frames,height:s.height,lives:s.lives,t:s.timeElapsed,timer:s.timeSinceLastCheckpoint,checkpoint:s.nextCheckpointHeight,loss:s.lastLoss,lossCount:s.lossCount,invincible:s.isInvincible,ball:s.ball,wind:s.wind,action:decision.action});
   if(decision.action)await draw(...decision.action as [number,number,number,number]);
   for(const [label,height] of [['first',900],['middle',500],['last',75]] as const)if(s.height<=height&&!shots.has(label)&&s.state==='Active'){
    shots.add(label);console.log(info.project.name,'genuine journey',label,s.height,s.lives,s.timeElapsed);await page.screenshot({path:info.outputPath('descensus-'+label+'.png'),fullPage:true});
   }
   await page.waitForTimeout(Math.max(0,100-(Date.now()-begun)));
  }
  const won=await read();console.log(info.project.name,'journey terminal',won.state,won.height,won.lives,won.resetCount);trace.push({final:won});expect(won.state).toBe('Won');expect(won.wonCount).toBe(1);expect(won.resetCount).toBe(1);expect(won.ball.position[1]).toBeLessThan(2);expect(won.lives).toBeGreaterThan(0);expect(minHeight).toBeLessThan(10);
  expect(checkpointValues.size).toBeGreaterThanOrEqual(9);expect(terrain.size).toBeGreaterThanOrEqual(8);expect(shots.size).toBe(3);expect(windZonesSeen.size).toBe(6);expect([...lossTypes].sort()).toEqual(['saw','timeout']);
  await expect(frame.locator('#status')).toContainText('已真实落地');await expect(frame.locator('#records')).toContainText('已完成 1 次');await page.waitForTimeout(5500);
  await page.screenshot({path:info.outputPath('descensus-ground-certificate.png'),fullPage:true});await iframe.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('descensus-certificate-viewport.png')});
  const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.descensus2.v1.records')||'null'));expect(record.completed).toBe(1);expect(record.bestTime).toBe(won.timeElapsed);expect(record.lastLives).toBe(won.lives);
  await tapCanvas(512,1792*.92);await expect.poll(async()=>(await read()).state).toBe('Active');expect((await read()).resetCount).toBe(2);expect((await read()).lives).toBe(5);await expect(frame.locator('#records')).toContainText('已完成 1 次');
  await act(page.getByRole('button',{name:'返回大厅',exact:true}));await expect(iframe).toHaveCount(0);await openGame(page,'千米降落');await expect(page.locator('[data-descensus-ready]')).toHaveAttribute('data-descensus-ready','true');await expect(frame.locator('#records')).toContainText('已完成 1 次');
  expect((await read()).state).toBe('Intro');await page.reload();await openGame(page,'千米降落');await expect(page.locator('[data-descensus-ready]')).toHaveAttribute('data-descensus-ready','true');await expect(frame.locator('#records')).toContainText('已完成 1 次');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.descensus2.v1.records')||'null'))).toEqual(record);
  for(const control of ['#start','#pause','#menu'])expect((await frame.locator(control).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await iframe.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('descensus-saved-record.png'),fullPage:true});
 }finally{await info.attach('original-input-journey.json',{body:JSON.stringify({trace,terrain:[...terrain],checkpoints:[...checkpointValues],windZones:[...windZonesSeen],lossTypes:[...lossTypes],minHeight}),contentType:'application/json'});}
 expect(remote).toEqual([]);expect(failed).toEqual([]);expect(errors).toEqual([]);
 await act(page.getByRole('button',{name:'返回大厅',exact:true}));await expect(iframe).toHaveCount(0);
});
