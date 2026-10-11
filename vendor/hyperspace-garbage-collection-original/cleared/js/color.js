/*globals define*/
define([
  'base-object'
], function( BaseObject ) {
  'use strict';

  function Color( red, green, blue, alpha ) {
    BaseObject.call( this );

    this.red   = red   || 0;
    this.green = green || 0;
    this.blue  = blue  || 0;
    this.alpha = alpha || 0.0;
  }

  Color.prototype = new BaseObject();
  Color.prototype.constructor = Color;

  Color.prototype.rgba = function() {
    return 'rgba(' +
      Math.round( this.red )   + ', ' +
      Math.round( this.green ) + ', ' +
      Math.round( this.blue )  + ', ' +
      this.alpha +
    ')';
  };

  /* Playgarden modification (2026), GPL-3.0-only.
   * RGB/HSL arithmetic for the original procedural background. The upstream
   * Stack Overflow and unlicensed gist snippets are excluded from this file.
   * Unused fromHSL and lerp methods are intentionally omitted.
   */
  Color.prototype.hslObject = function() {
    var channels = [this.red, this.green, this.blue];
    var upper = Math.max.apply(Math, channels);
    var lower = Math.min.apply(Math, channels);
    var span = upper - lower;
    var sum = upper + lower;
    var degrees = 0;
    var saturation = 0;
    if (span !== 0) {
      var axis = channels.indexOf(upper);
      var phase = 2 * axis +
        (channels[(axis + 1) % 3] - channels[(axis + 2) % 3]) / span;
      degrees = ((phase * 60) % 360 + 360) % 360;
      saturation = 100 * span / (255 - Math.abs(sum - 255));
    }
    return {hue: degrees, saturation: saturation, lightness: sum * 100 / 510};
  };

  return Color;
});
