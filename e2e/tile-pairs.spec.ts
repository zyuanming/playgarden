// SPDX-License-Identifier: GPL-3.0-only
import {test,expect,type Locator,type Page} from '@playwright/test';
import {openGame,chooseLevel,captureErrors} from './helpers';
type Tile={id:number,x:number,y:number,z:number,symbol:number};
async function readTiles(page:Page):Promise<Tile[]>{return page.locator('[data-pair-tile]').evaluateAll(nodes=>nodes.map(n=>({id:Number(n.getAttribute('data-pair-tile')),x:Number(n.getAttribute('data-x')),y:Number(n.getAttribute('data-y')),z:Number(n.getAttribute('data-z')),symbol:Number(n.getAttribute('data-symbol'))})));}
// Independently check cover and horizontal freedom from displayed geometry.
function solution(tiles:Tile[]):number[][]|null{
  const seen=new Set<string>();
  function dfs(live:Tile[]):number[][]|null{
    if(!live.length)return [];const key=live.map(t=>t.id).join(',');if(seen.has(key))return null;seen.add(key);
    const free=live.filter(t=>!live.some(o=>o.z>t.z&&Math.abs(o.x-t.x)<.98&&Math.abs(o.y-t.y)<.98)&&(!live.some(o=>o.z===t.z&&o.y===t.y&&o.x===t.x-1)||!live.some(o=>o.z===t.z&&o.y===t.y&&o.x===t.x+1)));
    for(let a=0;a<free.length;a++)for(let b=a+1;b<free.length;b++)if(free[a].symbol===free[b].symbol){const ids=[free[a].id,free[b].id];const rest=dfs(live.filter(t=>!ids.includes(t.id)));if(rest)return[ids,...rest];}return null;
  }return dfs(tiles);
}
test('layered matching first/final and recoverable shell controls',async({page},info)=>{
  test.setTimeout(90000);const errors=captureErrors(page);const act=async(l:Locator)=>info.project.name==='mobile'?l.tap():l.click();
  await openGame(page,'叠牌寻对');const game=page.locator('[data-tile-pairs-game]');const tile=(n:number)=>page.locator(`[data-pair-tile="${n}"]`);const initial=await readTiles(page);const first=solution(initial)![0];
  await page.screenshot({path:info.outputPath('tile-pairs-first-start.png'),fullPage:true});
  if(info.project.name==='mobile')await act(tile(first[0]));else{await tile(first[0]).focus();await tile(first[0]).press('Space');}await act(tile(first[1]));await expect(game).toHaveAttribute('data-pairs','1');
  await act(page.getByRole('button',{name:'暂停',exact:true}));await expect(page.locator('[data-pair-tile]:enabled')).toHaveCount(0);
  await act(page.getByRole('button',{name:'继续游戏',exact:true}));await act(page.getByRole('button',{name:'撤销',exact:true}));await expect(game).toHaveAttribute('data-pairs','0');
  await act(page.getByRole('button',{name:'提示',exact:true}));await expect(page.locator('.tp-tile.hinted')).toHaveCount(2);
  for(const id of first)await act(tile(id));await act(page.getByRole('button',{name:'重来',exact:true}));await expect(game).toHaveAttribute('data-pairs','0');
  for(const level of [0,7]){
    if(level){await chooseLevel(page,level);await expect(page.locator('.status')).toContainText('找两张相同的自由牌');await page.screenshot({path:info.outputPath('tile-pairs-final-start.png'),fullPage:true});}const all=await readTiles(page);const plan=solution(all);expect(plan).not.toBeNull();
    for(const pair of plan!)for(const id of pair){await expect(tile(id)).toHaveAttribute('data-free','true');await act(tile(id));}
    await expect(game).toHaveAttribute('data-won','true');await expect(page.locator('[data-pair-tile]')).toHaveCount(0);await expect(page.locator('.status')).toHaveClass(/success/);await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`tile-pairs-${level+1}-won.png`),fullPage:true});
  }
  expect(errors).toEqual([]);
});
