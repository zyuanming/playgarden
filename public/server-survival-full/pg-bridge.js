// SPDX-License-Identifier: GPL-3.0-only
// Local shell adapter; authentic upstream simulation and all 25 objectives are retained.
import './game.js';
import {STATE} from './src/state.js';
import {CONFIG} from './src/config.js';
import {CAMPAIGN_LEVELS} from './src/campaign/levels.js';
import {i18n} from './src/i18n.js';
import {createService,createConnection,deleteConnection,deleteObject} from './src/sim/topology.js';
import {resetCamera,orbitCamera} from './src/input/handlers.js';
import {toggleAutoscaling,canAutoscale} from './src/sim/autoscaling.js';
import {checkSmartHints} from './src/core/hints.js';
import {renderer} from './game.js';
import {pgStorage} from './pg-storage.js';
const names={waf:'防火墙',alb:'负载均衡器',compute:'计算节点',db:'关系数据库',s3:'文件存储',cdn:'边缘缓存',cache:'内存缓存',sqs:'消息队列',apigw:'API网关',nosql:'NoSQL数据库',search:'搜索引擎',replica:'只读副本',serverless:'无服务器函数',monitor:'监控',dlq:'死信队列',pubsub:'发布订阅',auth:'身份验证',scheduler:'定时器',notify:'通知',container:'容器集群',stream:'数据流',dns:'GeoDNS',warehouse:'数据仓库',gpu:'GPU集群',infgw:'推理网关',power:'变电站'};
let ready=false,wasRunning=true,savedSpeed=0,refreshId=0,completed=false;
const locked=()=>window.PG_SHELL_PAUSED||window.PG_FINISHED;
const report=text=>{document.getElementById('pg-feedback').textContent=text;window.pgSend('status',{message:text});};
const tag=node=>node.id==='internet'?'互联网入口':`${STATE.services.indexOf(node)+1} · ${names[node.type]||node.type}`;
const level=()=>CAMPAIGN_LEVELS.find(item=>item.id===STATE.campaign.currentLevelId);
const allowed=kind=>!STATE.campaign.active||((!level()?.allowedServices?.length||level().allowedServices.includes(kind))&&!level()?.forbiddenServices?.includes(kind));
function optionList(select,options){
 const signature=JSON.stringify(options);if(select.dataset.signature===signature)return;
 const old=select.value;select.replaceChildren();
 for(const[value,text]of options){const o=document.createElement('option');o.value=value;o.textContent=text;select.appendChild(o);}
 if(options.some(o=>o[0]===old))select.value=old;select.dataset.signature=signature;
}
function selectedNode(){return STATE.services.find(s=>s.id===document.getElementById('pg-edit-node').value);}
function repaint(){
 if(!ready)return;
 const services=STATE.services,all=[STATE.internetNode,...services],sourceSelect=document.getElementById('pg-from'),targetSelect=document.getElementById('pg-to');
 optionList(document.getElementById('pg-service'),Object.keys(CONFIG.services).filter(allowed).map(kind=>[kind,`${names[kind]} · ${CONFIG.services[kind].cost}`]));
 optionList(sourceSelect,all.map(s=>[s.id,tag(s)]));optionList(targetSelect,services.map(s=>[s.id,tag(s)]));optionList(document.getElementById('pg-edit-node'),services.map(s=>[s.id,tag(s)]));
 document.getElementById('pg-metrics').textContent=`余款 ${STATE.money.toFixed(1)} · 声誉 ${STATE.reputation.toFixed(1)}% · 时间 ${Math.floor(STATE.elapsedGameTime||0)}s · 已处理 ${STATE.requestsProcessed}`;
 const rows=document.getElementById('pg-node-status');rows.replaceChildren();
 for(const s of services){const li=document.createElement('li');li.textContent=`${tag(s)} · T${s.tier||1} · 健康${Math.round(s.health)} · ${s.isDisabled?'离线':`负载${Math.round(s.totalLoad*100)}%`} · 队列${s.queue.length}`;rows.append(li);}
 const l=level();
 document.getElementById('pg-objectives').textContent=STATE.campaign.active?(l?.objectives.primary.map(o=>`${STATE.campaign.objectiveResults[o.id]?'✓':'○'} ${i18n.t(`obj_${l.id}_${o.id}`)}`).join('；')||''):'原作自由模式：生存有预算和声誉风险，沙盒可自由实验。';
 const snapshot={level:STATE.campaign.currentLevelId,mode:STATE.gameMode,time:STATE.elapsedGameTime||0,speed:STATE.timeScale,money:STATE.money,reputation:STATE.reputation,processed:STATE.requestsProcessed,completed:STATE.campaign.completedByType,objectives:STATE.campaign.objectiveResults,ended:STATE.campaign.ended,outcome:STATE.campaign.outcome,services:services.map(s=>({id:s.id,type:s.type,tier:s.tier||1,x:s.position.x,z:s.position.z,health:s.health,isDisabled:!!s.isDisabled,load:s.totalLoad,connections:[...s.connections]})),connections:STATE.connections.map(c=>[c.from,c.to]),inference:STATE.inference,shift:STATE.intervention?.currentShift,trafficShiftActive:STATE.intervention?.trafficShiftActive};
 document.body.dataset.pgState=JSON.stringify(snapshot);
 if(window.PG_RENDERER==='diagram')drawDiagram(all);
 window.pgSend('snapshot',{level:STATE.campaign.currentLevelId,time:Math.floor(STATE.elapsedGameTime||0),money:Math.round(STATE.money),reputation:Math.round(STATE.reputation),processed:STATE.requestsProcessed});
}
function drawDiagram(all){
 const svg=document.getElementById('pg-diagram'),ns='http://www.w3.org/2000/svg';svg.replaceChildren();
 const xy=node=>({x:((node.position.x+65)/130)*580+10,y:((node.position.z+65)/130)*340+40});
 for(const link of STATE.connections){const a=all.find(s=>s.id===link.from),b=all.find(s=>s.id===link.to);if(!a||!b)continue;const p=xy(a),q=xy(b),line=document.createElementNS(ns,'line');for(const[k,v]of Object.entries({x1:p.x,y1:p.y,x2:q.x,y2:q.y,stroke:'#38bdf8','stroke-width':2}))line.setAttribute(k,String(v));svg.append(line);}
 for(const node of all){const p=xy(node),g=document.createElementNS(ns,'g'),rect=document.createElementNS(ns,'rect'),text=document.createElementNS(ns,'text');rect.setAttribute('x',p.x-34);rect.setAttribute('y',p.y-18);rect.setAttribute('width','68');rect.setAttribute('height','36');rect.setAttribute('rx','6');rect.setAttribute('fill',node.isDisabled?'#7f1d1d':'#0f766e');text.setAttribute('x',p.x);text.setAttribute('y',p.y+4);text.setAttribute('text-anchor','middle');text.setAttribute('fill','white');text.setAttribute('font-size','9');text.textContent=tag(node);g.append(rect,text);svg.append(g);}
}
function setup(){
 const panel=document.createElement('details');panel.id='pg-access';panel.open=window.PG_RENDERER==='diagram';
 panel.innerHTML=`<summary>键盘／触屏建设台</summary><div class="pg-access-content"><p id="pg-metrics"></p><p id="pg-objectives"></p><label>服务<select id="pg-service"></select></label><div class="pg-row"><label>横坐标 X<input id="pg-x" type="number" min="-60" max="60" step="4" value="0"></label><label>纵坐标 Z<input id="pg-z" type="number" min="-60" max="60" step="4" value="0"></label></div><button id="pg-build">在坐标建设</button><div class="pg-row"><label>连线起点<select id="pg-from"></select></label><label>连线终点<select id="pg-to"></select></label></div><div class="pg-row"><button id="pg-connect">连接两端</button><button id="pg-unlink">断开两端</button></div><label>维护对象<select id="pg-edit-node"></select></label><div class="pg-row"><button id="pg-upgrade">升级选中服务</button><button id="pg-repair">修复选中服务</button></div><div class="pg-row"><button id="pg-autoscale">开关自动扩容</button><button id="pg-delete">拆除选中服务</button></div><div class="pg-row"><button id="pg-normal">运行 1 倍</button><button id="pg-fast">运行 3 倍</button><button id="pg-stop">停止流量</button></div><div class="pg-row"><button id="pg-camera">视角复位</button><button id="pg-rotate-left">左转视角</button><button id="pg-rotate-right">右转视角</button></div><p id="pg-feedback" role="status">这里调用原作的建设、连线、升级与模拟规则，不会自动完成目标。</p><details><summary>当前服务状态</summary><ul id="pg-node-status"></ul></details><p class="pg-small">原作25关与26类服务均保留；键盘可用Tab、Enter与空格。每个位置按4格对齐。</p></div>`;
 document.body.append(panel);
 const diagram=document.createElementNS('http://www.w3.org/2000/svg','svg');diagram.id='pg-diagram';diagram.setAttribute('viewBox','0 0 600 420');diagram.setAttribute('aria-label','服务网络平面图');diagram.setAttribute('role','img');document.body.append(diagram);
 if(window.PG_RENDERER==='diagram'){document.body.classList.add('pg-no-webgl');window.pgSend('status',{message:'3D不可用，已切换平面图。建设台仍使用完整原作模拟和关卡。'});}
 const listen=(id,handler)=>document.getElementById(id).addEventListener('click',()=>{if(locked()||STATE.campaign.ended)return;handler();repaint();});
 listen('pg-build',()=>{
  const kind=document.getElementById('pg-service').value,x=Number(document.getElementById('pg-x').value),z=Number(document.getElementById('pg-z').value);
  if(!CONFIG.services[kind]||!allowed(kind)||!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>60||Math.abs(z)>60||x%4||z%4){report('请选择本关可用服务，坐标须在−60至60之间且为4的倍数。');return;}
  if(STATE.internetNode.position.distanceTo(new THREE.Vector3(x,0,z))<4){report('互联网入口位置不能建造。');return;}
  const count=STATE.services.length;createService(kind,new THREE.Vector3(x,0,z));
  report(STATE.services.length>count?`${names[kind]}已建好；请连线。`:'未能建设：检查预算、位置是否已有服务，以及GPU电力余量。');
 });
 listen('pg-connect',()=>{const result=createConnection(document.getElementById('pg-from').value,document.getElementById('pg-to').value);report(result.ok?'连接已建立。':'连接未建立：'+({invalid:'这两类服务不支持该方向',self:'起终点相同',duplicate:'连接已存在',reverse:'已存在反向连接',missing:'请选择有效服务'}[result.reason]||result.reason));});
 listen('pg-unlink',()=>report(deleteConnection(document.getElementById('pg-from').value,document.getElementById('pg-to').value)?'连接已移除。':'未找到这条连接。'));
 listen('pg-upgrade',()=>{const s=selectedNode();if(!s)return;const before=s.tier;s.upgrade();report(s.tier>before?`${tag(s)}已升至T${s.tier}。`:'未升级：可能已满级、预算不足或不支持升级。');});
 listen('pg-repair',()=>{const s=selectedNode();if(s)report(s.repair()?'已付费修复。':'无需修复或预算不足。');});
 listen('pg-delete',()=>{const s=selectedNode();if(s){deleteObject(s.id);report('已请求拆除。电力依赖等原作约束仍会校验。');}});
 listen('pg-autoscale',()=>{const s=selectedNode();if(!s)return;if(!canAutoscale(s)){report('这类服务不支持自动扩容。');return;}toggleAutoscaling(s);report('自动扩容状态已切换。');});
 listen('pg-normal',()=>window.handleGameState(1));listen('pg-fast',()=>window.handleGameState(3));listen('pg-stop',()=>window.handleGameState(0));
 listen('pg-camera',resetCamera);listen('pg-rotate-left',()=>orbitCamera(-Math.PI/4));listen('pg-rotate-right',()=>orbitCamera(Math.PI/4));
}
function initialize(){
 if(ready)return;setup();ready=true;
 if(window.PG_MODE==='campaign'){
  document.body.classList.add('pg-campaign-embed');window.startCampaignLevel(window.PG_LEVEL);
  document.getElementById('main-menu-modal').classList.add('hidden');
  const item=CAMPAIGN_LEVELS[window.PG_LEVEL-1];report(`${window.PG_LEVEL}. ${i18n.t(`level_${item.id}_title`)}：${i18n.t(`level_${item.id}_learn`)}。先建设，再运行。`);
 }else{
  document.body.classList.add('pg-free-embed');document.getElementById('main-menu-modal').classList.remove('hidden');document.getElementById('load-btn').style.display=pgStorage.getItem('serverSurvivalSave')?'block':'none';
  report('原作自由模式：选择生存或沙盒。');
 }
 i18n.setLocale('zh');repaint();refreshId=setInterval(repaint,350);
 window.pgSend('ready',{levels:CAMPAIGN_LEVELS.length,services:Object.keys(CONFIG.services).length,renderer:window.PG_RENDERER});
}
window.addEventListener('pg-upstream-ready',initialize,{once:true});
window.addEventListener('pg-campaign-result',event=>{
 repaint();if(event.detail.levelId!==window.PG_LEVEL||window.PG_MODE!=='campaign')return;
 if(event.detail.outcome==='win'&&!completed){completed=true;window.PG_FINISHED=true;STATE.isRunning=false;for(const control of document.querySelectorAll('button,input,select,textarea'))control.disabled=true;document.body.dataset.pgWon='true';window.pgSend('complete',{level:event.detail.levelId});}
 else window.pgSend('status',{message:'原作判定本局失败。上方“重来”可重新开始这一关。'});
});
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.source!=='playgarden-host'||event.data.session!==window.PG_SESSION)return;
 const {type,paused}=event.data;
 if(type==='pause'){
  if(paused&&!window.PG_SHELL_PAUSED){wasRunning=STATE.isRunning;savedSpeed=STATE.timeScale;window.PG_SHELL_PAUSED=true;STATE.isRunning=false;STATE.timeScale=0;document.body.inert=true;}
  else if(!paused&&window.PG_SHELL_PAUSED){window.PG_SHELL_PAUSED=false;document.body.inert=false;if(!completed){STATE.isRunning=wasRunning;STATE.lastTime=performance.now();window.setTimeScale(savedSpeed);}}
 }else if(type==='hint'&&!locked()){
  checkSmartHints();document.getElementById('pg-access').open=true;const l=level();report(l?`${i18n.t(`level_${l.id}_learn`)} 当前目标：${l.objectives.primary.map(o=>i18n.t(`obj_${l.id}_${o.id}`)).join('；')}`:'观察服务负载和失败原因，再调整连接、容量或防线。');
 }
});
window.addEventListener('pagehide',()=>{clearInterval(refreshId);cancelAnimationFrame(STATE.animationId);STATE.isRunning=false;renderer.dispose();});
