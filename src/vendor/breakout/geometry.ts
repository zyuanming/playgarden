// SPDX-License-Identifier: MIT
// Adapted from Jake Gordon and contributors, javascript-breakout
// eed59e2affa9423b93d2ac8ff93061bb88b33284, game.js Game.Math.intercept
// and breakout.js Ball.update paddle response. Full notice: LICENSE.txt.
export type Hit = {t:number;x:number;y:number;nx:number;ny:number};
export function segmentIntercept(x1:number,y1:number,x2:number,y2:number,x3:number,y3:number,x4:number,y4:number):{t:number;x:number;y:number}|null {
 const denominator=((y4-y3)*(x2-x1))-((x4-x3)*(y2-y1));
 if(Math.abs(denominator)<1e-12)return null;
 const ua=(((x4-x3)*(y1-y3))-((y4-y3)*(x1-x3)))/denominator;
 const ub=(((x2-x1)*(y1-y3))-((y2-y1)*(x1-x3)))/denominator;
 if(ua < -1e-9 || ua > 1+1e-9 || ub < -1e-9 || ub > 1+1e-9)return null;
 const t=Math.max(0,Math.min(1,ua));return {t,x:x1+t*(x2-x1),y:y1+t*(y2-y1)};
}
// Intentionally arcade-style expanded rectangles, not an exact circular corner model.
// Unlike upstream's horizontal-first return, compare every approaching face.
export function sweepBox(x:number,y:number,dx:number,dy:number,left:number,top:number,right:number,bottom:number):Hit|null {
 const faces:[number,number,number,number,number,number][]=[
 [left,top,left,bottom,-1,0],[right,top,right,bottom,1,0],
 [left,top,right,top,0,-1],[left,bottom,right,bottom,0,1]];
 const hits=faces.filter(f=>dx*f[4]+dy*f[5]<-1e-10).map(f=>{const p=segmentIntercept(x,y,x+dx,y+dy,...f.slice(0,4) as [number,number,number,number]);return p?{...p,nx:f[4],ny:f[5]}:null;}).filter((h):h is Hit=>h!==null).sort((a,b)=>a.t-b.t);
 if(!hits.length)return null;
 const h=hits[0];for(const other of hits.slice(1)){if(Math.abs(h.t-other.t)<1e-8){h.nx+=other.nx;h.ny+=other.ny;}}
 return {...h,nx:Math.sign(h.nx),ny:Math.sign(h.ny)};
}
// Retains upstream's contact-offset control, with a lower vertical component
// so a flat trajectory cannot leave the player waiting indefinitely.
export function paddleBounce(offset:number,speed:number):{vx:number;vy:number}{
 const u=Math.max(-1,Math.min(1,offset)); const vx=speed*u*.85;
 return {vx,vy:-Math.sqrt(speed*speed-vx*vx)};
}
