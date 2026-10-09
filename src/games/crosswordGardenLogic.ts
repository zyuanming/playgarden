// SPDX-License-Identifier: GPL-3.0-only
export type CrosswordEntry = { word: string; clue: string; row: number; col: number; direction: "across" | "down" };
export type CrosswordLevel = { title: string; lesson: string; entries: CrosswordEntry[] };
const a = (word: string, clue: string, row: number, col: number): CrosswordEntry => ({word, clue, row, col, direction:"across"});
const d = (word: string, clue: string, row: number, col: number): CrosswordEntry => ({word, clue, row, col, direction:"down"});
export const crosswordGardenLevels: CrosswordLevel[] = [
 {title:"小小伙伴",lesson:"先从最熟悉的词开始，再让交叉的字母帮忙。",entries:[a("CAT","喵喵叫的动物",0,0),d("ANT","会排队搬食物的小昆虫",0,1),a("TOY","拿来玩耍的小物件",2,1)]},
 {title:"野餐篮子",lesson:"两个横词与两条竖线相互约束。",entries:[d("RICE","米饭",0,2),a("PIE","有馅料的烘焙圆饼",1,1),a("PEAR","上窄下圆、常见绿色的水果",3,1),d("JAM","涂在面包上的果酱",2,3)]},
 {title:"仰望天空",lesson:"同样长度的单词也要读线索，不能只看格数。",entries:[d("SUN","白天照亮大地的恒星",0,0),a("STAR","夜空中闪烁的星星",0,0),d("RAIN","从云里落下的水滴",0,3),a("WIND","流动的空气",2,2),d("DEW","清晨凝结在叶片上的露水",2,5)]},
 {title:"自然观察",lesson:"跟着交叉点，从左侧一路推理到右侧。",entries:[a("LEAF","植物的叶片",0,0),d("LILY","百合花",0,0),d("FIRE","燃烧时出现的火",0,3),a("ROOT","植物埋在土里的根",2,3),d("TREE","长着树干与树枝的植物",2,6)]},
 {title:"沿路旅行",lesson:"竖词会把相距很远的横词连接起来。",entries:[a("BOAT","在水面航行的小船",2,0),d("BOOK","装订成册、可以阅读的书",2,0),d("ROAD","供人车通行的道路",0,2),a("RAIN","下雨时落下的水",0,2),a("KEY","用来打开锁的小工具",5,0)]},
 {title:"温暖家园",lesson:"短词卡在中间，长词从两旁伸展。",entries:[a("HOUSE","供人居住的房子",2,0),d("HORSE","可以骑乘、会奔跑的马",2,0),d("CUP","用来喝水的杯子",1,2),d("SHOE","穿在脚上保护脚的鞋",2,3),a("ECHO","声音反射回来形成的回声",5,3)]},
 {title:"书桌角落",lesson:"这次有五字母词。放错时，红色交叉格会提醒你。",entries:[a("PAPER","写字画画用的纸",2,0),d("PEAR","梨这种水果",2,0),d("APPLE","苹果这种水果",1,2),d("READ","阅读文字这个动作",2,4),a("DESK","学习写字用的书桌",5,4)]},
 {title:"田野长卷",lesson:"两条长竖词穿过主干，左右支线各有自己的交叉点。",entries:[a("HORSE","在田野奔跑的马",2,2),d("MOUSE","体形很小、尾巴很长的老鼠",1,3),d("SHEEP","长着羊毛的绵羊",2,5),a("BLUE","晴朗天空常见的颜色",5,0),a("PEAR","梨",6,5)]},
];
export const crosswordCells = (entry: CrosswordEntry) => [...entry.word].map((_,i) => ({row:entry.row+(entry.direction==="down"?i:0),col:entry.col+(entry.direction==="across"?i:0)}));
export function crosswordInspection(config: CrosswordLevel, placed: (string|null)[]) {
 const cells: Record<string,{row:number;col:number;letters:string[];entries:number[]}> = {};
 config.entries.forEach((entry,index)=>crosswordCells(entry).forEach((p,k)=>{const key=`${p.row},${p.col}`;const cell=cells[key]??(cells[key]={...p,letters:[],entries:[]});cell.entries.push(index);if(placed[index])cell.letters.push(placed[index]![k]);}));
 const conflicts=Object.values(cells).filter(c=>new Set(c.letters).size>1).length;
 return {cells,conflicts,won:placed.length===config.entries.length&&placed.every((word,i)=>word===config.entries[i].word)&&conflicts===0};
}
export function crosswordHint(config:CrosswordLevel,placed:(string|null)[]) {
 const index=config.entries.findIndex((e,i)=>placed[i]!==e.word); if(index<0)return null;
 const entry=config.entries[index], holder=placed.indexOf(entry.word);
 return {index,text:holder>=0?`第 ${holder+1} 条里的 ${entry.word} 属于第 ${index+1} 条。先选第 ${holder+1} 条并取下，再填入第 ${index+1} 条。`:`第 ${index+1} 条「${entry.clue}」可以填 ${entry.word}，共 ${entry.word.length} 个字母。`};
}
