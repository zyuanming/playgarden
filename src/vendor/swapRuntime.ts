// Swap by Noah Moroze and Michael Yang, CC-BY-SA-4.0.
// Fixed source: nmoroze/swap@a3cfb7d2d59d37dd3778d5de685a206cca4f1206.
// Adapted 2026-10-10 for Playgarden; adapter contributions GPL-3.0-only.
// Original license/attribution remain applicable. See vendor/swap-original/NOTICE.md.
// @ts-nocheck
// Original dynamic prototype code is intentionally retained, isolated per game mount.
import {swapMaps as levels} from './swapMaps';
import {validSwapSave,type SwapSave,type SwapSnapshot,type SwapDirection,type SwapRuntime} from './swapState';
export function createSwapRuntime(canvas:HTMLCanvasElement,level:number):SwapRuntime {
    canvas.width=640;canvas.height=640;
    var input={up:false,down:false,left:false,right:false,reset:function(){this.up=this.down=this.left=this.right=false;},gameMode:function(){},dialogueMode:function(){this.reset();}};
// BEGIN upstream/js/tile.js (changes recorded in source-map.json)
var switchedTiles = new Array(10);
var anyDown = [];

var Tile = {
	init: function(x, y){
		this.x = x;
		this.y = y;
	},
	update: function() {},
	onCollide: function(ai) {},
	blocksMovement: false,
	blocksOnlyPlayer: false,
	color:"white",
};

// FLOOR TILE
var FloorTile = function(x, y){
	this.init(x, y);
};
FloorTile.prototype = Object.create(Tile);

// WALL TILE
var WallTile = function(x, y){
	this.init(x, y);
	this.blocksMovement = true;
	this.color = "grey";
};
WallTile.prototype = Object.create(Tile);

// VICTORY TILE
var VictoryTile = function(x, y){
	this.init(x, y);
	this.color = "rgb(163, 211, 156)"; //"rgba(95, 255, 80, 1.0)";	
};
VictoryTile.prototype = Object.create(Tile);
VictoryTile.prototype.onCollide = function(ai) {
	world.victory();
};

// LAVA TILE (kills player)
var LavaTile = function(x, y){
	this.init(x, y);
	this.color = "red";
};
LavaTile.prototype = Object.create(Tile);
LavaTile.prototype.onCollide = function(ai) {
	world.death();
};

// SWITCHED TILE (wall that can be on/off)
var SwitchedTile = function(x, y){
	this.init(x, y);
	this.blocksMovement = true;
	this.color = "rgb(253, 198, 137)";
};
SwitchedTile.prototype = Object.create(Tile);
SwitchedTile.prototype.onCollide = function(ai) {
	this.touchingAI = true;
	// console.log(ai);
	this.justTouching = true;
}
SwitchedTile.prototype.update = function() {
	if(!this.justTouching)
		this.touchingAI = false;
	this.justTouching = false;
}

// SWITCH TILE (toggles wall)
var SwitchTile = function(x, y, id){
	this.init(x, y);
	this.switchingId = id;
	this.color = "rgb(255, 247, 153)";
}
SwitchTile.prototype = Object.create(Tile);
SwitchTile.prototype.onCollide = function(ai) {
	this.down = true;
	anyDown[this.switchingId] = true;
	switchedTiles[this.switchingId].blocksMovement = false;
	switchedTiles[this.switchingId].color = "rgb(235, 235, 235)";
}
SwitchTile.prototype.update = function() {
	if(!anyDown[this.switchingId]) {
		if(!switchedTiles[this.switchingId].touchingAI) {
			switchedTiles[this.switchingId].blocksMovement = true;
			switchedTiles[this.switchingId].color = "rgb(253, 198, 137)";
		}
	}
	anyDown[this.switchingId] = false;
}

// PLAYER WALL TILE (blocks only player)
var PlayerWallTile = function(x, y){
	this.init(x, y);
	this.blocksOnlyPlayer = true;
	this.color = "rgb(155,197,247)";
};
PlayerWallTile.prototype = Object.create(Tile);


var getTile = function(x, y, id) {
	if(19<id && id<30) {
		var t = new SwitchedTile(x, y)
		switchedTiles[id-20] = t;
		anyDown.push(false);
		return t;
	}
	else if(9<id && id<20) {
		return new SwitchTile(x, y, id-10);
	}
	else {
		switch(id) {
			case 1:
				return new WallTile(x, y);
			case 2:
				return new VictoryTile(x, y);
			case 3:
				return new LavaTile(x, y);
			case 4: 
				return new PlayerWallTile(x, y);
			default:
				return new FloorTile(x, y);
		}
	}
}


// END upstream/js/tile.js

// BEGIN upstream/js/ai.js (changes recorded in source-map.json)
var AI = {
	x:0,
	y:0,
	vx:0,
	vy:0,
	color: "rgb(125,167,217)",//"rgba(0, 10, 200, 0.4)",
	init: function(x, y) {
		this.x = x;
		this.y = y;
	},
	update: function(gridSize) {
		if(!this.hitWall) {
			if(this.vx!=0)
				this.x += gridSize / this.vx;
			if(this.vy!=0)
				this.y += gridSize / this.vy;
		}
		this.hitWall = false;
	}, 
	onCollide: function(tile) {
		if(tile.blocksMovement)
			this.hitWall = true;
	},
};

// STATIONARY AI 
var StationaryAI = function(x, y) {
	this.init(x, y);
}
StationaryAI.prototype = Object.create(AI);

// RIGHT AI
var RightAI = function(x, y) {
	this.init(x, y);
	this.vx = 7;
	this.hitWall = false;
}
RightAI.prototype = Object.create(AI);

// BOUNCE AI (RIGHT) (starts right, reverses direction on walls)
var RightBounceAI = function(x, y) {
	this.init(x, y);
	this.vx = 7;
	this.hitWall = false;
}
RightBounceAI.prototype = Object.create(AI);
RightBounceAI.prototype.onCollide = function(tile) {
	if(tile.blocksMovement && !this.hitWall) {
		this.vx *= -1;
		this.hitWall = true;
	}
}
RightBounceAI.prototype.update = function(gridSize) {
	this.hitWall = false;

	if(this.vx!=0)
		this.x += gridSize/this.vx;
	if(this.vy!=0)
		this.y += gridSize/this.vy; 
}

// FOLLOW AI (follows player movements)
var FollowAI = function(x, y) {
	this.init(x, y);
}
FollowAI.prototype = Object.create(AI);
FollowAI.prototype.update = function(gridSize) {
	if (!this.hitWall) {
		this.prevX = this.x;
		this.prevY = this.y;
		this.x += player.getVelocity().x;
		this.y += player.getVelocity().y;
	}
	this.hitWall = false;
}
FollowAI.prototype.onCollide = function(tile) {
	if(tile.blocksMovement) {
		this.hitWall = true;
		this.x = this.prevX; 
		this.y = this.prevY;
	}
}

// LEFT TURN AI (RIGHT) (starts right, turns left on walls)
var LeftTurnRightAI = function(x, y) {
	this.init(x, y);
	this.vx = 7;
}
LeftTurnRightAI.prototype = Object.create(AI);
LeftTurnRightAI.prototype.update = function(gridSize) {
	this.prevX = this.x;
	this.prevY = this.y;
	if(this.vx!=0)
		this.x += gridSize/this.vx;
	if(this.vy!=0)
		this.y += gridSize/this.vy; 
	this.hitWall = false;
}
LeftTurnRightAI.prototype.onCollide = function(tile) {
	if(tile.blocksMovement && !this.hitWall) {
		this.x = this.prevX;
		this.y = this.prevY;
		this.vxo = this.vx;
		this.vyo = this.vy;
		this.vx = 0;
		this.vy = 0;
		if (this.vxo > 0) this.vy = -7;
		else if (this.vxo < 0) this.vy = 7; 
		else if (this.vyo > 0) this.vx = 7;
		else if (this.vyo < 0) this.vx = -7;
		this.hitWall = true;
	}
}

// UP AI
var UpAI = function(x, y) {
	this.init(x, y);
	this.vy = -7;
	this.hitWall = false;
}
UpAI.prototype = Object.create(AI);


var originalGetAI = function(x, y, id) {
	switch(id) {
		case -1:
			return new StationaryAI(x, y);
		case -2:
			return new RightAI(x, y);
		case -3:
			return new RightBounceAI(x, y);
		case -4: 
			return new FollowAI(x, y);
		case -5:
			return new LeftTurnRightAI(x, y);
		case -6:
			return new UpAI(x, y);
	}
}

var actorSequence = 0;
var getAI = function(x,y,id) { var actor=originalGetAI(x,y,id); actor.type=id; actor.id=actorSequence++; return actor; };

// END upstream/js/ai.js

// BEGIN upstream/js/player.js (changes recorded in source-map.json)
var player = function() {
	var x,y;
	var prevX, prevY;
	var vx = 0, vy = 0;
	var currentAI;
	var friction = 1.6;
	var trail = [];
	var gridSize;
	// var hitRight = false;
	// var hitLeft = false;
	// var hitUp = false;
	// var hitDown = false;

	var init = function(gSize) {
		gridSize = gSize;
		vx = 0;
		vy = 0;
		this.trail.length = 0;
	}

	var setAI = function(ai){
		this.trail.length = 0;
		this.x = ai.x;
		this.y = ai.y;
		this.currentAI = ai;
	}

	var getAI = function() {
		this.currentAI.x = this.x;
		this.currentAI.y = this.y;
		return this.currentAI;
	}
	var update = function(gridSize) {
		prevX = x;
		prevY = y;
		this.trail.push([this.x, this.y]);
		if (this.trail.length >= 5) this.trail.shift();

		if(input.right) {
            if (vx <= gridSize / 10) vx += (Math.abs(vx) + 1) / friction;
		}
        else if(input.left) {
            if (vx >= -gridSize / 10) vx -= (Math.abs(vx) + 1) / friction;
        }

        if(input.up){
            if (vy >= -gridSize / 10) vy -= (Math.abs(vy) + 1) / friction;
        }
        else if(input.down) {
            if (vy <= gridSize / 10) vy += (Math.abs(vy) + 1) / friction;
        }
        if(!input.right && !input.left) {
        	vx = vx / friction;
        }
        if(!input.up && !input.down) {
        	vy = vy / friction;
        }
        if(vx>8)
        	vx=8;
        else if(vx<-8)
        	vx=-8;
        if(vy>8)
        	vy=8;
        else if(vy<-8)
        	vy=-8;
		this.x += vx;
		this.y += vy;
	}

	var hitWall = function(x, y) {
		if(this.trail[1]) {
			if (x>this.trail[1][0]) {
				if (x-this.trail[1][0] > gridSize) {
					this.y = this.trail[1][1];
				}
			}
			else {
				if (this.trail[1][0]-x < gridSize) {
					this.y = this.trail[1][1];
				}
			}

			if (y>this.trail[1][1]) {
				if (y-this.trail[1][1] > gridSize) {
					this.x = this.trail[1][0];
				}
			}
			else {
				if (this.trail[1][1]-y < gridSize) {
					this.x = this.trail[1][0];
				}
			}
		}
		// justHit = true;
		// if(vx*vx>vy*vy) {
		// 	vx=0;
		// 	hitSide = true;
		// }
		// if(vy*vy>vx*vx) {
		// 	vy=0;
		// 	hitUp = true;
		// }

		// if(vx*vx>vy*vy) {
		// 	vx = 0;
		// 	if(this.x>x)
		// 		hitLeft = true;
		// 	else if(this.x<x+gridSize)
		// 		hitRight = true;
		// }
		// if(vy*vy>vx*vx) {
		// 	vy = 0;
		// 	if(this.y>y)
		// 		hitUp = true;
		// 	else if(this.y<y+gridSize)
		// 		hitDown = true;
		// }
		// vx = vx / friction;
		// vy = vy / friction;

		// vx *= -0.3;
		// vy *= -0.3;
	}

	var getVelocity = function() {
		return {
			x:vx,
			y:vy,
		}
	}

	return {
		x: x,
		y: y,
		color: "rgb(125,167,217)",//"rgba(0, 10, 200, 0.4)",
		trail: trail,
		getVelocity: getVelocity,
        saveMotion: function() { return {vx:vx,vy:vy,trail:this.trail.map(p=>p.slice())}; },
        restoreMotion: function(m) { vx=m.vx;vy=m.vy;this.trail=m.trail.map(p=>p.slice()); },
		init: init,
		setAI: setAI,
		getAI: getAI, 
		update: update,
		hitWall: hitWall,
	}
}();

// END upstream/js/player.js

// BEGIN upstream/js/draw.js (changes recorded in source-map.json)
var renderer = function() {
	var canvas;
	var ctx;
	var gridSize;
	var width, height;
	var tipDisplay;
	var hud;

	var init = function(canvasId, hudId, tipId) {
		canvas = canvasId;
		tipDisplay = tipId;
		hud = hudId;
		ctx = canvas.getContext("2d");
		width = canvas.width;
		height = canvas.height;
	}

	var initLevel = function(level) {
		var sizeX = level.sizeX;
		var sizeY = level.sizeY;
		this.gridSize = width/sizeX<height/sizeY ? width/sizeX : height/sizeY;

		canvas.width = this.gridSize * sizeX;
		canvas.height = this.gridSize * sizeY;
		ctx.clearRect(0, 0, width, height);
	}

	var renderText = function() {}; // Host renders escaped, accessible text.

	var draw = function(aiEntities, floor) {
		//iterate through and draw tiles first, then entities
		var gridSize = this.gridSize;
		ctx.globalAlpha = 1;
		ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
		ctx.lineWidth = 0.25;
		for (var y = 0; y < floor.length; y++) {
			for (var x = 0; x < floor[y].length; x++) {
				ctx.fillStyle = floor[y][x].color;
				ctx.fillRect(x*gridSize, y*gridSize, gridSize, gridSize);
				ctx.strokeRect(x*gridSize, y*gridSize, gridSize, gridSize);
				clearShadows();
			}
		}
		for (var i = 0; i < aiEntities.length; i++) {
			ctx.globalAlpha = 0.65;
			ctx.fillStyle = aiEntities[i].color;
			// ctx.fillRect(aiEntities[i].x, aiEntities[i].y, gridSize-5, gridSize-5);
			ctx.beginPath();
			ctx.arc(aiEntities[i].x, aiEntities[i].y, gridSize / 2 - 5, 0, 2*Math.PI);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
		var trail = player.trail;
		for (var i = 0; i < trail.length; i++) { 
			ctx.globalAlpha = 1 - ((trail.length - i) / trail.length);		
			ctx.fillStyle = player.color;
			// ctx.fillRect(trail[i][0], trail[i][1], gridSize-5, gridSize-5);

			ctx.beginPath();
			ctx.arc(trail[i][0], trail[i][1], gridSize / 2 - (trail.length - i) - 5, 0, 2*Math.PI);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
		if (player) {
			ctx.fillStyle = player.color;
			// ctx.fillRect(player.x, player.y, gridSize-5, gridSize-5);

			ctx.beginPath();
			ctx.arc(player.x, player.y, (gridSize / 2) - 5, 0, 2*Math.PI);
			ctx.fill();
			//highlight player
			// ctx.lineWidth = 3;
			// ctx.strokeStyle = '#FF8000';
			// ctx.stroke();
		}
		else {
			console.log("Fiddlesticks -- no player instance! Check level for startX and startY?");
		}
	}

	var showDialogue = function() {}; // Accessible host controls replace canvas dialogues.

	var clearShadows = function() {
		ctx.shadowColor = "transparent";
		ctx.shadowBlur = 0;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
	}

	return {
		init: init,
		initLevel: initLevel,
		renderText: renderText,
		draw: draw,
		gridSize: gridSize,
		showDialogue: showDialogue,
	}
}();


// END upstream/js/draw.js

// BEGIN upstream/js/world.js (changes recorded in source-map.json)
var world = function() {
	var aiEntities = [];
	var floor = [];
	var gridSize;
	var curLevel;
	var deaths = 0;
	// Scheduling belongs to the host; each mount owns one independent instance.
	var ticks = 0;
	var fps = 30;
	var hitSpace = false;
	var dialogue = "";
	var hasDied = false;
	var prevTime;
	var hasWon = false;

	var init = function(level, canvasId, hudId, tipId) {
		renderer.init(canvasId, hudId, tipId);
		initLevel(level);
		createDialogue("ready");
		prevTime = Date.now();
	}

	var initLevel = function(level) {
		hasDied = false;
		hasWon = false;
		ticks = 0; actorSequence = 0; switchedTiles = new Array(10); anyDown = [];

		curLevel = level;
		if(level==levels.length) {
			// alert("That's all folks!");
			createDialogue("That's all folks");
			return;
		}

		renderer.initLevel(levels[level]);
		gridSize = renderer.gridSize;

		player.init(gridSize);
		input.gameMode();
		input.reset();
				
		loadLevel(level);
		renderer.renderText(deaths, curLevel, levels[curLevel].tip);

		renderer.draw(aiEntities, floor);
	}

	var victory = function() {
		if(!hasWon) {
			// alert("You win!");
			createDialogue("You won!");
			// initLevel(curLevel+1);
			// Selected level stays fixed; the host owns explicit level selection.
		}
		hasWon = true;
	}

	var death = function() {
		// alert("You died! :O");
		createDialogue("You died!");
		// Host stops ticking at terminal state.
		if(!hasDied) 
			deaths++; 
		hasDied = true;
		renderer.renderText(deaths, curLevel, levels[curLevel].tip);
		// initLevel(curLevel);
	}

	var loadLevel = function(index) {
		// loads level from level file
		var currentLevel = levels[index];
		floor.length = 0;
		aiEntities.length = 0;
		for (var y = 0; y < currentLevel.sizeY; y++) {
			floor.push([]);
			for (var x = 0; x < currentLevel.sizeX; x++) {
				if (currentLevel.tiles[y][x] >= 0) {
					floor[y].push(getTile(x*gridSize, y*gridSize, currentLevel.tiles[y][x]));
				}
				else {
					floor[y].push(getTile(0));	
					if(x==currentLevel.startX && y==currentLevel.startY)
						player.setAI(getAI(x*gridSize+gridSize/2, y*gridSize+gridSize/2, currentLevel.tiles[y][x]));
					else {
						aiEntities.push(getAI(x*gridSize+gridSize/2, y*gridSize+gridSize/2, currentLevel.tiles[y][x]));
					}
				}
			}
		}
	}

	var run = function() {
		// var deltaTime = (Date.now() - prevTime);
		// prevTime = Date.now();
		// console.log(deltaTime);
		if (!dialogue && !hasDied && !hasWon) { ticks++; update(); }
		renderer.draw(aiEntities, floor);
		if (dialogue) {
			input.dialogueMode();
			renderer.showDialogue(dialogue);
		}
	}	

	var update = function() {
		for(var y=0; y<floor.length; y++) {
			for(var x=0; x<floor[y].length; x++) {
				floor[y][x].update();
			}
		}

		//update player and player collision
		player.update(gridSize);
		var touchingTiles = collide(player).tiles;
		for(var i=0; i<touchingTiles.length; i++) {
			if(touchingTiles[i].blocksMovement || touchingTiles[i].blocksOnlyPlayer) {
				player.hitWall(touchingTiles[i].x, touchingTiles[i].y);
			}
			touchingTiles[i].onCollide(player);
            if (hasDied || hasWon) return;
		}

		//update AIs and AI collisions
		for(var i=0; i<aiEntities.length; i++) {
			aiEntities[i].update(gridSize);
			var touchingTiles = collide(aiEntities[i]).tiles;
			for(var j=0; j<touchingTiles.length; j++) {
				aiEntities[i].onCollide(touchingTiles[j]);
				touchingTiles[j].onCollide(aiEntities[i]);
                if (hasDied || hasWon) return;
			}
		}

	}

	var collide = function(ai) {
		var touching = {
			tiles: [],
		}
		var x = (ai.x - gridSize/2) + 5;
		var y = (ai.y - gridSize/2) + 5;
		addToArray(touching.tiles, tileAt(x, y));
		addToArray(touching.tiles, tileAt(x+gridSize-10, y));
		addToArray(touching.tiles, tileAt(x, y+gridSize-10));
		addToArray(touching.tiles, tileAt(x+gridSize-10, y+gridSize-10));
		return touching;
	}	

    var tileAt = function(x,y) {
        var p=coordToGrid(x,y);
        return floor[p.y]?.[p.x] || new WallTile(p.x*gridSize,p.y*gridSize);
    };

	var coordToGrid = function(x, y) {
		var grid = {};
		grid.x = Math.round((x-gridSize/2)/gridSize);
		grid.y = Math.round((y-gridSize/2)/gridSize);
		return grid;
	}

	var addToArray = function(array, obj) {
		if(array.indexOf(obj)==-1) 
			array.push(obj);
	}

	var cyclePlayer = function() {
		aiEntities.push(player.getAI());		
		player.setAI(aiEntities.shift());
	}

	var createDialogue = function(info) {
		input.dialogueMode();
		dialogue = info;
	}

	var closeDialogue = function() {
		input.gameMode();
		dialogue = "";
		initLevel(curLevel);
	}

	var resetLevel = function() {
		createDialogue("Level Reset!");
		initLevel(curLevel);
	}

    // Host-only lifecycle/state seam. Physics above is retained from the original.
    var capture = function() {
        const ordered=[player.currentAI,...aiEntities];
        const actors=ordered.map(a=>{
            const o={id:a.id,type:a.type,x:a===player.currentAI?player.x:a.x,y:a===player.currentAI?player.y:a.y,vx:a.vx,vy:a.vy,hitWall:!!a.hitWall};
            for(const k of ['prevX','prevY','vxo','vyo']) if(Number.isFinite(a[k])) o[k]=a[k];
            return o;
        });
        return {version:1,source:'a3cfb7d2',level:curLevel,ticks,deaths,
            result:hasWon?'won':hasDied?'lost':'playing',actors,motion:player.saveMotion(),
            gates:floor.flatMap((row,y)=>row.flatMap((t,x)=>levels[curLevel].tiles[y][x]>=20?[{x,y,open:!t.blocksMovement,touching:!!t.touchingAI,just:!!t.justTouching}]:[])),
            plates:floor.flatMap((row,y)=>row.flatMap((t,x)=>levels[curLevel].tiles[y][x]>=10&&levels[curLevel].tiles[y][x]<20?[{x,y,down:!!t.down}]:[])),anyDown:Array.from({length:10},(_,i)=>!!anyDown[i])};
    };
    var restore = function(s) {
        const actors=[player.currentAI,...aiEntities];
        const byId=new Map(actors.map(a=>[a.id,a]));
        for(const a of s.actors) {
            const original=byId.get(a.id);
            for(const k of ['x','y','vx','vy','prevX','prevY','vxo','vyo','hitWall']) {
                if(k in a) original[k]=a[k]; else if(Object.prototype.hasOwnProperty.call(original,k)) delete original[k];
            }
        }
        player.setAI(byId.get(s.actors[0].id)); player.restoreMotion(s.motion);
        aiEntities=s.actors.slice(1).map(a=>byId.get(a.id));
        for(const t of s.gates) {const original=floor[t.y][t.x];original.blocksMovement=!t.open;original.touchingAI=t.touching;original.justTouching=t.just;original.color=t.open?'rgb(235, 235, 235)':'rgb(253, 198, 137)';}
        for(const t of s.plates) floor[t.y][t.x].down=t.down;
        anyDown=s.anyDown.slice();ticks=s.ticks;deaths=s.deaths;hasWon=s.result==='won';hasDied=s.result==='lost';
        dialogue=s.result==='playing'?'ready':s.result;input.reset();renderer.draw(aiEntities,floor);
    };

	return {
		init: init,
        step: run, capture: capture, restore: restore,
        start: function(){if(!hasWon&&!hasDied)dialogue="";},
        paint: function(){renderer.draw(aiEntities,floor);},
        getGrid: function(){return gridSize;},
        retry: function(){initLevel(curLevel);dialogue="ready";},
		victory: victory,
		cyclePlayer: cyclePlayer,
		death: death,
		closeDialogue: closeDialogue,
		resetLevel: resetLevel,
	}
}();
// END upstream/js/world.js

    let disposed=false,started=false;
    world.init(level,canvas,null,null);
    function snapshot():SwapSnapshot {
        const s=world.capture();
        return {...s,gridSize:world.getGrid(),width:levels[level].sizeX,height:levels[level].sizeY,started,
            held:['up','down','left','right'].filter(k=>input[k]),credits:level===24};
    }
    return {
        snapshot,
        start(){if(disposed)return;started=true;input.reset();world.start();},
        step(){if(disposed||!started)return;world.step();},
        hold(direction:SwapDirection,down:boolean){if(!disposed)input[direction]=down;},
        cancel(){input.reset();},
        swap(){if(disposed||!started||world.capture().result!=='playing')return;input.reset();world.cyclePlayer();world.paint();},
        retry(){if(disposed)return;started=false;input.reset();world.retry();},
        save():SwapSave{return world.capture();},
        restore(value:unknown){if(disposed||!validSwapSave(value,world.capture()))return false;world.restore(value);started=false;return true;},
        dispose(){disposed=true;started=false;input.reset();}
    };
}
