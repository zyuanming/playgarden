// SPDX-License-Identifier: GPL-3.0-only
import {sweepBox,paddleBounce,type Hit} from '../vendor/breakout/geometry';
export const COURT={width:400,height:500,radius:6,paddleWidth:88,paddleY:462,paddleHeight:12};
export type Brick={id:number;x:number;y:number;w:number;h:number;hp:number};
export type BreakoutLevel={id:string;name:string;lesson:string;speed:number;rows:string[]};
export const breakoutLevels:BreakoutLevel[]=[
 {id:'first-return',name:'第一次回弹',lesson:'挡板中心让球向上，边缘让球斜着飞。先接稳，再瞄准。',speed:220,rows:['..111..']},
 {id:'two-wings',name:'左右两翼',lesson:'让球落在挡板不同位置，分别打到左右两组砖。',speed:225,rows:['11...11']},
 {id:'stairs',name:'上行阶梯',lesson:'斜着反弹能从侧面逐层打开阶梯。',speed:230,rows:['1......','.1.....','..1....','...1...','....1..']},
 {id:'corridor',name:'打开走廊',lesson:'先打通中间，再让球进入上方通道。',speed:235,rows:['1111111','...1...','...1...']},
 {id:'two-decks',name:'双层甲板',lesson:'观察砖块间的空隙，用斜球改变下一次落点。',speed:240,rows:['1111111','.......','1.1.1.1']},
 {id:'durable',name:'双击砖块',lesson:'标着2的砖需要打中两次，颜色和数字会一起变化。',speed:245,rows:['..222..','.1...1.']},
 {id:'open-ring',name:'环形入口',lesson:'从开口把球送进环里，连续反弹能清掉内侧砖。',speed:250,rows:['.11111.','.1...1.','.1...1.','.11.11.']},
 {id:'diagonal',name:'交错斜线',lesson:'反弹方向比一味追球更重要，预判球撞墙后的落点。',speed:255,rows:['1.....1','.1...1.','..1.1..','...2...']},
 {id:'side-door',name:'侧门通行',lesson:'利用左右墙反弹，绕到砖块的侧面。',speed:260,rows:['.22222.','.11111.','..111..']},
 {id:'split-islands',name:'分离小岛',lesson:'把远处剩余砖块当成下一次目标，避免一直垂直弹跳。',speed:265,rows:['21...12','.......','..121..','.......','1.....1']},
 {id:'diamond',name:'菱形花窗',lesson:'从边缘逐步打开花窗，注意双击砖的剩余次数。',speed:270,rows:['...2...','..121..','.12121.','..121..','...1...']},
 {id:'garden-finale',name:'花园终章',lesson:'混合运用中心接球、边缘瞄准和墙面反弹，清空全部砖。',speed:275,rows:['1212121','.11111.','..222..','...1...']},
];
export type BreakoutState={level:number;bricks:Brick[];x:number;y:number;vx:number;vy:number;paddle:number;lives:number;score:number;phase:'ready'|'playing'|'won'|'lost';hits:number;elapsed:number};
export function createBreakout(level:number):BreakoutState{
 const index=Number.isInteger(level)&&level>=0&&level<breakoutLevels.length?level:0;
 const bricks:Brick[]=[];breakoutLevels[index].rows.forEach((row,r)=>[...row].forEach((c,col)=>{if(c!=='0'&&c!=='.')bricks.push({id:r*7+col,x:29+col*49,y:68+r*27,w:44,h:19,hp:Number(c)});}));
 return {level:index,bricks,x:200,y:COURT.paddleY-COURT.radius-1,vx:0,vy:0,paddle:200,lives:3,score:0,phase:'ready',hits:0,elapsed:0};
}
export function movePaddle(state:BreakoutState,x:number):BreakoutState{
 if(!Number.isFinite(x)||state.phase==='won'||state.phase==='lost')return state;
 const paddle=Math.max(COURT.paddleWidth/2,Math.min(COURT.width-COURT.paddleWidth/2,x));
 return {...state,paddle,...(state.phase==='ready'?{x:paddle}:{})};
}
export function launchBreakout(state:BreakoutState):BreakoutState{
 if(state.phase!=='ready')return state;
 const speed=breakoutLevels[state.level].speed;return {...state,phase:'playing',vx:speed*.24,vy:-Math.sqrt(speed*speed-(speed*.24)**2)};
}
// Bounded fixed microsteps and continuous sweeps prevent tunnelling. Extra elapsed
// time after a long stall is intentionally dropped rather than consuming lives.
export function stepBreakout(state:BreakoutState,dt:number):BreakoutState{
 if(state.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return state;
 let s={...state,bricks:state.bricks.map(b=>({...b}))};
 let remaining=Math.min(dt,.05);while(remaining>1e-9&&s.phase==='playing'){
  const slice=Math.min(remaining,1/120);remaining-=slice;s.elapsed+=slice;
  let time=slice;
  for(let bounce=0;bounce<12&&time>1e-9&&s.phase==='playing';bounce++){
   const dx=s.vx*time,dy=s.vy*time,r=COURT.radius;
   const candidates:(Hit&{id:number;kind:'wall'|'paddle'|'brick'|'floor'})[]=[];
   const add=(h:Hit|null,id:number,kind:'wall'|'paddle'|'brick'|'floor')=>{if(h)candidates.push({...h,id,kind});};
   if(dx<0){const t=(r-s.x)/dx;if(t>=-1e-9&&t<=1)add({t:Math.max(0,t),x:r,y:s.y+dy*t,nx:1,ny:0},-1,'wall');}
   if(dx>0){const t=(COURT.width-r-s.x)/dx;if(t>=-1e-9&&t<=1)add({t:Math.max(0,t),x:COURT.width-r,y:s.y+dy*t,nx:-1,ny:0},-2,'wall');}
   if(dy<0){const t=(r-s.y)/dy;if(t>=-1e-9&&t<=1)add({t:Math.max(0,t),x:s.x+dx*t,y:r,nx:0,ny:1},-3,'wall');}
   if(dy>0){const t=(COURT.height+r-s.y)/dy;if(t>=0&&t<=1)add({t,x:s.x+dx*t,y:COURT.height+r,nx:0,ny:-1},-4,'floor');
    // Paddle only catches from above; moving it under a lost ball cannot rescue it.
    if(s.y<=COURT.paddleY-r+.001)add(sweepBox(s.x,s.y,dx,dy,s.paddle-COURT.paddleWidth/2-r,COURT.paddleY-r,s.paddle+COURT.paddleWidth/2+r,COURT.paddleY+COURT.paddleHeight+r),-5,'paddle');
   }
   for(const b of s.bricks)if(b.hp>0)add(sweepBox(s.x,s.y,dx,dy,b.x-r,b.y-r,b.x+b.w+r,b.y+b.h+r),b.id,'brick');
   candidates.sort((a,b)=>a.t-b.t||a.id-b.id);const h=candidates[0];
   if(!h){s.x+=dx;s.y+=dy;break;}
   s.x=h.x;s.y=h.y;time*=1-h.t;
   if(h.kind==='floor'){s.lives--;s.phase=s.lives>0?'ready':'lost';s.x=s.paddle;s.y=COURT.paddleY-r-1;s.vx=s.vy=0;break;}
   if(h.kind==='brick'){
    const brick=s.bricks.find(b=>b.id===h.id)!;brick.hp--;s.score+=10;s.hits++;
    if(s.bricks.every(b=>b.hp===0)){s.phase='won';s.vx=s.vy=0;break;}
   }
   if(h.kind==='paddle'&&h.ny===-1){const velocity=paddleBounce((h.x-s.paddle)/(COURT.paddleWidth/2),breakoutLevels[s.level].speed);s.vx=velocity.vx;s.vy=velocity.vy;}
   else{if(h.nx)s.vx=-s.vx;if(h.ny)s.vy=-s.vy;}
   // Move off the struck surface; time is also consumed on degenerate contacts.
   s.x+=h.nx*.0001;s.y+=h.ny*.0001;if(h.t<1e-8)time=Math.max(0,time-1e-7);
  }
 }
 return s;
}
export function breakoutHint(state:BreakoutState):string{
 if(state.phase==='ready')return '点发球开始。用挡板中心接球更稳，靠近两端会斜向反弹。';
 if(state.phase==='lost')return '这局的三次机会用完了。重来试试提前移动到球的落点。';
 if(state.phase==='won')return '全部砖块已清空！你可以选择下一关。';
 return breakoutLevels[state.level].lesson;
}
