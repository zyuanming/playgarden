// Original Grid Garden by Thomas Park, MIT. Lifecycle seams: vendor CHANGES.md.
var game = {
  language: 'zh-cn',
  level: 0,
  answers: {},
  solved: [],
  changed: false,

  start: function() {
    game.translate();

    $('#level-counter .total').text(levels.length);
    $('#editor').show();
    $('#share').hide();

    this.setHandlers();
    this.loadMenu();
    game.loadLevel(levels[game.level]);
  },

  setHandlers: function() { game.bridge.setHandlers(); },

  prev: function() { game.bridge.navigate(game.level - 1); },

  next: function() { game.bridge.navigate(game.level + 1); },

  loadMenu: function() {
    levels.forEach(function(level, i) {
      var levelMarker = $('<button type="button"/>').addClass('level-marker').attr({'data-level': i, 'title': level.name}).text(i+1);

      if ($.inArray(level.name, game.solved) !== -1) {
        levelMarker.addClass('solved');
      }

      levelMarker.appendTo('#levels');
    });

    $('.level-marker').on('click', function() {
      game.saveAnswer();

      var level = $(this).attr('data-level');
      game.bridge.navigate(parseInt(level, 10));
    });

    $('#level-indicator').on('click', function() {
      $('#language .tooltip').hide();
      $('#levelsWrapper').toggle();
    });

    $('.arrow.left').on('click', function() {
      if ($(this).hasClass('disabled')) {
        return;
      }

      game.saveAnswer();
      game.prev();
    });

    $('.arrow.right').on('click', function() {
      if ($(this).hasClass('disabled')) {
        return;
      }

      game.saveAnswer();
      game.next();
    });
  },

  loadLevel: function(level) {
    game.bridge.beforeLevel(level);
    $('#editor').show();
    $('#share').hide();
    $('#plants, #garden').removeClass().attr('style', '').empty();
    $('#soil, #overlay').removeClass().attr('style', '');
    $('#levelsWrapper').hide();
    $('.level-marker').removeClass('current').eq(this.level).addClass('current');
    $('#level-counter .current').text(this.level + 1);
    $('#before').text(level.before);
    $('#after').text(level.after);
    $('#next').removeClass('animated animation').addClass('disabled');

    var instructions = level.instructions[game.language] || level.instructions.en;
    $('#instructions').html(instructions);

    $('.arrow.disabled').removeClass('disabled');

    if (this.level === 0) {
      $('.arrow.left').addClass('disabled');
    }

    if (this.level === levels.length - 1) {
      $('.arrow.right').addClass('disabled');
    }

    var answer = game.answers[level.name];
    $('#code').val(answer || '');

    this.loadDocs();

    var lines = Object.keys(level.style).length;
    $('#code').height(20 * lines).data("lines", lines);

    var string = level.board;
    var markup = '';
    var colors = {
      'c': 'carrot',
      'w': 'weed'
    };

    for (var i = 0; i < string.length; i++) {
      var c = string.charAt(i);
      var color = colors[c];

      var plant = $('<div/>').addClass('plant ' + color).data('color', color);
      var treatment = $('<div/>').addClass('treatment ' + color).data('color', color);

      $('<div/>').addClass('bg').appendTo(plant);
      $('<div/>').addClass('bg').appendTo(treatment);

      $('#plants').append(plant);
      $('#garden').append(treatment);
    }

    var classes = level.classes;

    if (classes) {
      for (var rule in classes) {
        $(rule).addClass(classes[rule]);
      }
    }

    var selector = level.selector || '';
    $('#plants ' + selector).css(level.style);

    game.changed = false;
    game.applyStyles();
    game.check();
    game.bridge.afterLevel();
  },

  loadDocs: function() { game.bridge.loadDocs(); },

  applyStyles: function() {
    if (game.bridge.ending()) return;
    var level = levels[game.level];
    var code = game.bridge.safeCSS($('#code').val());
    var selector = level.selector || '';
    $('#garden ' +  selector).attr('style', code);

    if (!selector) {
      if (code) {
        $('#soil, #overlay').attr('style', code);
      } else {
        $('#soil, #overlay').attr('style', '');
      }
    }

    game.saveAnswer();
  },
  
  check: function() { return game.bridge.check(); },

  compare: function() {

    var level = levels[game.level];
    var treatments = {};
    var correct = true;

    $('.treatment').each(function() {
      var position = {};

      position.top = Math.round(this.getBoundingClientRect().top);
      position.left = Math.round(this.getBoundingClientRect().left);
      position.width = Math.floor(parseFloat(window.getComputedStyle(this).width));
      position.height = Math.floor(parseFloat(window.getComputedStyle(this).height));

      var key = JSON.stringify(position);
      var val = $(this).data('color');
      key += ":" + val;
      treatments[key] = (treatments[key] || 0) + 1;
    });

    $('.plant').each(function() {
      var position = {};

      position.top = Math.round(this.getBoundingClientRect().top);
      position.left = Math.round(this.getBoundingClientRect().left);
      position.width = Math.floor(parseFloat(window.getComputedStyle(this).width));
      position.height = Math.floor(parseFloat(window.getComputedStyle(this).height));

      var key = JSON.stringify(position);
      var val = $(this).data('color');

      key += ":" + val;
      if (!treatments[key]) correct = false;
      else treatments[key]--;
    });

    if (Object.values(treatments).some(function(count) { return count !== 0; })) correct = false;

    if (correct) {

            
      if ($.inArray(level.name, game.solved) === -1) {
        game.solved.push(level.name);
      }

      $('[data-level=' + game.level + ']').addClass('solved');
      $('#next').removeClass('disabled').addClass('animated animation');
    } else {
      $('#next').removeClass('animated animation').addClass('disabled');
    }
    return correct;
  },

  saveAnswer: function() {
    if (game.bridge.ending()) return;
    var level = levels[this.level];
    game.answers[level.name] = $('#code').val();
    game.bridge.save();
  },

  tryagain: function() {
    $('#editor').addClass('animated shake');
  },

  win: function() {
    var solution = $('#code').val();

    this.loadLevel(levelWin);

    $('#editor').hide();
    $('#code').val(solution);
    $('#share').show();
  },

  transform: function() {
    var scale = 1 + ((Math.random() / 5) - 0.2);
    var rotate = 360 * Math.random();
    scale = 1;
    rotate = 0;

    return {'transform': 'scale(' + scale + ') rotate(' + rotate + 'deg)'};
  },

  translate: function() {
    document.title = messages.title[game.language] || messages.title.en;
    $('html').attr('lang', game.language);

    var level = $('#editor').is(':visible') ? levels[game.level] : levelWin;
    var instructions = level.instructions[game.language] || level.instructions.en;
    $('#instructions').html(instructions);
    game.loadDocs();

    $('.translate').each(function() {
      var label = $(this).attr('id');
      var text = messages[label][game.language] || messages[label].en;

      $('#' + label).text(text);
    });
  },

  debounce: function(func, wait) { return game.bridge.debounce(func, wait); }
};

// Validated host handshake starts the retained original engine.
