/* SPDX-License-Identifier: GPL-3.0-only
 * Standalone Playgarden lifecycle bridge. Original renderer/checker: js/restaurant.js (MPL-2.0).
 * Selector text is passed only to the original table-scoped jQuery/Sizzle matcher, never evaluated.
 */
(function () {
  'use strict';
  var session = new URLSearchParams(location.search).get('session');
  if (!session || !/^[a-zA-Z0-9-]{16,80}$/.test(session) || parent === window) return;
  var parentOrigin;
  try { parentOrigin = new URL(document.referrer).origin; } catch (_) { return; }
  var started = false, loaded = false, disposed = false, generation = 0;
  var hostPaused = false, localPaused = false, hidden = document.hidden;
  var phase = 'loading', earnedEnding = false, finalEnding = false, drafts = {}, reported = false;
  var pending = new Set(), observer, lastHeight = 0;
  var revision = 'css-diner-566aaa0-playgarden-2';
  function paused() { return hostPaused || localPaused || hidden; }
  function send(type, extra) {
    if (!disposed) parent.postMessage(Object.assign({ source: 'playgarden-css-diner', session: session, type: type }, extra || {}), parentOrigin);
  }
  function arm(task) {
    if (disposed || paused() || task.id !== null) return;
    task.at = performance.now();
    task.id = setTimeout(function () {
      task.id = null; pending.delete(task);
      if (!disposed && !paused() && task.generation === generation) task.callback();
    }, task.remaining);
  }
  function schedule(callback, delay) {
    var task = { callback: callback, remaining: delay, at: 0, id: null, generation: generation };
    pending.add(task); arm(task); return task;
  }
  function cancelWork() {
    generation++;
    pending.forEach(function (task) { if (task.id !== null) clearTimeout(task.id); });
    pending.clear();
  }
  function height() {
    if (!started || disposed) return;
    var value = Math.ceil(Math.max(document.querySelector('.left-col').getBoundingClientRect().bottom,
      document.querySelector('.right-col').getBoundingClientRect().bottom) + scrollY + 12);
    if (value !== lastHeight) { lastHeight = value; send('height', { height: value }); }
  }
  function state() {
    return { drafts: drafts, guessHistory: progress.guessHistory, currentLevel: currentLevel,
      earnedEnding: earnedEnding, finalEnding: finalEnding, ending: finished, phase: phase, paused: paused(), solvedCount: progress.totalCorrect };
  }
  function save() { if (started && !disposed) send('snapshot', { state: state() }); }
  function result(message) { $('#result').text(message); send('status', { message: message }); height(); }
  function controls() {
    $('#selector,.enter-button').prop('disabled', paused() || phase !== 'playing');
    $('.level-nav button,.levels button,#retry-game,#retry-final,.reset-progress').prop('disabled', paused() || phase === 'navigating');
    $('.level-nav .previous').prop('disabled', paused() || phase === 'navigating' || currentLevel === 0);
    $('.level-nav .next').prop('disabled', paused() || phase === 'navigating' || currentLevel === 31);
  }
  function applyPause() {
    if (!started || disposed) return;
    if (paused()) {
      pending.forEach(function (task) {
        if (task.id !== null) {
          clearTimeout(task.id); task.id = null;
          task.remaining = Math.max(0, task.remaining - (performance.now() - task.at));
        }
      });
    } else pending.forEach(arm);
    document.body.classList.toggle('is-paused', paused());
    document.getElementById('paused-cover').hidden = !paused();
    $('#resume-game').prop('disabled', hostPaused || hidden);
    $('#pause-game').text(localPaused ? '继续练习' : '暂停练习');
    document.querySelector('.left-col').inert = paused();
    document.querySelector('.right-col').inert = paused();
    controls(); save(); height();
    if (localPaused && !hostPaused && !hidden) document.getElementById('paused-cover').scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function ready() {
    if (!loaded || disposed) return;
    send('ready', { revision: revision, levelCount: 32 }); save(); height();
  }
  function navigate(index) {
    if (disposed || paused() || !started || phase === 'navigating' || !Number.isInteger(index) || index < 0 || index >= 32) return;
    drafts[currentLevel] = String($('#selector').val() || '').slice(0, 1024);
    cancelWork(); hideTooltip();
    if (index === currentLevel) { loadLevel(); return; }
    phase = 'navigating'; controls(); save();
    send('navigate', { level: index, fromLevel: currentLevel });
  }
  function ending() {
    cancelWork(); earnedEnding = true; finalEnding = true; phase = 'ending'; winGame();
    $('.table-wrapper,.table-edge').css('opacity', 1);
    $('.editor').hide(); document.getElementById('ending').hidden = false;
    $('#ending-progress').text(progress.totalCorrect === 32 ? '32 / 32 道谜题全部完成！完整课程已通关。' : '最后一关完成。已经解开 ' + progress.totalCorrect + ' / 32 道谜题，可以继续挑战未完成的关卡。');
    result('你做到了！' + $('#ending-progress').text()); controls(); save(); height();
    send('ending', { solvedCount: progress.totalCorrect, campaignComplete: progress.totalCorrect === 32 });
  }
  function retry() {
    if (paused() || disposed || phase === 'navigating') return;
    drafts[currentLevel] = ''; loadLevel(); result('已清空本关草稿。已经获得的完成记录会保留。');
  }
  function localize() {
    var copy = dinerChinese[currentLevel];
    // Keep all original English help/examples available, including their formatting.
    $('#original-help-content').empty().append($('<h3/>').text(level.helpTitle || 'Practice'))
      .append($('<div/>').html(level.help || ''));
    (level.examples || []).forEach(function (example) { $('#original-help-content').append($('<p/>').html(example)); });
    $('.order').text(copy[0]); $('.display-help .selector-name').text(copy[1]);
    $('.display-help .title').text(copy[2]); $('.display-help .hint').text(copy[3]);
    $('.display-help .examples').empty();
    copy[4].forEach(function (example) { $('.display-help .examples').append($('<p/>').text(example)); });
    $('.display-help .examples-title').toggle(copy[4].length > 0);
    if (currentLevel === 7) $('.display-help .syntax').text('把前面学到的选择器组合起来');
    $('#original-help').prop('open', false);
    $('.note-toggle').show();
  }
  window.dinerBridge = {
    schedule: schedule, save: save, height: height, navigate: navigate,
    canPlay: function () { return started && !disposed && !paused() && phase === 'playing' && !finished; },
    beforeLevel: function () {
      cancelWork(); phase = 'loading'; reported = false;
      // This is the final puzzle's current view, distinct from having earned
      // its ending in the past. Other puzzles never overwrite that view.
      if (currentLevel === 31) finalEnding = false;
      document.getElementById('ending').hidden = true; $('.editor').show();
      $('.note').hide(); hideTooltip(); controls();
    },
    afterLevel: function () {
      localize(); $('#selector').val(drafts[currentLevel] || '');
      // Focusable markup adds no attributes or nodes to the authored table.
      $('.markup > div *').attr({ tabindex: '0', role: 'button', 'aria-label': '查看这个 HTML 元素' });
      $('.levels button').each(function (index) { $(this).attr('aria-current', index === currentLevel ? 'step' : null); });
      controls(); height(); save();
    },
    levelReady: function () {
      if (disposed) return;
      loaded = true; phase = 'playing'; controls();
      result('选中全部金色目标，且不要多选。输入选择器后按 Enter。'); ready();
    },
    checked: function (correct) {
      phase = correct ? 'correct' : 'incorrect'; controls();
      if (correct) {
        drafts[currentLevel] = '';
        result('选得完全正确！正在收走菜品…'); save();
        if (!reported) { reported = true; send('complete', { level: currentLevel }); }
        if (currentLevel === 31) ending();
        else schedule(function () { navigate(currentLevel + 1); }, levelTimeout);
      } else { result('还不对：需要选中全部目标，并且不能多选。'); save(); }
    },
    feedbackDone: function () { phase = 'playing'; controls(); save(); },
    confirmReset: function () { if (!paused()) { document.getElementById('reset-confirm').hidden = false; height(); } },
    reset: function () {
      cancelWork(); drafts = {}; earnedEnding = false; finalEnding = false; reported = false; phase = 'playing';
      $('#selector').val(''); document.getElementById('reset-confirm').hidden = true; save();
      if (currentLevel === 0) loadLevel(); else navigate(0);
    }
  };
  function restore(value) {
    var data = value && typeof value === 'object' ? value : {};
    progress = freshProgress(); drafts = {};
    for (var index = 0; index < 32; index++) {
      if (data.drafts && typeof data.drafts[index] === 'string') drafts[index] = data.drafts[index].slice(0, 1024);
      var record = data.guessHistory && data.guessHistory[index];
      if (record && typeof record === 'object') {
        var correct = record.correct === true;
        progress.guessHistory[index] = { correct: correct, incorrectCount: Number.isInteger(record.incorrectCount) ? Math.max(0, Math.min(10000, record.incorrectCount)) : 0, gaSent: false };
        if (correct) progress.totalCorrect++;
      }
    }
    progress.percentComplete = progress.totalCorrect / 32;
    earnedEnding = data.earnedEnding === true && checkCompleted(31);
    finalEnding = earnedEnding && (data.finalEnding === true ||
      (data.finalEnding === undefined && data.ending === true && data.currentLevel === 31));
  }
  function bind() {
    // A fixed cover would center its resume button inside the tall iframe,
    // beyond a phone viewport. Keep the resume panel outside the inert columns.
    $('#paused-cover').insertBefore('.left-col');
    $('#selector').on('input.playgarden', function () { drafts[currentLevel] = String($(this).val()).slice(0, 1024); save(); });
    // Replace optional note animation with a synchronous, height-observable toggle.
    $('.note-toggle').off('click').on('click.playgarden', function () { $('.note').toggle(); height(); });
    $('#close-note').on('click.playgarden', function () { $('.note').hide(); height(); });
    $('.editor').off('click');
    // The iframe grows with its content; a fixed bottom would put help far
    // below the phone viewport. Keep the original label beside its active UI.
    $('.helper').insertAfter('.game-scroll');
    // Retain clicked/touched labels until the next selection or board load.
    // Original mouseout would otherwise hide one when scrolling it into view.
    $('.table,.markup').off('mouseover mouseout');
    $('.table').on('mouseover.playgarden click.playgarden', '*', function (event) {
      if (paused()) return; event.stopPropagation();
      $('.helper').insertAfter('.game-scroll'); hideTooltip(); showTooltip($(this)); height();
      if (event.type === 'click') document.querySelector('.helper').scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    $('.markup').on('mouseover.playgarden focusin.playgarden click.playgarden', '> div *', function (event) {
      if (paused()) return; event.stopPropagation();
      $('.helper').insertAfter('.html-view .file-window');
      var index = $('.markup > div *').index(this); hideTooltip(); showTooltip($('.table *').eq(index)); height();
      if (event.type === 'click' || event.type === 'focusin') {
        document.querySelector('.helper').scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }).on('keydown.playgarden', '[role=button]', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $(this).trigger('click'); } });
    $('#pause-game').on('click.playgarden', function () { localPaused = true; applyPause(); $('#resume-game').trigger('focus'); });
    $('#resume-game').on('click.playgarden', function () { localPaused = false; applyPause(); });
    $('#retry-game,#retry-final').on('click.playgarden', retry);
    $('#review-game').on('click.playgarden', openMenu);
    $('#reset-no').on('click.playgarden', function () { document.getElementById('reset-confirm').hidden = true; height(); });
    $('#reset-yes').on('click.playgarden', function () { if (!paused()) resetProgress(); });
    $('#original-help').on('toggle.playgarden', height);
  }
  function receive(event) {
    var data = event.data;
    if (disposed || event.source !== parent || event.origin !== parentOrigin || !data || data.source !== 'playgarden-host' || data.session !== session) return;
    if (data.type === 'init') {
      if (started) { ready(); return; }
      if (!Number.isInteger(data.level) || data.level < 0 || data.level >= 32) return;
      restore(data.state); currentLevel = data.level; hostPaused = data.paused === true;
      var restoreFinalEnding = !data.freshStart && finalEnding && currentLevel === 31;
      if (data.freshStart) { drafts[currentLevel] = ''; if (currentLevel === 31) finalEnding = false; }
      started = true; startDiner(); bind(); loaded = true; controls();
      if (restoreFinalEnding) {
        // Initialize the real final board, heading, menu marker and both help
        // languages first. ending() then cancels its pending highlight timer.
        // Restoring a view does not send a new completion event.
        loadLevel(); ending();
      }
      if (paused()) applyPause();
      observer = new ResizeObserver(height); observer.observe(document.querySelector('.left-col')); observer.observe(document.querySelector('.right-col'));
      ready();
    } else if (data.type === 'pause') { hostPaused = data.paused === true; applyPause(); }
    else if (data.type === 'navigation-denied' && started) { loadLevel(); result('请使用顶部关卡选择继续。'); }
    else if (data.type === 'hint' && started && !paused() && !finished) { $('.note').show(); result(dinerChinese[currentLevel][3]); height(); }
    else if (data.type === 'dispose') dispose();
  }
  function visibility() { hidden = document.hidden; applyPause(); }
  function dispose() {
    if (disposed) return;
    if (started) save(); disposed = true; cancelWork();
    if (observer) observer.disconnect();
    $(window).off(); $(document).off(); $('body,body *').off().stop(true, true);
    window.removeEventListener('message', receive); window.removeEventListener('resize', height);
    document.removeEventListener('visibilitychange', visibility);
  }
  window.addEventListener('message', receive);
  window.addEventListener('resize', height);
  window.addEventListener('pagehide', dispose, { once: true });
  document.addEventListener('visibilitychange', visibility);
  send('hello');
}());
