// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { openGame, chooseLevel } from './helpers';
const solution = readFileSync(new URL('./fixtures/elevator-saga-dispatcher.js', import.meta.url), 'utf8');
test.use({ trace: 'off' });
test('complete original elevator programming: first middle final, isolation and lifecycle', async ({ page, baseURL }, info) => {
  test.setTimeout(240000);
  const mobile = info.project.name === 'mobile', inputs: object[] = [], errors: string[] = [], outside: string[] = [], responses: string[] = [], workerEvents: object[] = [];
  const dispatchLog:object[]=[];
  page.on('console',message=>{const text=message.text();if(text.startsWith('ELEVATOR_PUBLIC ')){try{dispatchLog.push(JSON.parse(text.slice(16)));if(dispatchLog.length>500)dispatchLog.shift();}catch{/* only our bounded JSON records */}}});
  if (!baseURL) throw new Error('The game test requires its configured baseURL.');
  const gameOrigin = new URL(baseURL).origin;
  page.on('worker', worker => { workerEvents.push({event:'created',url:worker.url()}); worker.on('close',()=>workerEvents.push({event:'closed',url:worker.url()})); });
  page.on('response', response => { if (/^https?:/.test(response.url()) && new URL(response.url()).origin !== gameOrigin) responses.push(response.url()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== gameOrigin) outside.push(request.url()); });
  const activate = async (node: Locator) => { if (mobile) await node.tap(); else await node.click(); };
  await openGame(page, '电梯调度员');
  const iframe = page.locator('iframe[title="电梯调度员 Elevator Saga 编程挑战"]');
  const frame = page.frameLocator('iframe[title="电梯调度员 Elevator Saga 编程挑战"]');
  const ready = () => expect(page.locator('[data-elevator-ready]')).toHaveAttribute('data-elevator-ready','true');
  const code = async (value: string) => {
    await activate(frame.locator('.CodeMirror'));
    await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(value);
    inputs.push({ action:'paste-editor', characters:value.length });
  };
  const run = async () => { await activate(frame.locator('#run')); inputs.push({ action:'apply',time:Date.now() }); };
  const stats = async () => ({ transported:await frame.locator('#transported').innerText(),elapsed:await frame.locator('#elapsed').innerText(),maximum:await frame.locator('#maximum').innerText(),moves:await frame.locator('#moves').innerText() });
  const screenshot = async (name:string) => { await page.screenshot({path:info.outputPath(name),fullPage:true}); };
  const progress = () => page.evaluate(() => JSON.parse(localStorage.getItem('playgarden.elevator-saga.v1') || '{}').completed || []);
  try {
    await ready(); await expect(page.getByLabel('选择关卡',{exact:true}).locator('option')).toHaveCount(18);
    await expect(iframe).toHaveAttribute('sandbox','allow-scripts');
    await code('{ init:function(){}, update:function(){} }');
    await frame.locator('#speed').selectOption('55'); await run();
    await expect(frame.locator('body')).toHaveAttribute('data-result','false',{timeout:20000});
    expect(await progress()).toEqual([]); inputs.push({case:'idle-natural-failure',stats:await stats()});
    await screenshot('elevator-real-idle-failure.png');
    await code('{ init: function( }'); await run();
    await expect(frame.locator('#status')).toContainText('程序错误');
    await code('{ init: function(){ while(true){} }, update:function(){} }'); await run();
    await expect(frame.locator('#status')).toContainText('长时间没有响应',{timeout:10000});
    await expect(frame.locator('#run')).toBeEnabled(); expect(await progress()).toEqual([]);
    await screenshot('elevator-infinite-loop-stopped-editor-usable.png');
    await code('{ init:function(){ var blocked=false; try { indexedDB.open("playgarden-isolation-probe"); } catch(e) { blocked=true; } throw new Error("ISOLATION:"+typeof document+":"+typeof localStorage+":"+self.origin+":"+blocked); }, update:function(){} }'); await run();
    await expect(frame.locator('#status')).toContainText('ISOLATION:undefined:undefined:null:true');
    expect(await progress()).toEqual([]);
    await code('{ init:function(){ var bad=[]; for(var p=self;p;p=Object.getPrototypeOf(p)){ ["Worker","SharedWorker","importScripts","setTimeout","setInterval","BroadcastChannel"].forEach(function(k){ if(p[k]!==undefined)bad.push(k); }); } throw new Error("CHILDREN_BLOCKED:"+(bad.length===0)); }, update:function(){} }'); await run();
    await expect(frame.locator('#status')).toContainText('CHILDREN_BLOCKED:true');
    await code('{ init:function(){ var me=this; me.blocked=false;me.directive="";self.addEventListener("securitypolicyviolation",function(e){me.directive=e.effectiveDirective;});fetch("https://example.com/elevator-csp-probe").catch(function(){me.blocked=true;}); }, update:function(){if(this.blocked&&this.directive==="connect-src")throw new Error("CSP_CONNECT_BLOCKED");} }'); await run();
    await expect(frame.locator('#status')).toContainText('CSP_CONNECT_BLOCKED');
    inputs.push({case:'csp-network-probe',responses:[...responses]}); expect(responses).toEqual([]);
    await code('{ init:function(){ for(var i=0;i<500;i++)postMessage({type:"noise"}); }, update:function(){} }'); await run();
    await expect(frame.locator('#status')).toContainText('消息过于频繁');
    await expect(frame.locator('#run')).toBeEnabled();
    await code(solution); await frame.locator('#speed').selectOption('1'); await run();
    await expect.poll(async()=>Number((await frame.locator('#elapsed').innerText()).split(' ')[0])).toBeGreaterThan(1);
    await activate(frame.locator('#pause')); await expect(frame.locator('body')).toHaveAttribute('data-paused','true');
    const frozen = await stats(); await page.waitForTimeout(750); expect(await stats()).toEqual(frozen);
    await frame.locator('#pause').scrollIntoViewIfNeeded(); await page.screenshot({path:info.outputPath('elevator-paused-controls-viewport.png'),fullPage:false});
    await activate(frame.locator('#pause')); await frame.locator('#speed').selectOption('55');
    await expect(frame.locator('body')).toHaveAttribute('data-result','true',{timeout:20000});
    expect(await progress()).toContain(0); inputs.push({case:'first-earned-success',stats:await stats()});
    await screenshot('elevator-first-earned-success.png');
    await activate(frame.locator('#save'));
    await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.elevator-saga.v1')||'{}').code)).toBe(solution);
    await activate(frame.locator('#reset')); await activate(frame.locator('#undo'));
    await page.reload();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.elevator-saga.v1')||'{}').code)).toBe(solution);
    expect(await progress()).toContain(0);
    // The app deliberately returns to its lobby after a reload. Re-enter by UI.
    await page.getByRole('textbox',{name:'搜索游戏'}).fill('电梯调度员');
    await activate(page.getByRole('button',{name:'开始玩电梯调度员',exact:true})); await ready();
    await expect(frame.locator('.CodeMirror')).toContainText('An ordinary player solution');
    for (const level of [8,17]) {
      await chooseLevel(page,level); await ready(); await code(solution); await frame.locator('#speed').selectOption('55'); await run();
      inputs.push({case:'started-challenge',level});
      await expect(frame.locator('body')).toHaveAttribute('data-result',/^(true|false)$/,{timeout:90000});
      inputs.push({case:'challenge-terminal',level,result:await frame.locator('body').getAttribute('data-result'),stats:await stats()});
      await expect(frame.locator('body')).toHaveAttribute('data-result','true');
      expect(await progress()).toContain(level); inputs.push({case:'earned-success',level,stats:await stats()});
      await screenshot(`elevator-${level===17?'final':'middle'}-earned-success.png`);
    }
    await chooseLevel(page,0); await ready(); await code(solution); await frame.locator('#speed').selectOption('1'); await run();
    await activate(page.getByRole('button',{name:'暂停',exact:true})); await expect(frame.locator('body')).toHaveAttribute('data-paused','true');
    const hostFrozen=await stats(); await page.waitForTimeout(650); expect(await stats()).toEqual(hostFrozen);
    await activate(page.getByRole('button',{name:'继续游戏',exact:true}));
    await expect(frame.locator('body')).toHaveAttribute('data-paused','false');
    await activate(page.getByRole('button',{name:'返回游戏大厅',exact:true})); await expect(iframe).toHaveCount(0); await expect.poll(()=>page.workers().length).toBe(0);
    await openGame(page,'电梯调度员'); await ready(); await expect(frame.locator('#run')).toBeEnabled();
    await code('{ init:function(){while(true){}}, update:function(){} }'); await run();
    await activate(page.getByRole('button',{name:'返回游戏大厅',exact:true})); await expect(iframe).toHaveCount(0); await expect.poll(()=>page.workers().length).toBe(0);
    await openGame(page,'电梯调度员'); await ready(); await expect(frame.locator('#run')).toBeEnabled();
    const finalCode = solution + '\n// immediate exit save'; await code(finalCode);
    await activate(page.getByRole('button',{name:'返回游戏大厅',exact:true})); await expect(iframe).toHaveCount(0);
    await openGame(page,'电梯调度员'); await ready();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.elevator-saga.v1')||'{}').code)).toBe(finalCode);
    expect(errors).toEqual([]); expect(responses).toEqual([]); expect(outside.filter(url=>url!=='https://example.com/elevator-csp-probe')).toEqual([]);
  } finally {
    const finalVisible = await Promise.all([frame.locator('#level').inputValue(),frame.locator('body').getAttribute('data-result'),stats()]).then(([level,result,stats])=>({level,result,stats})).catch(()=>null);
    writeFileSync(info.outputPath('elevator-ordinary-inputs.json'),JSON.stringify({inputs,errors,outside,responses,workerEvents,dispatchLog,finalVisible},null,2));
    writeFileSync(info.outputPath('elevator-earned-code-progress.json'),JSON.stringify(await page.evaluate(()=>localStorage.getItem('playgarden.elevator-saga.v1')).catch(()=>null)));
    await page.screenshot({path:info.outputPath('elevator-final-viewport.png'),fullPage:false}).catch(()=>{});
  }
});

// Production acceptance above remains separate. This bounded development-server
// check exercises React's real StrictMode effect replay using the same sources.
test('elevator real development StrictMode rapid remount preserves editor and terminates worker', async ({ page }, info) => {
  test.setTimeout(45000);
  const port = 4280 + info.workerIndex, base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']});
  let output=''; server.stdout.on('data',chunk=>output+=String(chunk)); server.stderr.on('data',chunk=>output+=String(chunk));
  const mobile=info.project.name==='mobile';
  const activate=async(node:Locator)=>{if(mobile)await node.tap();else await node.click();};
  const frame=page.frameLocator('iframe[title="电梯调度员 Elevator Saga 编程挑战"]');
  try {
    await expect.poll(async()=>{try{return (await fetch(base)).ok;}catch{return false;}},{timeout:15000}).toBe(true);
    await page.goto(base);
    for(let i=0;i<2;i++){
      await page.getByRole('textbox',{name:'搜索游戏'}).fill('电梯调度员');
      await activate(page.getByRole('button',{name:'开始玩电梯调度员',exact:true}));
      await expect(page.locator('[data-elevator-ready]')).toHaveAttribute('data-elevator-ready','true');
      const entered=solution+'\n// strict replay '+i;
      await activate(frame.locator('.CodeMirror'));await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(entered);
      await activate(frame.locator('#run'));await expect.poll(()=>page.workers().length).toBe(1);
      await activate(page.getByRole('button',{name:'返回游戏大厅',exact:true}));await expect.poll(()=>page.workers().length).toBe(0);
      expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.elevator-saga.v1')||'{}').code)).toBe(entered);
    }
  } finally { server.kill('SIGTERM');writeFileSync(info.outputPath('elevator-strictmode-dev-server.json'),JSON.stringify({output,mode:'Vite development; existing React.StrictMode root'})); }
});
