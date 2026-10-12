/* Original Playgarden iframe lifecycle boundary for the audited Trust snapshot.
 * Load before upstream scripts. Required source boundaries are in boundaries.patch.
 * This deliberately does not replace Date, Date.now, performance, or Math.random.
 */
(function (w, d) {
  "use strict";
  if (w.TrustLifecycle) throw new Error("TrustLifecycle already installed");

  var native = {
    timeout: w.setTimeout.bind(w), interval: w.setInterval.bind(w),
    clearTimeout: w.clearTimeout.bind(w), clearInterval: w.clearInterval.bind(w),
    raf: w.requestAnimationFrame.bind(w), caf: w.cancelAnimationFrame.bind(w),
    now: w.performance.now.bind(w.performance)
  };
  var timers = new Map(), waiting = new Set(), apps = new Set();
  var reasons = new Set(), animations = new Map(), problems = new Set();
  var sequence = 0, scene = 0, pausedAt = 0, pausedTotal = 0;
  var state = "running", revision = 0, audioWork = Promise.resolve();
  var audioSnapshot = null;

  function frozen() { return state !== "running"; }
  function now() { return (frozen() ? pausedAt : native.now()) - pausedTotal; }
  function report(label, error) {
    problems.add(label);
    if (w.console) w.console.warn("TrustLifecycle: " + label, error);
  }
  function attempt(label, fn) {
    try { return fn(); } catch (error) { report(label, error); }
  }
  function delayValue(value) {
    var delay = Number(value) || 0;
    return delay < 0 || delay > 2147483647 ? 0 : delay;
  }
  function clearNative(timer) {
    if (timer.handle === null) return;
    if (timer.kind === "raf") native.caf(timer.handle);
    else if (timer.nativeInterval) native.clearInterval(timer.handle);
    else native.clearTimeout(timer.handle);
    timer.handle = null;
  }
  function cancel(id) {
    var timer = timers.get(id);
    if (timer) { clearNative(timer); timers.delete(id); }
  }
  function fire(timer, timestamp) {
    timer.handle = timer.nativeInterval ? timer.handle : null;
    if (!timers.has(timer.id) || state === "disposed") return;
    if (frozen()) { timer.remaining = 0; return; }
    if (timer.owner !== null && timer.owner !== scene) { cancel(timer.id); return; }
    if (timer.kind !== "interval") timers.delete(timer.id);
    else timer.due = now() + timer.delay;
    if (timer.kind === "raf") timer.fn.call(w, timestamp - pausedTotal);
    else timer.fn.apply(w, timer.args);
  }
  function arm(timer, resuming) {
    if (frozen() || timer.handle !== null) return;
    if (timer.kind === "raf") {
      timer.handle = native.raf(function (timestamp) { fire(timer, timestamp); });
    } else if (timer.kind === "interval" && !resuming) {
      timer.nativeInterval = true;
      timer.due = now() + timer.delay;
      timer.handle = native.interval(function () { fire(timer); }, timer.delay);
    } else {
      timer.nativeInterval = false;
      timer.due = now() + timer.remaining;
      timer.handle = native.timeout(function () {
        timer.handle = null;
        if (!timers.has(timer.id) || frozen()) { timer.remaining = 0; return; }
        if (timer.kind === "interval") {
          // Preserve the remaining first interval, then return to native cadence.
          timer.nativeInterval = true;
          timer.handle = native.interval(function () { fire(timer); }, timer.delay);
        }
        fire(timer);
      }, timer.remaining);
    }
  }
  function schedule(kind, fn, delay, args, owner) {
    if (typeof fn !== "function") throw new TypeError("Trust timers require a function");
    var id = --sequence;
    if (state === "disposed") return id;
    var timer = {
      id: id, kind: kind, fn: fn, args: args, owner: owner, handle: null,
      delay: delayValue(delay), remaining: delayValue(delay),
      due: now() + delayValue(delay), nativeInterval: false
    };
    timers.set(id, timer);
    arm(timer, false);
    return id;
  }
  function argsAfter(args, offset) { return Array.prototype.slice.call(args, offset); }
  w.setTimeout = function (fn, delay) {
    return schedule("timeout", fn, delay, argsAfter(arguments, 2), null);
  };
  w.setInterval = function (fn, delay) {
    return schedule("interval", fn, delay, argsAfter(arguments, 2), null);
  };
  w.requestAnimationFrame = function (fn) { return schedule("raf", fn, 0, [], null); };
  w.clearTimeout = w.clearInterval = function (id) {
    if (timers.has(id)) cancel(id);
    else { native.clearTimeout(id); native.clearInterval(id); }
  };
  w.cancelAnimationFrame = function (id) {
    if (timers.has(id)) cancel(id);
    else native.caf(id);
  };

  function freezeCss() {
    if (!frozen()) return;
    if (typeof d.getAnimations !== "function") {
      report("css-animation-api-unavailable");
      return;
    }
    d.getAnimations().forEach(function (animation) {
      if (animations.has(animation) || animation.playState === "idle" ||
          animation.playState === "finished" || animation.playState === "paused") return;
      var time = animation.currentTime;
      animation.pause();
      if (time !== null) animation.currentTime = time;
      animations.set(animation, true);
    });
  }
  var cssObserver = new MutationObserver(freezeCss);
  function thawCss() {
    cssObserver.disconnect();
    animations.forEach(function (_, animation) {
      if (animation.playState === "paused") attempt("css-resume-failed", function () { animation.play(); });
    });
    animations.clear();
  }
  d.addEventListener("transitionrun", freezeCss, true);
  d.addEventListener("animationstart", freezeCss, true);

  function captureAudio() {
    var howler = w.Howler, context = howler && howler.ctx;
    var snapshot = { howler: howler, context: context, resumeContext: false, nodes: [] };
    if (!howler) return snapshot;
    snapshot.resumeContext = !!context && (context.state === "running" || howler.state === "resuming");
    // Raw HTML5 pause preserves Howler's looping/end timers and sound IDs.
    // Those timers freeze separately; do not call Howl.pause(), which clears them.
    howler._howls.forEach(function (howl) {
      if (howl._webAudio) return;
      howl._sounds.forEach(function (sound) {
        var node = sound._node;
        if (node && !node.paused && !node.ended) {
          snapshot.nodes.push(node);
          node.pause();
        }
      });
    });
    return snapshot;
  }
  function queueAudio(operation) {
    audioWork = audioWork.then(operation).catch(function (error) { report("audio-operation-failed", error); });
    return audioWork;
  }
  function suspendAudio(snapshot) {
    return queueAudio(function () {
      var context = snapshot && snapshot.context;
      if (!context || context.state === "closed") return;
      if (typeof context.suspend !== "function") {
        report("audio-context-suspend-unavailable");
        return;
      }
      return context.suspend().then(function () {
        if (snapshot.howler.ctx === context) snapshot.howler.state = context.state;
      });
    });
  }
  function pause(reason) {
    if (state === "disposed") return audioWork;
    reasons.add(reason || "host");
    revision++;
    if (state === "running") {
      pausedAt = native.now();
      state = "paused";
      timers.forEach(function (timer) {
        if (timer.kind !== "raf") timer.remaining = Math.max(0, timer.due - now());
        clearNative(timer);
      });
      freezeCss();
      cssObserver.observe(d, { childList: true, subtree: true, attributes: true });
      audioSnapshot = captureAudio();
    } else {
      state = "paused";
    }
    // Also serialize another suspend if a resume was already in flight.
    return suspendAudio(audioSnapshot);
  }
  function resume(reason) {
    reasons.delete(reason || "host");
    if (state === "disposed" || reasons.size || state === "running") return audioWork;
    var ticket = ++revision, snapshot = audioSnapshot;
    state = "resuming";
    return queueAudio(function () {
      if (ticket !== revision || reasons.size || state === "disposed") return;
      var context = snapshot && snapshot.context;
      if (context && snapshot.resumeContext && context.state !== "closed") {
        return context.resume().then(function () {
          if (snapshot.howler.ctx === context) snapshot.howler.state = context.state;
        });
      }
    }).then(function () {
      if (ticket !== revision || reasons.size || state === "disposed") return;
      pausedTotal += native.now() - pausedAt;
      state = "running";
      thawCss();
      if (snapshot) snapshot.nodes.forEach(function (node) {
        var result = attempt("html-audio-resume-failed", function () { return node.play(); });
        if (result && result.catch) result.catch(function (error) { report("html-audio-resume-blocked", error); });
      });
      audioSnapshot = null;
      timers.forEach(function (timer) { arm(timer, true); });
      var callbacks = Array.from(waiting);
      waiting.clear();
      callbacks.forEach(function (fn) { w.setTimeout(fn, 0); });
    });
  }
  function deferUntilRunning(fn) {
    if (!frozen()) return false;
    if (state !== "disposed") waiting.add(fn);
    return true;
  }
  function gate(fn) {
    return function () {
      var that = this, args = arguments;
      var invoke = function () { return fn.apply(that, args); };
      if (!deferUntilRunning(invoke)) return invoke();
    };
  }
  function guardScene(fn) {
    var owner = scene;
    return function () {
      if (owner !== scene || state === "disposed") return;
      return fn.apply(this, arguments);
    };
  }
  function beginScene() {
    // Call at the END of old reset cleanup, before onjump/onstart for its replacement.
    // Regular nextSlide deliberately retains the scene: it builds slides incrementally.
    scene++;
    timers.forEach(function (timer) { if (timer.owner !== null && timer.owner !== scene) cancel(timer.id); });
    if (w.Tween) w.Tween.removeAllTweens();
  }
  function registerApp(app) {
    var destroy = app.destroy, live = true;
    apps.add(app);
    app.destroy = function () {
      if (!live) return;
      live = false;
      apps.delete(app);
      return destroy.apply(this, arguments);
    };
    return app;
  }
  function dispose() {
    if (state === "disposed") return audioWork;
    pause("dispose");
    state = "disposed";
    revision++;
    scene++;
    timers.forEach(function (timer) { cancel(timer.id); });
    waiting.clear();
    cssObserver.disconnect();
    animations.forEach(function (_, animation) { attempt("css-cancel-failed", function () { animation.cancel(); }); });
    animations.clear();
    Array.from(apps).forEach(function (app) { attempt("pixi-dispose-failed", function () { app.destroy(true); }); });
    if (w.PIXI && w.PIXI.ticker) attempt("pixi-shared-stop-failed", function () { w.PIXI.ticker.shared.stop(); });
    if (w.Tween) attempt("tween-dispose-failed", function () { w.Tween.removeAllTweens(); });
    if (w.Ticker) attempt("ticker-dispose-failed", function () { w.Ticker.reset(); });
    var howler = w.Howler, context = howler && howler.ctx;
    if (howler) howler._howls.slice().forEach(function (howl) {
      attempt("sound-unload-failed", function () { howl.unload(); });
    });
    // Do not call Howler.unload(): v2.0.0 recreates the AudioContext after closing it.
    audioSnapshot = null;
    // close() must not wait behind a browser-blocked resume() promise.
    var closed = attempt("audio-context-close-failed", function () {
      if (context && context.state !== "closed" && typeof context.close === "function") return context.close();
    });
    audioWork = Promise.resolve(closed).catch(function (error) { report("audio-context-close-failed", error); });
    return audioWork;
  }
  function blockInput(event) {
    if (!frozen()) return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }
  ["pointerdown", "pointerup", "pointermove", "mousedown", "mouseup", "mousemove",
    "touchstart", "touchmove", "touchend", "click", "dblclick", "keydown", "keyup", "wheel"]
    .forEach(function (name) { w.addEventListener(name, blockInput, { capture: true, passive: false }); });

  w.TrustLifecycle = {
    pause: pause, resume: resume, dispose: dispose, isFrozen: frozen, isPaused: frozen, now: now,
    deferUntilRunning: deferUntilRunning, gate: gate, guardScene: guardScene,
    beginScene: beginScene, registerApp: registerApp,
    sceneTimeout: function (fn, delay) {
      return schedule("timeout", fn, delay, argsAfter(arguments, 2), scene);
    },
    sceneInterval: function (fn, delay) {
      return schedule("interval", fn, delay, argsAfter(arguments, 2), scene);
    },
    status: function () {
      return { state: state, paused: frozen(), reasons: Array.from(reasons), scene: scene,
        timers: timers.size, applications: apps.size, problems: Array.from(problems),
        audioContextState: w.Howler && w.Howler.ctx ? w.Howler.ctx.state : null,
        cssAnimationControl: typeof d.getAnimations === "function" };
    }
  };
  d.addEventListener("visibilitychange", function () {
    if (d.hidden) pause("visibility"); else resume("visibility");
  });
  w.addEventListener("pagehide", function () { pause("pagehide"); });
  w.addEventListener("pageshow", function () { resume("pagehide"); });
  if (d.hidden) pause("visibility");
})(window, document);
