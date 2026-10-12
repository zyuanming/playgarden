// SPDX-License-Identifier: GPL-3.0-only
// An ordinary player solution, using only the documented elevator/floor API.
// No simulation globals, seeded traffic, altered people, thresholds or time step.
({
  init: function(elevators, floors) {
    var calls = [];
    var age = 0;
    function distance(e, floor) {
      var queue = e.destinationQueue;
      var path = Math.abs(e.currentFloor() - floor);
      var previous = e.currentFloor();
      for (var i = 0; i < queue.length; i++) {
        if (queue[i] === floor) return path * 0.2;
        path += Math.abs(previous - queue[i]);
        previous = queue[i];
      }
      return path + queue.length * 1.5 + e.loadFactor() * 8;
    }
    function assign() {
      calls.sort(function(a,b) { return a.age - b.age; });
      calls.forEach(function(call) {
        var eligible = elevators.filter(function(e) { return e.loadFactor() < 0.85; });
        if (!eligible.length) return;
        eligible.sort(function(a,b) { return distance(a,call.floor) - distance(b,call.floor); });
        var e = eligible[0];
        if (e.destinationQueue.indexOf(call.floor) < 0) e.goToFloor(call.floor);
      });
    }
    floors.forEach(function(floor) {
      ['up','down'].forEach(function(direction) {
        floor.on(direction + '_button_pressed',function() {
          var existing = calls.some(function(c) { return c.floor === floor.floorNum() && c.direction === direction; });
          if (!existing) calls.push({floor:floor.floorNum(),direction:direction,age:age++});
          assign();
        });
      });
    });
    elevators.forEach(function(e,index) {
      e.on('idle',function() {
        assign();
        if (!e.destinationQueue.length && e.currentFloor() !== 0) e.goToFloor(0);
      });
      e.on('floor_button_pressed',function(floor) {
        e.goToFloor(floor);
        var current = e.currentFloor();
        e.destinationQueue.sort(function(a,b) { return Math.abs(a-current)-Math.abs(b-current); });
        e.checkDestinationQueue();
      });
      e.on('passing_floor',function(floor,direction) {
        var waiting = calls.some(function(c) { return c.floor === floor && c.direction === direction; });
        if (e.getPressedFloors().indexOf(floor) >= 0 || (e.loadFactor() < 0.75 && waiting)) e.goToFloor(floor,true);
      });
      e.on('stopped_at_floor',function(floor) {
        calls = calls.filter(function(c) { return c.floor !== floor; });
        e.goingUpIndicator(true); e.goingDownIndicator(true);
        assign();
      });
      if (index > 0) e.goToFloor(Math.min(floors.length-1,index*2));
    });
    this.dispatch = assign;
  },
  update: function(dt,elevators,floors) { this.dispatch(); }
})
