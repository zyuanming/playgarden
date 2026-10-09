// SPDX-License-Identifier: GPL-3.0-or-later
// Hextris, Copyright (C) 2018 Logan Engstrom and contributors.
// Pinned source: 3f4847dc8fd7dab3d1c87e6324b9159d92fbd396.
// Playgarden adaptation (2026): offline native shell, scoped lifecycle and plain-data saves.
// Full original source, modification map and GPL terms accompany this distribution.
(function () {
// Upstream: js/math.js
function rotatePoint(x, y, theta) {
	var thetaRad = theta * (Math.PI / 180);
	var rotX = Math.cos(thetaRad) * x - Math.sin(thetaRad) * y;
	var rotY = Math.sin(thetaRad) * x + Math.cos(thetaRad) * y;

	return {
		x: rotX,
		y: rotY
	};
}

function randInt(min, max) {
	return Math.floor((Math.random() * max) + min);
}


// Upstream: js/Hex.js
function Hex(sideLength) {
	this.playThrough = 0;
	this.fillColor = [44,62,80];
	this.tempColor = [44,62,80];
	this.angularVelocity = 0;
	this.position = 0;
	this.dy = 0;
	this.dt = 1;
	this.sides = 6;
	this.blocks = [];
	this.angle = 180 / this.sides;
	this.targetAngle = this.angle;
	this.shakes = [];
	this.sideLength = sideLength;
	this.strokeColor = 'blue';
	this.x = trueCanvas.width / 2;
	this.y = trueCanvas.height / 2;
	this.ct = 0;
	this.lastCombo = this.ct - settings.comboTime;
	this.lastColorScored = "#000";
	this.comboTime = 1;
	this.texts = [];
		this.lastRotate = Date.now();
	for (var i = 0; i < this.sides; i++) {
		this.blocks.push([]);
	}

	this.shake = function(obj) { //lane as in particle lane
		var angle = 30 + obj.lane * 60;
		angle *= Math.PI / 180;
		var dx = Math.cos(angle) * obj.magnitude;
		var dy = Math.sin(angle) * obj.magnitude;
		gdx -= dx;
		gdy += dy;
		obj.magnitude /= 2 * (this.dt+0.5);
		if (obj.magnitude < 1) {
			for (var i = 0; i < this.shakes.length; i++) {
				if (this.shakes[i] == obj) {
					this.shakes.splice(i, 1);
				}
			}
		}
	};

	this.addBlock = function(block) {
		if (!(gameState == 1 || gameState === 0)) return;
		block.settled = 1;
		block.tint = 0.6;
		var lane = this.sides - block.fallingLane;// -this.position;
		this.shakes.push({lane:block.fallingLane, magnitude:4.5 * (window.devicePixelRatio ? window.devicePixelRatio : 1) * (settings.scale)});
		lane += this.position;
		lane = (lane + this.sides) % this.sides;
		block.distFromHex = MainHex.sideLength / 2 * Math.sqrt(3) + block.height * this.blocks[lane].length;
		this.blocks[lane].push(block);
		block.attachedLane = lane;
		block.checked = 1;
		metrics.placed++;
	};

	this.doesBlockCollide = function(block, position, tArr) {
		if (block.settled) {
			return;
		}

		if (position !== undefined) {
			arr = tArr;
			if (position <= 0) {
				if (block.distFromHex - block.iter * this.dt * settings.scale - (this.sideLength / 2) * Math.sqrt(3) <= 0) {
					block.distFromHex = (this.sideLength / 2) * Math.sqrt(3);
					block.settled = 1;
					block.checked = 1;
				} else {
					block.settled = 0;
					block.iter = 1.5 + (waveone.difficulty/15) * 3;
				}
			} else {
				if (arr[position - 1].settled && block.distFromHex - block.iter * this.dt * settings.scale - arr[position - 1].distFromHex - arr[position - 1].height <= 0) {
					block.distFromHex = arr[position - 1].distFromHex + arr[position - 1].height;
					block.settled = 1;
					block.checked = 1;
				}
				else {
					block.settled = 0;
					block.iter = 1.5 + (waveone.difficulty/15) * 3;
				}
			}
		} else {
			var lane = this.sides - block.fallingLane;//  -this.position;
			lane += this.position;

			lane = (lane+this.sides) % this.sides;
			var arr = this.blocks[lane];

			if (arr.length > 0) {
				if (block.distFromHex + block.iter * this.dt * settings.scale - arr[arr.length - 1].distFromHex - arr[arr.length - 1].height <= 0) {
					block.distFromHex = arr[arr.length - 1].distFromHex + arr[arr.length - 1].height;
					this.addBlock(block);
				}
			} else {
				if (block.distFromHex + block.iter * this.dt * settings.scale - (this.sideLength / 2) * Math.sqrt(3) <= 0) {
					block.distFromHex = (this.sideLength / 2) * Math.sqrt(3);
					this.addBlock(block);
				}
			}
		}
	};

	this.rotate = function(steps) {
				if(Date.now()-this.lastRotate<75 && !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) ) return;
		if (!(gameState === 1 || gameState === 0)) return;
		this.position += steps;
		metrics.rotations++;

		while (this.position < 0) {
			this.position += 6;
		}

		this.position = this.position % this.sides;
		this.blocks.forEach(function(blocks) {
			blocks.forEach(function(block) {
				block.targetAngle = block.targetAngle - steps * 60;
			});
		});

		this.targetAngle = this.targetAngle - steps * 60;
				this.lastRotate = Date.now();
	};

	this.draw = function() {
		this.x = trueCanvas.width/2;

		if (gameState != -2) {
			this.y = trueCanvas.height/2;
		}
		this.sideLength = settings.hexWidth;
		gdx = 0;
		gdy = 0;
		for (var i = 0; i < this.shakes.length; i++) {
			this.shake(this.shakes[i]);
		}
		if (this.angle > this.targetAngle) {
			this.angularVelocity -= angularVelocityConst * this.dt;
		}
		else if(this.angle < this.targetAngle) {
			this.angularVelocity += angularVelocityConst * this.dt;
		}

		if (Math.abs(this.angle - this.targetAngle + this.angularVelocity) <= Math.abs(this.angularVelocity)) { //do better soon
			this.angle = this.targetAngle;
			this.angularVelocity = 0;
		}
		else {
			this.angle += this.angularVelocity;
		}
 
		drawPolygon(this.x + gdx, this.y + gdy + this.dy, this.sides, this.sideLength, this.angle,arrayToColor(this.fillColor) , 0, 'rgba(0,0,0,0)');
	};
}

function arrayToColor(arr){
	return 'rgb(' + arr[0]+ ','+arr[1]+','+arr[2]+')';
}


// Upstream: js/Block.js
function Block(fallingLane, color, iter, distFromHex, settled) {
	// whether or not a block is rested on the center hex or another block
	this.settled = (settled === undefined) ? 0 : 1;
	this.height = settings.blockHeight;
	//the lane which the block was shot from
	this.fallingLane = fallingLane;

		this.checked=0;
	//the angle at which the block falls
	this.angle = 90 - (30 + 60 * fallingLane);
	//for calculating the rotation of blocks attached to the center hex
	this.angularVelocity = 0;
	this.targetAngle = this.angle;
	this.color = color;
	//blocks that are slated to be deleted after a valid score has happened
	this.deleted = 0;
	//blocks slated to be removed from falling and added to the hex
	this.removed = 0;
	//value for the opacity of the white blcok drawn over falling block to give it the glow as it attaches to the hex
	this.tint = 0;
	//value used for deletion animation
	this.opacity = 1;
	//boolean for when the block is expanding
	this.initializing = 1;
	this.ict = MainHex.ct;
	//speed of block
	this.iter = iter;
	//number of iterations before starting to drop
	this.initLen = settings.creationDt;
	//side which block is attached too
	this.attachedLane = 0;
	//distance from center hex
	this.distFromHex = distFromHex || settings.startDist * settings.scale ;

	this.incrementOpacity = function() {
		if (this.deleted) {
			//add shakes
			if (this.opacity >= 0.925) {
				var tLane = this.attachedLane - MainHex.position;
				tLane = MainHex.sides - tLane;
				while (tLane < 0) {
					tLane += MainHex.sides;
				}

				tLane %= MainHex.sides;
				MainHex.shakes.push({lane:tLane, magnitude:3 * (window.devicePixelRatio ? window.devicePixelRatio : 1) * (settings.scale)});
			}
			//fade out the opacity
			this.opacity = this.opacity - 0.075 * MainHex.dt;
			if (this.opacity <= 0) {
				//slate for final deletion
				this.opacity = 0;
				this.deleted = 2;
				if (gameState == 1 || gameState==0) {
					saveGame();
				}
			}
		}
	};

	this.getIndex = function (){
		//get the index of the block in its stack
		var parentArr = MainHex.blocks[this.attachedLane];
		for (var i = 0; i < parentArr.length; i++) {
			if (parentArr[i] == this) {
				return i;
			}
		}
	};

	this.draw = function(attached, index) {
		this.height = settings.blockHeight;
		// Viewport scaling is applied once by scaleCanvas, including while paused.


		this.incrementOpacity();
		if(attached === undefined)
			attached = false;

		if(this.angle > this.targetAngle) {
			this.angularVelocity -= angularVelocityConst * MainHex.dt;
		}
		else if(this.angle < this.targetAngle) {
			this.angularVelocity += angularVelocityConst * MainHex.dt;
		}

		if (Math.abs(this.angle - this.targetAngle + this.angularVelocity) <= Math.abs(this.angularVelocity)) { //do better soon
			this.angle = this.targetAngle;
			this.angularVelocity = 0;
		}
		else {
			this.angle += this.angularVelocity;
		}
		
		this.width = 2 * this.distFromHex / Math.sqrt(3);
		this.widthWide = 2 * (this.distFromHex + this.height) / Math.sqrt(3);
		//this.widthWide = this.width + this.height + 3;
		var p1;
		var p2;
		var p3;
		var p4;
		if (this.initializing) {
			var rat = ((MainHex.ct - this.ict)/this.initLen);
			if (rat > 1) {
				rat = 1;
			}
			p1 = rotatePoint((-this.width / 2) * rat, this.height / 2, this.angle);
			p2 = rotatePoint((this.width / 2) * rat, this.height / 2, this.angle);
			p3 = rotatePoint((this.widthWide / 2) * rat, -this.height / 2, this.angle);
			p4 = rotatePoint((-this.widthWide / 2) * rat, -this.height / 2, this.angle);
			if ((MainHex.ct - this.ict) >= this.initLen) {
				this.initializing = 0;
			}
		} else {
			p1 = rotatePoint(-this.width / 2, this.height / 2, this.angle);
			p2 = rotatePoint(this.width / 2, this.height / 2, this.angle);
			p3 = rotatePoint(this.widthWide / 2, -this.height / 2, this.angle);
			p4 = rotatePoint(-this.widthWide / 2, -this.height / 2, this.angle);
		}

		if (this.deleted) {
			ctx.fillStyle = "#FFF";
		} else if (gameState === 0) {
			if (this.color.charAt(0) == 'r') {
				ctx.fillStyle = rgbColorsToTintedColors[this.color];
			}
			else {
				ctx.fillStyle = hexColorsToTintedColors[this.color];
			}
		}
		else {
			ctx.fillStyle = this.color;
		}

		ctx.globalAlpha = this.opacity;
		var baseX = trueCanvas.width / 2 + Math.sin((this.angle) * (Math.PI / 180)) * (this.distFromHex + this.height / 2) + gdx;
		var baseY = trueCanvas.height / 2 - Math.cos((this.angle) * (Math.PI / 180)) * (this.distFromHex + this.height / 2) + gdy;
		ctx.beginPath();
		ctx.moveTo(baseX + p1.x, baseY + p1.y);
		ctx.lineTo(baseX + p2.x, baseY + p2.y);
		ctx.lineTo(baseX + p3.x, baseY + p3.y);
		ctx.lineTo(baseX + p4.x, baseY + p4.y);
		//ctx.lineTo(baseX + p1.x, baseY + p1.y);
		ctx.closePath();
		ctx.fill();

		if (this.tint) {
			if (this.opacity < 1) {
				if (gameState == 1 || gameState==0) {
					saveGame();
				}

				this.iter = 2.25;
				this.tint = 0;
			}

			ctx.fillStyle = "#FFF";
			ctx.globalAlpha = this.tint;
			ctx.beginPath();
			ctx.moveTo(baseX + p1.x, baseY + p1.y);
			ctx.lineTo(baseX + p2.x, baseY + p2.y);
			ctx.lineTo(baseX + p3.x, baseY + p3.y);
			ctx.lineTo(baseX + p4.x, baseY + p4.y);
			ctx.lineTo(baseX + p1.x, baseY + p1.y);
			ctx.closePath();
			ctx.fill();
			this.tint -= 0.02 * MainHex.dt;
			if (this.tint < 0) {
				this.tint = 0;
			}
		}

		ctx.globalAlpha = 1;
	};
}

function findCenterOfBlocks(arr) {
	var avgDFH = 0;
	var avgAngle = 0;
	for (var i = 0; i < arr.length; i++) {
		avgDFH += arr[i].distFromHex;
		var ang = arr[i].angle;
		// Constant-time normalization also bounds work for untrusted saved angles.
		ang = ((ang % 360) + 360) % 360;
		
		avgAngle += ang % 360;
	}

	avgDFH /= arr.length;
	avgAngle /= arr.length;

	return {
		x:trueCanvas.width/2 + Math.cos(avgAngle * (Math.PI / 180)) * avgDFH,
		y:trueCanvas.height/2 + Math.sin(avgAngle * (Math.PI / 180)) * avgDFH
	};
}


// Upstream: js/Text.js
function Text(x,y,text,font,color,incrementFunction){
	this.x = x;
	this.y = y;
	this.font = font;
	this.color = color;
	this.opacity =1;
	this.text = text;
	this.alive=1;
	this.draw = function(){
		if (this.alive>0) {
			ctx.globalAlpha = this.opacity;
			renderText((this.x + gdx), (this.y + gdy),50,this.color,this.text);
			ctx.globalAlpha =1;
			incrementFunction(this);
			return true;
		}
		else {
			return false;
		}
	};
}

function fadeUpAndOut(text){
	text.opacity -= MainHex.dt * Math.pow(Math.pow((1-text.opacity), 1/3)+1,3)/100;
	text.alive = text.opacity;
	text.y -= 3 * MainHex.dt;
}


// Upstream: js/checking.js
function search(twoD,oneD){
	// Searches a two dimensional array to see if it contains a one dimensional array. indexOf doesn't work in this case
	for(var i=0;i<twoD.length;i++){
		if(twoD[i][0] == oneD[0] && twoD[i][1] == oneD[1]) {
			return true;
		}
	}
	return false;
}

function floodFill(hex, side, index, deleting) {
	if (hex.blocks[side] === undefined || hex.blocks[side][index] === undefined) return;

	//store the color
	var color = hex.blocks[side][index].color;
	//nested for loops for navigating the blocks
	for(var x =-1;x<2;x++){
		for(var y =-1;y<2;y++){
			//make sure the they aren't diagonals
			if(Math.abs(x)==Math.abs(y)){continue;}
			//calculate the side were exploring using mods
			var curSide =(side+x+hex.sides)%hex.sides;
			//calculate the index
			var curIndex = index+y;
			//making sure the block exists at this side and index
			if(hex.blocks[curSide] === undefined){continue;}
			if(hex.blocks[curSide][curIndex] !== undefined){
				// checking equivalency of color, if its already been explored, and if it isn't already deleted
				if(hex.blocks[curSide][curIndex].color == color && search(deleting,[curSide,curIndex]) === false && hex.blocks[curSide][curIndex].deleted === 0 ) {
					//add this to the array of already explored
					deleting.push([curSide,curIndex]);
					//recall with next block explored
					floodFill(hex,curSide,curIndex,deleting);
				}
			}
		}
	}
}

function consolidateBlocks(hex,side,index){
	//record which sides have been changed
	var sidesChanged =[];
	var deleting=[];
	var deletedBlocks = [];
	//add start case
	deleting.push([side,index]);
	//fill deleting	
	floodFill(hex,side,index,deleting);
	//make sure there are more than 3 blocks to be deleted
	if(deleting.length<3){return;}
	var i;
	for(i=0; i<deleting.length;i++) {
		var arr = deleting[i];
		//just making sure the arrays are as they should be
		if(arr !== undefined && arr.length==2) {
			//add to sides changed if not in there
			if(sidesChanged.indexOf(arr[0])==-1){
				sidesChanged.push(arr[0]);
			}
			//mark as deleted
			hex.blocks[arr[0]][arr[1]].deleted = 1;
			deletedBlocks.push(hex.blocks[arr[0]][arr[1]]);
		}
	}

	// add scores
	var now = MainHex.ct;
	if(now - hex.lastCombo < settings.comboTime ){
		settings.comboTime = (1/settings.creationSpeedModifier) * (waveone.nextGen/16.666667) * 3;
		hex.comboMultiplier += 1;
		hex.lastCombo = now;
		var coords = findCenterOfBlocks(deletedBlocks);
		hex.texts.push(new Text(coords['x'],coords['y'],"x "+hex.comboMultiplier.toString(),"bold Q","#fff",fadeUpAndOut));
	}
	else{
		settings.comboTime = 240;
		hex.lastCombo = now;
		hex.comboMultiplier = 1;
	}
	var adder = deleting.length * deleting.length * hex.comboMultiplier;
	hex.texts.push(new Text(hex.x,hex.y,"+ "+adder.toString(),"bold Q ",deletedBlocks[0].color,fadeUpAndOut));
		hex.lastColorScored = deletedBlocks[0].color;
	score += adder;
	metrics.cleared += deleting.length;
	metrics.clearEvents++;
}


// Upstream: js/comboTimer.js
function drawTimer() {
	if(gameState==1){
		var leftVertexes = [];
		var rightVertexes = [];
	if(MainHex.ct - MainHex.lastCombo < settings.comboTime){
		for(var i=0;i<6;i++){
			var done = (MainHex.ct -MainHex.lastCombo);
			if(done<(settings.comboTime)*(5-i)*(1/6)){
				leftVertexes.push(calcSide(i,i+1,1,1));
								rightVertexes.push(calcSide(12-i,11-i,1,1));
			}
			else{
				leftVertexes.push(calcSide(i,i+1,1-((done*6)/settings.comboTime)%(1),1));
				rightVertexes.push(calcSide(12-i,11-i,1-((done*6)/settings.comboTime)%(1),1));
				break;
			}
		}
	}
		if(rightVertexes.length !== 0) drawSide(rightVertexes);
		if(leftVertexes.length !== 0) drawSide(leftVertexes);
	}
}

function calcSide(startVertex,endVertex,fraction,offset){
	startVertex = (startVertex+offset)%12;
	endVertex = (endVertex+offset)%12;
	ctx.globalAlpha=1;
	ctx.beginPath();
	ctx.lineCap = "round";

	var radius = (settings.rows * settings.blockHeight) * (2/Math.sqrt(3)) + settings.hexWidth ;
	var halfRadius = radius/2;
	var triHeight = radius *(Math.sqrt(3)/2);
	var Vertexes =[
		[(halfRadius*3)/2,triHeight/2],
		[radius,0],
		[(halfRadius*3)/2,-triHeight/2],
		[halfRadius,-triHeight],
		[0,-triHeight],
		[-halfRadius,-triHeight],
		[-(halfRadius*3)/2,-triHeight/2],
		[-radius,0],
		[-(halfRadius*3)/2,triHeight/2],
		[-halfRadius,triHeight],
		[0,triHeight],
		[halfRadius,triHeight]
	].reverse();
	var startX =trueCanvas.width/2 + Vertexes[startVertex][0];
	var startY =trueCanvas.height/2 + Vertexes[startVertex][1];
	var endX = trueCanvas.width/2 + Vertexes[endVertex][0];
	var endY = trueCanvas.height/2 + Vertexes[endVertex][1];
		return [[startX,startY],[((endX-startX)*fraction)+startX,((endY-startY)*fraction)+startY]];
}
function drawSide(vertexes){
	if (gameState === 0) {
		ctx.strokeStyle = hexColorsToTintedColors[MainHex.lastColorScored];
	} else {
		ctx.strokeStyle = MainHex.lastColorScored;
	}
	ctx.lineWidth =4*settings.scale;
		ctx.moveTo(vertexes[0][0][0],vertexes[0][0][1]);
	ctx.lineTo(vertexes[0][1][0],vertexes[0][1][1]);
		for(var i=1;i<vertexes.length;i++){
			ctx.lineTo(vertexes[i][1][0],vertexes[i][1][1]);
			ctx.moveTo(vertexes[i][1][0],vertexes[i][1][1]);
		}
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

}


// Upstream: js/wavegen.js
function blockDestroyed() {
	if (waveone.nextGen > 1350) {
		waveone.nextGen -= 30 * settings.creationSpeedModifier;
	} else if (waveone.nextGen > 600) {
		waveone.nextGen -= 8 * settings.creationSpeedModifier;
	} else {
		waveone.nextGen = 600;
	}

	if (waveone.difficulty < 35) {
		waveone.difficulty += 0.085 * settings.speedModifier;
	} else {
		waveone.difficulty = 35;
	}
}

function waveGen(hex) {
	this.lastGen = 0;
	this.last = 0;
	this.nextGen = 2700;
	this.start = 0;
	this.colors = colors;
	this.ct = 0;
	this.hex = hex;
	this.difficulty = 1;
	this.dt = 0;
	this.update = function() {
		this.currentFunction();
		this.dt = (settings.platform == 'mobile' ? 14 : 16.6667) * MainHex.ct;
		this.computeDifficulty();
		if ((this.dt - this.lastGen) * settings.creationSpeedModifier > this.nextGen) {
			if (this.nextGen > 600) {
				this.nextGen -= 11 * ((this.nextGen / 1300)) * settings.creationSpeedModifier;
			}
		}
	};

	this.randomGeneration = function() {
		if (this.dt - this.lastGen > this.nextGen) {
			this.ct++;
			this.lastGen = this.dt;
			var fv = randInt(0, MainHex.sides);
			addNewBlock(fv, colors[randInt(0, colors.length)], 1.6 + (this.difficulty / 15) * 3);
			var lim = 5;
			if (this.ct > lim) {
				var nextPattern = randInt(0, 3 + 21);
				if (nextPattern > 15) {
					this.ct = 0;
					this.currentFunction = this.doubleGeneration;
				} else if (nextPattern > 10) {
					this.ct = 0;
					this.currentFunction = this.crosswiseGeneration;
				} else if (nextPattern > 7) {
					this.ct = 0;
					this.currentFunction = this.spiralGeneration;
				} else if (nextPattern > 4) {
					this.ct = 0;
					this.currentFunction = this.circleGeneration;
				} else if (nextPattern > 1) {
					this.ct = 0;
					this.currentFunction = this.halfCircleGeneration;
				}
			}
		}
	};

	this.computeDifficulty = function() {
		if (this.difficulty < 35) {
			var increment;
			if (this.difficulty < 8) {
				 increment = (this.dt - this.last) / (5166667) * settings.speedModifier;
			} else if (this.difficulty < 15) {
				increment = (this.dt - this.last) / (72333333) * settings.speedModifier;
			} else {
				increment = (this.dt - this.last) / (90000000) * settings.speedModifier;
			}

			this.difficulty += increment * (1/2);
		}
	};

	this.circleGeneration = function() {
		if (this.dt - this.lastGen > this.nextGen + 500) {
			var numColors = randInt(1, 4);
			if (numColors == 3) {
				numColors = randInt(1, 4);
			}

			var colorList = [];
			nextLoop: for (var i = 0; i < numColors; i++) {
				var q = randInt(0, colors.length);
				for (var j in colorList) {
					if (colorList[j] == colors[q]) {
						i--;
						continue nextLoop;
					}
				}
				colorList.push(colors[q]);
			}

			for (var i = 0; i < MainHex.sides; i++) {
				addNewBlock(i, colorList[i % numColors], 1.5 + (this.difficulty / 15) * 3);
			}

			this.ct += 15;
			this.lastGen = this.dt;
			this.shouldChangePattern(1);
		}
	};

	this.halfCircleGeneration = function() {
		if (this.dt - this.lastGen > (this.nextGen + 500) / 2) {
			var numColors = randInt(1, 3);
			var c = colors[randInt(0, colors.length)];
			var colorList = [c, c, c];
			if (numColors == 2) {
				colorList = [c, colors[randInt(0, colors.length)], c];
			}

			var d = randInt(0, 6);
			for (var i = 0; i < 3; i++) {
				addNewBlock((d + i) % 6, colorList[i], 1.5 + (this.difficulty / 15) * 3);
			}

			this.ct += 8;
			this.lastGen = this.dt;
			this.shouldChangePattern();
		}
	};

	this.crosswiseGeneration = function() {
		if (this.dt - this.lastGen > this.nextGen) {
			var ri = randInt(0, colors.length);
			var i = randInt(0, colors.length);
			addNewBlock(i, colors[ri], 0.6 + (this.difficulty / 15) * 3);
			addNewBlock((i + 3) % MainHex.sides, colors[ri], 0.6 + (this.difficulty / 15) * 3);
			this.ct += 1.5;
			this.lastGen = this.dt;
			this.shouldChangePattern();
		}
	};

	this.spiralGeneration = function() {
		var dir = randInt(0, 2);
		if (this.dt - this.lastGen > this.nextGen * (2 / 3)) {
			if (dir) {
				addNewBlock(5 - (this.ct % MainHex.sides), colors[randInt(0, colors.length)], 1.5 + (this.difficulty / 15) * (3 / 2));
			} else {
				addNewBlock(this.ct % MainHex.sides, colors[randInt(0, colors.length)], 1.5 + (this.difficulty / 15) * (3 / 2));
			}
			this.ct += 1;
			this.lastGen = this.dt;
			this.shouldChangePattern();
		}
	};

	this.doubleGeneration = function() {
		if (this.dt - this.lastGen > this.nextGen) {
			var i = randInt(0, colors.length);
			addNewBlock(i, colors[randInt(0, colors.length)], 1.5 + (this.difficulty / 15) * 3);
			addNewBlock((i + 1) % MainHex.sides, colors[randInt(0, colors.length)], 1.5 + (this.difficulty / 15) * 3);
			this.ct += 2;
			this.lastGen = this.dt;
			this.shouldChangePattern();
		}
	};

	this.setRandom = function() {
		this.ct = 0;
		this.currentFunction = this.randomGeneration;
	};

	this.shouldChangePattern = function(x) {
		if (x) {
			var q = randInt(0, 4);
			this.ct = 0;
			switch (q) {
				case 0:
					this.currentFunction = this.doubleGeneration;
					break;
				case 1:
					this.currentFunction = this.spiralGeneration;
					break;
				case 2:
					this.currentFunction = this.crosswiseGeneration;
					break;
			}
		} else if (this.ct > 8) {
			if (randInt(0, 2) === 0) {
				this.setRandom();
				return 1;
			}
		}

		return 0;
	};

	// rest of generation functions

	this.currentFunction = this.randomGeneration;
}


// Upstream: js/update.js

//remember to update history function to show the respective iter speeds
function update(dt) {
	MainHex.dt = dt;
	if (gameState == 1) {
		waveone.update();
		if (MainHex.ct - waveone.prevTimeScored > 1000) {
			waveone.prevTimeScored = MainHex.ct;
		}
	}
	var lowestDeletedIndex = 99;
	var i;
	var j;
	var block;

	var objectsToRemove = [];
	for (i = 0; i < blocks.length; i++) {
		MainHex.doesBlockCollide(blocks[i]);
		if (!blocks[i].settled) {
			if (!blocks[i].initializing) blocks[i].distFromHex -= blocks[i].iter * dt * settings.scale;
		} else if (!blocks[i].removed) {
			blocks[i].removed = 1;
		}
	}

	for (i = 0; i < MainHex.blocks.length; i++) {
		for (j = 0; j < MainHex.blocks[i].length; j++) {
			if (MainHex.blocks[i][j].checked ==1 ) {
				consolidateBlocks(MainHex,MainHex.blocks[i][j].attachedLane,MainHex.blocks[i][j].getIndex());
				MainHex.blocks[i][j].checked=0;
			}
		}
	}

	for (i = 0; i < MainHex.blocks.length; i++) {
		lowestDeletedIndex = 99;
		for (j = 0; j < MainHex.blocks[i].length; j++) {
			block = MainHex.blocks[i][j];
			if (block.deleted == 2) {
				MainHex.blocks[i].splice(j,1);
				blockDestroyed();
				if (j < lowestDeletedIndex) lowestDeletedIndex = j;
				j--;
			}
		}

		if (lowestDeletedIndex < MainHex.blocks[i].length) {
			for (j = lowestDeletedIndex; j < MainHex.blocks[i].length; j++) {
				MainHex.blocks[i][j].settled = 0;
			}
		}
	}

	for (i = 0; i < MainHex.blocks.length; i++) {
		for (j = 0; j < MainHex.blocks[i].length; j++) {
			block = MainHex.blocks[i][j];
			MainHex.doesBlockCollide(block, j, MainHex.blocks[i]);

			if (!MainHex.blocks[i][j].settled) {
				MainHex.blocks[i][j].distFromHex -= block.iter * dt * settings.scale;
			}
		}
	}

	for(i = 0; i < blocks.length;i++){
		if (blocks[i].removed == 1) {
			blocks.splice(i,1);
			i--;
		}
	}

	MainHex.ct += dt;
}


// Upstream: js/view.js, canvas primitives retained
// t: current time, b: begInnIng value, c: change In value, d: duration
function easeOutCubic(t, b, c, d) {
	return c * ((t = t / d - 1) * t * t + 1) + b;
}

function renderText(x, y, fontSize, color, text, font) {
	ctx.save();
	if (!font) {
		var font = 'px system-ui, sans-serif';
	}

	fontSize *= settings.scale;
	ctx.font = fontSize + font;
	ctx.textAlign = 'center';
	ctx.fillStyle = color;
	ctx.fillText(text, x, y + (fontSize / 2) - 9 * settings.scale);
	ctx.restore();
}

function drawScoreboard() {
    renderText(trueCanvas.width / 2 + gdx, trueCanvas.height / 2 + gdy,
        score >= 1000000 ? 30 : 45, "#ecf0f1", gameState === 0 ? "六向" : String(score));
}

function clearGameBoard() {
	drawPolygon(trueCanvas.width / 2, trueCanvas.height / 2, 6, trueCanvas.width / 2, 30, hexagonBackgroundColor, 0, 'rgba(0,0,0,0)');
}

function drawPolygon(x, y, sides, radius, theta, fillColor, lineWidth, lineColor) {
	ctx.fillStyle = fillColor;
	ctx.lineWidth = lineWidth;
	ctx.strokeStyle = lineColor;

	ctx.beginPath();
	var coords = rotatePoint(0, radius, theta);
	ctx.moveTo(coords.x + x, coords.y + y);
	var oldX = coords.x;
	var oldY = coords.y;
	for (var i = 0; i < sides; i++) {
		coords = rotatePoint(oldX, oldY, 360 / sides);
		ctx.lineTo(coords.x + x, coords.y + y);
		oldX = coords.x;
		oldY = coords.y;
	}

	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = 'rgba(0,0,0,0)';
}



// Upstream: js/render.js, original board renderer
function render() {
	var grey = '#bdc3c7';
	if (gameState === 0) {
		grey = "rgb(220, 223, 225)";
	}
	
	ctx.clearRect(0, 0, trueCanvas.width, trueCanvas.height);
	clearGameBoard();
	if (gameState === 1 || gameState === 2 || gameState === -1 || gameState === 0) {
		if (op < 1) {
			op += 0.01;
		}
		ctx.globalAlpha = op;
		drawPolygon(trueCanvas.width / 2 , trueCanvas.height / 2 , 6, (settings.rows * settings.blockHeight) * (2/Math.sqrt(3)) + settings.hexWidth, 30, grey, false,6);
		drawTimer();
		ctx.globalAlpha = 1;
	}

	var i;
	for (i = 0; i < MainHex.blocks.length; i++) {
		for (var j = 0; j < MainHex.blocks[i].length; j++) {
			var block = MainHex.blocks[i][j];
			block.draw(true, j);
		}
	}
	for (i = 0; i < blocks.length; i++) {
		blocks[i].draw();
	}

	MainHex.draw();
	if (gameState ==1 || gameState ==-1 || gameState === 0) {
		drawScoreboard();
	}

	for (i = 0; i < MainHex.texts.length; i++) {
		var alive = MainHex.texts[i].draw();
		if(!alive){
			MainHex.texts.splice(i,1);
			i--;
		}
	}


	settings.prevScale = settings.scale;
	settings.hexWidth = settings.baseHexWidth * settings.scale;
	settings.blockHeight = settings.baseBlockHeight * settings.scale;
}



// Upstream: js/main.js, exact capacity rule
function isInfringing(hex) {
	for (var i = 0; i < hex.sides; i++) {
		var subTotal = 0;
		for (var j = 0; j < hex.blocks[i].length; j++) {
			subTotal += hex.blocks[i][j].deleted;
		}

		if (hex.blocks[i].length - subTotal > settings.rows) {
			return true;
		}
	}
	return false;
}



// Playgarden's native shell. No third-party runtime dependencies.
var REVISION = 'hextris-3f4847dc-playgarden-1';
var SESSION = new URLSearchParams(location.search).get('session') || '';
var SAVE_KEY = 'playgarden.hextris.original.save.v1';
var RECORD_KEY = 'playgarden.hextris.original.records.v1';
var WAVE_NAMES = ['randomGeneration', 'doubleGeneration', 'crosswiseGeneration', 'spiralGeneration', 'circleGeneration', 'halfCircleGeneration'];
var colors = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71'];
var hexColorsToTintedColors = {'#e74c3c':'rgb(241,163,155)','#f1c40f':'rgb(246,223,133)','#3498db':'rgb(151,201,235)','#2ecc71':'rgb(150,227,183)'};
var rgbColorsToTintedColors = {};
var hexagonBackgroundColor = '#edf2f0';
var angularVelocityConst = 4;
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var trueCanvas = { width: 1, height: 1 };
var settings, MainHex, waveone, blocks = [], score = 0, highscores = [];
var gameState = 0, gdx = 0, gdy = 0, op = 1;
var metrics = newMetrics();
var phase = 'welcome', hasPlayed = false, localPaused = false, hostPaused = false;
var disposed = false, raf = 0, lastTime = 0, lastSnapshot = 0, lastAutosave = 0;
var rush = 1, pressedBoost = new Set(), removers = [], saved = null;
var storageAvailable = true, helpOpen = false, pauseReason = '', staticPainting = false;
var $id = function (id) { return document.getElementById(id); };

function newMetrics() { return { spawned: 0, placed: 0, rotations: 0, cleared: 0, clearEvents: 0, frame: 0 }; }
function post(type, extra) {
    if (parent !== window) parent.postMessage(Object.assign({ source: 'playgarden-hextris', session: SESSION, type: type }, extra || {}), location.origin);
}
function status(message) { $id('message').textContent = message; post('status', { message: message }); }
function listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    removers.push(function () { target.removeEventListener(type, fn, options); });
}
function readStorage(key) {
    try { return localStorage.getItem(key); }
    catch (_) { storageAvailable = false; return null; }
}
function writeStorage(key, data) {
    try { localStorage.setItem(key, data); return true; }
    catch (_) { storageAvailable = false; return false; }
}
function removeStorage(key) {
    try { localStorage.removeItem(key); return true; }
    catch (_) { storageAvailable = false; return false; }
}
function configure(platform) {
    // All gameplay constants are unchanged from upstream initialization.js.
    var mobile = platform === 'mobile';
    settings = { platform: mobile ? 'mobile' : 'nonmobile', baseScale: mobile ? 1.4 : 1,
        startDist: mobile ? 227 : 340, creationDt: mobile ? 60 : 9, scale: 1, prevScale: 1,
        baseHexWidth: 87, hexWidth: 87, baseBlockHeight: 20, blockHeight: 20,
        rows: mobile ? 7 : 8, speedModifier: mobile ? 0.73 : 0.65,
        creationSpeedModifier: mobile ? 0.73 : 0.65, speedUpKeyHeld: false, comboTime: 310 };
}
function preferredPlatform() { return matchMedia('(pointer: coarse)').matches || innerWidth < 600 ? 'mobile' : 'nonmobile'; }
function scaleCanvas() {
    var previousScale = settings.scale;
    var bounds = canvas.getBoundingClientRect();
    trueCanvas = { width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) };
    settings.scale = Math.min(trueCanvas.width, trueCanvas.height) / 800 * settings.baseScale;
    settings.prevScale = settings.scale;
    settings.hexWidth = settings.baseHexWidth * settings.scale;
    settings.blockHeight = settings.baseBlockHeight * settings.scale;
    var ratio = Math.min(devicePixelRatio || 1, 3);
    canvas.width = Math.round(trueCanvas.width * ratio);
    canvas.height = Math.round(trueCanvas.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (MainHex) {
        blocks.concat.apply(blocks.slice(), MainHex.blocks).forEach(function (block) {
            block.distFromHex *= settings.scale / previousScale;
            block.height = settings.blockHeight;
        });
        MainHex.sideLength = settings.hexWidth;
        // A resize updates only geometry; it must not advance paused game state.
        paintStatic();
    }
}
function addNewBlock(blocklane, color, iter, distFromHex, settled) {
    // Original addNewBlock physics; development replay logging was removed.
    iter *= settings.speedModifier;
    blocks.push(new Block(blocklane, color, iter, distFromHex, settled));
    metrics.spawned++;
}
function currentWave() {
    return WAVE_NAMES.find(function (name) { return waveone.currentFunction === waveone[name]; }) || 'randomGeneration';
}
function snapshot() {
    return { phase: phase, paused: isPaused(), score: score, best: highscores[0] || 0,
        highscores: highscores.slice(), logicalTime: MainHex.ct, position: MainHex.position,
        rows: settings.rows, platform: settings.platform, rush: rush,
        comboMultiplier: MainHex.comboMultiplier || 1, comboTime: settings.comboTime,
        lastCombo: MainHex.lastCombo, wave: currentWave(), difficulty: waveone.difficulty,
        nextGen: waveone.nextGen, metrics: Object.assign({}, metrics),
        stacks: MainHex.blocks.map(function (lane) { return lane.map(function (b) { return { color: b.color, deleted: b.deleted, settled: b.settled }; }); }),
        falling: blocks.map(function (b) { return { lane: b.fallingLane, color: b.color,
            distance: b.distFromHex / settings.scale, initializing: b.initializing, settled: b.settled, ict: b.ict }; }),
        hasSave: !!saved, storageAvailable: storageAvailable, helpOpen: helpOpen };
}
function publish() {
    if (disposed) return;
    var state = snapshot();
    document.body.dataset.hextrisState = JSON.stringify(state);
    document.body.dataset.phase = phase;
    document.body.dataset.paused = String(isPaused());
    $id('score').textContent = String(score);
    $id('best').textContent = String(highscores[0] || 0);
    $id('combo').textContent = '×' + String(MainHex.comboMultiplier || 1);
    $id('wave').textContent = ({ randomGeneration: '随机', doubleGeneration: '双列', crosswiseGeneration: '对向', spiralGeneration: '螺旋', circleGeneration: '整环', halfCircleGeneration: '半环' })[currentWave()];
    $id('pause').textContent = localPaused ? '继续' : '暂停';
    $id('pause').disabled = phase !== 'playing' || hostPaused;
    $id('save').disabled = !hasPlayed || phase === 'lost';
    ['left', 'right', 'boost'].forEach(function (id) { $id(id).disabled = phase !== 'playing' || isPaused(); });
    $id('welcome').hidden = phase !== 'welcome';
    $id('lost').hidden = phase !== 'lost';
    $id('pause-cover').hidden = phase !== 'playing' || !isPaused() || helpOpen;
    $id('resume-save').hidden = !saved;
    $id('storage-note').hidden = storageAvailable;
    $id('help-panel').hidden = !helpOpen;
    $id('help').setAttribute('aria-expanded', String(helpOpen));
    $id('best-list').textContent = highscores.length ? highscores.join(' · ') : '还没有记录';
    $id('final-score').textContent = String(score);
    post('snapshot', { state: state });
}
function isPaused() { return hostPaused || localPaused; }
function resetBoost() { pressedBoost.clear(); rush = 1; settings.speedUpKeyHeld = false; }
function setBoost(id, on) {
    if (on && phase === 'playing' && !isPaused()) pressedBoost.add(id);
    else pressedBoost.delete(id);
    settings.speedUpKeyHeld = pressedBoost.size > 0;
    rush = settings.speedUpKeyHeld ? 4 : 1;
    publish();
}
function setPaused(value, fromHost, reason) {
    if (fromHost) {
        hostPaused = value;
        // Moving focus to the host pause button must not add an extra native pause.
        if (value && pauseReason === 'blur') { localPaused = false; pauseReason = ''; }
    } else {
        localPaused = value; pauseReason = value ? (reason || 'manual') : '';
        if (!value) helpOpen = false;
    }
    resetBoost();
    lastTime = performance.now();
    if (isPaused()) {
        cancelAnimationFrame(raf); raf = 0;
        saveGame();
    } else schedule();
    publish();
}
function startFresh() {
    removeStorage(SAVE_KEY); saved = null;
    resetBoost(); configure(preferredPlatform());
    MainHex = null; blocks = []; scaleCanvas();
    MainHex = new Hex(settings.hexWidth);
    MainHex.comboMultiplier = 1;
    MainHex.delay = 15;
    waveone = new waveGen(MainHex);
    score = 0; metrics = newMetrics(); hasPlayed = true;
    phase = 'playing'; gameState = 1; localPaused = false; pauseReason = ''; helpOpen = false;
    lastTime = performance.now(); lastAutosave = 0; lastSnapshot = 0;
    paintStatic(); publish(); schedule();
    status('左右旋转接住彩块；相邻同色 3 块起消除。按住下键或“加速”可四倍加速。');
    canvas.focus({ preventScroll: true });
}
function finishGame() {
    phase = 'lost'; gameState = 2; resetBoost();
    if (highscores.indexOf(score) === -1) highscores.push(score);
    highscores.sort(function (a, b) { return b - a; });
    highscores = highscores.slice(0, 3);
    writeStorage(RECORD_KEY, JSON.stringify({ version: 1, scores: highscores }));
    removeStorage(SAVE_KEY); saved = null;
    status('彩块超出外环，本局结束。得分 ' + score + '，可以再来一局。');
    publish();
}
function schedule() {
    if (!disposed && !raf && phase === 'playing' && !isPaused()) raf = requestAnimationFrame(tick);
}
function tick(now) {
    raf = 0;
    if (disposed || phase !== 'playing' || isPaused()) return;
    // Keep original 60 Hz physics and 4× rush. Bound only discontinuities (tab suspension).
    var dt = Math.min(Math.max(0, now - lastTime), 50) / 16.666 * rush;
    lastTime = now;
    render();
    if (!MainHex.delay) update(dt); else MainHex.delay--;
    metrics.frame++;
    if (isInfringing(MainHex)) { finishGame(); return; }
    if (now - lastAutosave > 3000) { saveGame(); lastAutosave = now; }
    if (now - lastSnapshot > 80) { publish(); lastSnapshot = now; }
    schedule();
}
function paintStatic() {
    // Upstream draw methods animate. Preserve all their state on an out-of-loop repaint.
    var objects = [MainHex].concat(blocks).concat.apply([MainHex].concat(blocks), MainHex.blocks).concat(MainHex.texts);
    var copies = objects.map(function (obj) {
        var copy = {};
        Object.keys(obj).forEach(function (key) { if (typeof obj[key] !== 'function') copy[key] = Array.isArray(obj[key]) ? obj[key].slice() : obj[key]; });
        return copy;
    });
    var oldGdx = gdx, oldGdy = gdy;
    var oldDt = MainHex.dt;
    MainHex.dt = 0; staticPainting = true;
    render();
    staticPainting = false;
    objects.forEach(function (obj, i) { Object.keys(copies[i]).forEach(function (key) { obj[key] = copies[i][key]; }); });
    MainHex.dt = oldDt; gdx = oldGdx; gdy = oldGdy;
}

// Strict, versioned plain-data storage. Constructor methods always come from this source.
var BLOCK_NUMBERS = ['fallingLane','iter','distFromHex','settled','angle','angularVelocity','targetAngle','deleted','removed','tint','opacity','initializing','ict','initLen','attachedLane','checked'];
var HEX_NUMBERS = ['ct','dt','position','angle','targetAngle','angularVelocity','lastCombo','comboMultiplier','playThrough','delay'];
var WAVE_NUMBERS = ['lastGen','last','nextGen','start','ct','difficulty','dt'];
function numeric(value, min, max, integer) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exactKeys(value, keys) { return plain(value) && Object.keys(value).length === keys.length && keys.every(function (key) { return Object.prototype.hasOwnProperty.call(value, key); }); }
function pickNumbers(object, names) { var result = {}; names.forEach(function (name) { result[name] = object[name] || 0; }); return result; }
function blockData(block) {
    var data = pickNumbers(block, BLOCK_NUMBERS);
    data.distFromHex /= settings.scale; data.color = block.color;
    return data;
}
function validateBlock(block, attached) {
    if (!exactKeys(block, BLOCK_NUMBERS.concat(['color'])) || colors.indexOf(block.color) === -1) return false;
    if (!BLOCK_NUMBERS.every(function (key) { return numeric(block[key], -1e10, 1e12, false); })) return false;
    if (!['fallingLane','attachedLane'].every(function (key) { return numeric(block[key], 0, 5, true); })) return false;
    if (!['settled','removed','initializing','checked'].every(function (key) { return numeric(block[key], 0, 1, true); })) return false;
    return numeric(block.deleted, 0, 2, true) && numeric(block.opacity, 0, 1, false) && numeric(block.tint, 0, 1, false) &&
        numeric(block.iter, 0, 100, false) && numeric(block.distFromHex, 0, 1000, false) &&
        numeric(block.initLen, 1, 60, false) && numeric(block.ict, 0, 1e12, false) && (!attached || block.removed === 1);
}
function validateSave(data) {
    if (!exactKeys(data, ['version','platform','score','comboTime','hex','blocks','wave','metrics']) || data.version !== 1 ||
        ['mobile','nonmobile'].indexOf(data.platform) === -1 || !numeric(data.score, 0, Number.MAX_SAFE_INTEGER, true) ||
        !numeric(data.comboTime, 1, 1e7, false)) return false;
    if (!exactKeys(data.hex, HEX_NUMBERS.concat(['lastColorScored','blocks'])) || !HEX_NUMBERS.every(function (key) { return numeric(data.hex[key], -1e10, 1e12, false); }) ||
        !numeric(data.hex.position, 0, 5, true) || !numeric(data.hex.dt, 0, 12.1, false) || !numeric(data.hex.ct, 0, 1e12, false) || !numeric(data.hex.comboMultiplier, 1, 1e8, true) ||
        !numeric(data.hex.delay, 0, 15, true) || !numeric(data.hex.playThrough, 0, 1e9, true) ||
        colors.concat(['#000']).indexOf(data.hex.lastColorScored) === -1 || !Array.isArray(data.hex.blocks) || data.hex.blocks.length !== 6) return false;
    if (!data.hex.blocks.every(function (lane, i) { return Array.isArray(lane) && lane.length <= 20 && lane.every(function (b) { return validateBlock(b, true) && b.attachedLane === i; }); })) return false;
    if (!Array.isArray(data.blocks) || data.blocks.length > 64 || !data.blocks.every(function (b) { return validateBlock(b, false) && b.removed === 0 && b.settled === 0; })) return false;
    if (!exactKeys(data.wave, WAVE_NUMBERS.concat(['pattern'])) || !WAVE_NUMBERS.every(function (key) { return numeric(data.wave[key], 0, 1e14, false); }) ||
        !numeric(data.wave.nextGen, 500, 2700, false) || !numeric(data.wave.difficulty, 1, 36, false) || WAVE_NAMES.indexOf(data.wave.pattern) === -1) return false;
    // Spiral uses ct as a lane index; only crosswise legitimately advances by 1.5.
    if (!Number.isInteger(data.wave.pattern === 'crosswiseGeneration' ? data.wave.ct / 1.5 : data.wave.ct)) return false;
    return exactKeys(data.metrics, Object.keys(newMetrics())) && Object.keys(data.metrics).every(function (key) { return numeric(data.metrics[key], 0, Number.MAX_SAFE_INTEGER, true); });
}
function exportSaveState() {
    var hex = pickNumbers(MainHex, HEX_NUMBERS);
    hex.lastColorScored = MainHex.lastColorScored;
    // Keep deletion flags so the original update removes faded blocks and drops blocks above them.
    hex.blocks = MainHex.blocks.map(function (lane) { return lane.map(blockData); });
    var wave = pickNumbers(waveone, WAVE_NUMBERS); wave.pattern = currentWave();
    return { version: 1, platform: settings.platform, score: score, comboTime: settings.comboTime,
        hex: hex, blocks: blocks.filter(function (b) { return !b.removed && !b.settled; }).map(blockData),
        wave: wave, metrics: Object.assign({}, metrics) };
}
function saveGame() {
    if (!hasPlayed || phase !== 'playing' || disposed || staticPainting) return false;
    var state = exportSaveState();
    if (!validateSave(state)) return false;
    if (writeStorage(SAVE_KEY, JSON.stringify(state))) { saved = state; return true; }
    return false;
}
function readSavedGame() {
    var raw = readStorage(SAVE_KEY);
    if (!raw) return null;
    try {
        if (raw.length > 150000) throw new Error('size');
        var data = JSON.parse(raw);
        if (validateSave(data)) return data;
    } catch (_) { /* Invalid saves are never executed or partially restored. */ }
    removeStorage(SAVE_KEY);
    status('旧存档无效，已安全跳过；可以开始新局。');
    return null;
}
function restoreBlock(data) {
    var block = new Block(data.fallingLane, data.color, data.iter);
    BLOCK_NUMBERS.forEach(function (key) { block[key] = data[key]; });
    block.distFromHex *= settings.scale;
    block.height = settings.blockHeight;
    return block;
}
function resumeSavedGame() {
    if (!saved || !validateSave(saved)) return;
    var data = saved;
    configure(data.platform); MainHex = null; blocks = []; scaleCanvas();
    MainHex = new Hex(settings.hexWidth);
    HEX_NUMBERS.forEach(function (key) { MainHex[key] = data.hex[key]; });
    MainHex.lastColorScored = data.hex.lastColorScored;
    MainHex.lastRotate = Date.now() - 100;
    MainHex.playThrough++;
    MainHex.blocks = data.hex.blocks.map(function (lane) { return lane.map(restoreBlock); });
    blocks = data.blocks.map(restoreBlock);
    waveone = new waveGen(MainHex);
    WAVE_NUMBERS.forEach(function (key) { waveone[key] = data.wave[key]; });
    waveone.currentFunction = waveone[data.wave.pattern];
    settings.comboTime = data.comboTime;
    score = data.score; metrics = Object.assign({}, data.metrics);
    hasPlayed = true; phase = 'playing'; gameState = 1; localPaused = false; pauseReason = ''; helpOpen = false;
    resetBoost(); lastTime = performance.now(); lastAutosave = lastTime;
    paintStatic(); publish(); schedule(); status('已恢复本机存档，继续守住六边形。');
    canvas.focus({ preventScroll: true });
}
function loadRecords() {
    try {
        var raw = readStorage(RECORD_KEY);
        if (!raw || raw.length > 256) return;
        var data = JSON.parse(raw);
        if (exactKeys(data, ['version','scores']) && data.version === 1 && Array.isArray(data.scores) && data.scores.length <= 3 &&
            data.scores.every(function (n) { return numeric(n, 0, Number.MAX_SAFE_INTEGER, true); })) {
            highscores = Array.from(new Set(data.scores)).sort(function (a, b) { return b - a; });
        }
    } catch (_) { highscores = []; }
}
function rotate(steps) {
    if (phase !== 'playing' || isPaused()) return;
    MainHex.rotate(steps); publish();
}
function toggleHelp() {
    helpOpen = !helpOpen;
    if (helpOpen && phase === 'playing') setPaused(true, false);
    publish();
}
function dispose() {
    if (disposed) return;
    saveGame(); resetBoost(); cancelAnimationFrame(raf); raf = 0;
    removers.splice(0).forEach(function (remove) { remove(); });
    disposed = true;
}

configure(preferredPlatform()); scaleCanvas();
MainHex = new Hex(settings.hexWidth); MainHex.comboMultiplier = 1; MainHex.delay = 15;
waveone = new waveGen(MainHex); loadRecords();
if (new URLSearchParams(location.search).get('fresh') === '1') removeStorage(SAVE_KEY);
else saved = readSavedGame();
paintStatic();
listen($id('start'), 'click', startFresh);
listen($id('restart'), 'click', startFresh);
listen($id('resume-save'), 'click', resumeSavedGame);
listen($id('pause'), 'click', function () { setPaused(!localPaused, false); });
listen($id('resume'), 'click', function () { if (!hostPaused) setPaused(false, false); });
listen($id('help'), 'click', toggleHelp);
listen($id('close-help'), 'click', toggleHelp);
listen($id('save'), 'click', function () {
    setPaused(true, false);
    status(saveGame() ? '进度已保存到本机。返回大厅或刷新后，选择“继续存档”即可接着玩。' : '浏览器未能保存进度；仍可继续当前游戏。');
    publish();
});
listen($id('left'), 'click', function () { rotate(1); });
listen($id('right'), 'click', function () { rotate(-1); });
listen($id('boost'), 'pointerdown', function (event) {
    if (phase !== 'playing' || isPaused()) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setBoost('pointer', true);
});
['pointerup','pointercancel','lostpointercapture'].forEach(function (type) { listen($id('boost'), type, function () { setBoost('pointer', false); }); });
listen(canvas, 'pointerdown', function (event) {
    if (event.button !== 0) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    var bounds = canvas.getBoundingClientRect(); rotate(event.clientX - bounds.left < bounds.width / 2 ? 1 : -1);
});
listen(document, 'keydown', function (event) {
    var key = event.key.toLowerCase();
    if (['arrowleft','arrowright','arrowdown','a','d','s','p','escape',' '].indexOf(key) === -1) return;
    if (key === ' ' && event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    if (key === 'arrowleft' || key === 'a') rotate(1);
    if (key === 'arrowright' || key === 'd') rotate(-1);
    if (key === 'arrowdown' || key === 's') setBoost(key, true);
    if (!event.repeat && ['p','escape',' '].indexOf(key) !== -1 && phase === 'playing' && !hostPaused) {
        if (helpOpen) helpOpen = false;
        setPaused(!localPaused, false);
    }
});
listen(document, 'keyup', function (event) { if (['arrowdown','s'].indexOf(event.key.toLowerCase()) !== -1) setBoost(event.key.toLowerCase(), false); });
listen(window, 'blur', function () { if (phase === 'playing' && !hostPaused && !localPaused) setPaused(true, false, 'blur'); else resetBoost(); });
listen(document, 'visibilitychange', function () { if (document.hidden && phase === 'playing' && !localPaused) setPaused(true, false, 'hidden'); });
listen(window, 'resize', function () { scaleCanvas(); publish(); });
listen(window, 'pagehide', function (event) {
    if (event.persisted) { setPaused(true, false, 'hidden'); saveGame(); }
    else dispose();
});
listen(window, 'pageshow', function (event) { if (event.persisted && !disposed) { paintStatic(); publish(); } });
listen(window, 'message', function (event) {
    if (event.source !== parent || event.origin !== location.origin || !event.data || event.data.source !== 'playgarden-host' || event.data.session !== SESSION) return;
    if (event.data.type === 'pause' && typeof event.data.paused === 'boolean') setPaused(event.data.paused, true);
    if (event.data.type === 'hint') { helpOpen = true; if (phase === 'playing') setPaused(true, false); publish(); }
    if (event.data.type === 'dispose') dispose();
});
publish(); post('ready', { revision: REVISION, endless: true });

})();
