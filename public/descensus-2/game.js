// Descensus 2, MIT Tom W Hall; documented Playgarden changes GPL-3.0-only.
(function(){"use strict";const modules={
"Assets/loadFonts":function(require,exports){
exports.default = Promise.resolve();

},
"Assets/loadSounds":function(require,exports){
exports.default = Promise.reject('Web context, no sound');

},
"Assets/loadTextures":function(require,exports){
var texturesPromise = new Promise((resolve, reject)=>{
    const loader = new PIXI.loaders.Loader();
    loader.add('ball', window.DESCENSUS_IMAGES['ball.png']);
    loader.add('ballReflections', window.DESCENSUS_IMAGES['ball-reflections.png']);
    loader.add('girder', window.DESCENSUS_IMAGES['girder.png']);
    loader.add('brick', window.DESCENSUS_IMAGES['brick.png']);
    loader.add('seesaw', window.DESCENSUS_IMAGES['seesaw.png']);
    loader.add('spinner', window.DESCENSUS_IMAGES['spinner.png']);
    loader.add('saw', window.DESCENSUS_IMAGES['saw.png']);
    loader.add('sawSmall', window.DESCENSUS_IMAGES['saw-small.png']);
    loader.add('twoByFour', window.DESCENSUS_IMAGES['two-by-four.png']);
    loader.add('clouds', window.DESCENSUS_IMAGES['clouds.jpg']);
    loader.add('bar', window.DESCENSUS_IMAGES['bar.png']);
    loader.add('helpHand', window.DESCENSUS_IMAGES['help-hand.png']);
    loader.add('plus1Life', window.DESCENSUS_IMAGES['plus-1-life.png']);
    loader.add('windLeft', window.DESCENSUS_IMAGES['wind-left.png']);
    loader.add('windRight', window.DESCENSUS_IMAGES['wind-right.png']);
    loader.add('timeBar', window.DESCENSUS_IMAGES['time-bar.png']);
    loader.add('timeBarTime', window.DESCENSUS_IMAGES['time-bar-time.png']);
    loader.add('ground', window.DESCENSUS_IMAGES['ground.png']);
    loader.add('paper', window.DESCENSUS_IMAGES['paper.jpg']);
    loader.onError.add((error)=>reject(error));
    loader.load((loader, resources)=>{
        const textures = {};
        for(var resourceKey in resources){
            textures[resourceKey] = resources[resourceKey].texture;
        }
        if (Object.values(textures).some((texture)=>!texture)) {
            reject(new Error('Required texture missing'));
            return;
        }
        resolve(textures);
    });
});
exports.default = texturesPromise;

},
"Bar":function(require,exports){
const materials = require("p2/materials").default;
const p2Util = require("p2/p2Util").default;
const Bus = require("Bus").default;
let stage;
let container;
let barContainer;
let worldPointA;
let worldPointB;
let pixiPointB;
let body;
let box;
let sprite;
let finalized;
let pointer = null;
let settleRemaining = 0;
let isActiveState = false;
function initialize(world, pixiGraph, textures) {
    stage = pixiGraph.stage;
    container = pixiGraph.container;
    barContainer = pixiGraph.barContainer;
    body = new p2.Body({
        mass: 20000,
        position: [
            -999999,
            0
        ]
    });
    body.gravityScale = 0;
    body.allowSleep = false;
    box = new p2.Box({
        width: 0.25,
        height: 0.25
    });
    box.material = materials.wood;
    body.addShape(box);
    sprite = new PIXI.Sprite(textures.bar);
    sprite.width = box.width * 64;
    sprite.height = box.height * 64;
    sprite.anchor = new PIXI.ObservablePoint(null, null, 0.5, 0.5);
    pixiGraph.barContainer.addChild(sprite);
    body.sprite = sprite;
    finalized = true;
    world.addBody(body);
    world.on('beginContact', beginContact, this);
    addTouchHandlers();
}
function click(e) {
    if (!finalized) return;
    finalized = false;
    box.sensor = true;
    const point = e.data.getLocalPosition(stage);
    worldPointA = getWorldPosition(point);
    worldPointB = [
        worldPointA[0],
        worldPointA[1]
    ];
    pixiPointB = new PIXI.Point(point.x, point.y);
    update();
}
function drag(e) {
    if (finalized) return;
    const point = e.data.getLocalPosition(stage);
    pixiPointB.x = point.x;
    pixiPointB.y = point.y;
    box.sensor = false;
}
function update(delta = 0) {
    if (settleRemaining > 0) {
        settleRemaining -= delta;
        if (settleRemaining <= 0) p2Util.resetBody(body);
    }
    if (finalized) return;
    const newWorldPointB = getWorldPosition(pixiPointB);
    if (newWorldPointB[0] === worldPointB[0] && newWorldPointB[1] === worldPointB[1]) return;
    worldPointB[0] = newWorldPointB[0];
    worldPointB[1] = newWorldPointB[1];
    const x1 = worldPointA[0];
    const y1 = worldPointA[1];
    const x2 = worldPointB[0];
    const y2 = worldPointB[1];
    const xDiff = x2 - x1;
    const yDiff = y2 - y1;
    body.position[0] = (x1 + x2) / 2;
    body.position[1] = (y1 + y2) / 2;
    body.angle = Math.atan2(yDiff, xDiff);
    const width = Math.max(0.25, Math.sqrt(xDiff * xDiff + yDiff * yDiff));
    box.width = width;
    const convex = box;
    convex.vertices[0][0] = -width / 2;
    convex.vertices[0][1] = -0.125;
    convex.vertices[1][0] = width / 2;
    convex.vertices[1][1] = -0.125;
    convex.vertices[2][0] = width / 2;
    convex.vertices[2][1] = 0.125;
    convex.vertices[3][0] = -width / 2;
    convex.vertices[3][1] = 0.125;
    convex.updateTriangles();
    convex.updateCenterOfMass();
    convex.updateBoundingRadius();
    convex.updateArea();
    body.updateAABB();
    body.updateBoundingRadius();
    sprite.position.x = body.position[0] * 64;
    sprite.position.y = -body.position[1] * 64;
    sprite.width = width * 64;
}
function finalize() {
    if (finalized) return;
    update();
    settleRemaining = 50;
    finalized = true;
}
function reset() {
    finalized = true;
    pointer = null;
    settleRemaining = 0;
    if (body) p2Util.resetBody(body);
}
function cancel() {
    finalize();
    pointer = null;
    settleRemaining = 0;
    if (body) p2Util.resetBody(body);
}
function hide() {
    reset();
    p2Util.updateBodyPosition(body, [
        -999999,
        0
    ]);
}
function getWorldPosition(point) {
    const pixiRendererContainerPosition = container.position;
    return [
        (point.x - pixiRendererContainerPosition.x) / 64,
        (pixiRendererContainerPosition.y - point.y) / 64
    ];
}
function addTouchHandlers() {
    function onTouch(e) {
        if (!isActiveState) return;
        if (pointer !== null) return;
        pointer = e.data.identifier ?? -1;
        click(e);
    }
    function onDrag(e) {
        if (!isActiveState) return;
        if (pointer !== (e.data.identifier ?? -1)) return;
        drag(e);
    }
    function onRelease(e) {
        if (!isActiveState) return;
        if (pointer !== (e.data.identifier ?? -1)) return;
        finalize();
        pointer = null;
    }
    barContainer.on('touchstart', onTouch);
    barContainer.on('touchmove', onDrag);
    barContainer.on('touchend', onRelease);
    barContainer.on('touchendoutside', onRelease);
    barContainer.on('touchcancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('touchcancel', cancel);
    barContainer.on('mousedown', onTouch);
    barContainer.on('mousemove', onDrag);
    barContainer.on('mouseup', onRelease);
    barContainer.on('mouseupoutside', onRelease);
}
function beginContact(contactEvent) {
    if (finalized) return;
    const bodyA = contactEvent.bodyA;
    const bodyB = contactEvent.bodyB;
    const barBody = body;
    if (!(bodyA === barBody || bodyB === barBody)) return;
    if (box.sensor) {
        hide();
        return;
    }
    finalize();
}
Bus.subscribe('State.IsActive', (isActive)=>{
    isActiveState = isActive;
    if (!isActive && body) cancel();
});
exports.default = {
    initialize,
    update,
    finalize,
    hide,
    cancel,
    reset,
    read: ()=>({
            finalized,
            pointer,
            settleRemaining,
            position: body ? [
                ...body.position
            ] : null,
            angle: body?.angle,
            width: box?.width
        })
};

},
"Bus":function(require,exports){
const topics = {};
function subscribe(topic, subscriber) {
    if (!topics[topic]) {
        topics[topic] = [];
    }
    if (topics[topic].indexOf(subscriber) === -1) {
        topics[topic].push(subscriber);
    }
}
function unsubscribe(topic, subscriber) {
    if (!topics[topic]) return;
    var index = topics[topic].indexOf(subscriber);
    if (index !== -1) {
        topics[topic].splice(index, 1);
    }
}
function publish(topic, data) {
    var subscribers = topics[topic];
    if (subscribers) {
        for(var i = 0; i < subscribers.length; i++){
            var subscriber = subscribers[i];
            subscriber(data);
        }
    }
}
exports.default = {
    subscribe,
    unsubscribe,
    publish
};

},
"Color":function(require,exports){
var Color = /*#__PURE__*/ function(Color) {
    Color[Color["blue"] = 6724095] = "blue";
    Color[Color["yellow"] = 16108847] = "yellow";
    Color[Color["orange"] = 16607755] = "orange";
    Color[Color["red"] = 16729156] = "red";
    return Color;
}(Color || {});
exports.default = Color;

},
"Game/GameState":function(require,exports){
var GameState = /*#__PURE__*/ function(GameState) {
    GameState[GameState["PageHidden"] = 0] = "PageHidden";
    GameState[GameState["Intro"] = 1] = "Intro";
    GameState[GameState["Active"] = 2] = "Active";
    GameState[GameState["Dying"] = 3] = "Dying";
    GameState[GameState["Menu"] = 4] = "Menu";
    GameState[GameState["Won"] = 5] = "Won";
    GameState[GameState["Lost"] = 6] = "Lost";
    return GameState;
}(GameState || {});
exports.default = GameState;

},
"Game/gameLoop":function(require,exports){
const gameClock = require("Utility/gameClock").default;
const GameState = require("Game/GameState").default;
const TerrainObject = require("Terrain/Objects/TerrainObject").default;
const randomUtil = require("Utility/randomUtil").default;
const soundPlayer = require("Sound/soundPlayer").default;
const pixiRenderer = require("Pixi/PixiRenderer").default;
const bar = require("Bar").default;
const terrainBuilder = require("Terrain/terrainBuilder").default;
const Color = require("Color").default;
const tintUtil = require("Utility/tintUtil").default;
const timer = require("Utility/timer").default;
const p2Util = require("p2/p2Util").default;
const Bus = require("Bus").default;
const startingHeight = 1000;
const startingLives = 5;
let height = startingHeight;
let lives = startingLives;
let timeElapsed = null;
let timeSinceLastCheckpoint = null;
let nextCheckpointHeight = null;
let clockTicking;
let isInvincible = false;
let timeSinceInvincible = null;
let fatalTerrainObject;
let tintedSprites = [];
let world = null;
let pixiGraph = null;
let ballBody;
let screenAABB = new p2.AABB();
let lastAnimateTime;
let state;
let preNavState;
let prePageHiddenState;
let stopped = false, raf = 0, externalPaused = true, localPaused = false, frames = 0;
let lastLoss = "", wonCount = 0, lossCount = 0, resetCount = 0;
function initialize(wld, pxGraph, ballBdy) {
    world = wld;
    pixiGraph = pxGraph;
    ballBody = ballBdy;
    document.addEventListener('visibilitychange', handleVisibilityChange, false);
    pixiGraph.terrainContainer.visible = false;
    preNavState = GameState.Active;
    setState(GameState.Intro);
    soundPlayer.play('saw');
    raf = requestAnimationFrame(animate);
}
function handleVisibilityChange() {
    if (document.hidden) {
        if (state !== GameState.PageHidden) {
            prePageHiddenState = state;
            bar.cancel();
            setState(GameState.PageHidden);
        }
    } else if (state === GameState.PageHidden && prePageHiddenState !== undefined) {
        lastAnimateTime = performance.now();
        setState(prePageHiddenState);
    }
}
function setPaused(paused) {
    externalPaused = paused;
    bar.cancel();
    lastAnimateTime = performance.now();
}
function setLocalPaused(paused) {
    localPaused = paused;
    bar.cancel();
    lastAnimateTime = performance.now();
}
function dispose() {
    stopped = true;
    cancelAnimationFrame(raf);
    bar.cancel();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    pixiRenderer.destroy(true);
}
function animate(time) {
    if (stopped) return;
    raf = requestAnimationFrame(animate);
    if (externalPaused || localPaused) {
        lastAnimateTime = time;
        return;
    }
    frames++;
    if (state === GameState.PageHidden) return;
    const fixedTimeStep = 1 / 60;
    let deltaTime = Math.min(100, Math.max(0, time - (lastAnimateTime || time)));
    lastAnimateTime = time;
    switch(state){
        case GameState.Active:
            const containerPosition = pixiGraph.container.position;
            const ballBodyPositionX = ballBody.position[0];
            const ballBodyPositionY = ballBody.position[1];
            gameClock.advance(deltaTime);
            processInvincibility(deltaTime);
            updateScreenAABB();
            bar.update(deltaTime);
            terrainBuilder.update(ballBody, screenAABB);
            world.step(fixedTimeStep, deltaTime / 1000, 5);
            p2Util.limitVelocity(world);
            if (state !== GameState.Active) {
                updateTransforms();
                break;
            }
            processHeightChange(ballBodyPositionY);
            processCheckpoints(ballBodyPositionY, deltaTime);
            setScroll(ballBodyPositionX, ballBodyPositionY, containerPosition);
            updateTransforms();
            timeElapsed += deltaTime;
            break;
        case GameState.Dying:
            processLifeLostAnimation(deltaTime);
            break;
        case GameState.Won:
            processGameWonAnimation(deltaTime);
            break;
        case GameState.Lost:
            processGameLostAnimation(deltaTime);
            break;
    }
    pixiRenderer.render(pixiGraph.stage);
}
function processHeightChange(ballBodyPositionY) {
    if (ballBodyPositionY <= 0) return;
    const currentHeight = Math.round(ballBodyPositionY);
    if (currentHeight !== height) {
        height = currentHeight;
        Bus.publish('Height.Set', height);
    }
}
function processCheckpoints(ballBodyPositionY, deltaTime) {
    if (ballBodyPositionY <= 0) return;
    if (nextCheckpointHeight === null || ballBodyPositionY <= nextCheckpointHeight) {
        nextCheckpointHeight = Math.floor(ballBodyPositionY / 100) * 100;
        if (nextCheckpointHeight === ballBodyPositionY) {
            nextCheckpointHeight -= 100;
        }
        timeSinceLastCheckpoint = 0;
        Bus.publish('NextCheckpointHeight.Set', nextCheckpointHeight);
        soundPlayer.stop('clock');
        clockTicking = false;
        soundPlayer.play('checkpoint');
    } else {
        timeSinceLastCheckpoint += deltaTime;
    }
    let timeRemainingQuotient = 1 - timeSinceLastCheckpoint / 30000;
    if (timeRemainingQuotient <= 0) {
        timeSinceLastCheckpoint = 0;
        timeRemainingQuotient = 0;
        soundPlayer.stop('clock');
        clockTicking = false;
        lostLife(null);
    } else if (timeRemainingQuotient <= 1 / 3 && !clockTicking) {
        soundPlayer.play('clock');
        clockTicking = true;
    }
    Bus.publish('TimeRemainingQuotient.Set', timeRemainingQuotient);
}
function processInvincibility(deltaTime) {
    if (isInvincible) {
        timeSinceInvincible += deltaTime;
        if (timeSinceInvincible > 3000) {
            timeSinceInvincible = 0;
            isInvincible = false;
            Bus.publish('IsInvincible.Set', isInvincible);
        }
    }
}
function setScroll(ballBodyPositionX, ballBodyPositionY, containerPosition) {
    containerPosition.x = pixiRenderer.screen.width / 2 - ballBodyPositionX * 64;
    containerPosition.y = 640 + ballBodyPositionY * 64;
    const backgroundPosition = pixiGraph.background.position;
    backgroundPosition.x = (containerPosition.x + 10000000) / 2 % 1024;
    backgroundPosition.y = (containerPosition.y + 10000000) / 2 % 1024;
}
function updateTransforms() {
    const pixelsPerUnit = 64;
    const bodies = world.bodies;
    for(let i = 0; i < bodies.length; i++){
        const body = bodies[i];
        if (body.aabbNeedsUpdate) {
            body.updateAABB();
        }
        const aabb = body.aabb;
        const interpolatedPosition = body.interpolatedPosition;
        const isOnScreen = !(aabb.lowerBound[1] > screenAABB.upperBound[1] || aabb.upperBound[1] < screenAABB.lowerBound[1] || aabb.upperBound[0] < screenAABB.lowerBound[0] || aabb.lowerBound[0] > screenAABB.upperBound[0]);
        const displayObject = body.sprite;
        if (displayObject) {
            const position = displayObject.position;
            position.x = interpolatedPosition[0] * pixelsPerUnit;
            position.y = -interpolatedPosition[1] * pixelsPerUnit;
            displayObject.rotation = -body.interpolatedAngle;
            displayObject.visible = isOnScreen;
        }
        const displayObjectReflection = body.spriteReflection;
        if (displayObjectReflection) {
            const position = displayObjectReflection.position;
            position.x = interpolatedPosition[0] * pixelsPerUnit;
            position.y = -interpolatedPosition[1] * pixelsPerUnit;
            displayObjectReflection.visible = isOnScreen;
        }
    }
}
function processLifeLostAnimation(deltaTime) {
    const increments = 1000 / deltaTime * 1.5;
    const alphaDelta = 1 / increments;
    pixiGraph.playerBallContainer.alpha -= alphaDelta;
    if (pixiGraph.playerBallContainer.alpha <= 0) {
        tintUtil.untintSprite(ballBody.sprite);
        tintUtil.untintSprite(ballBody.spriteReflection);
        if (fatalTerrainObject) {
            fatalTerrainObject.deactivate();
            tintUtil.untintTerrainObject(fatalTerrainObject);
            fatalTerrainObject = null;
        }
        pixiGraph.playerBallContainer.alpha = 1;
        p2Util.resetBody(ballBody);
        if (lives <= 0) {
            gameLost();
            return;
        }
        setState(GameState.Active);
        isInvincible = true;
        Bus.publish('IsInvincible.Set', isInvincible);
        soundPlayer.resumeAll();
    }
}
function getVisibleSprites() {
    const visibleSprites = pixiGraph.terrainContainer.children.map((displayObject)=>displayObject instanceof PIXI.Sprite ? [
            displayObject
        ] : displayObject.children.filter((sprite)=>sprite.visible));
    return [
        pixiGraph.background
    ].concat(pixiGraph.barContainer.children[0]).concat(...visibleSprites);
}
function lostLife(fatalBody) {
    if (state !== GameState.Active) return;
    lastLoss = fatalBody ? "saw" : "timeout";
    lossCount++;
    lives--;
    Bus.publish('Lives.Set', lives);
    bar.finalize();
    setState(GameState.Dying);
    soundPlayer.pauseAll();
    if (fatalBody) {
        soundPlayer.play('lostLife');
    } else {
        soundPlayer.play('alarm');
    }
}
function gameLost() {
    setState(GameState.Lost);
    soundPlayer.stopAll();
    soundPlayer.play('lost');
    tintedSprites = getVisibleSprites();
    for(let i = 0; i < tintedSprites.length; i++){
        tintUtil.tintSprite(tintedSprites[i], Color.red);
    }
}
function processGameLostAnimation(deltaTime) {
    const increments = 1000 / deltaTime * 3;
    const alphaDelta = 1 / increments;
    pixiGraph.background.alpha -= alphaDelta;
    pixiGraph.container.alpha -= alphaDelta;
    if (pixiGraph.container.alpha <= 0) {
        startNewGame();
    }
}
function gameWon() {
    if (state !== GameState.Active) return;
    wonCount++;
    setState(GameState.Won);
    soundPlayer.stopAll();
    soundPlayer.play('won');
    Bus.publish('Menu.RequestGameWonPanel', {
        time: timeElapsed,
        lives: lives
    });
}
function processGameWonAnimation(deltaTime) {
    Bus.publish('Menu.IncrementGameWonPanelAlpha', deltaTime);
}
function updateScreenAABB() {
    const ballBodyPosition = ballBody.position;
    const ballBodyPositionX = ballBodyPosition[0];
    const ballBodyPositionY = ballBodyPosition[1];
    screenAABB.lowerBound[0] = ballBodyPositionX - 8;
    screenAABB.lowerBound[1] = ballBodyPositionY - 18;
    screenAABB.upperBound[0] = ballBodyPositionX + 8;
    screenAABB.upperBound[1] = ballBodyPositionY + 10;
}
function startNewGame() {
    resetCount++;
    gameClock.reset();
    bar.reset();
    localPaused = false;
    timeSinceInvincible = 0;
    clockTicking = false;
    lastAnimateTime = performance.now();
    Bus.publish("IsInvincible.Set", false);
    randomUtil.reseed();
    terrainBuilder.deactivateAll();
    height = startingHeight;
    Bus.publish('Height.Set', height);
    lives = startingLives;
    Bus.publish('Lives.Set', lives);
    isInvincible = false;
    timeSinceLastCheckpoint = 0;
    nextCheckpointHeight = startingHeight - 100;
    Bus.publish('NextCheckpointHeight.Set', nextCheckpointHeight);
    timeElapsed = 0;
    p2Util.updateBodyPosition(ballBody, [
        0,
        height
    ]);
    tintUtil.untintSprite(ballBody.sprite);
    tintUtil.untintSprite(ballBody.spriteReflection);
    for(let i = 0; i < tintedSprites.length; i++){
        tintUtil.untintSprite(tintedSprites[i]);
    }
    pixiGraph.background.alpha = 1;
    pixiGraph.container.alpha = 1;
    if (fatalTerrainObject) {
        tintUtil.untintTerrainObject(fatalTerrainObject);
        fatalTerrainObject = null;
    }
    pixiGraph.playerBallContainer.alpha = 1;
    pixiGraph.sawContainer.alpha = 1;
    pixiGraph.freeSawContainer.alpha = 1;
    soundPlayer.stopAll();
    bar.hide();
    setState(GameState.Active);
}
function setState(newState) {
    state = newState;
    const isActive = state === GameState.Active;
    pixiRenderer.view.className = isActive ? 'playing-field' : '';
    Bus.publish('State.IsActive', isActive);
}
Bus.subscribe('Menu.Shown', ()=>{
    pixiGraph.background.visible = false;
    pixiGraph.container.visible = false;
    pixiGraph.windLeft.visible = false;
    pixiGraph.windRight.visible = false;
    soundPlayer.pauseAll();
    preNavState = state;
    setState(GameState.Menu);
});
Bus.subscribe('Menu.Hidden', ()=>{
    pixiGraph.background.visible = true;
    if (state === GameState.Intro) {
        pixiGraph.terrainContainer.visible = true;
        startNewGame();
    } else {
        pixiGraph.container.visible = true;
        soundPlayer.resumeAll();
        setState(preNavState);
    }
});
Bus.subscribe('Menu.RequestRestartGame', ()=>{
    pixiGraph.background.visible = true;
    pixiGraph.container.visible = true;
    startNewGame();
});
Bus.subscribe('Ball.CollisionWithFatal', (fatalBody)=>{
    if (state === GameState.Active && !isInvincible) {
        fatalTerrainObject = fatalBody.terrainObject;
        tintUtil.tintSprite(ballBody.sprite, Color.red);
        tintUtil.tintSprite(ballBody.spriteReflection, Color.red);
        tintUtil.tintTerrainObject(fatalTerrainObject, Color.red);
        lostLife(fatalBody);
    }
});
Bus.subscribe('Ball.CollisionWithPlusOne', ()=>{
    if (state !== GameState.Active) return;
    lives++;
    Bus.publish('Lives.Set', lives);
    soundPlayer.play('gainedLife');
});
Bus.subscribe('Ball.CollisionWithGround', ()=>{
    gameWon();
});
function read() {
    return {
        state: GameState[state],
        paused: externalPaused || localPaused || state === GameState.PageHidden,
        localPaused,
        externalPaused,
        height,
        lives,
        timeElapsed,
        timeSinceLastCheckpoint,
        nextCheckpointHeight,
        isInvincible,
        timeSinceInvincible,
        physicsClock: gameClock.now(),
        frames,
        lastLoss,
        lossCount,
        resetCount,
        wonCount,
        ball: ballBody ? {
            position: [
                ...ballBody.position
            ],
            velocity: [
                ...ballBody.velocity
            ],
            radius: 1
        } : null,
        camera: pixiGraph ? {
            x: pixiGraph.container.x,
            y: pixiGraph.container.y
        } : null,
        bar: bar.read(),
        wind: pixiGraph ? {
            left: pixiGraph.windLeft.visible,
            right: pixiGraph.windRight.visible
        } : null,
        bodies: world ? world.bodies.filter((b)=>b.sprite && b.sprite.visible).map((b)=>({
                id: b.id,
                position: [
                    ...b.position
                ],
                velocity: [
                    ...b.velocity
                ],
                angle: b.angle,
                angularVelocity: b.angularVelocity,
                shapeOffsets: b.shapes.map((x)=>[
                        ...x.position
                    ]),
                shapeAngles: b.shapes.map((x)=>x.angle),
                fatal: !!b.isFatal,
                ground: !!b.isGround,
                type: b.terrainObject?.type,
                shapes: b.shapes.map((x)=>({
                        radius: x.radius,
                        width: x.width,
                        height: x.height,
                        vertices: x.vertices?.map((v)=>[
                                ...v
                            ])
                    }))
            })) : []
    };
}
exports.default = {
    initialize,
    setPaused,
    setLocalPaused,
    dispose,
    read
};

},
"Pixi/PixiRenderer":function(require,exports){
const widthUnits = 16;
const heightUnits = 28;
const pixelsPerUnit = 64;
const width = widthUnits * pixelsPerUnit;
const height = heightUnits * pixelsPerUnit;
const playfield = document.getElementById('playfield');
const fit = Math.min(playfield.clientWidth / width, playfield.clientHeight / height);
const backingWidth = Math.min(width, Math.max(4, Math.ceil(width * fit * (window.devicePixelRatio || 1) / 4) * 4));
const resolution = backingWidth / width;
const rendererOptions = {
    transparent: false,
    backgroundColor: 0x000000,
    resolution
};
const renderer = new PIXI.WebGLRenderer(width, height, rendererOptions);
const view = renderer.view;
view.id = 'viewport';
view.dataset.logicalWidth = String(width);
view.dataset.logicalHeight = String(height);
view.dataset.renderResolution = String(resolution);
view.style.display = 'none';
view.style.marginLeft = 'auto';
view.style.marginRight = 'auto';
document.getElementById('playfield').appendChild(view);
view.addEventListener('webglcontextlost', (event)=>{
    event.preventDefault();
    window.descensusFailure('图形上下文中断，请重试。');
});
function resizeView() {
    resize(renderer);
}
window.addEventListener('resize', ()=>{
    resizeView();
});
window.addEventListener('orientationchange', ()=>{
    resizeView();
});
resizeView();
function resize(renderer) {
    const windowWidth = document.getElementById('playfield').clientWidth;
    const windowHeight = document.getElementById('playfield').clientHeight;
    const view = renderer.view;
    const windowRatio = windowWidth / windowHeight;
    const pixiRatio = width / height;
    if (windowRatio > pixiRatio) {
        view.style.width = Math.floor(windowHeight * pixiRatio) + 'px';
        view.style.height = windowHeight + 'px';
    } else {
        view.style.width = windowWidth + 'px';
        view.style.height = Math.floor(windowWidth / pixiRatio) + 'px';
    }
}
exports.default = renderer;

},
"Pixi/buildNavContainer":function(require,exports){
const Color = require("Color").default;
const pixiRenderer = require("Pixi/PixiRenderer").default;
const blendColors = require("Utility/blendColors").default;
const Bus = require("Bus").default;
const version = '1.0.0.0';
const width = pixiRenderer.screen.width;
const height = pixiRenderer.screen.height;
const xCenter = width / 2;
const tinyTextStyle = getTextStyle(0.5);
const smallTextStyle = getTextStyle(0.6);
const mediumTextStyle = getTextStyle(0.7);
const largeTextStyle = getTextStyle(0.8);
const hugeTextStyle = getTextStyle(1);
function buildNavContainer(textures, soundSupported) {
    const navContainer = new PIXI.Container;
    const navBackground = buildNavBackground(textures);
    const introPanel = buildIntroPanel(textures);
    const menuPanel = buildMenuPanel(soundSupported);
    const helpPanel = buildHelpPanel(textures);
    const aboutPanel = buildAboutPanel();
    const restartPanel = buildRestartPanel();
    const topMenu = buildTopMenu(textures);
    const gameWonPanel = buildGameWonPanel(textures);
    navContainer.addChild(navBackground);
    navContainer.addChild(topMenu);
    navContainer.addChild(menuPanel);
    navContainer.addChild(introPanel);
    navContainer.addChild(helpPanel);
    navContainer.addChild(aboutPanel);
    navContainer.addChild(restartPanel);
    navContainer.addChild(gameWonPanel);
    Bus.subscribe('Menu.RequestStart', ()=>{
        if (introPanel.visible) {
            introPanel.visible = false;
            Bus.publish('Menu.IntroHidden');
        }
    });
    Bus.subscribe('Menu.IntroHidden', (data)=>{
        navBackground.visible = false;
        topMenu.visible = true;
        Bus.publish('Menu.RequestHide');
    });
    Bus.subscribe('Menu.RequestShow', (data)=>{
        topMenu.visible = false;
        navBackground.visible = true;
        menuPanel.visible = true;
        Bus.publish('Menu.Shown');
    });
    Bus.subscribe('Menu.RequestHide', (data)=>{
        menuPanel.visible = false;
        navBackground.visible = false;
        topMenu.visible = true;
        Bus.publish('Menu.Hidden');
    });
    Bus.subscribe('Menu.RequestHelpPanel', (data)=>{
        menuPanel.visible = false;
        helpPanel.visible = true;
    });
    Bus.subscribe('Menu.RequestAboutPanel', (data)=>{
        menuPanel.visible = false;
        aboutPanel.visible = true;
    });
    Bus.subscribe('Menu.RequestRestartPanel', (data)=>{
        menuPanel.visible = false;
        restartPanel.visible = true;
    });
    Bus.subscribe('Menu.PanelHidden', (data)=>{
        menuPanel.visible = true;
    });
    Bus.subscribe('Menu.RequestRestartGame', (data)=>{
        menuPanel.visible = false;
        navBackground.visible = false;
        topMenu.visible = true;
    });
    Bus.subscribe('Menu.RequestGameWonPanel', (gameWonStats)=>{
        topMenu.visible = false;
        gameWonPanel.visible = true;
        gameWonPanel.alpha = 0;
    });
    return navContainer;
}
function getTextStyle(multiplier) {
    return {
        fontFamily: 'serif',
        fontSize: 116 * multiplier,
        fill: 0xffffff,
        tint: Color.yellow
    };
}
function buildText(text, options) {
    const style = options.style || smallTextStyle;
    const pixiText = new PIXI.Text(text, style);
    pixiText.tint = Color.yellow;
    if (pixiText.width > 940) pixiText.scale.set(940 / pixiText.width);
    if (options.left) {
        pixiText.position.x = Math.round(options.left);
    } else if (options.right) {
        pixiText.position.x = Math.round(options.right - pixiText.width);
    } else if (options.xCenter) {
        pixiText.position.x = Math.round(options.xCenter - pixiText.width / 2);
    }
    if (options.top) {
        pixiText.position.y = Math.round(options.top);
    } else if (options.bottom) {
        pixiText.position.y = Math.round(options.bottom - pixiText.height);
    } else if (options.yCenter) {
        pixiText.position.y = Math.round(options.yCenter - pixiText.height / 2);
    }
    if (options.callback) {
        pixiText.interactive = true;
        pixiText.buttonMode = true;
        const highlight = (e)=>{
            const text = e.currentTarget;
            text.tint = Color.orange;
        };
        const unhighlight = (e)=>{
            const text = e.currentTarget;
            text.tint = Color.yellow;
        };
        pixiText.on('mousedown', (e)=>{
            highlight(e);
        }).on('touchstart', (e)=>{
            highlight(e);
        });
        pixiText.on('mouseup', (e)=>{
            unhighlight(e);
            options.callback();
        }).on('mouseupoutside', (e)=>{
            unhighlight(e);
        }).on('touchend', (e)=>{
            unhighlight(e);
            options.callback();
        }).on('touchendoutside', (e)=>{
            unhighlight(e);
        });
    }
    return pixiText;
}
function buildHelpContent(textures) {
    const container = new PIXI.Container;
    const textStyle = mediumTextStyle;
    const text1 = buildText('引导小球降落地面', {
        xCenter: xCenter,
        yCenter: 320,
        style: textStyle
    });
    container.addChild(text1);
    const text2 = buildText('拖动画线，搭出弹跳木条：', {
        xCenter: xCenter,
        yCenter: 420,
        style: textStyle
    });
    container.addChild(text2);
    const handSprite = new PIXI.Sprite(textures.helpHand);
    handSprite.anchor.x = handSprite.anchor.y = 0.5;
    handSprite.position.x = 512;
    handSprite.position.y = 665;
    container.addChild(handSprite);
    const text3 = buildText('避开锯片：', {
        xCenter: xCenter,
        yCenter: 850,
        style: textStyle
    });
    container.addChild(text3);
    const sawSprite = new PIXI.Sprite(textures.saw);
    sawSprite.anchor.x = sawSprite.anchor.y = 0.5;
    sawSprite.position.x = 512;
    sawSprite.position.y = 1000;
    container.addChild(sawSprite);
    const text4 = buildText('收集额外生命：', {
        xCenter: xCenter,
        yCenter: 1150,
        style: textStyle
    });
    container.addChild(text4);
    const plus1LifeSprite = new PIXI.Sprite(textures.plus1Life);
    plus1LifeSprite.anchor.x = plus1LifeSprite.anchor.y = 0.5;
    plus1LifeSprite.position.x = 512;
    plus1LifeSprite.position.y = 1280;
    container.addChild(plus1LifeSprite);
    const text5 = buildText('每下降 100 米，重置 30 秒计时。', {
        xCenter: xCenter,
        yCenter: 1420,
        style: textStyle
    });
    container.addChild(text5);
    return container;
}
function buildNavBackground(textures) {
    const backgroundSprite = new PIXI.Sprite(textures.clouds);
    backgroundSprite.scale.x = backgroundSprite.scale.y = 2;
    backgroundSprite.anchor.x = backgroundSprite.anchor.y = 0.5;
    backgroundSprite.alpha = 0.8;
    return backgroundSprite;
}
function buildTopMenu(textures) {
    const topMenu = new PIXI.Container();
    topMenu.visible = false;
    const heightLabel = buildText('高度', {
        left: 32,
        top: 16
    });
    topMenu.addChild(heightLabel);
    const height = buildText(getHeightText(1000), {
        left: heightLabel.position.x + heightLabel.width + 16,
        top: 16
    });
    topMenu.addChild(height);
    Bus.subscribe('Height.Set', (data)=>{
        height.text = getHeightText(data);
    });
    const livesDummy = buildText('生命: 9', {
        left: 0,
        top: 0
    });
    const livesLabel = buildText('生命:', {
        left: width * 0.6 - livesDummy.width / 2,
        top: 16
    });
    topMenu.addChild(livesLabel);
    const lives = buildText(5..toString(), {
        left: livesLabel.position.x + livesLabel.width + 16,
        top: 16
    });
    topMenu.addChild(lives);
    Bus.subscribe('Lives.Set', (data)=>{
        lives.text = data.toString();
    });
    const menu = buildText('菜单', {
        right: width - 32,
        top: 16,
        callback: ()=>{
            Bus.publish('Menu.RequestShow');
        }
    });
    topMenu.addChild(menu);
    const timeRemainingLabel = buildText(getTimeRemainingText(900), {
        left: 32,
        top: 106,
        style: tinyTextStyle
    });
    topMenu.addChild(timeRemainingLabel);
    Bus.subscribe('NextCheckpointHeight.Set', (height)=>{
        timeRemainingLabel.text = getTimeRemainingText(height);
    });
    const timeBar = new PIXI.Sprite(textures.timeBar);
    timeBar.position.x = 392;
    timeBar.position.y = 128;
    topMenu.addChild(timeBar);
    const timeBarTime = new PIXI.Sprite(textures.timeBarTime);
    timeBarTime.position.x = 394;
    timeBarTime.position.y = 130;
    timeBarTime.alpha = 0.85;
    topMenu.addChild(timeBarTime);
    Bus.subscribe('TimeRemainingQuotient.Set', (timeRemainingQuotient)=>{
        timeBarTime.width = timeRemainingQuotient * 596;
        timeBarTime.tint = blendColors(Color.yellow, Color.red, timeRemainingQuotient);
        if (timeRemainingQuotient <= 0) {
            timeRemainingLabel.tint = Color.red;
        } else {
            timeRemainingLabel.tint = Color.yellow;
        }
    });
    return topMenu;
}
function buildIntroPanel(textures) {
    const introPanel = new PIXI.Container();
    introPanel.addChild(buildHelpContent(textures));
    introPanel.addChild(buildText('开始下降 >', {
        xCenter: xCenter,
        yCenter: height * 0.92,
        style: hugeTextStyle,
        callback: ()=>{
            introPanel.visible = false;
            Bus.publish('Menu.IntroHidden');
        }
    }));
    return introPanel;
}
function getHeightText(height) {
    return height + 'm';
}
function getTimeRemainingText(height) {
    return '到 ' + height.toString() + '米:';
}
function getSoundText(soundEnabled) {
    return '浏览器无声版';
}
function buildMenuPanel(soundSupported) {
    const menuPanel = new PIXI.Container();
    const verticalSpace = height / 6;
    const textStyle = largeTextStyle;
    const soundStatus = buildText(getSoundText(soundSupported), {
        xCenter: xCenter,
        yCenter: verticalSpace,
        style: textStyle,
        callback: soundSupported ? ()=>{
            Bus.publish('Sound.Toggle');
        } : null
    });
    if (soundSupported) {
        Bus.subscribe('Sound.Enable', (data)=>{
            soundStatus.text = getSoundText(data);
        });
    } else {
        soundStatus.alpha = 0.5;
    }
    menuPanel.addChild(soundStatus);
    menuPanel.addChild(buildText('玩法说明', {
        xCenter: xCenter,
        yCenter: verticalSpace * 2,
        style: textStyle,
        callback: ()=>{
            Bus.publish('Menu.RequestHelpPanel');
        }
    }));
    menuPanel.addChild(buildText('关于原作', {
        xCenter: xCenter,
        yCenter: verticalSpace * 3,
        style: textStyle,
        callback: ()=>{
            Bus.publish('Menu.RequestAboutPanel');
        }
    }));
    menuPanel.addChild(buildText('重新开始', {
        xCenter: xCenter,
        yCenter: verticalSpace * 4,
        style: textStyle,
        callback: ()=>{
            Bus.publish('Menu.RequestRestartPanel');
        }
    }));
    menuPanel.addChild(buildText('继续下降', {
        xCenter: xCenter,
        yCenter: verticalSpace * 5,
        style: textStyle,
        callback: ()=>{
            Bus.publish('Menu.RequestHide');
        }
    }));
    menuPanel.visible = false;
    return menuPanel;
}
function buildBackButton(panel) {
    return buildText('< 返回', {
        xCenter: xCenter,
        yCenter: height * 0.92,
        style: hugeTextStyle,
        callback: ()=>{
            panel.visible = false;
            Bus.publish('Menu.PanelHidden');
        }
    });
}
function buildHelpPanel(textures) {
    const helpPanel = new PIXI.Container();
    helpPanel.addChild(buildHelpContent(textures));
    helpPanel.addChild(buildBackButton(helpPanel));
    helpPanel.visible = false;
    return helpPanel;
}
function buildAboutPanel() {
    const aboutPanel = new PIXI.Container();
    const text1 = buildText('Descensus 2', {
        xCenter: xCenter,
        yCenter: 600,
        style: largeTextStyle
    });
    aboutPanel.addChild(text1);
    const text2 = buildText('v1.0.2', {
        xCenter: xCenter,
        yCenter: 700,
        style: mediumTextStyle
    });
    aboutPanel.addChild(text2);
    const text3 = buildText('By Tom W Hall', {
        xCenter: xCenter,
        yCenter: 900
    });
    aboutPanel.addChild(text3);
    const text4 = buildText('Boolean Operations Limited', {
        xCenter: xCenter,
        yCenter: 1000
    });
    aboutPanel.addChild(text4);
    const text5 = buildText('http://booleanoperations.com', {
        xCenter: xCenter,
        yCenter: 1100
    });
    aboutPanel.addChild(text5);
    aboutPanel.addChild(buildBackButton(aboutPanel));
    aboutPanel.visible = false;
    return aboutPanel;
}
function buildRestartPanel() {
    const textStyle = largeTextStyle;
    const restartPanel = new PIXI.Container();
    restartPanel.addChild(buildText('重新从 1000 米开始？', {
        xCenter: xCenter,
        yCenter: height * 0.45,
        style: textStyle
    }));
    restartPanel.addChild(buildText('取消', {
        xCenter: width / 3,
        yCenter: height * 0.75,
        callback: ()=>{
            restartPanel.visible = false;
            Bus.publish('Menu.PanelHidden');
        },
        style: textStyle
    }));
    restartPanel.addChild(buildText('重新开始', {
        xCenter: width * (2 / 3),
        yCenter: height * 0.75,
        callback: ()=>{
            restartPanel.visible = false;
            Bus.publish('Menu.RequestRestartGame');
        },
        style: textStyle
    }));
    restartPanel.visible = false;
    return restartPanel;
}
function buildGameWonPanel(textures) {
    const gameWonPanel = new PIXI.Container();
    gameWonPanel.addChild(new PIXI.Sprite(textures.paper));
    function getTimeText(time) {
        const totalSeconds = time / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.round(totalSeconds % 60);
        return '用时 ' + minutes.toString() + ':' + (seconds < 10 ? '0' : '') + seconds.toString();
    }
    function getLivesText(lives) {
        return '剩余 ' + lives.toString() + ' 条生命';
    }
    gameWonPanel.addChild(buildText('降落完成', {
        xCenter: xCenter,
        yCenter: 400,
        style: mediumTextStyle
    }));
    gameWonPanel.addChild(buildText('你已成功到达地面', {
        xCenter: xCenter,
        yCenter: 500,
        style: mediumTextStyle
    }));
    gameWonPanel.addChild(buildText('Descensus 2', {
        xCenter: xCenter,
        yCenter: 700,
        style: hugeTextStyle
    }));
    const timeText = buildText(getTimeText(0), {
        xCenter: xCenter,
        yCenter: 900,
        style: mediumTextStyle
    });
    gameWonPanel.addChild(timeText);
    const livesText = buildText(getLivesText(10), {
        xCenter: xCenter,
        yCenter: 1000,
        style: mediumTextStyle
    });
    gameWonPanel.addChild(livesText);
    Bus.subscribe('Menu.RequestGameWonPanel', (gameWonStats)=>{
        timeText.text = getTimeText(gameWonStats.time);
        timeText.position.x = Math.round(xCenter - timeText.width / 2);
        livesText.text = getLivesText(gameWonStats.lives);
        livesText.position.x = Math.round(xCenter - livesText.width / 2);
    });
    Bus.subscribe('Menu.IncrementGameWonPanelAlpha', (deltaTime)=>{
        const increments = 1000 / deltaTime * 5;
        const alphaDelta = 1 / increments;
        gameWonPanel.alpha = Math.min(1, gameWonPanel.alpha + alphaDelta);
    });
    gameWonPanel.addChild(buildText('再来一次 >', {
        xCenter: xCenter,
        yCenter: height * 0.92,
        style: largeTextStyle,
        callback: ()=>{
            gameWonPanel.visible = false;
            Bus.publish('Menu.RequestRestartGame');
        }
    }));
    gameWonPanel.visible = false;
    return gameWonPanel;
}
exports.default = buildNavContainer;

},
"Pixi/buildPixiGraph":function(require,exports){
const buildNavContainer = require("Pixi/buildNavContainer").default;
const Bus = require("Bus").default;
function buildPixiGraph(textures, soundSupported) {
    const stage = new PIXI.Container();
    const background = new PIXI.Sprite(textures.clouds);
    background.scale.x = background.scale.y = 2;
    background.anchor.x = background.anchor.y = 0.5;
    background.visible = false;
    const container = new PIXI.Container();
    const terrainContainer = new PIXI.Container();
    const girderContainer = new PIXI.Container();
    const brickContainer = new PIXI.Container();
    const seesawContainer = new PIXI.Container();
    const spinnerContainer = new PIXI.Container();
    const sawContainer = new PIXI.Container();
    const freeSawContainer = new PIXI.Container();
    const twoByFourContainer = new PIXI.Container();
    const playerBallContainer = new PIXI.Container();
    const ballContainer = new PIXI.Container();
    const ballReflectionsContainer = new PIXI.Container();
    const plus1LifeContainer = new PIXI.Container();
    const windAlpha = 0.75;
    const windLeft = new PIXI.Sprite(textures.windLeft);
    windLeft.anchor.x = windLeft.anchor.y = 0.5;
    windLeft.position.x = 256;
    windLeft.position.y = 567;
    windLeft.alpha = windAlpha;
    windLeft.visible = false;
    const windRight = new PIXI.Sprite(textures.windRight);
    windRight.anchor.x = windRight.anchor.y = 0.5;
    windRight.position.x = 768;
    windRight.position.y = 567;
    windRight.alpha = windAlpha;
    windRight.visible = false;
    const barContainer = new PIXI.Container();
    barContainer.interactive = true;
    barContainer.hitArea = new PIXI.Rectangle(-10000000, -10000000, 20000000, 20000000);
    terrainContainer.addChild(girderContainer);
    terrainContainer.addChild(brickContainer);
    terrainContainer.addChild(seesawContainer);
    terrainContainer.addChild(spinnerContainer);
    terrainContainer.addChild(twoByFourContainer);
    terrainContainer.addChild(ballContainer);
    terrainContainer.addChild(ballReflectionsContainer);
    terrainContainer.addChild(sawContainer);
    terrainContainer.addChild(freeSawContainer);
    terrainContainer.addChild(playerBallContainer);
    terrainContainer.addChild(plus1LifeContainer);
    container.addChild(terrainContainer);
    container.addChild(barContainer);
    const navContainer = buildNavContainer(textures, soundSupported);
    stage.addChild(background);
    stage.addChild(container);
    stage.addChild(windLeft);
    stage.addChild(windRight);
    stage.addChild(navContainer);
    Bus.subscribe('IsInvincible.Set', (isInvincible)=>{
        sawContainer.alpha = isInvincible ? 0.5 : 1;
        freeSawContainer.alpha = isInvincible ? 0.5 : 1;
    });
    return {
        stage,
        container,
        terrainContainer,
        barContainer,
        girderContainer,
        brickContainer,
        seesawContainer,
        spinnerContainer,
        sawContainer,
        freeSawContainer,
        twoByFourContainer,
        playerBallContainer,
        ballContainer,
        ballReflectionsContainer,
        plus1LifeContainer,
        background,
        windLeft,
        windRight
    };
}
exports.default = buildPixiGraph;

},
"Sound/soundPlayer":function(require,exports){
const Bus = require("Bus").default;
let sounds = null;
let soundSupported = false;
let soundOn = false;
Bus.subscribe('Sound.Toggle', ()=>{
    toggle();
});
function initialize(snds) {
    sounds = snds;
    soundSupported = true;
    soundOn = true;
    for(let name in sounds){
        const audio = sounds[name];
        audio.hackPlaying = false;
        audio.hackPaused = true;
        audio.onplaying = ()=>{
            audio.hackPlaying = true;
            audio.hackPaused = false;
        };
        audio.onpause = ()=>{
            audio.hackPlaying = false;
            audio.hackPaused = true;
        };
    }
}
function play(name, resuming = false) {
    if (!soundSupported || !soundOn) return;
    const audio = sounds[name];
    if (!resuming) {
        audio.currentTime = 0;
    }
    if (audio.hackPaused) {
        if (audio === sounds.clock) {
            audio.loop = true;
        }
        audio.play();
    }
}
function pause(name) {
    if (!soundSupported) return;
    const audio = sounds[name];
    if (!audio.hackPaused) {
        audio.pause();
    }
    ;
}
function stop(name) {
    if (!soundSupported) return;
    const audio = sounds[name];
    audio.pause();
    audio.currentTime = 0;
}
function pauseAll() {
    for(let name in sounds){
        pause(name);
    }
}
function resumeAll() {
    for(let name in sounds){
        const audio = sounds[name];
        if (audio.paused && audio.currentTime > 0 && !audio.ended) {
            play(name, true);
        }
    }
}
function stopAll() {
    for(let name in sounds){
        stop(name);
    }
}
function toggle() {
    if (!soundSupported) return;
    soundOn = !soundOn;
    Bus.publish('Sound.Enable', soundOn);
}
exports.default = {
    initialize,
    play,
    pause,
    stop,
    pauseAll,
    resumeAll,
    stopAll,
    toggle
};

},
"Terrain/Objects/Brick":function(require,exports){
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const TerrainObject = require("Terrain/Objects/TerrainObject").default;
const materials = require("p2/materials").default;
const p2Util = require("p2/p2Util").default;
exports.default = class Brick extends TerrainObject {
    constructor(world, pixiGraph, textures){
        super(TerrainObjectType.Brick, world, pixiGraph);
        const brickBody = new p2.Body({
            mass: 1
        });
        brickBody.allowSleep = false;
        const brickSprite = new PIXI.Sprite(textures.brick);
        this.addBody(brickBody, brickSprite, pixiGraph.brickContainer);
        const boxShape = new p2.Box({
            width: 2,
            height: 0.625
        });
        boxShape.material = materials.brick;
        this.addShape(brickBody, boxShape);
    }
    activate(position, angle) {
        super.activate();
        p2Util.updateBodyPosition(this.bodies[0], position, angle);
    }
}

},
"Terrain/Objects/FreeSaw":function(require,exports){
const TerrainObject = require("Terrain/Objects/TerrainObject").default;
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const materials = require("p2/materials").default;
const p2Util = require("p2/p2Util").default;
exports.default = class FreeSaw extends TerrainObject {
    constructor(world, pixiGraph, textures){
        super(TerrainObjectType.FreeSaw, world, pixiGraph);
        const sawBody = this.sawBody = new p2.Body({
            mass: 0.5
        });
        sawBody.damping = 0.5;
        sawBody.isFatal = true;
        sawBody.allowSleep = false;
        const sawSprite = new PIXI.Sprite(textures.sawSmall);
        this.addBody(sawBody, sawSprite, pixiGraph.freeSawContainer);
        const circleShape = new p2.Circle({
            radius: 0.75
        });
        circleShape.material = materials.saw;
        this.addShape(sawBody, circleShape);
    }
    sawBody;
    activate(position, velocity) {
        super.activate();
        p2Util.updateBodyPosition(this.sawBody, position);
        this.sawBody.angularVelocity = -2;
        if (velocity) {
            this.sawBody.velocity = velocity;
        }
    }
}

},
"Terrain/Objects/Girder":function(require,exports){
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const TerrainObject = require("Terrain/Objects/TerrainObject").default;
const materials = require("p2/materials").default;
const p2Util = require("p2/p2Util").default;
exports.default = class Girder extends TerrainObject {
    constructor(world, pixiGraph, textures){
        super(TerrainObjectType.Girder, world, pixiGraph);
        const girderBody = new p2.Body({
            mass: 30
        });
        girderBody.gravityScale = 0;
        const girderSprite = new PIXI.Sprite(textures.girder);
        this.addBody(girderBody, girderSprite, pixiGraph.girderContainer);
        const boxShape = new p2.Box({
            width: 4,
            height: 1
        });
        boxShape.material = materials.wood;
        this.addShape(girderBody, boxShape);
    }
    activate(position, angle) {
        super.activate();
        p2Util.updateBodyPosition(this.bodies[0], position, angle);
    }
}

},
"Terrain/Objects/Plus1Life":function(require,exports){
const TerrainObject = require("Terrain/Objects/TerrainObject").default;
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const materials = require("p2/materials").default;
const p2Util = require("p2/p2Util").default;
exports.default = class Plus1Life extends TerrainObject {
    constructor(world, pixiGraph, textures){
        super(TerrainObjectType.Plus1Life, world, pixiGraph);
        const plus1LifeBody = this.plus1LifeBody = new p2.Body({
            mass: 0.5
        });
        plus1LifeBody.allowSleep = false;
        plus1LifeBody.damping = 0.8;
        const plus1LifeSprite = new PIXI.Sprite(textures.plus1Life);
        this.addBody(plus1LifeBody, plus1LifeSprite, pixiGraph.plus1LifeContainer);
        const boxShape = new p2.Box({
            width: 2,
            height: 1.203125
        });
        boxShape.material = materials.wood;
        this.addShape(plus1LifeBody, boxShape);
    }
    plus1LifeBody;
    activate(position) {
        super.activate();
        p2Util.updateBodyPosition(this.plus1LifeBody, position);
    }
}

},
"Terrain/Objects/Saw":function(require,exports){
const TerrainObject = require("Terrain/Objects/TerrainObject").default;
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const materials = require("p2/materials").default;
const terrainObjectKit = require("Terrain/Objects/terrainObjectKit").default;
const p2Util = require("p2/p2Util").default;
exports.default = class Saw extends TerrainObject {
    constructor(world, pixiGraph, textures){
        super(TerrainObjectType.Saw, world, pixiGraph);
        const sawBody = this.sawBody = new p2.Body({
            mass: 1
        });
        sawBody.gravityScale = 0;
        sawBody.isFatal = true;
        const sawSprite = new PIXI.Sprite(textures.saw);
        this.addBody(sawBody, sawSprite, pixiGraph.sawContainer);
        const circleShape = new p2.Circle({
            radius: 1
        });
        circleShape.material = materials.saw;
        this.addShape(sawBody, circleShape);
        const anchorBody = this.anchorBody = terrainObjectKit.getAnchor(sawBody);
        this.addBodyHidden(anchorBody);
        const anchorConstraint = terrainObjectKit.getAnchorConstraint(sawBody, anchorBody, null, true);
        anchorConstraint.setMotorSpeed(this.speed);
        this.addConstraint(anchorConstraint);
    }
    speed = -6;
    sawBody;
    anchorBody;
    activate(position) {
        super.activate();
        p2Util.updateBodyPosition(this.sawBody, position);
        p2Util.updateBodyPosition(this.anchorBody, position);
    }
}

},
"Terrain/Objects/SawSnake":function(require,exports){
const Snake = require("Terrain/Objects/Snake").default;
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const randomUtil = require("Utility/randomUtil").default;
const materials = require("p2/materials").default;
const p2Util = require("p2/p2Util").default;
exports.default = class SawSnake extends Snake {
    constructor(world, pixiGraph, textures, speed, agitateTime){
        super(world, pixiGraph, textures, speed, agitateTime);
        this.type = TerrainObjectType.SawSnake;
        const segments = this.segments;
        for(let i = 0; i < segments.length; i++){
            const body = segments[i];
            this.addSaw(body, textures);
        }
    }
    sawSpeed = -6;
    sawBodies = [];
    addSaw(body, textures) {
        const sawBody = new p2.Body({
            mass: 1,
            position: [
                body.position[0],
                body.position[1]
            ],
            angle: randomUtil.random0To1() * (2 * Math.PI)
        });
        sawBody.gravityScale = 0;
        sawBody.isFatal = true;
        const sawSprite = new PIXI.Sprite(textures.saw);
        this.addBody(sawBody, sawSprite, this.pixiGraph.sawContainer);
        this.sawBodies.push(sawBody);
        const circleShape = new p2.Circle({
            radius: 1
        });
        circleShape.material = materials.wood;
        this.addShape(sawBody, circleShape);
        const revoluteConstraint = new p2.RevoluteConstraint(sawBody, body, {
            localPivotA: [
                0,
                0
            ],
            localPivotB: [
                0,
                0
            ]
        });
        revoluteConstraint.enableMotor();
        revoluteConstraint.setMotorSpeed(this.sawSpeed);
        revoluteConstraint.collideConnected = false;
        this.addConstraint(revoluteConstraint);
    }
    activate(position, speed, agitateTime) {
        super.activate(position, speed, agitateTime);
        const segments = this.segments;
        const sawBodies = this.sawBodies;
        for(let i = 0; i < segments.length; i++){
            const segmentPosition = segments[i].position;
            const sawBody = sawBodies[i];
            p2Util.updateBodyPosition(sawBody, [
                segmentPosition[0],
                segmentPosition[1]
            ]);
        }
    }
}

},
"Terrain/Objects/SawSpinner":function(require,exports){
const Spinner = require("Terrain/Objects/Spinner").default;
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const materials = require("p2/materials").default;
const p2Util = require("p2/p2Util").default;
exports.default = class SawSpinner extends Spinner {
    constructor(world, pixiGraph, textures){
        super(world, pixiGraph, textures);
        this.type = TerrainObjectType.SawSpinner;
        const spinnerBody = this.spinnerBody;
        const sawOffsets = this.sawOffsets;
        for(let i = 0; i < sawOffsets.length; i++){
            this.addSaw(spinnerBody, sawOffsets[i], textures);
        }
    }
    sawSpeed = -6;
    sawOffsets = [
        [
            0,
            2.5
        ],
        [
            0,
            -2.5
        ],
        [
            -2.5,
            0
        ],
        [
            2.5,
            0
        ]
    ];
    sawBodies = [];
    addSaw(spinner, offset, textures) {
        const spinnerBodyPosition = spinner.position;
        const sawBody = new p2.Body({
            mass: 1,
            position: [
                spinnerBodyPosition[0] + offset[0],
                spinnerBodyPosition[1] + offset[1]
            ]
        });
        sawBody.gravityScale = 0;
        sawBody.isFatal = true;
        const sawSprite = new PIXI.Sprite(textures.saw);
        this.addBody(sawBody, sawSprite, this.pixiGraph.sawContainer);
        this.sawBodies.push(sawBody);
        const circleShape = new p2.Circle({
            radius: 1
        });
        circleShape.material = materials.wood;
        this.addShape(sawBody, circleShape);
        const revoluteConstraint = new p2.RevoluteConstraint(sawBody, spinner, {
            localPivotA: [
                0,
                0
            ],
            localPivotB: offset
        });
        revoluteConstraint.enableMotor();
        revoluteConstraint.setMotorSpeed(this.sawSpeed);
        revoluteConstraint.collideConnected = false;
        this.addConstraint(revoluteConstraint);
    }
    setSawPositions(spinnerPosition) {
        const sawBodies = this.sawBodies;
        const sawOffsets = this.sawOffsets;
        for(let i = 0; i < sawOffsets.length; i++){
            const sawOffset = sawOffsets[i];
            p2Util.updateBodyPosition(sawBodies[i], [
                spinnerPosition[0] + sawOffset[0],
                spinnerPosition[1] + sawOffset[1]
            ]);
        }
    }
    activate(position, speed) {
        super.activate(position, speed);
        this.setSawPositions(position);
    }
}

},
"Terrain/Objects/Seesaw":function(require,exports){
const TerrainObject = require("Terrain/Objects/TerrainObject").default;
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const materials = require("p2/materials").default;
const terrainObjectKit = require("Terrain/Objects/terrainObjectKit").default;
const p2Util = require("p2/p2Util").default;
exports.default = class Seesaw extends TerrainObject {
    constructor(world, pixiGraph, textures){
        super(TerrainObjectType.Seesaw, world, pixiGraph);
        const seesawBody = new p2.Body({
            mass: 3
        });
        seesawBody.gravityScale = 0;
        const seesawSprite = new PIXI.Sprite(textures.seesaw);
        this.addBody(seesawBody, seesawSprite, pixiGraph.seesawContainer);
        const boxShape = new p2.Box({
            width: 6,
            height: 1
        });
        boxShape.material = materials.wood;
        this.addShape(seesawBody, boxShape);
        const anchorBody = terrainObjectKit.getAnchor(seesawBody);
        this.addBodyHidden(anchorBody);
        this.addConstraint(terrainObjectKit.getAnchorConstraint(seesawBody, anchorBody));
    }
    activate(position, upright = false) {
        super.activate();
        const bodies = this.bodies;
        for(let i = 0; i < bodies.length; i++){
            const body = this.bodies[i];
            const angle = upright ? -Math.PI / 2 : 0;
            p2Util.updateBodyPosition(body, position, angle);
        }
    }
}

},
"Terrain/Objects/Snake":function(require,exports){
const gameClock = require("Utility/gameClock").default;
const TerrainObject = require("Terrain/Objects/TerrainObject").default;
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const materials = require("p2/materials").default;
const terrainObjectKit = require("Terrain/Objects/terrainObjectKit").default;
const p2Util = require("p2/p2Util").default;
exports.default = class Snake extends TerrainObject {
    constructor(world, pixiGraph, textures, speed, agitateCycle){
        super(TerrainObjectType.Snake, world, pixiGraph);
        this.agitateCycle = agitateCycle;
        let previousSegment = null;
        for(let i = 0; i < this.segmentCount; i++){
            let twoByFourBody = new p2.Body({
                mass: 0.5
            });
            twoByFourBody.gravityScale = 0;
            const twoByFourSprite = new PIXI.Sprite(textures.twoByFour);
            this.addBody(twoByFourBody, twoByFourSprite, pixiGraph.twoByFourContainer);
            this.segments.push(twoByFourBody);
            const boxShape = new p2.Box({
                width: 0.5,
                height: 4
            });
            boxShape.material = materials.wood;
            this.addShape(twoByFourBody, boxShape);
            if (previousSegment === null) {
                const anchorBody = this.anchorBody = terrainObjectKit.getAnchor(twoByFourBody);
                this.addBodyHidden(anchorBody);
                const anchorConstraint = this.anchorConstraint = terrainObjectKit.getAnchorConstraint(twoByFourBody, anchorBody, [
                    1.75,
                    0
                ], true);
                this.addConstraint(anchorConstraint);
            } else {
                const revoluteConstraint = new p2.RevoluteConstraint(twoByFourBody, previousSegment, {
                    localPivotA: [
                        0,
                        1.75
                    ],
                    localPivotB: [
                        0,
                        -1.75
                    ]
                });
                revoluteConstraint.collideConnected = false;
                const maxAngle = Math.PI / 4;
                revoluteConstraint.setLimits(-maxAngle, maxAngle);
                this.addConstraint(revoluteConstraint);
            }
            previousSegment = twoByFourBody;
        }
    }
    segmentCount = 4;
    agitateCycle;
    nextAgitateTime;
    segments = [];
    anchorBody;
    anchorConstraint;
    scheduleAgitate() {
        this.nextAgitateTime = gameClock.now() + this.agitateCycle;
    }
    agitate() {
        if (!this.active || gameClock.now() < this.nextAgitateTime) return;
        this.anchorConstraint.setMotorSpeed(-this.anchorConstraint.getMotorSpeed());
        this.scheduleAgitate();
    }
    activate(position, speed, agitateCycle) {
        super.activate();
        const snakeHeight = this.segmentCount * 3.5 + 0.5;
        const tailBodyPosition = [
            position[0],
            position[1] + snakeHeight / 2 - 2
        ];
        p2Util.updateBodyPosition(this.anchorBody, [
            tailBodyPosition[0],
            tailBodyPosition[1] + 1.75
        ]);
        const segments = this.segments;
        for(let i = 0; i < segments.length; i++){
            p2Util.updateBodyPosition(segments[i], [
                tailBodyPosition[0],
                tailBodyPosition[1] - i * 3.5
            ]);
        }
        this.anchorConstraint.setMotorSpeed(speed);
        this.agitateCycle = agitateCycle;
        this.scheduleAgitate();
    }
}

},
"Terrain/Objects/Spinner":function(require,exports){
const TerrainObject = require("Terrain/Objects/TerrainObject").default;
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const Color = require("Color").default;
const materials = require("p2/materials").default;
const terrainObjectKit = require("Terrain/Objects/terrainObjectKit").default;
const p2Util = require("p2/p2Util").default;
exports.default = class Spinner extends TerrainObject {
    constructor(world, pixiGraph, textures){
        super(TerrainObjectType.Spinner, world, pixiGraph);
        const spinnerBody = new p2.Body({
            mass: 6
        });
        spinnerBody.gravityScale = 0;
        const spinnerSprite = new PIXI.Sprite(textures.spinner);
        spinnerSprite.isSpinner = true;
        this.addBody(spinnerBody, spinnerSprite, pixiGraph.spinnerContainer);
        this.spinnerBody = spinnerBody;
        const horizontalBoxShape = new p2.Box({
            width: 6,
            height: 1
        });
        horizontalBoxShape.material = materials.wood;
        this.addShape(spinnerBody, horizontalBoxShape);
        const verticalBoxShape = new p2.Box({
            width: 6,
            height: 1
        });
        verticalBoxShape.material = materials.wood;
        this.addShape(spinnerBody, verticalBoxShape, {
            angle: -Math.PI / 2
        });
        const anchorBody = this.anchorBody = terrainObjectKit.getAnchor(spinnerBody);
        this.addBodyHidden(anchorBody);
        const revoluteConstraint = this.anchorConstraint = terrainObjectKit.getAnchorConstraint(spinnerBody, anchorBody, null, true);
        this.addConstraint(revoluteConstraint);
    }
    spinnerBody;
    anchorBody;
    anchorConstraint;
    activate(position, speed) {
        super.activate();
        p2Util.updateBodyPosition(this.spinnerBody, position);
        p2Util.updateBodyPosition(this.anchorBody, position);
        this.anchorConstraint.setMotorSpeed(speed);
    }
}

},
"Terrain/Objects/TerrainObject":function(require,exports){
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const p2Util = require("p2/p2Util").default;
exports.default = class TerrainObject {
    constructor(type, world, pixiGraph){
        this.type = type;
        this.world = world;
        this.pixiGraph = pixiGraph;
        this.bodies = [];
        this.constraints = [];
    }
    type;
    world;
    pixiGraph;
    bodies;
    constraints;
    active = false;
    suspended = false;
    addBody(body, sprite, container) {
        sprite.anchor = new PIXI.ObservablePoint(null, null, 0.5, 0.5);
        sprite.visible = false;
        body.sprite = sprite;
        container.addChild(sprite);
        body.terrainObject = this;
        this.bodies.push(body);
    }
    addBodyHidden(body) {
        body.terrainObject = this;
        this.bodies.push(body);
    }
    addShape(body, shape, options) {
        options = options || {};
        const offset = options.offset || [
            0,
            0
        ];
        const angle = options.angle || 0;
        shape.collisionGroup = options.collisionOptions && options.collisionOptions.collisionGroup || 1;
        shape.collisionMask = options.collisionOptions && options.collisionOptions.collisionMask || 1;
        body.addShape(shape, offset, angle);
    }
    addConstraint(constraint) {
        this.constraints.push(constraint);
    }
    getAABB() {
        const aabb = new p2.AABB();
        for(let i = 0; i < this.bodies.length; i++){
            let body = this.bodies[i];
            if (body.aabbNeedsUpdate) {
                body.updateAABB();
            }
            if (i === 0) {
                aabb.copy(body.aabb);
            } else {
                aabb.extend(body.aabb);
            }
        }
        return aabb;
    }
    activate(...args) {
        const world = this.world;
        const bodies = this.bodies;
        for(let i = 0; i < bodies.length; i++){
            let body = bodies[i];
            world.addBody(body);
            const sprite = body.sprite;
            if (!sprite) continue;
            sprite.visible = true;
        }
        const constraints = this.constraints;
        for(let j = 0; j < constraints.length; j++){
            world.addConstraint(constraints[j]);
        }
        this.resume();
        this.active = true;
    }
    deactivate() {
        const world = this.world;
        const constraints = this.constraints;
        for(let i = 0; i < constraints.length; i++){
            world.removeConstraint(constraints[i]);
        }
        const bodies = this.bodies;
        for(let j = 0; j < bodies.length; j++){
            let body = bodies[j];
            body.setZeroForce();
            body.velocity[0] = 0;
            body.velocity[1] = 0;
            body.angularVelocity = 0;
            world.removeBody(body);
            const sprite = body.sprite;
            if (sprite) {
                sprite.visible = false;
            }
        }
        this.active = false;
    }
    suspend() {
        const bodies = this.bodies;
        for(let i = 0; i < bodies.length; i++){
            let body = bodies[i];
            if (body.allowSleep) {
                body.sleep();
            }
            body.collisionResponse = false;
        }
        this.suspended = true;
    }
    resume() {
        const bodies = this.bodies;
        for(let i = 0; i < bodies.length; i++){
            let body = bodies[i];
            if (body.allowSleep) {
                body.wakeUp();
                p2Util.resetBody(body);
            }
            body.collisionResponse = true;
        }
        this.suspended = false;
    }
}

},
"Terrain/Objects/TerrainObjectType":function(require,exports){
var TerrainObjectType = /*#__PURE__*/ function(TerrainObjectType) {
    TerrainObjectType[TerrainObjectType["Girder"] = 1] = "Girder";
    TerrainObjectType[TerrainObjectType["Brick"] = 2] = "Brick";
    TerrainObjectType[TerrainObjectType["Seesaw"] = 3] = "Seesaw";
    TerrainObjectType[TerrainObjectType["Spinner"] = 4] = "Spinner";
    TerrainObjectType[TerrainObjectType["Snake"] = 5] = "Snake";
    TerrainObjectType[TerrainObjectType["FreeSaw"] = 6] = "FreeSaw";
    TerrainObjectType[TerrainObjectType["Saw"] = 7] = "Saw";
    TerrainObjectType[TerrainObjectType["SawSpinner"] = 8] = "SawSpinner";
    TerrainObjectType[TerrainObjectType["SawSnake"] = 9] = "SawSnake";
    TerrainObjectType[TerrainObjectType["Plus1Life"] = 10] = "Plus1Life";
    return TerrainObjectType;
}(TerrainObjectType || {});
exports.default = TerrainObjectType;

},
"Terrain/Objects/terrainObjectKit":function(require,exports){
function getAnchor(body) {
    const anchorBody = new p2.Body({
        mass: 100
    });
    anchorBody.gravityScale = 0;
    const circleShape = new p2.Circle({
        radius: 0.1
    });
    circleShape.sensor = true;
    anchorBody.addShape(circleShape);
    anchorBody.terrainObject = body.terrainObject;
    return anchorBody;
}
function getAnchorConstraint(body, anchor, offset, enableMotor = false) {
    offset = offset || [
        0,
        0
    ];
    const revoluteConstraint = new p2.RevoluteConstraint(body, anchor, {
        localPivotA: offset,
        localPivotB: [
            0,
            0
        ]
    });
    revoluteConstraint.collideConnected = false;
    if (enableMotor) {
        revoluteConstraint.enableMotor();
    }
    return revoluteConstraint;
}
exports.default = {
    getAnchor,
    getAnchorConstraint
};

},
"Terrain/terrainBuilder":function(require,exports){
const TerrainObject = require("Terrain/Objects/TerrainObject").default;
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const randomUtil = require("Utility/randomUtil").default;
const terrainUtil = require("Terrain/terrainUtil").default;
const p2Util = require("p2/p2Util").default;
const Girder = require("Terrain/Objects/Girder").default;
const Brick = require("Terrain/Objects/Brick").default;
const Seesaw = require("Terrain/Objects/Seesaw").default;
const Spinner = require("Terrain/Objects/Spinner").default;
const Snake = require("Terrain/Objects/Snake").default;
const FreeSaw = require("Terrain/Objects/FreeSaw").default;
const Saw = require("Terrain/Objects/Saw").default;
const SawSpinner = require("Terrain/Objects/SawSpinner").default;
const SawSnake = require("Terrain/Objects/SawSnake").default;
const Plus1Life = require("Terrain/Objects/Plus1Life").default;
const ground = require("ground").default;
let world;
let pixiGraph;
let girders;
let bricks;
let seesaws;
let spinners;
let freeSaws;
let saws;
let sawSpinners;
let snakes;
let sawSnakes;
let plus1Lifes;
let allSnakes = [];
const terrainObjectPoolMap = {};
const terrainObjectPools = [];
let groundBody;
let purgeCheckPoolIndex = 0;
let purgeCheckObjectIndex = 0;
const windZones = [
    {
        startY: 600,
        endY: 575,
        strength: 1.5
    },
    {
        startY: 500,
        endY: 475,
        strength: -1.75
    },
    {
        startY: 350,
        endY: 325,
        strength: 2
    },
    {
        startY: 275,
        endY: 250,
        strength: -2.25
    },
    {
        startY: 100,
        endY: 75,
        strength: 2.5
    },
    {
        startY: 75,
        endY: 50,
        strength: -2.75
    }
];
function createTerrainObjects(factory, count) {
    const pool = [];
    for(let i = 0; i < count; i++){
        pool.push(factory());
    }
    return pool;
}
function getActiveCount(terrainObjects) {
    let count = 0;
    for(let i = 0; i < terrainObjects.length; i++){
        if (terrainObjects[i].active) count++;
    }
    return count;
}
function initialize(wld, pxGraph, textures) {
    world = wld;
    pixiGraph = pxGraph;
    girders = createTerrainObjects(()=>new Girder(world, pxGraph, textures), 20);
    bricks = createTerrainObjects(()=>new Brick(world, pxGraph, textures), 6);
    seesaws = createTerrainObjects(()=>new Seesaw(world, pxGraph, textures), 8);
    spinners = createTerrainObjects(()=>new Spinner(world, pxGraph, textures), 8);
    freeSaws = createTerrainObjects(()=>new FreeSaw(world, pxGraph, textures), 4);
    saws = createTerrainObjects(()=>new Saw(world, pxGraph, textures), 20);
    sawSpinners = createTerrainObjects(()=>new SawSpinner(world, pxGraph, textures), 8);
    plus1Lifes = createTerrainObjects(()=>new Plus1Life(world, pxGraph, textures), 2);
    snakes = createTerrainObjects(()=>{
        const speed = 0.5 + randomUtil.random0To1();
        const agitateTime = (1 + randomUtil.random0To1()) * 1000;
        return new Snake(world, pxGraph, textures, speed, agitateTime);
    }, 8);
    sawSnakes = createTerrainObjects(()=>{
        const speed = 0.5 + randomUtil.random0To1();
        const agitateTime = (1 + randomUtil.random0To1()) * 1000;
        return new SawSnake(world, pxGraph, textures, speed, agitateTime);
    }, 6);
    allSnakes = snakes.concat(sawSnakes);
    terrainObjectPoolMap[TerrainObjectType.Girder] = girders;
    terrainObjectPoolMap[TerrainObjectType.Brick] = bricks;
    terrainObjectPoolMap[TerrainObjectType.Seesaw] = seesaws;
    terrainObjectPoolMap[TerrainObjectType.Spinner] = spinners;
    terrainObjectPoolMap[TerrainObjectType.FreeSaw] = freeSaws;
    terrainObjectPoolMap[TerrainObjectType.Saw] = saws;
    terrainObjectPoolMap[TerrainObjectType.SawSpinner] = sawSpinners;
    terrainObjectPoolMap[TerrainObjectType.Snake] = snakes;
    terrainObjectPoolMap[TerrainObjectType.SawSnake] = sawSnakes;
    terrainObjectPoolMap[TerrainObjectType.Plus1Life] = plus1Lifes;
    terrainObjectPools.push.apply(terrainObjectPools, [
        girders,
        bricks,
        seesaws,
        spinners,
        snakes,
        freeSaws,
        saws,
        sawSpinners,
        sawSnakes,
        plus1Lifes
    ]);
    groundBody = ground.initialize(world, pixiGraph, textures);
}
function update(ballBody, screenAABB) {
    const activeBufferUnits = 16;
    const activeAABB = new p2.AABB();
    activeAABB.lowerBound[0] = screenAABB.lowerBound[0] - activeBufferUnits;
    activeAABB.lowerBound[1] = screenAABB.lowerBound[1] - activeBufferUnits;
    activeAABB.upperBound[0] = screenAABB.upperBound[0] + activeBufferUnits;
    activeAABB.upperBound[1] = screenAABB.upperBound[1] + activeBufferUnits;
    setObjectStates(screenAABB, activeAABB);
    terrainUtil.updateAABBs(world);
    const leftInner = screenAABB.lowerBound[0];
    const rightInner = screenAABB.upperBound[0];
    const topInner = screenAABB.upperBound[1];
    const bottomInner = screenAABB.lowerBound[1];
    const leftOuter = activeAABB.lowerBound[0];
    const rightOuter = activeAABB.upperBound[0];
    const topOuter = activeAABB.upperBound[1];
    const bottomOuter = activeAABB.lowerBound[1];
    const topArea = new p2.AABB({
        lowerBound: [
            leftOuter,
            topInner
        ],
        upperBound: [
            rightOuter,
            topOuter
        ]
    });
    const bottomArea = new p2.AABB({
        lowerBound: [
            leftOuter,
            bottomOuter
        ],
        upperBound: [
            rightOuter,
            bottomInner
        ]
    });
    const leftArea = new p2.AABB({
        lowerBound: [
            leftOuter,
            bottomInner
        ],
        upperBound: [
            leftInner,
            topInner
        ]
    });
    const rightArea = new p2.AABB({
        lowerBound: [
            rightInner,
            bottomInner
        ],
        upperBound: [
            rightOuter,
            topInner
        ]
    });
    populateArea(topArea);
    populateArea(bottomArea);
    populateArea(leftArea);
    populateArea(rightArea);
    dropBricks(topArea);
    throwSaws(leftArea, rightArea, bottomArea);
    applyWind(ballBody);
    agitateSnakes();
    positionGround(ballBody);
}
function positionGround(ballBody) {
    const groundPositionX = Math.round(ballBody.position[0] / 16) * 16;
    const groundPosition = [
        groundPositionX,
        -10
    ];
    p2Util.updateBodyPosition(groundBody, groundPosition);
}
function deployTerrainObject(type, targetActiveCount, aabb, width, height, buffer, ...args) {
    const terrainObjects = terrainObjectPoolMap[type];
    if (getActiveCount(terrainObjects) < targetActiveCount) {
        for(let i = 0; i < terrainObjects.length; i++){
            const terrainObject = terrainObjects[i];
            if (!terrainObject.active) {
                const position = terrainUtil.getRandomPosition(world, aabb, width, height, buffer);
                if (position !== null) {
                    const activationArgs = [
                        position
                    ].concat(args);
                    terrainObject.activate.apply(terrainObject, activationArgs);
                }
                return;
            }
        }
        throw new Error('TerrainObjectPool of type ' + type + ' empty');
    }
}
function deployGirder(aabb, targetActiveCount, buffer) {
    const angle = randomUtil.random0To1() * (Math.PI * 2);
    deployTerrainObject(TerrainObjectType.Girder, targetActiveCount, aabb, 5, 5, buffer, angle);
}
function deployBrick(aabb, targetActiveCount, buffer) {
    const angle = randomUtil.random0To1() * (Math.PI * 2);
    deployTerrainObject(TerrainObjectType.Brick, targetActiveCount, aabb, 5, 5, buffer, angle);
}
function deploySeesaw(aabb, targetActiveCount, buffer) {
    const isUpright = randomUtil.randomBoolean();
    const width = isUpright ? 1 : 6;
    const height = isUpright ? 6 : 1;
    deployTerrainObject(TerrainObjectType.Seesaw, targetActiveCount, aabb, width, height, buffer, isUpright);
}
function deploySpinner(aabb, targetActiveCount, buffer) {
    const speed = randomUtil.randomInt(200, 250) * randomUtil.randomSign();
    deployTerrainObject(TerrainObjectType.Spinner, targetActiveCount, aabb, 7, 7, buffer, speed);
}
function deploySnake(aabb, targetActiveCount, buffer) {
    const speed = randomUtil.randomInt(40, 60) * randomUtil.randomSign();
    const agitateTime = randomUtil.randomInt(2500, 5000);
    deployTerrainObject(TerrainObjectType.Snake, targetActiveCount, aabb, 0.5, 14.5, buffer, speed, agitateTime);
}
function deployFreeSaw(aabb, targetActiveCount, buffer, velocity) {
    deployTerrainObject(TerrainObjectType.FreeSaw, targetActiveCount, aabb, 1, 1, buffer, velocity);
}
function deploySaw(aabb, targetActiveCount, buffer) {
    deployTerrainObject(TerrainObjectType.Saw, targetActiveCount, aabb, 2, 2, buffer);
}
function deploySawSpinner(aabb, targetActiveCount, buffer) {
    const speed = randomUtil.randomInt(200, 250) * randomUtil.randomSign();
    deployTerrainObject(TerrainObjectType.SawSpinner, targetActiveCount, aabb, 9, 9, buffer, speed);
}
function deploySawSnake(aabb, targetActiveCount, buffer) {
    const speed = randomUtil.randomInt(40, 60) * randomUtil.randomSign();
    const agitateTime = randomUtil.randomInt(2500, 5000);
    deployTerrainObject(TerrainObjectType.SawSnake, targetActiveCount, aabb, 2, 14.5, buffer, speed, agitateTime);
}
function deployPlus1Life(aabb, targetActiveCount, buffer) {
    deployTerrainObject(TerrainObjectType.Plus1Life, targetActiveCount, aabb, 2, 2, buffer);
}
function populateArea(aabb) {
    const height = terrainUtil.getMidHeight(aabb);
    const buffer = terrainUtil.getCountLessAsDescends(height, 4, 6, 1000);
    deploySawSnake(aabb, terrainUtil.getCountMoreAsDescends(height, 3, 6, 250), buffer);
    deploySawSpinner(aabb, terrainUtil.getCountLessAsDescends(height, 2, 8, 500), buffer);
    deploySnake(aabb, terrainUtil.getCountLessAsDescends(height, 1, 8, 600), buffer);
    deploySpinner(aabb, terrainUtil.getCountLessAsDescends(height, 1, 8, 800), buffer);
    deploySeesaw(aabb, terrainUtil.getCountLessAsDescends(height, 1, 8, 900), buffer);
    deployGirder(aabb, terrainUtil.getCountLessAsDescends(height, 1, 20, 1000), buffer);
    deploySaw(aabb, terrainUtil.getCountLessAsDescends(height, 20, 2, 1000), buffer);
    deployPlus1Life(aabb, terrainUtil.getCountMoreAsDescends(height, 1, 2, 500), buffer);
}
function dropBricks(topAABB) {
    const height = terrainUtil.getMidHeight(topAABB);
    const targetActiveCount = terrainUtil.getCountMoreAsDescends(height, 2, 6, 975);
    if (targetActiveCount === 0) return;
    const topAABBCopy = new p2.AABB();
    topAABBCopy.copy(topAABB);
    topAABBCopy.upperBound[1] -= 12;
    topAABBCopy.lowerBound[0] += 4;
    topAABBCopy.upperBound[0] -= 4;
    deployBrick(topAABB, targetActiveCount, 1);
}
function throwSaws(leftAABB, rightAABB, bottomAABB) {
    const height = terrainUtil.getMidHeight(leftAABB);
    const targetActiveCount = terrainUtil.getCountMoreAsDescends(height, 2, 4, 975);
    if (targetActiveCount === 0) return;
    {
        const isFromLeft = randomUtil.randomBoolean();
        const aabb = new p2.AABB();
        aabb.copy(isFromLeft ? leftAABB : rightAABB);
        aabb.lowerBound[1] += 14;
        if (isFromLeft) {
            aabb.lowerBound[0] += 13;
        } else {
            aabb.upperBound[0] -= 13;
        }
        const horizontalVelocity = 10;
        const verticalVelocity = randomUtil.random0To1();
        const velocity = isFromLeft ? [
            horizontalVelocity,
            verticalVelocity
        ] : [
            -horizontalVelocity,
            verticalVelocity
        ];
        deployFreeSaw(aabb, targetActiveCount, 1, velocity);
    }
    {
        const bottomAABBCopy = new p2.AABB();
        bottomAABBCopy.copy(bottomAABB);
        bottomAABBCopy.lowerBound[1] += 25;
        bottomAABBCopy.lowerBound[0] += 4;
        bottomAABBCopy.upperBound[0] -= 4;
        const verticalVelocity = 20;
        const horizontalVelocity = randomUtil.random0To1();
        const velocity = [
            horizontalVelocity,
            verticalVelocity
        ];
        deployFreeSaw(bottomAABB, targetActiveCount, 1, velocity);
    }
}
function applyWind(ballBody) {
    let bodiesToBlow = [];
    const bodies = world.bodies;
    for(let j = 0; j < bodies.length; j++){
        const body = bodies[j];
        if (body.sprite && body.sprite.visible) {
            bodiesToBlow.push(body);
        }
    }
    pixiGraph.windLeft.visible = false;
    pixiGraph.windRight.visible = false;
    const ballBodyPositionY = ballBody.position[1];
    for(let i = 0; i < windZones.length; i++){
        const windZone = windZones[i];
        if (ballBodyPositionY <= windZone.startY && ballBodyPositionY >= windZone.endY) {
            for(let k = 0; k < bodiesToBlow.length; k++){
                const body = bodiesToBlow[k];
                body.applyForce([
                    windZone.strength,
                    0
                ], [
                    0,
                    0
                ]);
            }
            if (windZone.strength < 0) {
                pixiGraph.windRight.visible = true;
            } else {
                pixiGraph.windLeft.visible = true;
            }
            break;
        }
    }
}
function agitateSnakes() {
    for(let i = 0; i < allSnakes.length; i++){
        const snake = allSnakes[i];
        if (snake.active) {
            snake.agitate();
        }
    }
}
function setObjectStates(screenAABB, activeAABB) {
    for(let i = 0; i < terrainObjectPools.length; i++){
        const terrainObjectPool = terrainObjectPools[i];
        for(let j = 0; j < terrainObjectPool.length; j++){
            const terrainObject = terrainObjectPool[j];
            if (terrainObject.active) {
                const aabb = terrainObject.getAABB();
                if (aabb.upperBound[0] < activeAABB.lowerBound[0] || aabb.lowerBound[0] > activeAABB.upperBound[0] || aabb.lowerBound[1] > activeAABB.upperBound[1] || aabb.upperBound[1] < activeAABB.lowerBound[1]) {
                    terrainObject.deactivate();
                } else if (aabb.upperBound[0] < screenAABB.lowerBound[0] || aabb.lowerBound[0] > screenAABB.upperBound[0] || aabb.lowerBound[1] > screenAABB.upperBound[1] || aabb.upperBound[1] < screenAABB.lowerBound[1]) {
                    terrainObject.suspend();
                } else {
                    if (terrainObject.suspended) {
                        terrainObject.resume();
                    }
                }
            }
        }
    }
}
function deactivateAll() {
    for(let i = 0; i < terrainObjectPools.length; i++){
        const terrainObjectPool = terrainObjectPools[i];
        for(let j = 0; j < terrainObjectPool.length; j++){
            const terrainObject = terrainObjectPool[j];
            if (terrainObject.active) {
                terrainObject.deactivate();
            }
        }
    }
}
exports.default = {
    initialize,
    update,
    deactivateAll
};

},
"Terrain/terrainUtil":function(require,exports){
const randomUtil = require("Utility/randomUtil").default;
function getRandomPosition(world, aabb, width, height, buffer) {
    const maxAttempts = 10;
    let attempts = 0;
    const minX = aabb.lowerBound[0] + width / 2;
    const maxX = aabb.upperBound[0] - width / 2;
    const minY = aabb.lowerBound[1] + height / 2;
    const maxY = aabb.upperBound[1] - height / 2;
    while(attempts < maxAttempts){
        attempts++;
        const x = randomUtil.randomInt(minX, maxX);
        const y = randomUtil.randomInt(minY, maxY);
        const position = [
            x,
            y
        ];
        if (!isBlocked(world, position, width + buffer, height + buffer)) {
            return position;
        }
    }
    return null;
}
function getMidHeight(aabb) {
    return (aabb.lowerBound[1] + aabb.upperBound[1]) / 2;
}
function getCountMoreAsDescends(height, min, max, startingHeight) {
    if (height > startingHeight) return 0;
    const proportion = (startingHeight - height) / startingHeight;
    const count = Math.round(min + proportion * (max - min));
    return count;
}
function getCountLessAsDescends(height, min, max, startingHeight) {
    if (height > startingHeight) return 0;
    const proportion = (startingHeight - height) / startingHeight;
    const count = Math.round(min + (1 - proportion) * (max - min));
    return count;
}
function updateAABBs(world) {
    const bodies = world.bodies;
    for(let i = 0; i < bodies.length; i++){
        const body = bodies[i];
        if (body.aabbNeedsUpdate) {
            body.updateAABB();
        }
    }
}
function isBlocked(world, position, width, height) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const bodies = world.bodies;
    for(let i = 0; i < bodies.length; i++){
        const body = bodies[i];
        const aabb = body.aabb;
        if (!(aabb.upperBound[0] < position[0] - halfWidth || aabb.lowerBound[0] > position[0] + halfWidth || aabb.upperBound[1] < position[1] - halfHeight || aabb.lowerBound[1] > position[1] + halfHeight)) {
            return true;
        }
    }
    return false;
}
exports.default = {
    getRandomPosition,
    getMidHeight,
    getCountMoreAsDescends,
    getCountLessAsDescends,
    updateAABBs
};

},
"Utility/blendColors":function(require,exports){
function blendColors(color1, color2, ratio) {
    var hex = function(num) {
        const hexStr = num.toString(16);
        return hexStr.length === 1 ? '0' + hexStr : hexStr;
    };
    const color1Hex = hex(color1);
    const color2Hex = hex(color2);
    const r = Math.ceil(parseInt(color1Hex.substring(0, 2), 16) * ratio + parseInt(color2Hex.substring(0, 2), 16) * (1 - ratio));
    const g = Math.ceil(parseInt(color1Hex.substring(2, 4), 16) * ratio + parseInt(color2Hex.substring(2, 4), 16) * (1 - ratio));
    const b = Math.ceil(parseInt(color1Hex.substring(4, 6), 16) * ratio + parseInt(color2Hex.substring(4, 6), 16) * (1 - ratio));
    const blended = hex(r) + hex(g) + hex(b);
    return parseInt(blended, 16);
}
exports.default = blendColors;

},
"Utility/gameClock":function(require,exports){
let elapsed = 0;
exports.default = {
    now: ()=>elapsed,
    advance: (delta)=>{
        elapsed += delta;
    },
    reset: ()=>{
        elapsed = 0;
    }
};

},
"Utility/randomUtil":function(require,exports){
const seed = 1;
const mersenneTwister = new MersenneTwister(seed);
function reseed() {
    mersenneTwister.seed(seed);
}
function random0To1() {
    return mersenneTwister.rnd();
}
function randomNeg1ToPos1() {
    return (mersenneTwister.rnd() - 0.5) * 2;
}
function randomSign() {
    return randomInt(1, 2) === 1 ? -1 : 1;
}
function randomInt(min, max) {
    const r = mersenneTwister.rnd();
    return Math.floor(r * (max - min + 1)) + min;
}
function randomBoolean() {
    return randomInt(1, 2) === 1;
}
exports.default = {
    reseed,
    random0To1,
    randomNeg1ToPos1,
    randomSign,
    randomInt,
    randomBoolean
};

},
"Utility/timer":function(require,exports){
const Bus = require("Bus").default;
const timeLogs = {};
let loggingInitialized = false;
function time(key, func) {
    let timeLog = timeLogs[key];
    if (!timeLog) {
        timeLog = timeLogs[key] = {
            startTime: performance.now(),
            iterations: 0,
            totalTime: 0
        };
    }
    if (!loggingInitialized) {
        loggingInitialized = true;
        const updateIntervalMs = 2000;
        window.setInterval(()=>{
            const keys = Object.keys(timeLogs);
            let output = '';
            keys.forEach((key)=>{
                const timeLog = timeLogs[key];
                const iterationsPerSecond = Math.round(timeLog.iterations / ((performance.now() - timeLog.startTime) / 1000));
                output += key + ' ' + iterationsPerSecond + '   ';
            });
            Bus.publish('Log', output);
        }, updateIntervalMs);
    }
    const timeStart = performance.now();
    func();
    const timeEnd = performance.now();
    const duration = timeEnd - timeStart;
    timeLog.iterations++;
    timeLog.totalTime += duration;
}
exports.default = {
    time
};

},
"Utility/tintUtil":function(require,exports){
const TerrainObject = require("Terrain/Objects/TerrainObject").default;
function tintTerrainObject(terrainObject, tint) {
    const bodies = terrainObject.bodies;
    for(let i = 0; i < bodies.length; i++){
        const body = bodies[i];
        tintSprite(body.sprite, tint);
        tintSprite(body.spriteReflection, tint);
    }
}
function untintTerrainObject(terrainObject) {
    const bodies = terrainObject.bodies;
    for(let i = 0; i < bodies.length; i++){
        const body = bodies[i];
        untintSprite(body.sprite);
        untintSprite(body.spriteReflection);
    }
}
function tintSprite(sprite, tint) {
    if (sprite) {
        sprite.tint = tint;
    }
}
function untintSprite(sprite) {
    if (sprite) {
        sprite.tint = sprite.originalTint || 0xffffff;
    }
}
exports.default = {
    tintTerrainObject,
    untintTerrainObject,
    tintSprite,
    untintSprite
};

},
"ball":function(require,exports){
const TerrainObjectType = require("Terrain/Objects/TerrainObjectType").default;
const materials = require("p2/materials").default;
const Color = require("Color").default;
const Bus = require("Bus").default;
let body;
let active = false;
Bus.subscribe("State.IsActive", (value)=>{
    active = value;
});
function initialize(world, pixiGraph, textures) {
    body = new p2.Body({
        mass: 0.5
    });
    body.allowSleep = false;
    const circle = new p2.Circle({
        radius: 1
    });
    circle.material = materials.ball;
    body.addShape(circle);
    const ballSprite = new PIXI.Sprite(textures.ball);
    ballSprite.anchor = new PIXI.ObservablePoint(null, null, 0.5, 0.5);
    ballSprite.tint = ballSprite.originalTint = Color.blue;
    pixiGraph.playerBallContainer.addChild(ballSprite);
    body.sprite = ballSprite;
    const ballReflectionSprite = new PIXI.Sprite(textures.ballReflections);
    ballReflectionSprite.alpha = 0.5;
    ballReflectionSprite.anchor = new PIXI.ObservablePoint(null, null, 0.5, 0.5);
    pixiGraph.playerBallContainer.addChild(ballReflectionSprite);
    body.spriteReflection = ballReflectionSprite;
    world.addBody(body);
    world.on('beginContact', beginContact, this);
    return body;
}
function beginContact(contactEvent) {
    if (!active) return;
    const bodyA = contactEvent.bodyA;
    const bodyB = contactEvent.bodyB;
    if (bodyA === body || bodyB === body) {
        const otherBody = bodyA === body ? bodyB : bodyA;
        if (otherBody.isFatal) {
            Bus.publish('Ball.CollisionWithFatal', otherBody);
            return;
        } else if (otherBody.isGround) {
            Bus.publish('Ball.CollisionWithGround');
            return;
        } else if (otherBody.terrainObject && otherBody.terrainObject.type === TerrainObjectType.Plus1Life) {
            otherBody.terrainObject.deactivate();
            Bus.publish('Ball.CollisionWithPlusOne');
        }
    }
}
exports.default = {
    initialize
};

},
"deviceReady":function(require,exports){
var deviceReadyPromise = new Promise((resolve, reject)=>{
    if (window.cordova) {
        document.addEventListener('deviceready', ()=>{
            resolve();
        }, false);
    } else {
        resolve();
    }
});
exports.default = deviceReadyPromise;

},
"ground":function(require,exports){
const materials = require("p2/materials").default;
let body;
function initialize(world, pixiGraph, textures) {
    body = new p2.Body();
    body.isGround = true;
    const groundShape = new p2.Box({
        width: 32,
        height: 18
    });
    groundShape.material = materials.wood;
    body.addShape(groundShape);
    const groundSprite = new PIXI.Sprite(textures.ground);
    groundSprite.scale.x = groundSprite.scale.y = 2;
    groundSprite.anchor = new PIXI.ObservablePoint(null, null, 0.5, 0.5);
    pixiGraph.terrainContainer.addChild(groundSprite);
    body.sprite = groundSprite;
    world.addBody(body);
    world.on('beginContact', beginContact, this);
    return body;
}
function beginContact(contactEvent) {
    const bodyA = contactEvent.bodyA;
    const bodyB = contactEvent.bodyB;
    if (!(bodyA === body || bodyB === body)) return;
    const otherBody = bodyA === body ? bodyB : bodyA;
    if (otherBody.terrainObject) {
        otherBody.terrainObject.deactivate();
    }
}
exports.default = {
    initialize
};

},
"index":function(require,exports){
const Bus = require("Bus").default;
const deviceReadyPromise = require("deviceReady").default;
const texturesPromise = require("Assets/loadTextures").default;
const soundsPromise = require("Assets/loadSounds").default;
const fontsPromise = require("Assets/loadFonts").default;
const createWorld = require("p2/createWorld").default;
const buildPixiGraph = require("Pixi/buildPixiGraph").default;
const terrainBuilder = require("Terrain/terrainBuilder").default;
const ball = require("ball").default;
const bar = require("Bar").default;
const soundPlayer = require("Sound/soundPlayer").default;
const gameLoop = require("Game/gameLoop").default;
deviceReadyPromise.then(()=>{
    let soundSupported = false;
    soundsPromise.then((sounds)=>{
        soundSupported = true;
        soundPlayer.initialize(sounds);
    }).catch((reason)=>{}).then(()=>{
        Promise.all([
            texturesPromise,
            fontsPromise
        ]).then((results)=>{
            const textures = results[0];
            const world = createWorld();
            const pixiGraph = buildPixiGraph(textures, soundSupported);
            terrainBuilder.initialize(world, pixiGraph, textures);
            const ballBody = ball.initialize(world, pixiGraph, textures);
            bar.initialize(world, pixiGraph, textures);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('viewport').style.display = 'block';
            gameLoop.initialize(world, pixiGraph, ballBody);
            window.descensusInitialized(gameLoop, Bus);
        }).catch((error)=>window.descensusFailure(String(error)));
    });
});

},
"p2/createWorld":function(require,exports){
const materials = require("p2/materials").default;
function createWorld() {
    const world = new p2.World({
        gravity: [
            0,
            -4.9
        ]
    });
    world.solver = new p2.GSSolver({
        tolerance: 0.01,
        iterations: 10
    });
    world.sleepMode = p2.World.BODY_SLEEPING;
    addContactMaterials(world);
    return world;
}
function addContactMaterials(world) {
    world.addContactMaterial(new p2.ContactMaterial(materials.wood, materials.wood, {
        restitution: 0.1,
        stiffness: Number.MAX_VALUE,
        friction: 0.3,
        relaxation: undefined,
        frictionStiffness: undefined,
        frictionRelaxation: undefined,
        surfaceVelocity: undefined
    }));
    world.addContactMaterial(new p2.ContactMaterial(materials.wood, materials.saw, {
        restitution: 0.3,
        stiffness: Number.MAX_VALUE,
        friction: 0.6,
        relaxation: undefined,
        frictionStiffness: undefined,
        frictionRelaxation: undefined,
        surfaceVelocity: undefined
    }));
    world.addContactMaterial(new p2.ContactMaterial(materials.wood, materials.brick, {
        restitution: 0.1,
        stiffness: Number.MAX_VALUE,
        friction: 0.6,
        relaxation: undefined,
        frictionStiffness: undefined,
        frictionRelaxation: undefined,
        surfaceVelocity: undefined
    }));
    world.addContactMaterial(new p2.ContactMaterial(materials.wood, materials.ball, {
        restitution: 0.4,
        stiffness: Number.MAX_VALUE,
        friction: 0.3,
        relaxation: undefined,
        frictionStiffness: undefined,
        frictionRelaxation: undefined,
        surfaceVelocity: undefined
    }));
    world.addContactMaterial(new p2.ContactMaterial(materials.brick, materials.brick, {
        restitution: 0,
        stiffness: Number.MAX_VALUE,
        friction: 0.8,
        relaxation: undefined,
        frictionStiffness: undefined,
        frictionRelaxation: undefined,
        surfaceVelocity: undefined
    }));
    world.addContactMaterial(new p2.ContactMaterial(materials.brick, materials.ball, {
        restitution: 0.5,
        stiffness: Number.MAX_VALUE,
        friction: 0.4,
        relaxation: undefined,
        frictionStiffness: undefined,
        frictionRelaxation: undefined,
        surfaceVelocity: undefined
    }));
    world.addContactMaterial(new p2.ContactMaterial(materials.brick, materials.saw, {
        restitution: 0.3,
        stiffness: Number.MAX_VALUE,
        friction: 0.4,
        relaxation: undefined,
        frictionStiffness: undefined,
        frictionRelaxation: undefined,
        surfaceVelocity: undefined
    }));
    world.addContactMaterial(new p2.ContactMaterial(materials.saw, materials.saw, {
        restitution: 0.4,
        stiffness: Number.MAX_VALUE,
        friction: 0.8,
        relaxation: undefined,
        frictionStiffness: undefined,
        frictionRelaxation: undefined,
        surfaceVelocity: undefined
    }));
}
exports.default = createWorld;

},
"p2/materials":function(require,exports){
const materials = {
    ball: new p2.Material(),
    wood: new p2.Material(),
    brick: new p2.Material(),
    saw: new p2.Material()
};
exports.default = materials;

},
"p2/p2Util":function(require,exports){
function updateBodyPosition(body, position, angle = 0) {
    resetBody(body);
    const bodyPosition = body.position;
    bodyPosition[0] = position[0];
    bodyPosition[1] = position[1];
    body.angle = angle;
    body.updateAABB();
    body.updateBoundingRadius();
}
function resetBody(body) {
    body.setZeroForce();
    body.velocity[0] = 0;
    body.velocity[1] = 0;
    body.angularVelocity = 0;
}
function limitVelocity(world) {
    const maxVelocity = 14;
    const maxAngularVelocity = 250;
    const bodies = world.bodies;
    for(let i = 0; i < bodies.length; i++){
        const body = bodies[i];
        const velocity = body.velocity;
        const absVelocityX = Math.abs(velocity[0]);
        const absVelocityY = Math.abs(velocity[1]);
        if (absVelocityX > maxVelocity || absVelocityY > maxVelocity) {
            const ratio = Math.min(maxVelocity / absVelocityX, maxVelocity / absVelocityY);
            velocity[0] *= ratio;
            velocity[1] *= ratio;
        }
        if (body.angularVelocity > maxAngularVelocity) {
            body.angularVelocity = maxAngularVelocity;
        } else if (body.angularVelocity < -maxAngularVelocity) {
            body.angularVelocity = -maxAngularVelocity;
        }
    }
}
exports.default = {
    updateBodyPosition,
    resetBody,
    limitVelocity
};

}
};const cache=Object.create(null);function require(id){if(cache[id])return cache[id];if(!modules[id])throw Error("Missing module "+id);const exports=cache[id]={};modules[id](require,exports);return exports;}require("index");})();
