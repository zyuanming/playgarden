/* SPDX-License-Identifier: GPL-3.0-only
 * Sandbox, persistence and lifecycle bridge for the retained MIT original.
 * The game still uses original loadLevel/loadDocs/writeCSS/compare/win.
 */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var session = params.get('session') || '';
  var parentOrigin = new URL(document.referrer || location.href).origin;
  var started = false, disposed = false, ending = false, earnedEnding = false, navigating = false;
  var hostPaused = false, localPaused = false, hidden = document.hidden;
  var generation = 0, inputTimer = null, advanceTimer = null, resizeTimer = null;
  var transition = null, correct = false, reported = false, lastHeight = 0;
  var resizeObserver;
  var allowedProperties = new Set(['justify-content', 'align-items', 'align-content', 'flex-direction', 'flex-wrap', 'flex-flow', 'order', 'align-self']);

  function send(type, data) {
    if (disposed) return;
    parent.postMessage(Object.assign({ source: 'playgarden-flexbox-froggy', session: session, type: type }, data || {}), parentOrigin);
  }
  function paused() { return hostPaused || localPaused || hidden; }
  function state() {
    return {
      level: game.level, answers: Object.assign({}, game.answers), solved: game.solved.slice(),
      colorblind: game.colorblind, language: game.language, difficulty: game.difficulty,
      ending: ending, earnedEnding: earnedEnding, phase: ending ? 'ending' : navigating ? 'navigating' : 'playing',
      paused: paused(), correct: correct
    };
  }
  function save() { if (started) send('snapshot', { state: state() }); }
  function result(text) { $('#result').text(text); send('status', { message: text }); }
  function invalidate() {
    generation++;
    clearTimeout(inputTimer); clearTimeout(advanceTimer); clearTimeout(resizeTimer);
    inputTimer = advanceTimer = resizeTimer = null;
    if (transition) { transition.skipTransition(); transition = null; }
    $('.frog').removeClass('animated bounceOutUp');
  }
  function height() {
    if (disposed) return;
    // Content children, not html/body scrollHeight, avoid iframe resize feedback.
    var value = Math.ceil(Math.max(document.getElementById('sidebar').getBoundingClientRect().bottom,
      document.getElementById('view').getBoundingClientRect().bottom) + scrollY + 4);
    if (value !== lastHeight) { lastHeight = value; send('height', { height: value }); }
  }
  function applyPause() {
    invalidate();
    document.body.classList.toggle('is-paused', paused());
    document.getElementById('paused-cover').hidden = !paused();
    document.getElementById('resume-game').disabled = hostPaused || hidden;
    $('#pause-game').text(localPaused ? '继续练习' : '暂停练习');
    $('#code').prop('disabled', paused());
    if (!paused() && started && !ending && !navigating) check();
    save();
  }
  function safeCSS(input) {
    var raw = String(input).slice(0, 4096).replace(/\/\*[\s\S]*?\*\//g, '');
    var styles = document.createElement('div').style;
    raw.split(';').forEach(function (declaration) {
      var colon = declaration.indexOf(':');
      if (colon < 0) return;
      var property = declaration.slice(0, colon).trim().toLowerCase();
      var value = declaration.slice(colon + 1).trim().toLowerCase();
      // Only actual flex properties are admitted. Values have no functions,
      // selectors, escapes, URLs, variables, custom properties or !important.
      if (!allowedProperties.has(property) || !/^[a-z0-9+\-\s]+$/.test(value)) return;
      if (CSS.supports(property, value)) styles.setProperty(property, value);
    });
    return styles.cssText;
  }
  async function check() {
    if (!started || disposed || paused() || ending || navigating) return false;
    invalidate();
    var token = generation, level = game.level, code = $('#code').val();
    correct = false;
    $('#next').removeClass('animated animation').addClass('disabled').attr('aria-disabled', 'true');
    function current() { return !disposed && !paused() && !ending && !navigating && token === generation && level === game.level && code === $('#code').val(); }
    function apply() { if (current()) game.applyStyles(); }
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        var active = document.startViewTransition(apply);
        transition = active;
        // skipTransition rejects ready independently of finished. Cancellation
        // is owned by this bridge and must not become an unhandled rejection.
        active.ready.catch(function () {});
        await active.finished;
        if (transition === active) transition = null;
      } catch (_) { if (current()) apply(); }
    } else apply();
    if (!current()) return false;
    // This is the upstream positional/color objective check, never a CSS text
    // matcher. Its multiset patch only prevents overlapping duplicate matches.
    correct = game.compare();
    $('#next').attr('aria-disabled', String(!correct));
    if (correct) {
      result('青蛙都落在同色荷叶上了！可以进入下一课。');
      if (!reported) { reported = true; save(); send('complete', { level: game.level }); }
    } else result('还没有全部对齐。试试另一种 Flexbox 布局；可以点击属性查看帮助。');
    save();
    return correct;
  }
  function navigate(index) {
    if (!Number.isInteger(index) || index < 0 || index >= levels.length || disposed || paused()) return;
    game.saveAnswer();
    invalidate();
    correct = false;
    ending = false;
    if (index === game.level) { navigating = false; game.loadLevel(levels[index]); return; }
    navigating = true;
    save();
    // Never switch the internal index first. The host owns the selected level,
    // completion attribution and keyed remount that acknowledges this request.
    send('navigate', { level: index });
  }
  function next() {
    if (disposed || paused() || ending || navigating || advanceTimer !== null) return;
    if (!correct || $('#next').hasClass('disabled')) { game.tryagain(); return; }
    game.saveAnswer();
    var token = generation, index = game.level, code = $('#code').val();
    $('#next').removeClass('animated animation').addClass('disabled').attr('aria-disabled', 'true');
    $('.frog').addClass('animated bounceOutUp');
    advanceTimer = setTimeout(function () {
      advanceTimer = null;
      if (disposed || paused() || navigating || token !== generation || index !== game.level || code !== $('#code').val()) return;
      if (index === levels.length - 1) {
        // A durable milestone, distinct from the currently displayed screen.
        // This is reached only by the real final layout check and Next action.
        earnedEnding = true;
        game.win();
        $('#ending-progress').text(game.solved.length === levels.length
          ? '24 / 24 课全部完成。完整课程已通关！'
          : '最后一课完成，已解开 ' + game.solved.length + ' / 24 课。还有未完成的课程可以复习。');
        save(); height(); send('ending', { solvedCount: game.solved.length, campaignComplete: game.solved.length === levels.length });
      } else game.next();
    }, 2000);
  }
  function retry() {
    if (disposed || paused() || navigating) return;
    invalidate();
    ending = false;
    game.answers[levels[game.level].name] = '';
    game.loadLevel(levels[game.level]);
    $('#code').trigger('focus');
    result('已清空本关草稿，重新试一试。已经解开的课程会保留。');
  }
  function setDifficulty() {
    $('#instructions').toggle(game.difficulty === 'easy');
    $('.level-marker').each(function () {
      var index = Number($(this).attr('data-level'));
      $(this).attr('title', game.difficulty === 'easy' ? levels[index].name : '第 ' + (index + 1) + ' 课');
    });
    height(); save();
  }
  function makeDocsAccessible() {
    $('#instructions code.help').attr({ role: 'button', tabindex: '0' }).on('click.playgarden', function () {
      // The upstream direct handler stops propagation; attach on that same
      // property element so newly created value controls receive keyboard roles.
      $('#instructions .tooltip code').attr({ tabindex: '0', role: 'button' });
      $('<button type="button" class="close-help">关闭帮助</button>').prependTo('#instructions .tooltip').on('click.playgarden', function (event) {
        event.stopPropagation();
        $('#instructions .tooltip').remove(); clickedCode = null; height();
      });
      height();
    }).on('keydown.playgarden', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $(this).trigger('click'); }
    });
  }
  var originalDocs = game.loadDocs;
  game.loadDocs = function () { originalDocs.call(game); makeDocsAccessible(); };

  game.bridge = {
    ending: function () { return ending; }, safeCSS: safeCSS, check: check, save: save, navigate: navigate,
    beforeLevel: function (data) { invalidate(); ending = data === levelWin; correct = false; navigating = false; },
    afterLevel: function () {
      if (ending) {
        // Keep the original victory paragraph and frog tableau. Following
        // paragraphs are promotional links, not a lesson or extra challenge.
        $('#instructions').children().slice(1).remove();
        $('#instructions').show();
      } else setDifficulty();
      $('#instructions a').each(function () { $(this).replaceWith(document.createTextNode($(this).text())); });
      height(); save();
    },
    debounce: function (callback, wait) {
      return function () {
        invalidate();
        var token = generation;
        inputTimer = setTimeout(function () { inputTimer = null; if (token === generation && !disposed && !paused()) callback(); }, wait);
      };
    },
    setHandlers: function () {
      $('#next').on('click.playgarden', next);
      $('#code').on('keydown.playgarden', function (event) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault(); check().then(function (ok) { if (ok) next(); });
        }
      }).on('input.playgarden', game.debounce(check, 500)).on('input.playgarden', function () {
        correct = false; game.changed = true;
        $('#next').removeClass('animated animation').addClass('disabled').attr('aria-disabled', 'true');
        game.saveAnswer(); result('正在编辑…只应用当前池塘的 Flexbox 属性。');
      });
      $('#editor').on('animationend.playgarden', function () { $(this).removeClass('animated shake'); });
      $('#pause-game').on('click.playgarden', function () { localPaused = !localPaused; applyPause(); });
      $('#resume-game').on('click.playgarden', function () { localPaused = false; applyPause(); });
      $('#retry-game').on('click.playgarden', retry);
      $('#labelSettings').on('click.playgarden', function (event) { event.stopPropagation(); $('#levelsWrapper').hide(); $('#settings .tooltip').toggle(); $('#instructions .tooltip').remove(); height(); });
      $('#language').on('change.playgarden', function () {
        var lang = $(this).val();
        if (!Object.prototype.hasOwnProperty.call(messages.languageActive, lang)) return;
        game.language = lang; game.translate(); game.bridge.afterLevel(); save();
      });
      $('#difficulty').on('change.playgarden', function () { game.difficulty = $('#difficulty input:checked').val(); setDifficulty(); });
      $('#colorblind').on('change.playgarden', function () {
        game.colorblind = $('#colorblind input:checked').val();
        $('.lilypad, .frog').toggleClass('cb-friendly', game.colorblind === 'true'); save();
      });
      $('#labelReset').on('click.playgarden', function () { $('#levelsWrapper').hide(); document.getElementById('reset-confirm').hidden = false; height(); });
      $('#reset-no').on('click.playgarden', function () { document.getElementById('reset-confirm').hidden = true; height(); });
      $('#reset-yes').on('click.playgarden', function () {
        if (paused()) return;
        invalidate(); game.answers = {}; game.solved = []; ending = false; earnedEnding = false; reported = false;
        $('#code').val(''); $('.level-marker').removeClass('solved');
        document.getElementById('reset-confirm').hidden = true; save(); navigate(0);
      });
      $('#return-final').on('click.playgarden', function () { navigate(game.level); });
      $('#review-lessons').on('click.playgarden', function (event) { event.stopPropagation(); $('#levelsWrapper').show(); height(); });
      $('body').on('click.playgarden', function () { $('.tooltip').hide(); clickedCode = null; height(); });
      $('.tooltip, #level-indicator').on('click.playgarden', function (event) { event.stopPropagation(); });
      $('#instructions').on('keydown.playgarden', '.tooltip code', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $(this).trigger('click'); }
      });
    }
  };

  function receive(event) {
    var data = event.data;
    if (event.source !== parent || event.origin !== parentOrigin || !data || data.source !== 'playgarden-host' || data.session !== session || disposed) return;
    if (data.type === 'init' && !started) {
      if (!Number.isInteger(data.level) || data.level < 0 || data.level >= levels.length) return;
      var saved = data.state || {}, names = levels.map(function (level) { return level.name; });
      game.level = data.level;
      game.answers = {};
      names.forEach(function (name) { if (saved.answers && typeof saved.answers[name] === 'string') game.answers[name] = saved.answers[name].slice(0, 4096); });
      game.solved = Array.isArray(saved.solved) ? names.filter(function (name) { return saved.solved.includes(name); }) : [];
      earnedEnding = saved.earnedEnding === true && game.solved.includes(names[23]);
      game.colorblind = saved.colorblind === 'true' ? 'true' : 'false';
      game.language = Object.prototype.hasOwnProperty.call(messages.languageActive, saved.language) ? saved.language : 'zh-cn';
      game.difficulty = ['easy', 'medium', 'hard'].includes(saved.difficulty) ? saved.difficulty : 'easy';
      if (data.freshStart) game.answers[names[game.level]] = '';
      Object.keys(messages.languageActive).forEach(function (lang) { $('<option/>').attr('value', lang).text(messages.languageActive[lang]).appendTo('#language'); });
      hostPaused = !!data.paused;
      started = true; game.start();
      $('#difficulty input[value="' + game.difficulty + '"]').prop('checked', true);
      if (!data.freshStart && earnedEnding && game.level === 23) {
        game.win(); $('#ending-progress').text(game.solved.length === 24 ? '24 / 24 课全部完成。完整课程已通关！' : '最后一课完成，已解开 ' + game.solved.length + ' / 24 课。');
      }
      if (paused()) applyPause();
      resizeObserver = new ResizeObserver(height);
      resizeObserver.observe(document.getElementById('sidebar')); resizeObserver.observe(document.getElementById('view'));
      height(); save(); send('ready', { revision: 'flexbox-froggy-9a6feab-playgarden-1', levelCount: levels.length });
    } else if (data.type === 'navigation-denied' && started) { navigating = false; check(); }
    else if (data.type === 'pause') { hostPaused = !!data.paused; if (started) applyPause(); }
    else if (data.type === 'hint' && started && !ending && !paused()) {
      if (game.difficulty !== 'easy') { game.difficulty = 'easy'; $('#difficulty input[value="easy"]').prop('checked', true); setDifficulty(); }
      $('#instructions code.help').first().trigger('click');
      result('看清楚本关修改的是池塘还是指定颜色的青蛙。点击属性帮助中的值，可以填入 CSS。');
    } else if (data.type === 'dispose') dispose();
  }
  function visibility() { hidden = document.hidden; if (started) applyPause(); }
  function resized() {
    if (!started || disposed) return;
    height(); invalidate();
    var token = generation;
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
