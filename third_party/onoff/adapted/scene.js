// Original game mechanics © 2018 Daniel Marino and Brad Dunbar (MIT).
// Lifecycle and host callbacks adapted for Playgarden (GPL-3.0-only).
import {upKey} from './src/keys.js'
import Body from './src/body.js'
import Goal from './src/goal.js'
import Guy from './src/guy.js'
import Bar from './src/bar.js'
import Counter from './src/counter.js'
import Spikes from './src/spikes.js'
import {WIDTH, HEIGHT} from './src/dimensions.js'
export default class Scene extends Body {
  constructor (game, levels) {
    super(document.getElementById('game'))
    this.deaths = new Counter(document.getElementById('death-counter'))
    this.stars = new Counter(document.getElementById('level-counter'))
    this.congrats = new Body(document.getElementById('congrats'))
    this.game = game
    this.levels = levels
    this.bars = []
    this.spikes = []
    this.paused = false
    this.guy = new Guy
    this.append(this.guy)
    this.goal = new Goal
    this.append(this.goal)
    this.index = game.selected
  }

  get on () {
    return this._on
  }

  set on (value) {
    this._on = value
    document.body.classList.toggle('on', value)
    document.body.classList.toggle('off', !value)
  }

  get index () {
    return this._index
  }

  set index (value) {
    this._index = Math.min(this.levels.length, Math.max(value || 0))

    this.on = true
    this.stars.value = Math.min(25, this.index + 1)
    while (this.bars.length) this.bars.pop().remove()
    while (this.spikes.length) this.spikes.pop().remove()

    if (this.finished) {
      this.guy.hidden = true
      this.congrats.hidden = false
      this.game.playWin()
      return
    }

    const [guy, goal, bars, spikes] = this.level
    this.guy.load(...guy)
    this.guy.hidden = false
    this.goal.load(...goal)
    this.goal.hidden = false
    this.congrats.hidden = true

    for (const values of bars) {
      const bar = new Bar(...values)
      this.append(bar)
      this.bars.push(bar)
    }

    for (const values of spikes) {
      const spike = new Spikes(...values)
      this.append(spike)
      this.spikes.push(spike)
    }
  }

  get level () {
    return this.levels[this.index]
  }

  get finished () {
    return this.index >= this.levels.length
  }

  advance () {
    if (this.paused) return
    this.game.sound('GOAL_FX')
    this.paused = true
    document.body.classList.add('finish')
    this.game.complete()
  }

  death () {
    if (this.paused) return
    this.game.sound('DEATH_FX')
    this.deaths.value += 1
    this.paused = true
    const death = document.getElementById('death')
    death.setAttribute('x', this.guy.x - 32 + this.guy.width / 2)
    death.setAttribute('y', this.guy.y - 32 + this.guy.height / 2)
    this.guy.hidden = true
    document.body.classList.add('dying')
    this.game.after(700, () => {
      document.body.classList.remove('dying')
      this.reset()
      this.guy.hidden = false
      this.paused = false
    })
  }

  reset () {
    this.guy.load(...this.level[0])
    this.guy.vx = this.guy.vy = 0
  }

  lost () {
    return this.guy.bottom > HEIGHT || this.bars.some((bar) =>
      bar.on === this.on && bar.overlaps(this.guy)
    ) || this.spikes.some((spike) =>
      spike.on === this.on && spike.overlaps(this.guy)
    )
  }

  setBounds (body) {
    const {bounds} = body

    bounds.left = -body.left
    bounds.right = WIDTH - body.right
    bounds.top = -body.top
    bounds.bottom = HEIGHT - body.bottom + 1

    for (const bar of this.bars) {
      if (bar.on !== this.on) continue

      if (bar.top < body.bottom && bar.bottom > body.top) {
        if (bar.isRightOf(body)) {
          bounds.right = Math.min(bounds.right, bar.left - body.right)
        } else if (bar.isLeftOf(body)) {
          bounds.left = Math.max(bounds.left, bar.right - body.left)
        }
      }

      if (bar.left < body.right && bar.right > body.left) {
        if (bar.isBelow(body)) {
          bounds.bottom = Math.min(bounds.bottom, bar.top - body.bottom)
        } else if (bar.isAbove(body)) {
          bounds.top = Math.max(bounds.top, bar.bottom - body.top)
        }
      }
    }

    return bounds
  }

  tick (scale) {
    if (this.paused || this.hidden) return

    this.guy.tick(scale)

    const {left, right} = this.setBounds(this.guy)
    this.guy.x += Math.min(right, Math.max(left, this.guy.vx))

    const {top, bottom} = this.setBounds(this.guy)
    this.guy.y += Math.min(bottom, Math.max(top, this.guy.vy))

    if (bottom === 0) {
      this.guy.vy = upKey() ? -scale(1200) : 0
      if (upKey()) this.game.sound('JUMP_FX')
    } else {
      this.guy.vy = Math.min(scale(600), this.guy.vy + scale(120))
    }

    if (this.lost()) {
      this.death()
    } else if (this.guy.overlaps(this.goal)) {
      this.advance()
    }
  }
}
