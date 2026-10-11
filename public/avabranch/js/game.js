// SPDX-License-Identifier: MIT
// Original Zolmeister game; Playgarden clock/lifecycle changes, 2026.
function Game(canvas) {
	this.canvas = canvas
	this.ctx = canvas.getContext("2d")
	this.objects = []
	this.prevTime = Date.now()
	this.speed = 4
	this.paused = false
	this.play = true
	this.timeTillLevel = 10000
	this.timer = 0
	// Playgarden: one adapter-owned RAF advances only active simulation time.
	this.elapsed = 0
	this.effects = []
	this.after = function(callback, delay, arg) {
		this.effects.push({ remaining: delay, callback: callback, arg: arg })
	}
	this.physics = function(timeDelta) {
		this.elapsed += timeDelta
		var due = []
		this.effects = this.effects.filter(function(effect) {
			effect.remaining -= timeDelta
			if (effect.remaining <= 0) { due.push(effect); return false }
			return true
		})
		for (var e = 0; e < due.length; e++) due[e].callback(due[e].arg)
		this.timer += timeDelta
		if (this.timer > this.timeTillLevel) {
			this.timer = 0
			if (this.objects["spawner"]) {
				this.objects["spawner"].level += 1
			}
			if (this.objects["power_spawn"]) {
				this.objects["power_spawn"].spawn()
			}
		}
		for (var i = 0; i < this.objects.length; i++) {
			this.objects[i].physics(timeDelta)
		}
	}

	this.draw = function() {
		for (var i = 0; i < this.objects.length; i++) {
			this.objects[i].draw(this.ctx)
		}
	}

	this.addObject = function(name, o) {
		this.objects[name] = o
		this.objects.push(o)
	}
}