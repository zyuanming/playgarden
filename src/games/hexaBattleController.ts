// SPDX-License-Identifier: GPL-3.0-only
// Original gameplay classes and strategy: Giacomo Tagliabue, MIT, fixed fe97718.
// Playgarden adds cancellable presentation, validated saves and a modern UI boundary.
import createLevel from '../vendor/hexaBattle/content/createLevel';
import {generateLevel} from '../vendor/hexaBattle/content/levels';
import Game from '../vendor/hexaBattle/engine/game';
import Faction from '../vendor/hexaBattle/engine/faction';
import Hex from '../vendor/hexaBattle/engine/hex';
import HexMap,{Terrain,type ICell} from '../vendor/hexaBattle/engine/map';
import Unit,{UnitStatus,type IUnitType} from '../vendor/hexaBattle/engine/unit';
import UnitAi from '../vendor/hexaBattle/ai/unitAi';
import * as types from '../vendor/hexaBattle/engine/units';
import races from '../vendor/hexaBattle/engine/units/races';
export {Unit,Hex,Terrain,UnitStatus,races};
export const HB_KEY='playgarden.hexa-battle.v1';
export type TypeKey=keyof typeof types;
const typeKeys=Object.keys(types) as TypeKey[];
export const keyOf=(type:IUnitType)=>typeKeys.find(k=>types[k]===type)!;
export type Campaign={depth:number;money:number;party:TypeKey[];wins:number};
type SavedBattle={size:number;terrain:[number,number,number][];units:{type:TypeKey;side:number;q:number;r:number;hp:number;mp:number;mana:number;acted:boolean;status:[UnitStatus,number][]}[];epoch:number};
type Save={version:1;campaign:Campaign;battle:SavedBattle|null};
const initial=():Campaign=>({depth:0,money:0,party:['archer','warrior','warrior','warrior'],wins:0});
const integer=(n:unknown,max=1000000):n is number=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<=max;
const STOP=Symbol('disposed');
export class BattleController {
  campaign=initial();game:Game|null=null;selected='';action=-1;busy=false;paused=false;disposed=false;
  result:''|'win'|'loss'='';message='选择一支队伍，走近敌人后使用技能。';storageAvailable=true;
  private timers=new Set<ReturnType<typeof setTimeout>>();private waiting=new Set<()=>void>();private delayed=new Set<()=>void>();
  private stable='';private subscribers:(()=>void)[]=[];
  constructor(private changed:()=>void){try{const raw=localStorage.getItem(HB_KEY);if(raw)this.restore(raw);}catch{this.message='旧存档无法读取，已开始新远征。';}this.stable=this.export();}
  get player(){return this.game?Array.from(this.game.factions.keys())[0]:'';}
  get selectedUnit(){const u=this.game?.things.get(this.selected);return u instanceof Unit?u:null;}
  get moveTargets(){return this.selectedUnit?.factionId===this.player&&this.action<0?this.selectedUnit.moveTargets():[];}
  get actionTargets(){const u=this.selectedUnit;return u&&u.factionId===this.player&&this.action>=0&&u.actions[this.action]?.canExecute?u.actions[this.action].targets():[];}
  get pendingTimers(){return this.timers.size;}
  notify(){if(!this.disposed)this.changed();}
  setPaused(value:boolean){this.paused=value;if(!value){for(const wake of this.waiting)wake();this.waiting.clear();}this.notify();}
  private async gate(){if(this.disposed)throw STOP;while(this.paused){await new Promise<void>(resolve=>this.waiting.add(resolve));if(this.disposed)throw STOP;}}
  private async delay(ms:number){await this.gate();await new Promise<void>(resolve=>{let timer:ReturnType<typeof setTimeout>;const done=()=>{clearTimeout(timer);this.timers.delete(timer);this.delayed.delete(done);resolve();};timer=setTimeout(done,ms);this.timers.add(timer);this.delayed.add(done);});await this.gate();}
  dispose(){this.disposed=true;for(const timer of this.timers)clearTimeout(timer);this.timers.clear();for(const finish of this.delayed)finish();this.delayed.clear();for(const wake of this.waiting)wake();this.waiting.clear();for(const off of this.subscribers)off();this.subscribers=[];}
  private bind(){for(const off of this.subscribers)off();this.subscribers=[];if(!this.game)return;for(const name of ['unit:move','unit:takeDamage','action:perform'])this.subscribers.push(this.game.listen(name,async()=>{this.notify();await this.delay(100);}));}
  private savedBattle():SavedBattle|null {if(!this.game)return null;const sides=Array.from(this.game.factions.keys());return{size:this.game.map instanceof HexMap?this.game.map.size:5,epoch:this.game.epoch,terrain:this.game.map.cells.filter(c=>c.terrain!==Terrain.Ground).map(c=>[c.pos.q,c.pos.r,c.terrain]),units:Array.from(this.game.things.values()).filter((u):u is Unit=>u instanceof Unit).map(u=>({type:keyOf(u.type),side:sides.indexOf(u.factionId),q:u.pos.q,r:u.pos.r,hp:u.hp,mp:u.mp,mana:u.mana,acted:u.actionPerformed,status:Array.from(u.status.entries())}))};}
  export(){return JSON.stringify({version:1,campaign:this.campaign,battle:this.savedBattle()});}
  private save(){this.stable=this.export();try{localStorage.setItem(HB_KEY,this.stable);}catch{this.storageAvailable=false;}}
  private restore(raw:string){
    if(raw.length>1000000)throw Error('存档过大');const data=JSON.parse(raw) as Save,c=data.campaign;
    if(data.version!==1||!c||!integer(c.depth,200)||!integer(c.money)||!integer(c.wins)||!Array.isArray(c.party)||!c.party.length||c.party.length>200||c.party.some(k=>!typeKeys.includes(k)||!races.humans.includes(types[k])))throw Error('远征数据无效');
    let game:Game|null=null;const b=data.battle;
    if(b!==null){
      if(!b||!integer(b.size,10)||b.size<5||!integer(b.epoch)||!Array.isArray(b.terrain)||b.terrain.length>331||!Array.isArray(b.units)||!b.units.length||b.units.length>331)throw Error('战场数据无效');
      const map=new HexMap(b.size,[]),occupied=new Set<string>();
      for(const row of b.terrain){if(!Array.isArray(row)||row.length!==3||!row.every(Number.isInteger)||row[2]<0||row[2]>4)throw Error('地形无效');const pos=new Hex(row[0],row[1]);if(!map.isIn(pos))throw Error('地形越界');map.cellAt(pos).terrain=row[2];}
      const factions=[new Faction('Greens','#25855b'),new Faction('Reds','#b64a47')];game=new Game({map,factions});game.epoch=b.epoch;
      for(const u of b.units){
        if(!u||!typeKeys.includes(u.type)||![0,1].includes(u.side)||!Number.isInteger(u.q)||!Number.isInteger(u.r)||typeof u.acted!=='boolean')throw Error('单位无效');
        const pos=new Hex(u.q,u.r),type=types[u.type];if(!map.isIn(pos)||occupied.has(pos.toString()))throw Error('单位位置无效');occupied.add(pos.toString());
        if(!integer(u.hp,type.hp)||u.hp===0||!integer(u.mp,type.mp)||!integer(u.mana,type.mana)||!Array.isArray(u.status)||u.status.length>4||u.status.some(s=>!Array.isArray(s)||s.length!==2||!integer(s[0],3)||!integer(s[1],10)))throw Error('单位状态无效');
        game.addUnit({factionId:factions[u.side].id,pos,type});const unit=map.cellAt(pos).thing as Unit;unit.hp=u.hp;unit.mp=u.mp;unit.mana=u.mana;unit.actionPerformed=u.acted;unit.status=new Map(u.status);
      }
      if(game.checkGameOver())throw Error('请使用未结束战场的存档');
    }
    this.campaign={depth:c.depth,money:c.money,party:[...c.party],wins:c.wins};this.game=game;this.result='';this.selected='';this.action=-1;this.bind();
  }
  import(raw:string){if(this.busy||this.paused)return;try{this.restore(raw);this.save();this.message='远征存档已导入。';}catch(e){this.message='未导入，原进度保留：'+(e as Error).message;}this.notify();}
  start(){if(this.busy||this.paused||this.game)return;try{const def=generateLevel(this.campaign.depth);this.game=createLevel(def,this.campaign.party.map(k=>types[k]));this.bind();this.selected=Array.from(this.game.things.values()).find(u=>u instanceof Unit&&u.factionId===this.player)?.id||'';this.result='';this.action=-1;this.message='绿队先行动。先移动，再使用一次技能；结束回合后红队行动。';this.save();}catch(e){this.game=null;this.message='本次地图无法部署完整队伍，请重试：'+(e as Error).message;}this.notify();}
  reset(){if(this.busy||this.paused)return;this.game=null;this.campaign=initial();this.selected='';this.action=-1;this.result='';this.bind();this.save();this.message='已开始新远征。';this.notify();}
  retreat(){if(this.busy||this.paused)return;this.game=null;this.result='';this.selected='';this.action=-1;this.bind();this.save();this.message='已返回营地，保留出发时的队伍。';this.notify();}
  purchase(cart:TypeKey[]){if(this.game||this.busy||this.paused||cart.some(k=>!races.humans.includes(types[k])))return false;const cost=cart.reduce((n,k)=>n+types[k].cost,0);if(cost>this.campaign.money||this.campaign.party.length+cart.length>200)return false;this.campaign.money-=cost;this.campaign.party.push(...cart);this.save();this.message=`招募完成，花费 ${cost} 金币。`;this.notify();return true;}
  selectAction(index:number){const u=this.selectedUnit;if(this.busy||this.paused||!u||u.factionId!==this.player||!u.actions[index]?.canExecute)return;this.action=this.action===index?-1:index;this.notify();}
  nextUnit(){if(!this.game||this.busy||this.paused)return;const all=this.game.factionUnits[this.player].filter(u=>u.canPerformAction||u.mp>0),i=all.findIndex(u=>u.id===this.selected);this.selected=all[(i+1)%all.length]?.id||'';this.action=-1;this.notify();}
  private finish(){const winner=this.game?.checkGameOver();if(winner)this.result=winner===this.player?'win':'loss';return!!winner;}
  async cell(q:number,r:number){if(!this.game||this.busy||this.paused||this.result)return;const target=new Hex(q,r);if(!this.game.map.isIn(target))return;const u=this.selectedUnit,move=this.moveTargets.some(h=>h.equals(target)),action=this.actionTargets.some(h=>h.equals(target));
    if(u&&action){await this.transaction(async()=>{await u.actions[this.action].execute(target);this.action=-1;this.selected='';});}
    else if(u&&move){await this.transaction(async()=>u.move(target));}
    else{const thing=this.game.map.cellAt(target).thing;this.selected=thing instanceof Unit?thing.id:'';this.action=-1;this.notify();}
  }
  private async transaction(work:()=>Promise<unknown>){this.busy=true;this.notify();try{await this.gate();await work();await this.gate();this.finish();if(!this.result)this.save();}catch(e){if(e!==STOP&&!this.disposed)this.message='操作未完成：'+String(e);}finally{this.busy=false;this.notify();}}
  async endTurn(){if(!this.game||this.busy||this.paused||this.result)return;await this.transaction(async()=>{const game=this.game!;this.selected='';this.action=-1;await game.endTurn();if(this.finish())return;
    const enemy=game.currenFaction.id;
    const context={isCellNearEnemyUnit:(c:ICell)=>c.pos.neighbors.filter(game.map.isIn).map(game.map.cellAt).some(c=>c.thing instanceof Unit&&c.thing.factionId!==enemy)};
    for(const unit of [...game.factionUnits[enemy]]){
      await this.delay(200);if(!game.things.has(unit.id))continue;const ai=new UnitAi(unit,game.map,context);
      const act=async(last=false)=>{await this.gate();if(this.finish())return;const action=ai.getAction(last);if(action&&unit.canPerformAction)await action();this.notify();};
      await act();if(this.finish())break;
      for(const pos of ai.findPath()){await this.gate();if(!unit.moveTargets().some(h=>h.equals(pos)))break;await unit.move(pos);await act();if(this.finish())break;}
      if(this.finish())break;await act(true);if(this.finish())break;
    }
    if(!this.result)await game.endTurn();this.message='轮到绿队。';
  });}
  acceptResult(){if(this.busy||this.paused||!this.result||!this.game)return;if(this.result==='win'){const depth=this.campaign.depth,reward=Math.floor((10+depth*10)*Math.max(20-depth,1)/70);this.campaign={depth:this.campaign.depth+1,money:this.campaign.money+reward,party:this.game.factionUnits[this.player].map(u=>keyOf(u.type)),wins:this.campaign.wins+1};this.message=`胜利，获得 ${reward} 金币。生还者进入下一层。`;}else this.message='本次战斗失败。返回出发时的队伍，可重新挑战。';this.game=null;this.result='';this.selected='';this.action=-1;this.bind();this.save();this.notify();}
  snapshot(){return{campaign:{...this.campaign,party:[...this.campaign.party]},busy:this.busy,paused:this.paused,disposed:this.disposed,timers:this.pendingTimers,result:this.result,selected:this.selected,action:this.action,player:this.player,epoch:this.game?.epoch??0,phase:this.game?.currenFaction.id??'',units:this.game?Array.from(this.game.things.values()).filter((u):u is Unit=>u instanceof Unit).map(u=>({id:u.id,type:keyOf(u.type),side:u.factionId,q:u.pos.q,r:u.pos.r,hp:u.hp,mp:u.mp,mana:u.mana,acted:u.actionPerformed,status:Array.from(u.status),moves:u.moveTargets().map(h=>[h.q,h.r]),actions:u.actions.map((a,i)=>({i,name:a.name,available:a.canExecute,targets:a.targets().map(h=>({q:h.q,r:h.r,result:a.performAction(h)}))}))})):[]};}
}
