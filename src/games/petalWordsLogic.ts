// SPDX-License-Identifier: GPL-3.0-only
// Original finite letter-guessing lessons and authored vocabulary cues.
export const petalWordLevels = [
  {id:'sun',word:'SUN',clue:'白天给大地带来光和温暖',gloss:'太阳',lesson:'点一个字母。猜中的字母会出现在所有正确位置。'},
  {id:'moon',word:'MOON',clue:'夜空中有时圆、有时弯的伙伴',gloss:'月亮',lesson:'同一个字母可能出现两次，一次猜中就会全部打开。'},
  {id:'leaf',word:'LEAF',clue:'长在枝条上，常常是绿色的',gloss:'叶子',lesson:'花瓣记录误猜。灰色字母已经试过，不会再扣一次。'},
  {id:'seed',word:'SEED',clue:'藏着一株小植物的未来',gloss:'种子',lesson:'重复的元音也是线索。观察已经打开的位置，再猜下一步。'},
  {id:'water',word:'WATER',clue:'小花口渴时最需要它',gloss:'水',lesson:'五个字母，把词义和已知位置一起考虑。'},
  {id:'bloom',word:'BLOOM',clue:'花苞打开，开始盛放',gloss:'开花',lesson:'有两个相同的中间字母。猜字母不是猜它在哪一格。'},
  {id:'banana',word:'BANANA',clue:'弯弯的黄色水果',gloss:'香蕉',lesson:'六个位置不代表六种字母。重复出现的字母可以一下打开好几格。'},
  {id:'robot',word:'ROBOT',clue:'按照程序完成任务的机械伙伴',gloss:'机器人',lesson:'已经排除的字母也有用。可以暂停，先想一想拼写。'},
  {id:'garden',word:'GARDEN',clue:'种花、散步，也装满好奇心的地方',gloss:'花园',lesson:'这次六个字母各不相同，留意每一个新位置。'},
  {id:'planet',word:'PLANET',clue:'围着恒星运行的天体，地球就是其中之一',gloss:'行星',lesson:'较长的词也可以从常见字母逐步缩小范围。'},
  {id:'bridge',word:'BRIDGE',clue:'把河流或沟谷的两边连起来',gloss:'桥',lesson:'结合词义找一条路，不必按照从左到右的顺序猜。'},
  {id:'puzzle',word:'PUZZLE',clue:'需要动脑寻找答案的小挑战',gloss:'谜题',lesson:'不常见的字母也可能成双出现。把最后一封花信拼完整。'},
] as const;
export type PetalLevel = typeof petalWordLevels[number];
export type PetalState = { guessed: string[]; hints: string[] };
export const PETAL_SAVE='playgarden.petal-words.v1';
export const newPetalState=():PetalState=>({guessed:[],hints:[]});
export const petalErrors=(p:PetalLevel,s:PetalState)=>s.guessed.filter(c=>!p.word.includes(c)).length+s.hints.length;
export const petalWon=(p:PetalLevel,s:PetalState)=>p.word.split('').every(c=>s.guessed.includes(c));
export const petalEnded=(p:PetalLevel,s:PetalState)=>petalWon(p,s)||petalErrors(p,s)>=6;
export function guessPetal(p:PetalLevel,s:PetalState,letter:string):PetalState{
  const c=letter.toUpperCase();if(petalEnded(p,s)||!/^[A-Z]$/.test(c)||s.guessed.includes(c))return s;
  return {...s,guessed:[...s.guessed,c]};
}
export function hintPetal(p:PetalLevel,s:PetalState):PetalState{
  // Keep one petal available unless this hint completes the word.
  if(petalEnded(p,s))return s;
  const missing=[...new Set(p.word.split(''))].filter(c=>!s.guessed.includes(c));
  if(!missing.length||(petalErrors(p,s)>=5&&missing.length>1))return s;
  return {guessed:[...s.guessed,missing[0]],hints:[...s.hints,missing[0]]};
}
export function loadPetal(p:PetalLevel,index:number):PetalState{
  try{
    const raw=localStorage.getItem(`${PETAL_SAVE}.round.${index}`);if(!raw||raw.length>1500)return newPetalState();const v=JSON.parse(raw);
    if(v.version!==1||v.id!==p.id||!Array.isArray(v.guessed)||!Array.isArray(v.hints)||v.guessed.length>26||v.hints.length>6)return newPetalState();
    if(new Set(v.guessed).size!==v.guessed.length||!v.guessed.every((c:unknown)=>typeof c==='string'&&/^[A-Z]$/.test(c))||new Set(v.hints).size!==v.hints.length||!v.hints.every((c:string)=>v.guessed.includes(c)&&p.word.includes(c)))return newPetalState();
    const s:PetalState={guessed:v.guessed,hints:v.hints};return petalErrors(p,s)<=6?s:newPetalState();
  }catch{return newPetalState();}
}
export function savePetal(p:PetalLevel,index:number,s:PetalState):boolean{
  try{localStorage.setItem(`${PETAL_SAVE}.round.${index}`,JSON.stringify({version:1,id:p.id,...s}));return true;}catch{return false;}
}
