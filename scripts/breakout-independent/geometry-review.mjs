import assert from 'node:assert/strict';
import {sweepBox} from './geometry.mjs';
import {createBreakout,launchBreakout,stepBreakout,movePaddle,breakoutLevels,COURT} from './logic.mjs';
let seed=872349; function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
// Independent Liang-Barsky / slab interval oracle for incoming rays initially outside.
function oracle(x,y,dx,dy,l,t,r,b){
 let near=-Infinity,far=Infinity,nx=0,ny=0;
 for(const [p,v,lo,hi,axis] of [[x,dx,l,r,'x'],[y,dy,t,b,'y']]){
  if(v===0){if(p<lo||p>hi)return null;continue;}
  let a=(lo-p)/v,z=(hi-p)/v,n=v>0?-1:1;if(a>z)[a,z]=[z,a];
  if(a>near+1e-10){near=a;nx=axis==='x'?n:0;ny=axis==='y'?n:0;}
  else if(Math.abs(a-near)<1e-10){if(axis==='x')nx=n;else ny=n;}
  far=Math.min(far,z);if(near>far)return null;
 }
 return near>=0&&near<=1?{t:near,nx,ny}:null;
}
let checked=0;
for(let i=0;i<500000;i++){
 const l=rand()*100,t=rand()*100,r=l+1+rand()*100,b=t+1+rand()*100;
 const x=rand()*400-100,y=rand()*400-100,dx=rand()*1000-500,dy=rand()*1000-500;
 if(x>=l&&x<=r&&y>=t&&y<=b)continue;
 const a=sweepBox(x,y,dx,dy,l,t,r,b),o=oracle(x,y,dx,dy,l,t,r,b);
 assert.equal(!!a,!!o,JSON.stringify({x,y,dx,dy,l,t,r,b,a,o}));
 if(a&&o){assert.ok(Math.abs(a.t-o.t)<1e-7);assert.equal(a.nx,o.nx);assert.equal(a.ny,o.ny);}checked++;
}
console.log('Independent slab oracle passed',checked,'rays');
// Long randomized reachable runs: legal paddle-only inputs, all levels.
let total=0,wins=0,losses=0,interior=0,firstInterior;
for(let l=0;l<12;l++)for(let run=0;run<10;run++){
 let s=launchBreakout(createBreakout(l));
 for(let tick=0;tick<15000&&s.phase!=='won'&&s.phase!=='lost';tick++){
  let landing=s.x+s.vx*((COURT.paddleY-COURT.radius-s.y)/s.vy),span=388;
  let p=((landing-6)%(2*span)+2*span)%(2*span);landing=6+(p<=span?p:2*span-p);
  if(s.vy>0&&Number.isFinite(landing))s=movePaddle(s,landing+(rand()-.5)*72);
  if(s.phase==='ready')s=launchBreakout(s);
  s=stepBreakout(s,1/60);total++;
  assert.ok([s.x,s.y,s.vx,s.vy,s.score,s.lives].every(Number.isFinite));
  assert.ok(s.x>=5.99&&s.x<=394.01,JSON.stringify(s));
  assert.ok(s.y>=5.99&&s.y<=506.01);
  assert.ok(s.score===s.hits*10);
  assert.ok(s.bricks.every(b=>b.hp>=0&&b.hp<=2));
  for(const b of s.bricks)if(b.hp>0&&s.x>b.x-6+.001&&s.x<b.x+b.w+6-.001&&s.y>b.y-6+.001&&s.y<b.y+b.h+6-.001){interior++;firstInterior??={l,run,tick,s,brick:b};}
 }
 wins+=s.phase==='won';losses+=s.phase==='lost';
}
console.log({total,wins,losses,interior,firstInterior});
