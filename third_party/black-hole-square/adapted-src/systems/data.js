// Original data interface: Copyright (c) 2021 Quinten Clause, MIT.
// Parent-owned validation and persistence adapter: GPL-3.0-only.
import {emptyData, copyData, parseData} from '../../bridge-src/contract.ts';
let data=emptyData();
let changed=()=>{};
const configure=(initial,onChange)=>{data=parseData(initial)??emptyData();changed=onChange;};
const save=(key,value)=>{
    if (key==='payed') return; // Author's selected release already opens all 18.
    if (!['current','solved','solutions'].includes(key)) return;
    const candidate=parseData({...data,[key]:value});
    if (!candidate) return;
    data=candidate;changed(copyData(data));
};
const load=key=>key==='payed'?true:copyData(data)[key];
const snapshot=()=>copyData(data);
export default Object.freeze({configure,save,load,snapshot});
