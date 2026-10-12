// SPDX-License-Identifier: GPL-3.0-only
// This file is loaded as text and embedded in an opaque-origin blob worker.
// The fixed original simulation runs here; player code never runs in the UI.
(() => {
  'use strict';
  const send = self.postMessage.bind(self);
  const schedule = self.setInterval.bind(self);
  const cancel = self.clearInterval.bind(self);
  let controller = null, world = null, challenge = null, pendingFrame = null;
  let timer = null, generation = '', result = null, initialized = false;
  let lastPublished = 0, lastMessage = 0;
  const number = value => Number.isFinite(value) ? value : 0;
  const error = value => {
    if (controller) controller.setPaused(true);
    send({ type: 'error', generation, message: String(value && value.message || value).slice(0, 1500) });
  };
  function snapshot(force) {
    if (!world || (!force && performance.now() - lastPublished < 90)) return;
    lastPublished = performance.now();
    // Bounds protect the renderer/message payload; they never cull game users.
    if (world.users.length > 6000) { error('当前程序让等待乘客超过显示上限，请停止后改进调度。'); return; }
    send({ type: 'state', generation, result, paused: controller.isPaused,
      speed: controller.timeScale,
      stats: { transported: world.transportedCounter, elapsed: world.elapsedTime,
        throughput: number(world.transportedPerSec), averageWait: world.avgWaitTime,
        maximumWait: world.maxWaitTime, moves: world.moveCount },
      floorHeight: world.floorHeight,
      floors: world.floors.map(f => ({ level: f.level, y: f.yPosition,
        up: !!f.buttonStates.up, down: !!f.buttonStates.down })),
      elevators: world.elevators.map(e => ({ x: e.worldX, y: e.worldY, width: e.width,
        floor: e.currentFloor, up: e.goingUpIndicator, down: e.goingDownIndicator,
        buttons: e.buttonStates.slice(), load: e.getLoadFactor(), capacity: e.maxUsers })),
      users: world.users.map((u, index) => ({ index, x: u.worldX, y: u.worldY,
        kind: u.displayType, done: !!u.done })) });
  }
  self.onmessage = event => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    try {
      if (data.type === 'init' && !initialized) {
        initialized = true;
        if (typeof data.generation !== 'string' || typeof data.base !== 'string' ||
            typeof data.code !== 'string' || data.code.length > 64000 ||
            !Number.isInteger(data.level) || data.level < 0 || data.level > 18) {
          throw new Error('初始化内容无效。');
        }
        generation = data.generation;
        const base = new URL(data.base);
        if (!['http:', 'https:'].includes(base.protocol)) throw new Error('资源地址无效。');
        importScripts(...['libs/lodash.min.js', 'libs/riot.js', 'libs/unobservable.js',
          'base.js', 'movable.js', 'floor.js', 'user.js', 'elevator.js',
          'interfaces.js', 'world.js', 'challenges.js'].map(path => new URL(path, base).href));
        // Only the documented game callbacks schedule player work. The original
        // simulation timer is already captured above and is not exposed again.
        // Lock both the global bindings and inherited native bindings, so an
        // explicit prototype lookup cannot recover the native constructors.
        // If a browser cannot apply a required lock, init fails before eval.
        for (const key of ['Worker', 'SharedWorker', 'importScripts', 'setTimeout',
          'setInterval', 'clearTimeout', 'clearInterval', 'BroadcastChannel']) {
          for (let prototype = Object.getPrototypeOf(self); prototype; prototype = Object.getPrototypeOf(prototype)) {
            if (Object.prototype.hasOwnProperty.call(prototype, key))
              Object.defineProperty(prototype, key, { value: undefined, writable: false, configurable: false });
          }
          Object.defineProperty(self, key, { value: undefined, writable: false, configurable: false });
        }
        challenge = self.challenges[data.level];
        const evaluate = challenge.condition.evaluate;
        world = self.createWorldCreator().createWorld(challenge.options);
        controller = self.createWorldController(1 / 60);
        controller.on('usercode_error', error);
        world.on('stats_changed', () => {
          if (result !== null) return;
          const status = evaluate(world);
          if (status !== null) {
            result = status === true;
            world.challengeEnded = true;
            controller.setPaused(true);
          }
        });
        // Player init/update is intentionally evaluated by the original loader,
        // only inside this terminable worker under the inherited restrictive CSP.
        const program = self.getCodeObjFromCode(data.code);
        controller.setTimeScale([1, 2, 3, 5, 8, 13, 21, 34, 55].includes(data.speed) ? data.speed : 2);
        controller.start(world, program, callback => { pendingFrame = callback; }, !!data.start);
        timer = schedule(() => {
          const callback = pendingFrame; pendingFrame = null;
          if (callback) callback(performance.now());
          snapshot(false);
        }, 1000 / 60);
        snapshot(true);
      } else if (data.generation === generation && controller) {
        // Limit accepted command rate without dropping ordinary human controls.
        if (performance.now() - lastMessage < 5 && !['dispose', 'pause'].includes(data.type)) return;
        lastMessage = performance.now();
        if (data.type === 'pause' && result === null) controller.setPaused(!!data.paused);
        else if (data.type === 'speed' && [1, 2, 3, 5, 8, 13, 21, 34, 55].includes(data.speed)) controller.setTimeScale(data.speed);
        else if (data.type === 'floor' && !controller.isPaused && result === null && Number.isInteger(data.floor) && world.floors[data.floor]) {
          if (data.direction === 'up') world.floors[data.floor].pressUpButton();
          else if (data.direction === 'down') world.floors[data.floor].pressDownButton();
        } else if (data.type === 'elevator' && !controller.isPaused && result === null && Number.isInteger(data.elevator) &&
                   world.elevators[data.elevator] && Number.isInteger(data.floor) && world.floors[data.floor]) {
          world.elevators[data.elevator].pressFloorButton(data.floor);
        } else if (data.type === 'dispose') {
          if (timer !== null) cancel(timer);
          timer = null; pendingFrame = null;
          world.unWind(); self.close(); return;
        }
        snapshot(true);
      }
    } catch (caught) { error(caught); }
  };
})();
