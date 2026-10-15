// Original slider contract: ncase/trust (CC0). Accessible pointer adaptation: GPL-3.0-only.
function Slider(config) {
  var self = this;
  self.id = config.id;
  self.value = 0;
  var dom = self.dom = document.createElement('div');
  dom.className = 'slider';
  dom.style.left = config.x + 'px'; dom.style.top = config.y + 'px'; dom.style.width = config.width + 'px';
  var input = document.createElement('input');
  input.type = 'range'; input.min = config.min; input.max = config.max; input.step = config.step;
  input.dataset.message = config.message || ''; input.setAttribute('aria-label', config.message || '调整数值');
  dom.appendChild(input);
  self.setValue = function(value) { self.value = value; input.value = value; dom.dataset.value = String(value); };
  self.setParam = function(param) { self.setValue(Math.round((config.min + (config.max-config.min)*param)/config.step)*config.step); };
  if (config.message) listen(self, config.message, self.setValue);
  var selecting = false;
  self.beginInput = function() { if (!selecting && config.onselect) config.onselect(); selecting = true; };
  self.endInput = function() { selecting = false; };
  self.userValue = function(value) {
    if (TrustLifecycle.isPaused() || Scratcher.isTransitioning) return;
    value = Math.max(config.min, Math.min(config.max, Math.round(value/config.step)*config.step));
    if (self.value === value) return;
    if (config.message) publish(config.message, [value]);
    if (config.onchange) config.onchange(value);
    // The original message listener owns the displayed value. Preserve the
    // callback-only case without manufacturing a different simulation rule.
    if (!config.message) self.setValue(value);
  };
  input.addEventListener('pointerdown', self.beginInput);
  input.addEventListener('pointerup', self.endInput);
  input.addEventListener('pointercancel', self.endInput);
  input.addEventListener('lostpointercapture', self.endInput);
  input.addEventListener('blur', self.endInput);
  input.addEventListener('keydown', self.beginInput);
  input.addEventListener('keyup', self.endInput);
  input.addEventListener('input', function() { self.beginInput(); self.userValue(Number(input.value)); });
  input.addEventListener('change', self.endInput);
  // The mobile control forwards the same public input contract, never state.
  dom.trustSlider = self;
  self.add = function() { _add(self); };
  self.remove = function() { selecting = false; unlisten(self); _remove(self); };
}
