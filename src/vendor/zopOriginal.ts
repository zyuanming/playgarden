// @ts-nocheck
// Zop gameplay derived from Zolmeister/Zop fafaa4751df64634aee48d942062617c21acfb26.
// Original MIT © 2015 Zolmeister. See vendor/zop-original/LICENSE.
// Host lifecycle/input boundary changes: GPL-3.0-only.
// Original rendering, neighbor/collision, selection/backtrack/loop and refill
// bodies are retained below. The old global/router/dependency wrapper is absent.
export function createZopEngine(canvas, getBest, onFinish) {
  const c=canvas.getContext('2d');
  if(!c)throw new Error('Canvas unavailable');
  const RATIO=1, paperColors={$black54:'rgba(0,0,0,0.54)'}, Score={getBest};
  let ctx,W,H,dotSize,xs,ys,choice,colors,dots,color,gameRestart,render;
  let isSelecting=false,selected=[],mouseX=0,mouseY=0,squareColor=null;
  let score=0,time=60,lastPhysicsTime=0,frameTime=0,dir,dot,isBelow,collideDot,contains,isNeighbor;
  let phase='waiting',elapsed=0,disposed=false;
  let metrics={clears:0,loops:0,lastRemoved:0,lastLoopColor:null};
  const a=canvas;
    ctx = c
    W = a.width
    H = a.height
    dotSize = Math.min(W, H) / 7
    xs = W / 2 - dotSize * 3 + dotSize / 2
    ys = H / 2 - dotSize * 3 + dotSize / 2

    if (W > H) {
      dotSize *= 0.6
      xs = W / 2 - dotSize * 3 + dotSize / 2
      ys = H / 2 - dotSize * 3
    }

    choice = function(arr) {
      return arr[Math.floor(Math.random()*arr.length)]
    }

    colors = ['#F44336', '#9C27B0', '#2196F3', '#4CAF50', '#FF9800']

    dots = []
    for (var x = 0; x < 6; x++) {
      for (var y = 0; y < 6; y++) {
        color = choice(colors)
        dots.push({
          color: color,
          ty: ys + y * dotSize,
          x: xs + x * dotSize,
          y: ys + y * dotSize,
          r: y,
          c: x
        })
      }
    }

    gameRestart = function () {
      isSelecting = false
      selected = []
      isSelecting = false
      mouseX = 0
      mouseY = 0
      squareColor = null

      score = 0
      time = 60
      lastPhysicsTime = 0

      for (var x = 0; x < 6; x++) {
        for (var y = 0; y < 6; y++) {
          color = choice(colors)
          dots[x + y * 6] = {
            color: color,
            ty: ys + y * dotSize,
            x: xs + x * dotSize,
            y: ys + y * dotSize - (dotSize * x * 2),
            r: y,
            c: x,
            tt: dotSize / 15
          }
        }
      }
    }

    render = function() {
      var physicsScale = 1
      var delta = 1
      if (lastPhysicsTime) {
        var now = frameTime
        delta = now - lastPhysicsTime
        // we want 60fps
        physicsScale = delta / 16
        // clamp
        physicsScale = Math.min(physicsScale, 5)
        lastPhysicsTime = now
      } else {
        lastPhysicsTime = frameTime
      }

      if (time === 0) {
        return
      }
      ctx.clearRect(0, 0, W, H)

      if (squareColor) {
        ctx.globalAlpha = 0.1
        ctx.fillStyle = squareColor
        ctx.fillRect(0, 0, W, H)
        ctx.globalAlpha = 1
      }

      ctx.font = dotSize / 2 + 'px sans-serif'
      function fillText(s, x, y) {
        ctx.fillText(s, x|0, y|0)
      }
      ctx.fillStyle = paperColors.$black54
      fillText(score, xs + dotSize * 2.5, ys - dotSize)
      fillText(time, xs + dotSize, ys - dotSize)
      fillText(Score.getBest(), xs + dotSize * 4, ys - dotSize)

      ctx.textAlign = 'center'
      ctx.font = 'italic ' + dotSize / 5 + 'px sans-serif'
      fillText('SCORE', xs + dotSize * 2.5, ys - dotSize + dotSize / 3)
      fillText('TIME', xs + dotSize, ys - dotSize + dotSize / 3)
      fillText('BEST', xs + dotSize * 4, ys - dotSize + dotSize / 3)


      for (var i = dots.length - 1; i >= 0 ; i--) {
        var a = dots[i]
        var hasBelow = false
        for (var j = 0; j < dots.length; j++) {
          var b = dots[j]
          if (isBelow(a, b)) {
            hasBelow = true
            break
          }
        }
        if (!hasBelow && a.r != 5) {
          a.r += 1
          a.ty = ys + a.r * dotSize
        }

        if (a.y != a.ty) {
          dir = a.y > a.ty ? -1 : 1
          a.y += a.tt * dir * physicsScale
          a.tt *= a.bdown && !a.bup ? 0.7 : 1.3

          if (dir == 1 && a.y >= a.ty) {
            a.y = a.ty
          } else if (dir == -1 && a.y <= a.ty) {
            a.y = a.ty
            if (a.bdown) {
              a.bdown = true
            }
          }

          if (!a.bdown && !a.bup && a.y == a.ty) {
            a.bdown = true
            a.ty -= dotSize / 3 * 1.3
            a.tt = dotSize / 5
          } else if (a.bdown && !a.bup && a.y == a.ty) {
            a.bup = true
            a.tt = dotSize / 25
            a.ty += dotSize / 3 * 1.3
          }

        } else {
          a.tt = dotSize / 15
          a.bdown = false
          a.bup = false
        }
      }


      for (var i = 0; i < dots.length; i++) {
        dot = dots[i]
        if (contains(selected, dot) || dot.color == squareColor) {
          ctx.fillStyle = dot.color
          ctx.globalAlpha = 0.5
          ctx.fillRect(Math.floor(dot.x - dotSize / 3), Math.floor(dot.y - dotSize / 3), Math.floor(dotSize / 1.5), Math.floor(dotSize / 1.5))
          ctx.globalAlpha = 1
        }
        ctx.fillStyle = dot.color
        ctx.fillRect(Math.floor(dot.x - dotSize / 4), Math.floor(dot.y - dotSize / 4), Math.floor(dotSize / 2), Math.floor(dotSize / 2))
      }

      if (selected.length && isSelecting) {
        ctx.strokeStyle = selected[0].color
        ctx.lineJoin = 'round'
        ctx.lineWidth = dotSize / 6
        ctx.beginPath()
        ctx.moveTo(mouseX, mouseY)
        for (var i = 0; i < selected.length; i++) {
          var dot = selected[i]
          ctx.lineTo(dot.x, dot.y)
        }
        ctx.stroke()
      }


    }

    isBelow = function (a, b) {
      return a.r + 1 == b.r && a.c == b.c
    }

    collideDot = function (x, y, dot) {
      return x > dot.x - dotSize / 2 &&
             x < dot.x + dotSize / 2 &&
             y > dot.y - dotSize / 2 &&
             y < dot.y + dotSize / 2
    }

    contains = function (arr, x) {
      return arr.indexOf(x) != -1
    }

    isNeighbor = function (a, b) {
      return a.r + 1 == b.r && a.c == b.c ||
             a.r - 1 == b.r && a.c == b.c ||
             a.c + 1 == b.c && a.r == b.r ||
             a.c - 1 == b.c && a.r == b.r
    }

    function touchend(e) {
      if (e && e.preventDefault) e.preventDefault()
      isSelecting = false
      if (selected.length < 2) {
        return selected = []
      }

      if (squareColor) {
        for (var i = 0; i < dots.length; i++) {
          var dot = dots[i]
          if (dot.color == squareColor) {
            selected.push(dot)
          }
        }
      }

      var highestRow = 0
      for (var i = 0; i < selected.length; i++) {
        var dot = selected[i]
        highestRow = Math.max(dot.r, highestRow)
      }

      for (var i = 0; i < selected.length; i++) {
        var dot = selected[i]
        do {
          var color = choice(colors)
        } while (color == squareColor)
        if (dot.r >= 0) {
          score += 1
          dot.r -= highestRow + 1
          dot.y = ys + dot.r * dotSize
          dot.ty = ys + dot.r * dotSize
          dot.color = color
        }
      }

      squareColor = null
      selected = []
    }

    function onmove (e) {
      mouseX = e.x
      mouseY = e.y

      if (isSelecting && time != 0) {
        for (var i = 0; i < dots.length; i++) {
          var dot = dots[i]
          var isntSame = selected.length && selected[0].color != dot.color
          if (isntSame || selected.length && !isNeighbor(dot, selected[0]))
            continue
          if (collideDot(mouseX, mouseY, dot)) {
            if (!contains(selected, dot)) {
              selected.unshift(dot)
            } else if (selected[1] == dot) {
              selected.shift()
            } else {
              selected.unshift(dot)
              squareColor = dot.color
            }
          }
        }
      }
    }

  function cancel(){isSelecting=false;selected=[];squareColor=null;}
  function snapshot(){return {phase,time,score,elapsed,disposed,width:W,height:H,dotSize,xs,ys,
    selecting:isSelecting,squareColor,selected:selected.map(d=>dots.indexOf(d)),
    dots:dots.map((d,id)=>({id,r:d.r,c:d.c,x:d.x,y:d.y,ty:d.ty,color:d.color,settled:Math.abs(d.y-(ys+d.r*dotSize))<0.01&&!d.bdown&&!d.bup})),metrics:{...metrics}};}
  render();
  return {
    start(){if(disposed)return;gameRestart();elapsed=0;frameTime=0;phase='playing';metrics={clears:0,loops:0,lastRemoved:0,lastLoopColor:null};render();},
    frame(dt){if(disposed||phase!=='playing')return;dt=Math.max(0,Number.isFinite(dt)?dt:0);elapsed+=dt;frameTime+=dt;time=Math.max(0,60-Math.floor(elapsed/1000));if(time===0){cancel();phase='gameover';onFinish(score);return;}render();},
    down(x,y){if(disposed||phase!=='playing')return;cancel();isSelecting=true;onmove({x,y});},
    move(x,y){if(!disposed&&phase==='playing'&&isSelecting)onmove({x,y});},
    up(){if(disposed||phase!=='playing'||!isSelecting)return;const before=score,loop=squareColor;touchend({preventDefault(){}});if(score>before){metrics.clears++;if(loop)metrics.loops++;metrics.lastRemoved=score-before;metrics.lastLoopColor=loop;}},
    cancel,
    snapshot,
    dispose(){disposed=true;cancel();phase='disposed';}
  };
}
