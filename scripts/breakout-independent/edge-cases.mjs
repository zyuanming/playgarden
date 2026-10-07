import assert from 'node:assert/strict';
import {segmentIntercept,sweepBox,paddleBounce} from './geometry.mjs';
import {createBreakout,launchBreakout,stepBreakout,movePaddle,breakoutLevels,COURT} from './logic.mjs';
const base=()=>launchBreakout(createBreakout(0));const checks=[];
function check(name,f){f();checks.push(name);}
check('exact zero-distance incoming and receding contacts',()=>{
 assert.deepEqual(sweepBox(5,7,4,0,5,5,10,10),{t:0,x:5,y:7,nx:-1,ny:0});assert.equal(sweepBox(5,7,-4,0,5,5,10,10),null);
 const s={...base(),bricks:[{id:1,x:20,y:20,w:20,h:20,hp:2},{id:2,x:100,y:100,w:20,h:20,hp:1}],x:14,y:30,vx:220,vy:0};
 const a=stepBreakout(s,.001);assert.equal(a.hits,1);assert.equal(a.bricks[0].hp,1);assert.equal(a.vx,-220);assert.ok(a.x<14);assert.equal(s.bricks[0].hp,2);
});
check('all four exact incoming corners reflect both axes',()=>{
 for(const [x,y,dx,dy,nx,ny]of [[0,0,10,10,-1,-1],[15,0,-10,10,1,-1],[0,15,10,-10,-1,1],[15,15,-10,-10,1,1]]){assert.deepEqual(sweepBox(x,y,dx,dy,5,5,10,10),{t:.5,x:x+dx/2,y:y+dy/2,nx,ny});}
});
check('simultaneous court corner resolves both normals without zero-time loop',()=>{const s={...base(),x:6,y:6,vx:-220,vy:-180};const a=stepBreakout(s,.01);assert.equal(a.vx,220);assert.equal(a.vy,180);assert.ok(a.x>6&&a.y>6);assert.equal(a.score,0);});
check('high-speed pass cannot tunnel across isolated brick from four sides',()=>{
 for(const [x,y,vx,vy]of [[100,54,0,20000],[100,146,0,-20000],[54,100,20000,0],[146,100,-20000,0]]){
  const a=stepBreakout({...base(),bricks:[{id:1,x:80,y:80,w:40,h:40,hp:2}],x,y,vx,vy},.0015);
  assert.ok(a.hits>=1);assert.equal(Math.sign(a.vx||a.vy),-Math.sign(vx||vy));assert.equal(a.bricks[0].hp,1);
 }
});
check('iteration cap stays finite at impossible but bounded synthetic speed',()=>{const t=performance.now();const a=stepBreakout({...base(),x:200,y:300,vx:1e12,vy:0},.05);assert.ok(performance.now()-t<1000);assert.ok(Number.isFinite(a.x)&&a.x>=6&&a.x<=394);assert.equal(a.score,0);});
check('last damage sets terminal victory; later input cannot score or move',()=>{const a=stepBreakout({...base(),bricks:[{id:1,x:80,y:80,w:40,h:40,hp:1}],x:100,y:135,vx:0,vy:-220},.1);assert.equal(a.phase,'won');assert.equal(a.score,10);assert.equal(a.hits,1);assert.equal(a.vx,0);assert.equal(a.vy,0);assert.equal(stepBreakout(a,1),a);assert.equal(movePaddle(a,44),a);assert.equal(launchBreakout(a),a);});
check('each floor crossing consumes one life and third loss stays terminal',()=>{let s=base();for(let lives=3;lives>0;lives--){s=stepBreakout({...s,phase:'playing',x:100,y:505,vx:0,vy:220},.05);assert.equal(s.lives,lives-1);assert.equal(s.phase,lives>1?'ready':'lost');assert.equal(stepBreakout(s,.05),s);}assert.equal(launchBreakout(s),s);assert.equal(movePaddle(s,44),s);});
check('ball below paddle cannot be rescued even when paddle overlaps',()=>{const a=stepBreakout({...base(),x:200,y:460,vx:0,vy:10000,paddle:200},.05);assert.equal(a.lives,2);assert.equal(a.phase,'ready');});
check('large wall-clock stall is clamped to 50ms',()=>{assert.deepEqual(stepBreakout(base(),100),stepBreakout(base(),.05));});
check('paddle control keeps upward minimum and exact speed at extremes',()=>{for(let offset=-3;offset<=3;offset+=.001){const {vx,vy}=paddleBounce(offset,275);assert.ok(vy< -144);assert.ok(Math.abs(Math.hypot(vx,vy)-275)<1e-9);}});
console.log(JSON.stringify({passed:checks.length,checks},null,2));
