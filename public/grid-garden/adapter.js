/* SPDX-License-Identifier: GPL-3.0-only
 * Isolated lifecycle/persistence bridge around Thomas Park's retained MIT game.
 * Layout, original target classes, rectangle/color checker and artwork remain.
 */
(function () {
  'use strict';
  var session = new URLSearchParams(location.search).get('session') || '';
  var parentOrigin = new URL(document.referrer || location.href).origin;
  var started = false, disposed = false, ending = false, earnedEnding = false, navigating = false;
  var hostPaused = false, localPaused = false, hidden = document.hidden;
  var generation = 0, inputTimer = null, advanceTimer = null, resizeTimer = null, fade = null;
  var wasPaused = false;
  var correct = false, reported = false, lastHeight = 0, resizeObserver;
  var allowedProperties = new Set(['grid-column-start', 'grid-column-end', 'grid-column', 'grid-row-start', 'grid-row-end', 'grid-row', 'grid-area', 'order', 'grid-template-columns', 'grid-template-rows', 'grid-template']);

  function send(type, data) {
    if (!disposed) parent.postMessage(Object.assign({ source: 'playgarden-grid-garden', session: session, type: type }, data || {}), parentOrigin);
  }
  function paused() { return hostPaused || localPaused || hidden; }
  function state() {
    return { level: game.level, answers: Object.assign({}, game.answers), solved: game.solved.slice(), language: game.language,
      ending: ending, earnedEnding: earnedEnding, phase: ending ? 'ending' : (navigating || advanceTimer !== null) ? 'navigating' : 'playing', paused: paused(), correct: correct };
  }
  function save() { if (started) send('snapshot', { state: state() }); }
  function result(text) { $('#result').text(text); send('status', { message: text }); }
  function startTimer(task) {
    task.due = performance.now() + task.remaining;
    task.timer = setTimeout(function () { task.timer = null; task.run(); }, task.remaining);
  }
  function schedule(run, delay) {
    var task = { run: run, remaining: delay, due: 0, timer: null };
    startTimer(task); return task;
  }
  function cancelTimer(task) { if (task) clearTimeout(task.timer); }
  function pauseTimer(task) {
    if (!task || task.timer === null) return;
    task.remaining = Math.max(0, task.due - performance.now());
    clearTimeout(task.timer); task.timer = null;
  }
  function resumeTimer(task) { if (task && task.timer === null) startTimer(task); }
  function startFade(task) {
    task.due = performance.now() + task.remaining;
    $('.treatment').fadeOut(task.remaining, 'linear', function () {
      if (!disposed && !paused() && generation === task.token) { $('.plant').addClass('correct'); if (fade === task) fade = null; }
    });
  }
  function invalidate() {
    generation++;
    cancelTimer(inputTimer); cancelTimer(advanceTimer); clearTimeout(resizeTimer);
    inputTimer = advanceTimer = resizeTimer = null; fade = null;
    // Navigation/new input/disposal cancels the actual jQuery queue and callbacks.
    $('.treatment').stop(true, false).css('opacity', '').show();
    $('.plant').removeClass('correct'); $('#editor').removeClass('animated shake');
  }
  function height() {
    if (disposed) return;
    var value = Math.ceil(Math.max(document.getElementById('sidebar').getBoundingClientRect().bottom,
      document.getElementById('view').getBoundingClientRect().bottom) + scrollY + 4);
    if (value !== lastHeight) { lastHeight = value; send('height', { height: value }); }
  }
  function applyPause() {
    var nowPaused = paused();
    if (nowPaused && !wasPaused) {
      // The iframe is taller than the phone viewport. Keep Resume by the
      // control the player just reached, in the ordinary scrollable document.
      var pauseTop = document.getElementById('pause-game').getBoundingClientRect().top + scrollY;
      document.getElementById('paused-cover').style.setProperty('--pause-top', Math.max(12, pauseTop - 36) + 'px');
      pauseTimer(inputTimer); pauseTimer(advanceTimer);
      clearTimeout(resizeTimer); resizeTimer = null;
      if (fade) {
        fade.remaining = Math.max(0, fade.due - performance.now());
        $('.treatment').stop(true, false);
      }
    }
    document.body.classList.toggle('is-paused', nowPaused);
    document.getElementById('paused-cover').hidden = !nowPaused;
    document.getElementById('resume-game').disabled = hostPaused || hidden;
    $('#pause-game').text(localPaused ? '继续练习' : '暂停练习');
    $('#code').prop('disabled', nowPaused); $('#sidebar').prop('inert', nowPaused);
    if (!nowPaused && wasPaused) {
      if (fade) startFade(fade);
      resumeTimer(inputTimer); resumeTimer(advanceTimer);
      if (!inputTimer && !advanceTimer && started && !ending && !navigating) check();
    }
    wasPaused = nowPaused; save();
  }
  function safeCSS(input) {
    var raw = String(input).slice(0, 4096).replace(/\/\*[\s\S]*?\*\//g, '');
    var styles = document.createElement('div').style;
    raw.split(';').forEach(function (declaration) {
      var colon = declaration.indexOf(':');
      if (colon < 0) return;
      var property = declaration.slice(0, colon).trim().toLowerCase();
      var value = declaration.slice(colon + 1).trim().toLowerCase();
      // Admit grid declarations, numeric tracks, spans and grid sizing functions.
      // No selectors, escapes, URLs, custom properties, variables or !important.
      if (!allowedProperties.has(property) || !/^[a-z0-9+\-.\s%/,()*\[\]]+$/.test(value)) return;
      var functions = value.match(/[a-z-]+\s*\(/g) || [];
      if (functions.some(function (name) { return !/^(repeat|minmax|fit-content|calc)\s*\($/.test(name); })) return;
      if (CSS.supports(property, value)) styles.setProperty(property, value);
    });
    return styles.cssText;
  }
  function check() {
    if (!started || disposed || paused() || ending || navigating) return false;
    invalidate(); correct = false;
    $('#next').removeClass('animated animation').addClass('disabled').attr('aria-disabled', 'true');
    game.applyStyles();
    // Retained upstream computed rectangle, width, height and color validation.
    correct = game.compare();
    $('#next').attr('aria-disabled', String(!correct));
    if (correct) {
      // Resize/resume rechecks must retain the truthful final-course status.
      result(game.level === levels.length - 1 && game.solved.length < levels.length
        ? '已解开 ' + game.solved.length + ' / 28 课。请继续完成其他课程。'
        : '水和除草区域都覆盖正确了！可以进入下一课。');
      if (!reported) { reported = true; save(); send('complete', { level: game.level }); }
    } else result('还没有全部覆盖正确。试试另一种网格布局；点击属性可查看帮助。');
    save(); return correct;
  }
  function navigate(index) {
    if (!Number.isInteger(index) || index < 0 || index >= levels.length || disposed || paused()) return;
    game.saveAnswer(); invalidate(); correct = false; ending = false;
    if (index === game.level) { navigating = false; game.loadLevel(levels[index]); return; }
    navigating = true; save(); send('navigate', { level: index });
  }
  function showEnding() {
    if (game.solved.length !== levels.length) return;
    earnedEnding = true; game.win();
    $('#ending-progress').text('28 / 28 课全部完成。完整课程已通关！');
    result('28 课全部完成！网格花园迎来了收获。');
    save(); height(); send('ending', { solvedCount: levels.length, campaignComplete: true });
  }
  function next() {
    if (disposed || paused() || ending || navigating || advanceTimer !== null) return;
    if (!correct || $('#next').hasClass('disabled')) { game.tryagain(); return; }
    game.saveAnswer();
    var token = generation, index = game.level, code = $('#code').val();
    $('#next').removeClass('animated animation').addClass('disabled').attr('aria-disabled', 'true');
    fade = { token: token, remaining: 1000, due: 0 }; startFade(fade);
    advanceTimer = schedule(function () {
      advanceTimer = null;
      if (disposed || paused() || navigating || token !== generation || index !== game.level || code !== $('#code').val()) return;
      if (index === levels.length - 1) {
        if (game.solved.length === levels.length) showEnding();
        else {
          invalidate(); check(); $('#levelsWrapper').show();
          result('已解开 ' + game.solved.length + ' / 28 课。请继续完成其他课程。'); height();
        }
      } else game.next();
    }, 2500);
    save();
  }
  function retry() {
    if (disposed || paused() || navigating) return;
    invalidate(); ending = false;
    game.answers[levels[game.level].name] = '';
    game.loadLevel(levels[game.level]); $('#code').trigger('focus');
    result('已清空本关草稿，重新试一试。已经解开的课程会保留。');
  }
  function stripLinks(container) {
    $(container).find('a').each(function () { $(this).replaceWith(document.createTextNode($(this).text())); });
  }
  function loadDocs() {
    $('#instructions code').each(function () {
      var code = $(this), property = code.text();
      if (!Object.prototype.hasOwnProperty.call(docs, property)) return;
      code.addClass('help').attr({ role: 'button', tabindex: '0', 'aria-expanded': 'false' });
      code.on('click.playgarden', function (event) {
        event.stopPropagation();
        var wasOpen = code.attr('aria-expanded') === 'true';
        $('#instructions .tooltip').remove(); $('#instructions .help').attr('aria-expanded', 'false');
        if (!wasOpen) {
          var panel = $('<div class="tooltip" role="region"/>').attr('aria-label', property + ' 帮助').html(docs[property][game.language] || docs[property].en);
          stripLinks(panel);
          $('<button type="button" class="close-help">关闭帮助</button>').prependTo(panel).on('click.playgarden', function (closeEvent) {
            closeEvent.stopPropagation(); panel.remove(); code.attr('aria-expanded', 'false').trigger('focus'); height();
          });
          panel.appendTo('#instructions'); code.attr('aria-expanded', 'true');
        }
        height();
      }).on('keydown.playgarden', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $(this).trigger('click'); }
      });
    });
  }
  game.bridge = {
    ending: function () { return ending; }, safeCSS: safeCSS, check: check, save: save, navigate: navigate, loadDocs: loadDocs,
    beforeLevel: function (data) { invalidate(); ending = data === levelWin; correct = false; navigating = false; },
    afterLevel: function () {
      if (ending) $('#instructions').children().slice(1).remove();
      stripLinks('#instructions'); height(); save();
    },
    debounce: function (callback, wait) {
      return function () {
        invalidate(); var token = generation;
        inputTimer = schedule(function () { inputTimer = null; if (token === generation && !disposed && !paused()) callback(); }, wait);
      };
    },
    setHandlers: function () {
      $('#next').on('click.playgarden', next);
      $('#code').on('keydown.playgarden', function (event) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); if (check()) next(); }
      }).on('input.playgarden', game.debounce(check, 200)).on('input.playgarden', function () {
        correct = false; game.changed = true;
        $('#next').removeClass('animated animation').addClass('disabled').attr('aria-disabled', 'true');
        game.saveAnswer(); result('正在编辑…只应用当前区域的 CSS Grid 属性。');
      });
      $('#editor').on('animationend.playgarden', function () { $(this).removeClass('animated shake'); });
      $('#pause-game').on('click.playgarden', function () { localPaused = !localPaused; applyPause(); });
      $('#resume-game').on('click.playgarden', function () { localPaused = false; applyPause(); });
      $('#retry-game').on('click.playgarden', retry);
      $('#language').on('change.playgarden', function () {
        var lang = $(this).val();
        if (!Object.prototype.hasOwnProperty.call(messages.languageActive, lang) || paused()) return;
        game.language = lang; game.translate(); game.bridge.afterLevel(); save();
      });
      $('#return-final').on('click.playgarden', function () { navigate(game.level); });
      $('#review-lessons').on('click.playgarden', function () { $('#levelsWrapper').toggle(); height(); });
      $('#level-indicator').on('click.playgarden', function () { height(); });
    }
  };

  function receive(event) {
    var data = event.data;
    if (event.source !== parent || event.origin !== parentOrigin || !data || data.source !== 'playgarden-host' || data.session !== session || disposed) return;
    if (data.type === 'init' && !started) {
      if (!Number.isInteger(data.level) || data.level < 0 || data.level >= levels.length) return;
      var saved = data.state || {}, names = levels.map(function (level) { return level.name; });
      game.level = data.level; game.answers = {};
      names.forEach(function (name) { if (saved.answers && typeof saved.answers[name] === 'string') game.answers[name] = saved.answers[name].slice(0, 4096); });
      game.solved = Array.isArray(saved.solved) ? names.filter(function (name) { return saved.solved.includes(name); }) : [];
      earnedEnding = saved.earnedEnding === true && game.solved.length === levels.length;
      game.language = Object.prototype.hasOwnProperty.call(messages.languageActive, saved.language) ? saved.language : 'zh-cn';
      if (data.freshStart) game.answers[names[game.level]] = '';
      Object.keys(messages.languageActive).forEach(function (lang) { $('<option/>').attr('value', lang).text(messages.languageActive[lang]).appendTo('#language'); });
      $('#language').val(game.language);
      hostPaused = !!data.paused; started = true; game.start();
      if (!data.freshStart && earnedEnding && game.level === levels.length - 1) showEnding();
      if (paused()) applyPause();
      resizeObserver = new ResizeObserver(height);
      resizeObserver.observe(document.getElementById('sidebar')); resizeObserver.observe(document.getElementById('view'));
      height(); save(); send('ready', { revision: 'grid-garden-0e262f7-playgarden-1', levelCount: levels.length });
    } else if (data.type === 'navigation-denied' && started) { navigating = false; check(); }
    else if (data.type === 'pause') { hostPaused = !!data.paused; if (started) applyPause(); }
    else if (data.type === 'hint' && started && !ending && !paused()) {
      $('#instructions code.help').first().trigger('click'); result('看清楚本关修改的是水域、除草区域还是整个网格。点击属性名称查看帮助。');
    } else if (data.type === 'dispose') dispose();
  }
  function visibility() { hidden = document.hidden; if (started) applyPause(); }
  function resized() {
    if (!started || disposed) return;
    height();
    if (paused() || advanceTimer !== null) return;
    invalidate(); var token = generation;
    resizeTimer = setTimeout(function () { resizeTimer = null; if (token === generation && !paused() && !ending && !navigating) check(); }, 180);
  }
  function dispose() {
    if (disposed) return;
    if (started) { game.saveAnswer(); save(); }
    disposed = true; invalidate();
    if (resizeObserver) resizeObserver.disconnect();
    $(window).off(); $(document).off(); $('body, body *').off();
    window.removeEventListener('message', receive); window.removeEventListener('resize', resized);
    document.removeEventListener('visibilitychange', visibility);
  }
  window.addEventListener('message', receive);
  window.addEventListener('resize', resized);
  window.addEventListener('pagehide', dispose, { once: true });
  document.addEventListener('visibilitychange', visibility);
  send('hello');
}());
