// SPDX-License-Identifier: MIT
// Avabranch by Zolmeister; silent preparation removes optional third-party music controls.
var canvas = document.getElementById("canv")
var game, player, spawner, hud, power_spawner, global_controls
var avabranchRecords = { best: 0 }
var keyListeners = []
var keyState = {};
var keyMap = {
	13 : 'enter',
	37 : 'left',
	38 : 'up',
	39 : 'right',
	40 : 'down',
	186 : ';'
};

function init() {
	keyListeners = []
	canvas.width = 800
	canvas.height = 600
	game = new Game(canvas)
	global_controls = new Controls()
	hud = new HUD(game, true)
	game.addObject("hud", hud)
	hud.draw(game.ctx)
}

function startGame() {
	keyListeners = []
	game.play = false
	game = new Game(canvas)
	player = new Player(game, null, null, null, game.speed)
	spawner = new BlockSpawner(game, game.speed)
	hud = new HUD(game)
	power_spawner = new PowerupSpawner(game)
	game.addObject("spawner", spawner)
	game.addObject("player", player)
	game.addObject("power_spawn", power_spawner)
	game.addObject("hud", hud)
	game.draw()
}

