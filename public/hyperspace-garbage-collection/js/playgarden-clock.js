// SPDX-License-Identifier: GPL-3.0-only
// All gameplay callbacks advance only with accepted 60 Hz physics steps.
define(function() {
  'use strict';
  var tasks = new Map(), nextId = 1, now = 0, epoch = 0;
  function schedule(fn, delay, interval) {
    if (typeof fn !== 'function') throw new TypeError('Only local callbacks are allowed');
    var id = nextId++;
    tasks.set(id, { fn: fn, due: now + Math.max(0, Number(delay) || 0), interval: interval, epoch: epoch });
    return id;
  }
  function cancel(id) { tasks.delete(id); }
  return {
    setTimeout: function(fn, delay) { return schedule(fn, delay, 0); },
    clearTimeout: cancel,
    setInterval: function(fn, delay) { return schedule(fn, delay, Math.max(1, Number(delay) || 1)); },
    clearInterval: cancel,
    reset: function() { tasks.clear(); now = 0; epoch++; },
    tick: function(dt) {
      now += dt * 1000;
      var currentEpoch = epoch;
      Array.from(tasks.entries()).forEach(function(entry) {
        var id = entry[0], task = entry[1];
        if (epoch !== currentEpoch || task.epoch !== epoch || !tasks.has(id) || task.due > now) return;
        if (task.interval) task.due = now + task.interval; else tasks.delete(id);
        task.fn();
      });
    },
    read: function() { return { milliseconds: now, pending: tasks.size, epoch: epoch }; }
  };
});
