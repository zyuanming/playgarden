// SPDX-License-Identifier: GPL-3.0-only
export type JigsawGardenLevel={title:string;lesson:string;scene:number;columns:number;rows:number};
export const jigsawGardenLevels:JigsawGardenLevel[]=[
 {title:"风车花田",lesson:"六片大拼图：先找外框直边，再接上风车和田野的轮廓。",scene:0,columns:3,rows:2},
 {title:"荷塘月色",lesson:"天空、岸边和水面有不同色带，用水平线判断朝向。",scene:1,columns:3,rows:2},
 {title:"灯塔海岸",lesson:"九片拼图：灯塔竖线、船帆与海浪跨越接缝。",scene:2,columns:3,rows:3},
 {title:"热气球节",lesson:"弧线容易混淆，先对上气球颜色和远山。",scene:3,columns:3,rows:3},
 {title:"森林小屋",lesson:"树冠相似，但屋顶、窗户和小径提供清晰参照。",scene:4,columns:3,rows:3},
 {title:"星夜营地",lesson:"十二片拼图：从帐篷、星座与营火的局部特征接起。",scene:5,columns:4,rows:3},
 {title:"果园小径",lesson:"重复树叶里寻找独特的苹果、果篮和弯曲小径。",scene:6,columns:4,rows:3},
 {title:"四季温室",lesson:"十二片综合图：观察玻璃格线，连起四种花丛和浇水壶。",scene:7,columns:4,rows:3},
];
export type JigsawPiece={id:number;x:number;y:number;rotation:number;placed:boolean};
export function jigsawTarget(level:JigsawGardenLevel,id:number){return {x:60+(id%level.columns+.5)*360/level.columns,y:25+(Math.floor(id/level.columns)+.5)*270/level.rows};}
export function initialJigsaw(level:JigsawGardenLevel):JigsawPiece[]{const count=level.rows*level.columns;return Array.from({length:count},(_,id)=>{const slot=(id*5+3)%count,cols=count===6?3:level.columns;return {id,x:cols===3?90+slot%cols*150:65+slot%cols*115,y:(count===6?365:350)+Math.floor(slot/cols)*(count===6?145:110),rotation:(id+level.scene+1)%4,placed:false};});}
export function moveJigsaw(level:JigsawGardenLevel,board:JigsawPiece[],id:number,x:number,y:number,rotation?:number):JigsawPiece[]{return board.map(p=>{if(p.id!==id||p.placed)return p;const t=jigsawTarget(level,id),r=rotation??p.rotation,px=Math.max(20,Math.min(460,x)),py=Math.max(20,Math.min(630,y)),snap=r===0&&Math.hypot(px-t.x,py-t.y)<=14;return {...p,x:snap?t.x:px,y:snap?t.y:py,rotation:r,placed:snap};});}
export function jigsawPath(level:JigsawGardenLevel,id:number){const w=360/level.columns,h=270/level.rows,row=Math.floor(id/level.columns),col=id%level.columns,x=col*w,y=row*h,amplitude=Math.min(w,h)*.19;const vertical=(r:number,c:number)=>(r+c)%2?1:-1,horizontal=(r:number,c:number)=>(r*3+c)%2?1:-1;
 function edge(ax:number,ay:number,bx:number,by:number,sign:number){const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),nx=dy/len,ny=-dx/len;const p=(t:number,a=0)=>`${+(ax+dx*t+nx*a).toFixed(3)} ${+(ay+dy*t+ny*a).toFixed(3)}`;return sign?`L${p(.35)} C${p(.43)} ${p(.36,amplitude*sign)} ${p(.5,amplitude*sign)} C${p(.64,amplitude*sign)} ${p(.57)} ${p(.65)} L${p(1)}`:`L${p(1)}`;}
 return `M${x} ${y}`+edge(x,y,x+w,y,row?-vertical(row-1,col):0)+edge(x+w,y,x+w,y+h,col<level.columns-1?horizontal(row,col):0)+edge(x+w,y+h,x,y+h,row<level.rows-1?vertical(row,col):0)+edge(x,y+h,x,y,col?-horizontal(row,col-1):0)+"Z";
}
