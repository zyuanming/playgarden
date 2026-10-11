// SPDX-License-Identifier: GPL-3.0-only
// Safe replacement for the MIT original's editable key UI. Original mappings retained.
var AVABRANCH_DEFAULT_KEYS = [['A', 'S'], ['D', 'F'], ['J', 'K'], ['L', ';']];
function validAvabranchKeys(value) {
  return Array.isArray(value) && value.length === 4 && value.every(function(row) {
    return Array.isArray(row) && row.length === 2 && row.every(function(key) {
      return typeof key === 'string' && /^[A-OQ-Z0-9;]$/.test(key);
    });
  }) && new Set(value.flat()).size === 8;
}
function Controls() {
  this.colors = ['#E67373', '#ECEC85', '#9DE970', '#708EE9'];
  this.keyMaps = { 1: [['A', 'F'], ['A', 'F'], ['A', 'F'], ['A', 'F']], 4: AVABRANCH_DEFAULT_KEYS.map(function(row) { return row.slice(); }) };
  this.load = function(keys) {
    this.keyMaps[4] = (validAvabranchKeys(keys) ? keys : AVABRANCH_DEFAULT_KEYS).map(function(row) { return row.slice(); });
    this.showControls();
  };
  this.showControls = function() {
    var names = ['红线', '黄线', '绿线', '蓝线'];
    var inputs = document.querySelectorAll('[data-map-row]');
    var self = this;
    inputs.forEach(function(input) {
      var row = Number(input.dataset.mapRow), col = Number(input.dataset.mapCol);
      input.value = self.keyMaps[4][row][col];
    });
    document.querySelectorAll('[data-steer]').forEach(function(button) {
      var row = Number(button.dataset.row), col = Number(button.dataset.col);
      button.textContent = (col ? '右' : '左') + ' · ' + self.keyMaps[4][row][col];
      button.setAttribute('aria-label', names[row] + (col ? '向右' : '向左'));
    });
  };
  this.reset = function() { this.load(AVABRANCH_DEFAULT_KEYS); };
}
