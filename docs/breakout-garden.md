# 反弹砖园

One new rule system: move a paddle to control a ball's rebound angle and clear bricks before three misses. Twelve original stages are finite challenges, not twelve separate games. Fixed logical court 400 × 500; visual scaling preserves physics. Bricks marked 2 need two hits. Every hit scores ten, and completion requires all brick durability to reach zero. No network, account, advertising or upstream media is included.

## Actual source reuse

Source: Jake Gordon and contributors, `javascript-breakout`, fixed `eed59e2affa9423b93d2ac8ff93061bb88b33284`. `src/vendor/breakout/geometry.ts` actually adapts `game.js` `Game.Math.intercept`, the expanded rectangle approach of `ballIntercept`, and the paddle contact-offset response from `breakout.js` `Ball.update`. MIT is preserved in `src/vendor/breakout/LICENSE.txt` and `public/breakout-LICENSE.txt`. The upstream LICENSE separately describes CC BY-ND audio: none is copied. Original images, levels, global DOM/polyfill runtime and sound loader are also excluded.

Changes: compare all approaching faces by time of impact; reflect both normals for an exact corner; bounded iterative remaining-time handling replaces recursion; minimum vertical rebound prevents flat trajectories. Expanded rectangle corners are an intentional arcade approximation rather than exact circle-versus-corner dynamics. Fixed microsteps up to 1/120 s and a 50 ms frame cap avoid tunnelling and long-stall penalties.

## Controls and lifecycle

Pointer/mouse drag or arrow keys move the paddle. Space/Enter and the visible launch button release the ball. Modifier shortcuts are ignored; keyup, blur and pointer cancellation release held directions. Visibility loss and window blur require explicit local resume. Shell pause, local pause and hidden state freeze simulation; leaving the component cancels animation frames and event listeners. Reset or level switch starts fresh. This real-time mode intentionally does not provide undo. Hints explain the stage's control principle, not a guaranteed winning trajectory.

## Validation boundaries

Rules are tested independently against slab intersection and lawful input controllers. Browser journeys control the actual paddle using pointer input derived from rendered positions, not internal state injection. Desktop and mobile Chromium screenshots, lifecycle and narrow-layout checks are mandatory; viewport simulation is not a claim of physical iPhone performance or complete accessibility certification. GitHub exact-commit CI, independent image review, then public deployment verification are release gates. Development branch checkpoints are not acceptance.
