// SPDX-License-Identifier: GPL-3.0-only
// Isolated lifecycle/input/bridge for the audited MIT ONOFF engine.
import levels from './src/levels.js'
import Scene from './scene.js'
import {DOWN, clearKeys} from './src/keys.js'
const REVISION = 'onoff-cb1e2e4-playgarden-1'
const query = new URLSearchParams(location.search)
const session = query.get('session') || ''
const requested = Number(query.get('level'))
const selected = Number.isInteger(requested) && requested >= 0 && requested < 25 ? requested : 0
const status = document.getElementById('status')
let connected = false, disposed = false, hostPaused = true, muted = true, won = false
let scene, raf = 0, previous = 0, accumulator = 0, time = 0, frames = 0, lastSnapshot = 0
let tasks = [], audio = null, audioLoading = null, audioStarted = false, gesture = false
const keys = new Set(), pointers = new Map(), gamepad = new Set(), pausedAnimations = new Set()
const actions = new Map([['a','left'],['ArrowLeft','left'],['d','right'],['ArrowRight','right'],['w','jump'],['ArrowUp','jump'],[' ','toggle']])
const paused = () => hostPaused || document.hidden || !connected || disposed
const send = (type, extra = {}) => parent.postMessage({source:'playgarden-onoff', revision:REVISION, session, type, ...extra}, '*')
const getSnapshot = () => ({level:selected, total:levels.length, ready:connected, paused:paused(), disposed, won, frames, time,
  deaths:scene?.deaths.value || 0, on:scene?.on ?? true,
  phase:won?'complete':scene?.paused?'dying':'playing',
  guy:scene?{x:scene.guy.x,y:scene.guy.y,vx:scene.guy.vx,vy:scene.guy.vy,hidden:scene.guy.hidden}:null,
  goal:scene?{x:scene.goal.x,y:scene.goal.y}:null,
  held:[...DOWN], audio:{state:audio?.ac.state || 'uninitialized',muted,gesture,started:audioStarted}})
// Read-only diagnostics. No board, clock, RNG, score or success setter is exposed.
Object.defineProperty(window, '__onoffSnapshot', {value:getSnapshot, writable:false, configurable:false})
function snapshot() { send('snapshot', {state:getSnapshot()}) }
function report() {
  status.textContent = won ? (selected===24?'最后一关已抵达星星。可回到选关继续未完成关卡。':'已抵达星星！使用宿主的下一关继续。')
    : `第 ${selected+1} / 25 关 · 本次重试 ${scene?.deaths.value||0} 次 · ${scene?.on?'明层':'暗层'}实体`
}
function rebuildKeys() {
  clearKeys()
  for (const action of [...keys, ...pointers.values(), ...gamepad]) if(action!=='toggle') DOWN.add(action)
  document.querySelectorAll('[data-action]').forEach(button=>button.classList.toggle('held', DOWN.has(button.dataset.action)))
}
function cancelInput() { keys.clear(); pointers.clear(); gamepad.clear(); rebuildKeys() }
async function syncAudio() {
  if (!audio || disposed) return
  try {
    if (paused() || muted || !gesture) await audio.ac.suspend()
    else {
      await audio.ac.resume()
      if (disposed || paused() || muted) {if(!disposed) await audio.ac.suspend();return}
      if (!audioStarted) {audioStarted=true;audio.playMusic()}
    }
  } catch (_) { /* Audio is optional. A blocked browser never blocks gameplay. */ }
}
function activateAudio() {
  gesture = true
  if (muted || paused() || disposed) return
  if (!audioLoading) audioLoading = import('./src/sound.js').then(value => {
    if (disposed) {value.disposeAudio();return}
    audio=value;syncAudio()
  }).catch(()=>{audioLoading=null})
  else syncAudio()
}
function sound(name) { if(audio && audioStarted && !paused() && !muted) audio[name]?.play() }
function toggle() {
  if(paused() || won || scene.paused) return
  scene.on=!scene.on;sound(scene.on?'OFF_FX':'ON_FX');report();snapshot()
}
function after(delay, run) { tasks.push({at:time+delay,run}) }
function complete() {
  if(won || disposed) return
  won=true;cancelInput();send('complete',{level:selected});report();snapshot()
  after(1000,()=>{
    document.body.classList.remove('finish');scene.goal.hidden=true
    if(selected===24){scene.guy.hidden=true;scene.congrats.hidden=false;if(audio&&!muted&&!paused())audio.playWin()}
  })
}
function reset() {
  if(paused())return
  tasks=[];won=false;cancelInput();document.body.classList.remove('finish','dying')
  scene.index=selected;scene.guy.vx=scene.guy.vy=0;scene.paused=false
  if(audioStarted){audio.stopAudio();audioStarted=false;syncAudio()}
  report();snapshot()
}
function padInput() {
  let pad
  try { pad=navigator.getGamepads?.()[0] } catch (_) { return }
  const next = new Set()
  if(pad){
    if(pad.buttons[14]?.pressed || pad.axes[0]<-.4)next.add('left')
    if(pad.buttons[15]?.pressed || pad.axes[0]>.4)next.add('right')
    if(pad.buttons[0]?.pressed || pad.buttons[12]?.pressed)next.add('jump')
    if(pad.buttons[1]?.pressed)next.add('toggle')
  }
  if(next.has('toggle')&&!gamepad.has('toggle'))toggle()
  gamepad.clear();for(const action of next)gamepad.add(action);rebuildKeys()
}
function tick(now) {
  raf=0;if(paused())return
  if(!previous)previous=now
  accumulator+=Math.min(100, now-previous);previous=now
  while(accumulator>=1000/60){
    accumulator-=1000/60;time+=1000/60;frames++
    padInput();scene.tick(value=>Math.round(value/60))
    audio?.tickAudio(1000/60)
    const due=tasks.filter(task=>task.at<=time);tasks=tasks.filter(task=>task.at>time)
    for(const task of due)task.run()
  }
  report()
  if(now-lastSnapshot>150){lastSnapshot=now;snapshot()}
  raf=requestAnimationFrame(tick)
}
function syncPause() {
  cancelInput();previous=0;accumulator=0
  if(raf)cancelAnimationFrame(raf);raf=0
  if(paused()){
    for(const animation of document.getAnimations()){if(animation.playState==='running'){animation.pause();pausedAnimations.add(animation)}}
  }else{
    for(const animation of pausedAnimations){if(animation.playState==='paused')animation.play()}
    pausedAnimations.clear()
  }
  document.body.classList.toggle('paused',paused())
  syncAudio();if(!paused())raf=requestAnimationFrame(tick);snapshot()
}
function keydown(event) {
  const action=actions.get(event.key)
  if(action){event.preventDefault();if(paused()||won)return;activateAudio();if(action==='toggle'){if(!event.repeat)toggle()}else{keys.add(action);rebuildKeys()}}
  else if(event.key.toLowerCase()==='r'&&!event.repeat){event.preventDefault();reset()}
}
function keyup(event) {const action=actions.get(event.key);if(action){keys.delete(action);rebuildKeys()}}
const controller=new AbortController(),options={signal:controller.signal}
document.addEventListener('keydown',keydown,options);document.addEventListener('keyup',keyup,options)
document.addEventListener('pointerdown',()=>{if(!paused())activateAudio()},options)
for(const button of document.querySelectorAll('[data-action]')){
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();if(paused()||won)return
    button.setPointerCapture(event.pointerId);button.focus();activateAudio()
    const action=button.dataset.action
    pointers.set(event.pointerId,action);if(action==='toggle')toggle();rebuildKeys()
  },options)
  const release=event=>{pointers.delete(event.pointerId);rebuildKeys()}
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release,options)
  // Keyboard-accessible buttons use ordinary clicks; pointer clicks were handled above.
  button.addEventListener('click',event=>{if(event.detail!==0||paused()||won)return;activateAudio();
    const action=button.dataset.action;if(action==='toggle')toggle();else{keys.add(action);rebuildKeys();after(120,()=>{keys.delete(action);rebuildKeys()})}},options)
}
window.addEventListener('blur',cancelInput,options)
document.addEventListener('visibilitychange',syncPause,options)
function dispose() {
  if(disposed)return
  disposed=true;cancelInput();if(raf)cancelAnimationFrame(raf);raf=0;tasks=[];pausedAnimations.clear();controller.abort();audio?.disposeAudio();snapshot()
}
window.addEventListener('pagehide',dispose,options)
window.addEventListener('message',event=>{
  const data=event.data
  if(event.source!==parent||!data||data.source!=='playgarden-host'||data.session!==session||disposed)return
  if(data.type==='connect'){
    hostPaused=!!data.paused;muted=!!data.muted
    if(!connected){
      scene=new Scene({selected,sound,after,complete,playWin:()=>audio?.playWin()},levels)
      scene.hidden=false;connected=true;document.body.classList.remove('waiting');report()
    }
    send('ready');syncPause()
  } else if(!connected)return
  else if(data.type==='pause'){hostPaused=!!data.paused;syncPause()}
  else if(data.type==='mute'){muted=!!data.muted;syncAudio();snapshot()}
  else if(data.type==='cancel')cancelInput()
  else if(data.type==='dispose')dispose()
  else if(data.type==='command'&&data.action==='reset')reset()
},options)
window.addEventListener('error',()=>send('error',{message:'游戏运行出现错误，请重新载入。'}),options)
send('loaded')
