// SPDX-License-Identifier: GPL-3.0-only
import {test,expect,type Locator} from '@playwright/test';
import {openGame,chooseLevel,captureErrors} from './helpers';
// Independent rule search over the board exposed by the visible tube controls.
function solution(start:number[][],capacity:number):number[][]|null {
  const seen=new Set<string>();
  function dfs(board:number[][]):number[][]|null {
    if(board.every(t=>!t.length||t.length===capacity&&t.every(v=>v===t[0])))return [];
    const key=board.map(t=>t.join(',')).sort().join('|');if(seen.has(key))return null;seen.add(key);
    const choices:{a:number,b:number,rank:number}[]=[];
    for(let a=0;a<board.length;a++)for(let b=0;b<board.length;b++)if(a!==b&&board[a].length&&board[b].length<capacity&&(!board[b].length||board[b].at(-1)===board[a].at(-1))){
      if(board[a].length===capacity&&board[a].every(v=>v===board[a][0]))continue;
      if(!board[b].length&&board[a].every(v=>v===board[a][0]))continue;
      choices.push({a,b,rank:board[b].length*3+(board[a].length===1?2:0)});
    }
    for(const {a,b} of choices.sort((a,b)=>b.rank-a.rank)){const next=board.map(t=>[...t]);next[b].push(next[a].pop()!);const tail=dfs(next);if(tail)return [[a,b],...tail];}return null;
  }return dfs(start);
}
test('color tubes genuine first/final solutions and shell controls',async({page},info)=>{
  test.setTimeout(90000);const errors=captureErrors(page);const act=async(l:Locator)=>info.project.name==='mobile'?l.tap():l.click();
  await openGame(page,'彩珠归管');const game=page.locator('[data-color-tubes-game]');const tube=(n:number)=>page.locator(`[data-tube="${n}"]`);const initial=await game.getAttribute('data-state');
  await page.screenshot({path:info.outputPath('color-tubes-start.png'),fullPage:true});
  if(info.project.name==='mobile')await act(tube(0));else{await tube(0).focus();await tube(0).press('Space');}
  await act(tube(2));await expect(game).toHaveAttribute('data-moves','1');
  await act(page.getByRole('button',{name:'暂停',exact:true}));await expect(tube(0)).toBeDisabled();
  await act(page.getByRole('button',{name:'继续游戏',exact:true}));await act(page.getByRole('button',{name:'撤销',exact:true}));await expect(game).toHaveAttribute('data-state',initial!);
  await act(page.getByRole('button',{name:'提示',exact:true}));await expect(page.locator('.ct-tube.hinted')).toHaveCount(2);
  await act(tube(0));await act(tube(2));await act(page.getByRole('button',{name:'重来',exact:true}));await expect(game).toHaveAttribute('data-state',initial!);
  for(const level of [0,7]){
    if(level)await chooseLevel(page,level);
    const board=JSON.parse((await game.getAttribute('data-state'))!) as number[][];const cap=Number(await game.getAttribute('data-capacity'));const plan=solution(board,cap);expect(plan).not.toBeNull();
    for(const [from,to]of plan!){await act(tube(from));await act(tube(to));}
    await expect(game).toHaveAttribute('data-won','true');await expect(page.locator('.status')).toHaveClass(/success/);await expect(tube(0)).toBeDisabled();
    const result=JSON.parse((await game.getAttribute('data-state'))!) as number[][];expect(result.every(t=>!t.length||t.length===cap&&t.every(v=>v===t[0]))).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`color-tubes-${level+1}-won.png`),fullPage:true});
  }
  expect(errors).toEqual([]);
});
