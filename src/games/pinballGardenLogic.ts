// SPDX-License-Identifier: GPL-3.0-only
export type PinBumper={x:number;y:number;r:number;name:string};
export type PinballGardenLevel={title:string;lesson:string;bumpers:PinBumper[];returns:number;both:boolean;rails:[number,number,number,number][]};
const bumper=(x:number,y:number,r:number,name:string):PinBumper=>({x,y,r,name});
export const pinballGardenLevels:PinballGardenLevel[]=[
 {title:"第一朵铃兰",lesson:"中央发球会接近大花鼓，落球时按住挡板，把球真正击回上方。",bumpers:[bumper(180,190,38,"铃兰")],returns:2,both:false,rails:[]},
 {title:"双花对唱",lesson:"左右花鼓分开；利用两个发球口和左右挡板。",bumpers:[bumper(90,210,32,"风铃"),bumper(270,210,32,"雏菊")],returns:3,both:false,rails:[]},
 {title:"三色高台",lesson:"三个花鼓高低不同，点亮所有花鼓并完成三次真实回击。",bumpers:[bumper(90,225,29,"紫菀"),bumper(180,170,32,"金盏"),bumper(270,225,29,"鸢尾")],returns:3,both:false,rails:[]},
 {title:"斜坡转向",lesson:"侧边斜轨会改变落球方向，观察轨道后再击球。",bumpers:[bumper(90,180,30,"春兰"),bumper(270,240,33,"石竹")],returns:4,both:false,rails:[[18,290,66,345],[342,290,294,345]]},
 {title:"两手协作",lesson:"这一关左右挡板至少各回击一次；单用一边不够。",bumpers:[bumper(90,240,30,"矢车菊"),bumper(270,170,33,"百合")],returns:4,both:true,rails:[[18,285,54,325]]},
 {title:"三角花阵",lesson:"宽花鼓形成三角反弹阵，选择未点亮花鼓附近的发球口。",bumpers:[bumper(90,185,35,"蓝星"),bumper(180,270,30,"蒲公英"),bumper(270,185,35,"玛格丽特")],returns:5,both:false,rails:[[342,300,304,340]]},
 {title:"阶梯花台",lesson:"从低到高的花鼓改变每次反弹节奏，两侧挡板都要参与。",bumpers:[bumper(90,270,28,"雪滴"),bumper(180,215,30,"虞美人"),bumper(270,160,34,"金鱼草")],returns:5,both:true,rails:[[18,315,55,350],[342,310,305,350]]},
 {title:"花园奏鸣曲",lesson:"点亮三朵花并完成六次回击，左右挡板至少各一次。可多次发球，练习不扣球。",bumpers:[bumper(90,190,31,"晨光"),bumper(180,255,34,"午后"),bumper(270,180,32,"晚霞")],returns:6,both:true,rails:[[18,280,65,335],[342,285,295,340]]},
];
export type PinballState={x:number;y:number;vx:number;vy:number;time:number;lit:boolean[];cooldown:number[];left:number;right:number;lastFlipper:number;balls:number;status:"ready"|"playing"|"won"};
export const pinLaunches=[90,180,270];
export function initialPinball(level:PinballGardenLevel):PinballState{return {x:180,y:456,vx:0,vy:0,time:0,lit:level.bumpers.map(()=>false),cooldown:level.bumpers.map(()=>-1),left:0,right:0,lastFlipper:-1,balls:0,status:"ready"};}
export function servePinball(s:PinballState,lane:number):PinballState{return s.status!=="ready"?s:{...s,x:pinLaunches[lane],y:405,vx:0,vy:-530,balls:s.balls+1,status:"playing"};}
export function pinFlipper(left:boolean,active:boolean):[number,number,number,number]{return left?[54,412,174,active?398:466]:[306,412,186,active?398:466];}
function segment(x:number,y:number,line:[number,number,number,number]){const [ax,ay,bx,by]=line,dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy))),px=ax+t*dx,py=ay+t*dy,dist=Math.hypot(x-px,y-py);return {px,py,dist,nx:dist?(x-px)/dist:0,ny:dist?(y-py)/dist:-1};}
export function stepPinball(level:PinballGardenLevel,state:PinballState,left:boolean,right:boolean,seconds:number):PinballState{
 if(state.status!=="playing")return state;const s={...state,lit:[...state.lit],cooldown:[...state.cooldown]},count=Math.ceil(seconds/(1/180)),dt=seconds/count;
 for(let n=0;n<count;n++){s.time+=dt;s.vy+=500*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;if(s.x<15){s.x=15;s.vx=Math.abs(s.vx)*.88;}if(s.x>345){s.x=345;s.vx=-Math.abs(s.vx)*.88;}if(s.y<23){s.y=23;s.vy=Math.abs(s.vy)*.88;}
 for(let i=0;i<level.bumpers.length;i++){const b=level.bumpers[i],dx=s.x-b.x,dy=s.y-b.y,d=Math.hypot(dx,dy),r=b.r+9;if(d<r){const nx=d?dx/d:0,ny=d?dy/d:1;s.x=b.x+nx*r;s.y=b.y+ny*r;const dot=s.vx*nx+s.vy*ny;if(dot<0){s.vx-=2*dot*nx;s.vy-=2*dot*ny;s.vx+=nx*85;s.vy+=ny*85;const speed=Math.hypot(s.vx,s.vy);if(speed>640){s.vx*=640/speed;s.vy*=640/speed;}if(s.time-s.cooldown[i]>.22){s.lit[i]=true;s.cooldown[i]=s.time;}}}}
 for(const rail of level.rails){const hit=segment(s.x,s.y,rail);if(hit.dist<11){s.x=hit.px+hit.nx*11;s.y=hit.py+hit.ny*11;const dot=s.vx*hit.nx+s.vy*hit.ny;if(dot<0){s.vx-=1.7*dot*hit.nx;s.vy-=1.7*dot*hit.ny;}}}
 for(const side of [0,1]){const active=side===0?left:right,hit=segment(s.x,s.y,pinFlipper(side===0,active));if(hit.dist<13&&s.vy>0&&s.time-s.lastFlipper>.2){if(active){s.x=hit.px;s.y=hit.py-14;s.vx=side===0?100:-100;s.vy=-530;s.lastFlipper=s.time;if(side===0)s.left++;else s.right++;}else{const dot=s.vx*hit.nx+s.vy*hit.ny;s.x=hit.px+hit.nx*13;s.y=hit.py+hit.ny*13;if(dot<0){s.vx-=1.18*dot*hit.nx;s.vy-=1.18*dot*hit.ny;}}}}
 if(s.lit.every(Boolean)&&s.left+s.right>=level.returns&&(!level.both||(s.left>0&&s.right>0))){s.status="won";s.vx=0;s.vy=0;return s;}if(s.y>515){s.status="ready";s.vx=0;s.vy=0;return s;}}
 return s;
}
