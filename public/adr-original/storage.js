// SPDX-License-Identifier: GPL-3.0-only
// Playgarden local storage and plain-data import boundary. No executable saves.
(() => {
  'use strict';
  const prefix='playgarden.a-dark-room.v1.', memory=new Map();
  const keys=new Set(['gameState','lang','ending','invalid']);
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const safeKey=k=>typeof k==='string' && /^[\w ,:-]{1,100}$/.test(k) && !['__proto__','constructor','prototype'].includes(k);
  function get(k){if(!keys.has(k))throw Error('Unknown ADR key');try{return localStorage.getItem(prefix+k)??memory.get(k);}catch{return memory.get(k);}}
  function set(k,v){if(!keys.has(k))throw Error('Unknown ADR key');memory.set(k,String(v));try{localStorage.setItem(prefix+k,String(v));return true;}catch{window.ADRStorageUnavailable=true;return false;}}
  const storage={getItem:get,setItem:set,removeItem(k){if(!keys.has(k))throw Error('Unknown ADR key');memory.delete(k);try{localStorage.removeItem(prefix+k);}catch{window.ADRStorageUnavailable=true;}}};
  for(const k of keys)Object.defineProperty(storage,k,{get:()=>get(k),set:v=>set(k,v)});
  window.ADRStorage=storage;
  window.ADRLanguage=get('lang')==='en'?'en':'zh_cn';
  window.langs={zh_cn:'简体中文',en:'English'};
  window._=(text,...args)=>String(ADRLanguage==='zh_cn'?(ADRDictionary[text]??text):text).replace(/\{(\d+)\}/g,(all,n)=>args[n]===undefined?all:String(args[n]));
  window.Base64={
    encode(text){const bytes=new TextEncoder().encode(text);let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);},
    decode(text){if(typeof text!=='string'||text.length>2800000)throw Error('Save too large');return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(text),c=>c.charCodeAt(0)));}
  };
  function parts(path){
    if(typeof path!=='string'||path.length>600||!/^[\w .\[\]'",:-]+$/.test(path))throw Error('Invalid state path');
    const p=path.split(/[.\[\]'\"]+/).filter(Boolean);
    if(!p.length||p.length>16||p.some(k=>!safeKey(k)))throw Error('Unsafe state path');return p;
  }
  function lookup(root,path){let value=root;for(const k of parts(path)){if(value===null||typeof value!=='object'||!own(value,k))return undefined;value=value[k];}return value;}
  function assign(root,path,value){const p=parts(path);let o=root;for(const k of p.slice(0,-1)){if(!own(o,k)||o[k]===null||typeof o[k]!=='object')o[k]={};o=o[k];}o[p.at(-1)]=value;return o;}
  function remove(root,path){const p=parts(path);let o=root;for(const k of p.slice(0,-1)){if(o===null||typeof o!=='object'||!own(o,k))return;o=o[k];}if(o&&typeof o==='object')delete o[p.at(-1)];}
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const categories=new Set(['features','stores','character','income','timers','game','playStats','previous','outfit','config','wait','cooldown']);
  const number=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=99999999999999;
  function validate(state){
    if(!object(state))throw Error('Save must be a state object');
    if(state.version!==undefined&&state.version!==1.3)throw Error('Use the original v1.3 state format from the 2020 edition');
    // This original release's Path.updateOutfitting also writes harmless numeric
    // item mirrors at the root. Accept only those known item names, so genuine
    // exported v1.3 saves remain loadable without broadening object paths.
    const mirroredItems=new Set([...Object.keys(window.Room?.Craftables||{}),'cured meat','bullets','grenade','bolas','laser rifle','energy cell','bayonet','charm','medicine']);
    for(const k of Object.keys(state)){if(k==='version')continue;if(mirroredItems.has(k)&&number(state[k])&&state[k]>=0)continue;if(!categories.has(k)||!object(state[k]))throw Error('Unknown or malformed state category');}
    let nodes=0;
    function walk(v,path,depth){
      if(++nodes>20000||depth>16)throw Error('Save structure is too large');
      if(v===null||typeof v==='boolean'||number(v))return;
      if(typeof v==='string'){
        if(/^game\.world\.map\.\d+\.\d+$/.test(path)&&/^[AICS;,.#HVOYPWBFMU]!?$/.test(v))return;
        if(/^game\.(fire|temperature)\.text$/.test(path)&&v.length<=80&&!/[<>]/.test(v))return;
        throw Error('Unexpected text in save');
      }
      if(typeof v!=='object')throw Error('Invalid saved value');
      if(Array.isArray(v)&&v.length>61)throw Error('Invalid saved array');
      for(const [k,value] of Object.entries(v)){if(!safeKey(k))throw Error('Unsafe saved property');walk(value,path?path+'.'+k:k,depth+1);}
    }
    walk(state,'',0);
    for(const k of ['stores','outfit'])if(state[k]&&Object.values(state[k]).some(v=>!number(v)||v<0))throw Error('Invalid item quantity');
    for(const k of ['fire','temperature'])if(state.game?.[k]!==undefined){const e=state.game[k];if(!object(e)||!Number.isInteger(e.value)||e.value<0||e.value>4)throw Error('Invalid room state');}
    if(state.game?.builder!==undefined&&(!object(state.game.builder)||!number(state.game.builder.level)))throw Error('Invalid builder state');
    for(const k of ['buildings','workers','stolen'])if(state.game?.[k]!==undefined&&(!object(state.game[k])||Object.values(state.game[k]).some(v=>!number(v)||v<0)))throw Error('Invalid village state');
    if(state.features?.location!==undefined&&(!object(state.features.location)||Object.values(state.features.location).some(v=>typeof v!=='boolean')))throw Error('Invalid locations');
    const world=state.game?.world;
    if(world?.map!==undefined||world?.mask!==undefined||state.features?.location?.world){
      for(const k of ['map','mask'])if(!Array.isArray(world?.[k])||world[k].length!==61||world[k].some(row=>!Array.isArray(row)||row.length!==61))throw Error('World must remain 61 by 61');
      if(world.map.some(row=>row.some(v=>typeof v!=='string'||!/^[AICS;,.#HVOYPWBFMU]!?$/.test(v))))throw Error('Invalid world tile');
      if(world.map[30][30]!=='A'||!world.map.some(row=>row.some(c=>c==='W'||c==='W!')))throw Error('Missing original world landmarks');
      // Original undiscovered cells are sparse and serialize as null.
      if(world.mask.some(row=>row.some(v=>v!==null&&typeof v!=='boolean')))throw Error('Invalid world visibility');
    }
    if(state.previous?.stores!==undefined&&(!Array.isArray(state.previous.stores)||![0,24].includes(state.previous.stores.length)||state.previous.stores.some(v=>!number(v)||v<0)))throw Error('Invalid inherited stores');
    if(state.wait){
      const allowed=new Set(['Room.4.scenes.wood100.action','Room.4.scenes.wood500.action','Room.5.scenes.fur100.action','Room.5.scenes.fur500.action']);
      function delays(value,path){for(const [k,v] of Object.entries(value)){const next=path?path+'.'+k:k;if(object(v)){if(![...allowed].some(p=>p.startsWith(next+'.')))throw Error('Unknown delayed event');delays(v,next);}else if(!allowed.has(next)||!number(v)||v<0)throw Error('Invalid delayed event');}}
      delays(state.wait,'');
    }
    return state;
  }
  function parse(raw){if(typeof raw!=='string'||raw.length>2000000)throw Error('Missing or oversized save');return validate(JSON.parse(raw));}
  function report(message){const el=document.getElementById('adr-error');if(el){el.hidden=false;el.textContent=message;}window.ADRBridge?.status(message);}
  window.ADRSave={lookup,assign,remove,parse,validate,import64(encoded){
    try{
      const text=Base64.decode(String(encoded).replace(/[\s.]/g,'')),state=parse(text);
      const normalized=JSON.stringify(state),old=ADRStorage.gameState;if(!ADRStorage.setItem('gameState',normalized)){if(old!==undefined)memory.set('gameState',old);else memory.delete('gameState');throw Error('Browser storage is unavailable');}ADRClock.dispose(false);location.reload();return true;
    }catch(e){report('存档未导入，原进度已保留：'+e.message);return false;}
  }};
})();
