// SPDX-License-Identifier: GPL-3.0-only
export type HopPlatform={x:number;y:number;width:number};
export type CloudHopLevel={title:string;lesson:string;platforms:HopPlatform[]};
function course(title:string,lesson:string,steps:number[][]):CloudHopLevel{return {title,lesson,platforms:[{x:180,y:0,width:352},...steps.map(([x,y,width])=>({x,y,width}))]};}
export const cloudHopLevels:CloudHopLevel[]=[
 course("低空初跳","先在宽云上练习，越过最高点后会向下落到云面。",[[180,75,150],[240,150,140],[160,225,145],[110,300,135],[180,380,150]]),
 course("左右云梯","相邻云朵左右交错，起跳后尽早换向。",[[110,75,132],[210,155,130],[120,235,125],[225,315,126],[145,395,130],[220,475,145]]),
 course("高低节奏","混合短跳与高台，留意落点而不是一直按住方向。",[[200,62,130],[270,163,112],[180,221,122],[90,321,116],[150,388,114],[245,486,145]]),
 course("窄云停靠","云面逐渐收窄，接近中心时用停止键减速。",[[120,80,142],[170,160,116],[255,245,94],[180,325,92],[95,410,96],[145,495,100],[220,575,140]]),
 course("向阳折返","连续向一侧攀升，再折返到山顶；边墙不能替你登高。",[[105,76,125],[70,155,108],[125,240,106],[210,325,110],[285,405,104],[240,485,108],[150,572,110],[90,652,140]]),
 course("疏密云带","宽云提供缓冲，高窄云要求更准确的横向控制。",[[230,72,145],[150,172,100],[85,238,140],[175,335,100],[265,400,142],[210,503,98],[120,566,142],[180,666,138]]),
 course("双向穿梭","远近云梯交替，逐段落稳，别让镜头下方的云消失后才回头。",[[100,78,120],[195,160,112],[275,240,105],[180,332,105],[85,410,108],[160,492,100],[255,584,108],[170,667,110],[105,752,140]]),
 course("云海之巅","综合高台、窄台与长距离折返。最后一次必须真正落在旗帜云上。",[[245,78,120],[180,160,110],[90,255,98],[155,327,116],[250,423,102],[290,494,94],[200,590,102],[105,675,104],[175,766,102],[250,850,145]]),
];
export type HopState={x:number;y:number;vx:number;vy:number;highest:number;landed:number;jumps:number;status:"idle"|"playing"|"lost"|"won"};
export function initialCloudHop():HopState{return {x:180,y:11,vx:0,vy:0,highest:11,landed:0,jumps:0,status:"idle"};}
export function advanceCloudHop(level:CloudHopLevel,state:HopState,steer:number,seconds:number):HopState{
 if(state.status!=="playing")return state;let s={...state};const steps=Math.max(1,Math.ceil(seconds/(1/120))),dt=seconds/steps;
 for(let n=0;n<steps;n++){const oldY=s.y;s.vx+=(steer*185-s.vx)*Math.min(1,dt*18);s.x=Math.max(10,Math.min(350,s.x+s.vx*dt));s.vy-=800*dt;s.y+=s.vy*dt;s.highest=Math.max(s.highest,s.y);
 if(s.vy<=0){for(let p=level.platforms.length-1;p>=0;p--){const ledge=level.platforms[p];if(oldY-10>=ledge.y&&s.y-10<=ledge.y&&Math.abs(s.x-ledge.x)<=ledge.width/2+6){s.y=ledge.y+10;s.landed=p;s.jumps++;if(p===level.platforms.length-1){s.vx=0;s.vy=0;s.status="won";return s;}s.vy=440;break;}}}
 if(s.y<Math.max(-55,s.highest-410)){s.status="lost";s.vx=0;s.vy=0;return s;}}
 return s;
}
