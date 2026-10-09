// SPDX-License-Identifier: GPL-3.0-only
const prefix='playgarden.server-survival.original.';
const memory=new Map();
let warned=false;
function warning(){if(!warned){warned=true;window.pgSend?.("status",{message:"浏览器禁止持久保存；游戏可继续，保存仅在本次会话内有效。"});}}
export const pgStorage={
 getItem(key){try{return localStorage.getItem(prefix+key)??memory.get(key)??null;}catch{return memory.get(key)??null;}},
 setItem(key,value){memory.set(key,String(value));try{localStorage.setItem(prefix+key,String(value));}catch{warning();}},
 removeItem(key){memory.delete(key);try{localStorage.removeItem(prefix+key);}catch{/* No persistent state can be written here. */}}
};
