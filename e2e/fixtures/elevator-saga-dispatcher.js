// SPDX-License-Identifier: GPL-3.0-only
// An ordinary player solution, using only the documented elevator/floor API.
// Collective directional service with one reservation per hall call.
// No simulation globals, seeded traffic, altered people, thresholds or time step.
({
  init: function(elevators, floors) {
    var calls = [], serial = 0, dispatching = false, elapsed = 0, clock = 0, lastReport = -5;
    var cars = elevators.map(function(e,index) { return {e:e,index:index,direction:1,lastStop:-1,stoppedAt:-10}; });
    // This is a conservative weight-based pickup policy, not an exact count.
    // A full car can report 0.55..1.0 because original riders weigh 55..100.
    function available(car, call) {
      return car.e.loadFactor()<0.7 && !(car.lastStop===call.floor &&
        car.e.currentFloor()===call.floor && clock-car.stoppedAt<1.5);
    }
    function own(car) { return calls.filter(function(c) { return c.car === car.index; }); }
    function ordered(car, targets) {
      var at = car.e.currentFloor(), dir = car.direction;
      return targets.sort(function(a,b) {
        var aheadA = (a-at)*dir >= 0, aheadB = (b-at)*dir >= 0;
        if (aheadA !== aheadB) return aheadA ? -1 : 1;
        return aheadA ? (a-b)*dir : (b-a)*dir;
      });
    }
    function indicators(car, direction) {
      car.e.goingUpIndicator(direction >= 0);
      car.e.goingDownIndicator(direction <= 0);
    }
    function rebuild(car) {
      var e = car.e, at = e.currentFloor(), targets = e.getPressedFloors().slice();
      var carrying = targets.length > 0;
      var direction=e.destinationDirection(), committed=e.destinationQueue[0];
      if(direction!=='stopped')car.direction=direction==='up'?1:-1;
      own(car).forEach(function(c) {
        // Finish the current passenger sweep before opposite-direction pickups.
        // A call re-pressed during boarding belongs to another pickup. Do not
        // keep a car at this floor while its passengers have other destinations.
        if(carrying && c.floor===at)return;
        if(carrying && (c.direction!==car.direction || (c.floor-at)*car.direction<0))return;
        if(targets.indexOf(c.floor)<0) targets.push(c.floor);
      });
      if (!targets.length) { e.destinationQueue = direction!=='stopped' && committed!==undefined ? [committed] : []; return; }
      var ahead = targets.some(function(f) { return (f-at)*car.direction > 0; });
      if (!ahead && targets.some(function(f) { return f !== at; })) car.direction *= -1;
      e.destinationQueue = ordered(car,targets);
      // Public destinationDirection/queue preserve the already moving leg.
      // Explicit passing_floor interception below still handles pickups ahead.
      if(direction!=='stopped' && committed!==undefined) {
        e.destinationQueue=e.destinationQueue.filter(function(f){return f!==committed;});
        e.destinationQueue.unshift(committed);
      }
      e.checkDestinationQueue();
    }
    function estimate(car, call) {
      var e = car.e, at = e.currentFloor(), targets = e.getPressedFloors().slice();
      own(car).forEach(function(c) { if(targets.indexOf(c.floor)<0) targets.push(c.floor); });
      var route = ordered(car,targets), distance = 0, previous = at, stops = 0;
      // Estimate arrival along the existing collective route, including stops.
      for(var i=0;i<route.length;i++) {
        var next=route[i], direction=next>previous?1:next<previous?-1:car.direction;
        if ((call.floor-previous)*direction>=0 && (next-call.floor)*direction>=0 && call.direction===direction)
          return (distance+Math.abs(call.floor-previous))*0.55+stops*1.5+e.loadFactor()*3;
        distance+=Math.abs(next-previous); previous=next; stops++;
      }
      return (distance+Math.abs(call.floor-previous))*0.55+stops*1.5+e.loadFactor()*3;
    }
    function dispatch() {
      if(dispatching) return;
      dispatching=true;
      // Conservatively busy cars retain passengers but release hall reservations.
      calls.forEach(function(c) { if(c.car!==null && !available(cars[c.car],c))c.car=null; });
      calls.sort(function(a,b) { return a.order-b.order; });
      calls.forEach(function(c) {
        var candidates=cars.filter(function(car) { return available(car,c); });
        candidates.sort(function(a,b) { return estimate(a,c)-estimate(b,c); });
        if(candidates.length && (c.car===null ||
          clock-c.created>=8 && estimate(candidates[0],c)+3<estimate(cars[c.car],c)))
          c.car=candidates[0].index;
      });
      cars.forEach(rebuild);
      if(clock-lastReport>=5) {
        lastReport=clock;
        console.log('ELEVATOR_PUBLIC '+JSON.stringify({clock:clock,
          calls:calls.map(function(c){return {floor:c.floor,direction:c.direction,age:clock-c.created,car:c.car};}),
          cars:cars.map(function(c){return {id:c.index,floor:c.e.currentFloor(),direction:c.e.destinationDirection(),load:c.e.loadFactor(),pressed:c.e.getPressedFloors(),queue:c.e.destinationQueue.slice()};})}));
      }
      dispatching=false;
    }
    floors.forEach(function(floor) {
      ['up','down'].forEach(function(direction) {
        floor.on(direction+'_button_pressed',function() {
          var number=floor.floorNum(), sign=direction==='up'?1:-1;
          if(!calls.some(function(c) { return c.floor===number&&c.direction===sign; }))
            calls.push({floor:number,direction:sign,order:serial++,created:clock,car:null});
          dispatch();
        });
      });
    });
    cars.forEach(function(car) {
      var e=car.e;
      e.on('idle',dispatch);
      e.on('floor_button_pressed',function() { rebuild(car); });
      e.on('passing_floor',function(floor,direction) {
        var sign=direction==='up'?1:-1;
        var pickup=own(car).some(function(c) { return c.floor===floor&&c.direction===sign; });
        if(e.getPressedFloors().indexOf(floor)>=0 || (pickup&&e.loadFactor()<0.7)) {
          car.direction=sign; indicators(car,sign);
          e.destinationQueue=e.destinationQueue.filter(function(f) { return f!==floor; });
          e.goToFloor(floor,true);
        }
      });
      e.on('stopped_at_floor',function(floor) {
        car.lastStop=floor;car.stoppedAt=clock;
        var inside=e.getPressedFloors(), here=own(car).filter(function(c) { return c.floor===floor; });
        var ahead=inside.some(function(f) { return (f-floor)*car.direction>0; });
        if(!ahead&&inside.length)car.direction=inside[0]>floor?1:-1;
        else if(!inside.length&&here.length)car.direction=here[0].direction;
        else if(!inside.length) {
          var next=own(car).sort(function(a,b) { return Math.abs(a.floor-floor)-Math.abs(b.floor-floor); });
          if(next.length&&next[0].floor!==floor)car.direction=next[0].floor>floor?1:-1;
        }
        indicators(car,car.direction);
        calls=calls.filter(function(c) { return !(c.floor===floor&&c.direction===car.direction&&e.loadFactor()<0.95); });
        // The original floor logic re-presses a call if boarding overflows.
        // Keep the chosen indicators through the one-second boarding interval.
        dispatch();
      });
    });
    this.advance=function(dt) { clock+=dt;elapsed+=dt;if(elapsed>=0.25){elapsed=0;dispatch();} };
  },
  update: function(dt) { this.advance(dt); }
})
