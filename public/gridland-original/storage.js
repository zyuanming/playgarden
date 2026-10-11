// SPDX-License-Identifier: GPL-3.0-only
// Only this game's three slots/options are accessible; imported data is reconstructed, never executed.
(() => {
  'use strict';const prefix='playgarden:gridland:v1:',memory=Object.create(null);let available=true;
  const allowed=k=>/^slot[0-2]$/.test(k)||k==='gameOptions';
  const read=k=>{if(!allowed(k))return undefined;try{const s=localStorage.getItem(prefix+k);if(s!==null){memory[k]=s;return s;}}catch{available=false;}return memory[k];};
  const write=(k,v)=>{if(!allowed(k)||typeof v!=='string'||v.length>2000000)throw Error('Invalid save key');memory[k]=v;try{localStorage.setItem(prefix+k,v);}catch{available=false;}return true;};
  const remove=k=>{if(!allowed(k))return;delete memory[k];try{localStorage.removeItem(prefix+k);}catch{available=false;}};
  window.GridlandStorage=new Proxy(Object.create(null),{get:(_,k)=>k==='removeItem'?remove:read(String(k)),set:(_,k,v)=>write(String(k),v)});
  const number=(n,min,max,fallback)=>{if(n==null&&fallback!=null)return fallback;if(!Number.isFinite(n)||n<min||n>max)throw Error('Invalid save number');return n;};
  const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
  function validate(s){
    if(!plain(s))throw Error('Invalid save');const C=require('app/gamecontent');
    if(!Array.isArray(s.buildings)||s.buildings.length>100||!Array.isArray(s.stores)||s.stores.length>100)throw Error('Invalid saved inventory');
    const buildings=s.buildings.map(b=>{if(!plain(b)||!plain(b.options)||!plain(b.options.type)||!plain(b.requiredResources))throw Error('Invalid building');const t=C.getBuildingType(b.options.type.className);if(!t)throw Error('Unknown building');const costs={};for(const k of Object.keys(t.cost))costs[k]=number(b.requiredResources[k],0,t.cost[k]);return {options:{type:t},requiredResources:costs,built:!!b.built,obsolete:!!b.obsolete};});
    const stores=s.stores.map(b=>{if(!plain(b)||!plain(b.options)||!plain(b.options.type))throw Error('Invalid store');const t=C.getResourceType(b.options.type.className);if(!t)throw Error('Unknown resource');return {options:{type:t},_quantity:number(b._quantity,0,30)};});
    const items={},counts={};if(s.items&&!plain(s.items)||s.counts&&!plain(s.counts))throw Error('Invalid save counters');
    for(const k of Object.keys(C.LootType))if(Object.hasOwn(s.items||{},k))items[k]=number(s.items[k],0,C.LootType[k].large?1:3);
    for(const k of ['LEVEL','DEATHS','NIGHTS','ROW','SWAPPED','CHAIN','GATHERED','KILLED','ATONCE','LOOT','CAST','DRAGONS','CASUALNIGHTS','PRESTIGE'])if(Object.hasOwn(s.counts||{},k))counts[k]=number(s.counts[k],0,Number.MAX_SAFE_INTEGER);
    const level=number(s.level,1,26),priority=s.prioritizedBuilding;
    if(priority!=null&&!C.getBuildingType(priority))throw Error('Unknown priority');
    return {buildings,stores,items,counts,level,xp:number(s.xp,0,400000),dayNumber:number(s.dayNumber,1,1000000,1),gem:number(s.gem,0,4,0),mana:number(s.mana,0,3,0),prestige:number(s.prestige,0,100000,0),health:number(s.health,0,20+10*level,20+10*level),prioritizedBuilding:priority||null};
  }
  window.GridlandSave={validate,available:()=>available};
})();
