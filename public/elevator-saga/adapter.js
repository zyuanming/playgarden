// SPDX-License-Identifier: GPL-3.0-only
// Original simulation and player code run only in the terminable worker.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const session = new URL(location.href).searchParams.get('session') || '';
  const parentOrigin = new URL(document.referrer || location.href).origin;
  const speeds = [1, 2, 3, 5, 8, 13, 21, 34, 55];
  const defaultCode = '{\n  init: function(elevators, floors) {\n    var elevator = elevators[0];\n    // 空闲时在 0 层和 1 层之间往返。还有乘客要去哪里？\n    elevator.on("idle", function() {\n      elevator.goToFloor(0);\n      elevator.goToFloor(1);\n    });\n  },\n  update: function(dt, elevators, floors) {\n    // 可以用事件调度，也可以在这里观察每一帧。\n  }\n}';
  const goals = [
    '60 秒内运送 15 人','60 秒内运送 20 人','60 秒内运送 23 人',
    '60 秒内运送 28 人','68 秒内运送 100 人','移动不超过 60 层，运送 40 人',
    '移动不超过 63 层，运送 100 人','运送 50 人，最长等待不超过 21 秒',
    '运送 50 人，最长等待不超过 20 秒','70 秒内运送 50 人',
    '运送 60 人，最长等待不超过 19 秒','运送 80 人，最长等待不超过 17 秒',
    '运送 100 人，最长等待不超过 15 秒','运送 110 人，最长等待不超过 15 秒',
    '运送 120 人，最长等待不超过 14 秒','80 秒内运送 70 人',
    '80 秒内运送 110 人','1800 秒内运送 2675 人，最长等待不超过 45 秒',
    '自由运行：原作演示模式，没有通关判定'
  ];
  let worker = null, workerUrl = '', generation = '', level = 0, speed = 2;
  let hostPaused = false, userPaused = true, snapshot = null, disposed = false;
  let configured = false, lastHeartbeat = 0, rateStart = 0, messageCount = 0;
  let watchdog = 0, readyTimer = 0, draftTimer = 0, oldCode = '', completeSent = false, saveRevision = 0;
  const completed = new Set();
  const editor = CodeMirror.fromTextArea($('code'), {
    mode: 'javascript', lineNumbers: true, indentUnit: 2, tabSize: 2,
    autoCloseBrackets: true, theme: 'solarized dark', lineWrapping: false
  });
  editor.setValue(defaultCode);
  editor.getInputField().setAttribute('aria-label', '电梯调度 JavaScript 代码');
  function post(type, data = {}) {
    if (!disposed) parent.postMessage({ source: 'playgarden-elevator-saga', session, type, ...data }, parentOrigin);
  }
  function saveCode() {
    const revision = ++saveRevision, code = editor.getValue();
    document.body.dataset.codeRevision = String(revision);
    document.body.dataset.codeSave = 'pending';
    $('code-save-status').textContent = '正在保存当前代码，请等保存完成后再刷新。';
    if (code.length > 64000) {
      document.body.dataset.codeSave = 'failed';
      $('code-save-status').textContent = '代码超过 64000 个字符，尚未保存。请先复制备份。';
      return;
    }
    post('save-code', { code, revision });
  }
  function announce() { post('ready', { revision: 'elevator-saga-e0c55bf-worker-1', levels: 18 }); }
  function report(message) { $('status').textContent = message; post('status', { message }); }
  function command(type, data = {}) { worker?.postMessage({ type, generation, ...data }); }
  function destroyWorker() {
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); worker = null; }
    if (workerUrl) { URL.revokeObjectURL(workerUrl); workerUrl = ''; }
    clearInterval(watchdog); watchdog = 0;
  }
  function stop(message) {
    destroyWorker(); userPaused = true; $('run').textContent = '应用代码并运行';
    $('pause').disabled = true; $('world').inert = true;
    if (message) report(message);
    post('lifecycle', { running: false, terminated: true });
  }
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  function validState(d) {
    return d && d.type === 'state' && d.generation === generation &&
      typeof d.paused === 'boolean' && (d.result === null || typeof d.result === 'boolean') &&
      speeds.includes(d.speed) && d.floorHeight === 50 && d.stats &&
      ['transported','elapsed','throughput','averageWait','maximumWait','moves'].every(k => finite(d.stats[k]) && d.stats[k] >= 0) &&
      Array.isArray(d.floors) && d.floors.length >= 3 && d.floors.length <= 21 &&
      d.floors.every((f, i) => f.level === i && finite(f.y) && typeof f.up === 'boolean' && typeof f.down === 'boolean') &&
      Array.isArray(d.elevators) && d.elevators.length >= 1 && d.elevators.length <= 8 &&
      d.elevators.every(e => ['x','y','width','floor','load','capacity'].every(k => finite(e[k])) &&
        e.width >= 40 && e.width <= 100 && typeof e.up === 'boolean' && typeof e.down === 'boolean' &&
        Array.isArray(e.buttons) && e.buttons.length === d.floors.length && e.buttons.every(b => typeof b === 'boolean')) &&
      Array.isArray(d.users) && d.users.length <= 6000 && d.users.every(u => finite(u.x) && finite(u.y) &&
        ['male','female','child'].includes(u.kind) && typeof u.done === 'boolean');
  }
  function el(tag, className, text) {
    const node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  }
  let geometryKey = '', floorNodes = [], elevatorNodes = [], userNodes = [];
  function render(d) {
    snapshot = d;
    const key = d.floors.length + ':' + d.elevators.map(e => e.width).join(',');
    const world = $('world');
    if (key !== geometryKey) {
      geometryKey = key; world.replaceChildren(); floorNodes = []; elevatorNodes = []; userNodes = [];
      world.style.height = d.floors.length * d.floorHeight + 'px';
      world.style.width = Math.max(390, ...d.elevators.map(e => e.x + e.width + 35)) + 'px';
      $('manual-floor').replaceChildren(); $('manual-elevator').replaceChildren();
      d.floors.forEach(f => { const option = el('option','',f.level + ' 层'); option.value = String(f.level); $('manual-floor').append(option); });
      d.elevators.forEach((e,i) => { const option = el('option','','电梯 ' + (i + 1)); option.value = String(i); $('manual-elevator').append(option); });
      d.floors.forEach(f => {
        const row = el('div','floor'); row.style.top = f.y + 'px';
        row.append(el('span','floornumber',f.level));
        const controls = el('span','buttonindicator'); const buttons = {};
        for (const dir of ['up','down']) {
          const button = el('button','floor-call ' + dir);
          button.setAttribute('aria-label',f.level + ' 层' + (dir === 'up' ? '向上' : '向下') + '呼叫');
          button.append(el('i','fa fa-arrow-circle-' + dir));
          button.hidden = (dir === 'up' && f.level === d.floors.length - 1) || (dir === 'down' && f.level === 0);
          button.onclick = () => command('floor',{floor:f.level,direction:dir}); controls.append(button); buttons[dir] = button;
        }
        row.append(controls); world.append(row); floorNodes.push(buttons);
      });
      d.elevators.forEach((e, index) => {
        const box = el('div','elevator movable'); box.style.width = e.width + 'px';
        const up = el('i','fa fa-arrow-circle-up'), down = el('i','fa fa-arrow-circle-down');
        const top = el('span','directionindicator directionindicatorup'); top.append(up);
        const bottom = el('span','directionindicator directionindicatordown'); bottom.append(down);
        const floor = el('span','floorindicator'), buttons = el('span','buttonindicator');
        const floorButtons = d.floors.map(f => {
          const b = el('button','buttonpress',f.level); b.setAttribute('aria-label','电梯 ' + (index + 1) + ' 选择 ' + f.level + ' 层');
          b.onclick = () => command('elevator',{elevator:index,floor:f.level}); buttons.append(b); return b;
        });
        box.append(top,bottom,floor,buttons); world.append(box); elevatorNodes.push({box,up,down,floor,floorButtons});
      });
    }
    d.floors.forEach((f,i) => { floorNodes[i].up.classList.toggle('activated',f.up); floorNodes[i].down.classList.toggle('activated',f.down); });
    d.elevators.forEach((e,i) => {
      const node = elevatorNodes[i]; node.box.style.transform = `translate(${e.x}px,${e.y}px)`;
      node.up.classList.toggle('activated',e.up); node.down.classList.toggle('activated',e.down);
      node.floor.textContent = String(e.floor); node.floorButtons.forEach((b,j) => b.classList.toggle('activated',e.buttons[j]));
    });
    while (userNodes.length > d.users.length) userNodes.pop().remove();
    d.users.forEach((u,i) => {
      let node = userNodes[i]; if (!node) { node = el('i'); userNodes.push(node); world.append(node); }
      node.className = 'movable fa user fa-' + u.kind + (u.done ? ' leaving' : '');
      node.style.transform = `translate(${u.x}px,${u.y}px)`;
    });
    const s = d.stats;
    $('transported').textContent = String(s.transported); $('elapsed').textContent = s.elapsed.toFixed(1) + ' 秒';
    $('throughput').textContent = s.throughput.toFixed(2) + ' 人/秒'; $('average').textContent = s.averageWait.toFixed(1) + ' 秒';
    $('maximum').textContent = s.maximumWait.toFixed(1) + ' 秒'; $('moves').textContent = String(s.moves);
    $('pause').disabled = d.result !== null; $('pause').textContent = d.paused ? '继续运行' : '暂停运行';
    world.inert = d.paused || d.result !== null || hostPaused;
    $('manual-controls').inert = world.inert;
    document.body.dataset.paused = String(d.paused); document.body.dataset.result = d.result === null ? 'pending' : String(d.result);
    if (d.result !== null && !completeSent) {
      completeSent = true;
      if (d.result) {
        if (level < 18) completed.add(level); updateProgress();
        report('挑战成功！原作运送、时间和等待条件已达到。');
        post('complete',{level,stats:s});
      } else report('本次挑战未通过。查看统计，修改调度程序后再试。');
    }
    post('snapshot',{level,paused:d.paused,result:d.result,stats:s});
  }
  function run() {
    if (hostPaused || !configured) return;
    const code = editor.getValue(); if (code.length > 64000) return report('代码最多 64000 个字符。');
    stop(); snapshot = null; geometryKey = ''; completeSent = false; generation = crypto.randomUUID();
    $('world').replaceChildren(); $('run').textContent = '重新应用并运行'; $('pause').disabled = false;
    report('程序运行中；可以随时暂停或停止。'); userPaused = false;
    workerUrl = URL.createObjectURL(new Blob([window.ELEVATOR_WORKER_SOURCE],{type:'text/javascript'}));
    worker = new Worker(workerUrl); const activeWorker = worker; lastHeartbeat = performance.now(); rateStart = lastHeartbeat; messageCount = 0;
    worker.onerror = event => { event.preventDefault(); if (worker === activeWorker) stop('程序错误：' + String(event.message).slice(0,1500)); };
    worker.onmessage = event => {
      if (worker !== activeWorker || disposed) return;
      const now = performance.now(); if (now - rateStart > 1000) { rateStart = now; messageCount = 0; }
      if (++messageCount > 240) return stop('程序发送消息过于频繁，已停止。');
      const d = event.data; if (!d || d.generation !== generation) return;
      if (d.type === 'error' && typeof d.message === 'string') return stop('程序错误：' + d.message.slice(0,1500));
      if (!validState(d)) return stop('程序返回了无效状态，已停止。');
      lastHeartbeat = now; render(d);
    };
    watchdog = window.setInterval(() => { if (worker && performance.now() - lastHeartbeat > 2500) stop('程序长时间没有响应，已终止。请检查无限循环，再应用代码。'); },250);
    worker.postMessage({type:'init',generation,base:new URL('./',location.href).href,level,speed,code,start:true});
    saveCode(); post('lifecycle',{running:true,terminated:false});
  }
  function updateProgress() { $('progress').textContent = `已通过 ${completed.size} / 18 个原作挑战`; }
  function selectLevel(value) {
    if (!Number.isInteger(value) || value < 0 || value > 18) return;
    stop(); level = value; $('level').value = String(level); $('goal').textContent = goals[level];
    $('world').replaceChildren(); geometryKey = ''; snapshot = null; document.body.dataset.result = 'pending';
    report('修改代码后点击“应用代码并运行”。'); post('level',{level});
  }
  goals.forEach((goal,i) => { const option = el('option','',i === 18 ? '自由演示（不计关卡）' : `挑战 ${i + 1}`); option.value = String(i); $('level').append(option); });
  speeds.forEach(value => { const option = el('option','',value + ' 倍'); option.value = String(value); $('speed').append(option); });
  $('speed').value = '2'; $('level').onchange = () => selectLevel(Number($('level').value));
  $('speed').onchange = () => { speed = Number($('speed').value); command('speed',{speed}); post('speed',{speed}); };
  $('run').onclick = run; $('stop').onclick = () => stop('程序已停止。编辑后可以重新运行。');
  $('manual-up').onclick = () => { const floor = Number($('manual-floor').value); if (snapshot && floor < snapshot.floors.length - 1) command('floor',{floor,direction:'up'}); };
  $('manual-down').onclick = () => { const floor = Number($('manual-floor').value); if (floor > 0) command('floor',{floor,direction:'down'}); };
  $('manual-car').onclick = () => command('elevator',{elevator:Number($('manual-elevator').value),floor:Number($('manual-floor').value)});
  $('pause').onclick = () => { if (!worker || hostPaused) return; userPaused = !snapshot?.paused; command('pause',{paused:userPaused}); };
  $('save').onclick = saveCode;
  $('reset').onclick = () => { oldCode = editor.getValue(); editor.setValue(defaultCode); $('undo').disabled = false; };
  $('undo').onclick = () => { if (oldCode) { editor.setValue(oldCode); oldCode = ''; $('undo').disabled = true; } };
  editor.on('change', saveCode);
  function receive(event) {
    if (event.source !== parent || event.origin !== parentOrigin || event.data?.source !== 'playgarden-host' || event.data.session !== session) return;
    const d = event.data;
    if (d.type === 'hello') announce();
    else if (d.type === 'config' && !configured) {
      configured = true; clearInterval(readyTimer);
      if (typeof d.code === 'string' && d.code.length <= 64000) editor.setValue(d.code);
      if (Array.isArray(d.completed)) d.completed.filter(n => Number.isInteger(n) && n >= 0 && n < 18).forEach(n => completed.add(n));
      if (speeds.includes(d.speed)) { speed = d.speed; $('speed').value = String(speed); }
      updateProgress(); selectLevel(Number.isInteger(d.level) ? d.level : 0); hostPaused = !!d.paused; applyHostPause();
    } else if (d.type === 'pause') { hostPaused = !!d.paused; applyHostPause(); }
    else if (d.type === 'select-level' && configured && Number.isInteger(d.level) && d.level >= 0 && d.level <= 18 && d.level !== level) selectLevel(d.level);
    else if (d.type === 'saved' && d.revision === saveRevision && typeof d.ok === 'boolean') {
      document.body.dataset.codeSave = d.ok ? 'saved' : 'failed';
      document.body.dataset.savedRevision = d.ok ? String(d.revision) : '';
      $('code-save-status').textContent = d.ok ? '当前代码已保存在此浏览器。' : '此浏览器暂不能保存，请自行复制代码。';
    }
    else if (d.type === 'dispose') dispose();
  }
  function applyHostPause() {
    $('app').inert = hostPaused; $('host-pause').hidden = !hostPaused;
    command('pause',{paused:hostPaused || userPaused});
  }
  function dispose() {
    if (disposed) return; stop(); disposed = true; clearInterval(readyTimer); clearTimeout(draftTimer);
    window.removeEventListener('message',receive); editor.toTextArea();
  }
  window.addEventListener('message',receive); window.addEventListener('pagehide',dispose,{once:true});
  readyTimer = window.setInterval(announce,600); selectLevel(0); announce();
})();
