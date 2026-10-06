// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 YuanMing; Playgarden original interface and lifecycle integration.
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  Flag,
  RotateCcw,
  Route,
  Coins,
  Trophy,
} from "lucide-react";
import type { GameProps } from "../lib/types";
import { createHighScore } from "../vendor/cloudrunner/scoring/index";
import {
  createAudio,
  type AudioEngine,
} from "../vendor/cloudrunner/audio/index";
import { keyToIntent, swipeToIntent } from "../vendor/cloudrunner/input/index";
import type { Intent } from "../vendor/cloudrunner/player/index";
import {
  createRunner,
  startRunner,
  inputRunner,
  advanceRunner,
  runnerLessons,
  runnerScore,
  upcomingTurn,
  nextCue,
  clearBufferedInput,
  TURN_WINDOW,
  TURN_NOTICE,
  type RunnerState,
} from "./cloudrunnerLogic";
import { drawRunner, type SceneCamera } from "./cloudrunnerScene";
import "./cloudrunnerGarden.css";
function highScore() {
  return createHighScore({
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
  });
}
export default function CloudrunnerGarden({
  level,
  freePlay = true,
  paused,
  muted = false,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const [state, setState] = useState(() =>
    createRunner(freePlay ? null : level),
  );
  const current = useRef(state),
    canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null),
    audio = useRef<AudioEngine | null>(null);
  const [score] = useState(highScore);
  const [best, setBest] = useState(score.get()),
    [held, setHeld] = useState(false),
    [reduced, setReduced] = useState(false);
  const [heldMessage, setHeldMessage] = useState(
    "切走页面或画面短暂卡顿时，我们会停下脚步。",
  );
  const heldRef = useRef(false),
    pausedRef = useRef(paused),
    mutedRef = useRef(muted),
    alive = useRef(true),
    finished = useRef(false);
  const callback = useRef({ onComplete, onStatus });
  callback.current = { onComplete, onStatus };
  pausedRef.current = paused;
  mutedRef.current = muted;
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null),
    camera = useRef<SceneCamera>({ turnCount: 0, lag: 0 }),
    lastReport = useRef("");
  const previousTokens = useRef({ hintToken, undoToken });
  function update(next: RunnerState) {
    current.current = next;
    setState(next);
  }
  function report(message: string) {
    callback.current.onStatus(message);
  }
  function stopForInterruption(
    message = "切走页面或画面短暂卡顿时，我们会停下脚步。",
  ) {
    if (current.current.game.phase !== "playing") return;
    heldRef.current = true;
    setHeldMessage(message);
    setHeld(true);
    pointer.current = null;
    current.current = clearBufferedInput(current.current);
    audio.current?.setMuted(true);
    setState(current.current);
  }
  function focusPlayfield() {
    stage.current?.focus({ preventScroll: true });
    stage.current?.scrollIntoView?.({
      block: innerHeight <= 600 ? "start" : "center",
      behavior: "instant",
    });
  }
  function start() {
    if (pausedRef.current || document.hidden) return;
    heldRef.current = false;
    setHeld(false);
    finished.current = false;
    camera.current = { turnCount: 0, lag: 0 };
    const next = startRunner(
      createRunner(
        freePlay ? null : level,
        freePlay
          ? (Date.now() >>> 0) ^ Math.floor(Math.random() * 0x7fffffff)
          : 20261006,
      ),
    );
    update(next);
    audio.current?.init();
    audio.current?.setMuted(mutedRef.current);
    focusPlayfield();
    report(
      freePlay
        ? "出发！收集光点，留意前方障碍和路口。"
        : runnerLessons[level].caption,
    );
  }
  function resume() {
    heldRef.current = false;
    setHeld(false);
    current.current = clearBufferedInput(current.current);
    setState(current.current);
    audio.current?.setMuted(mutedRef.current);
    focusPlayfield();
  }
  function intent(move: Intent) {
    if (pausedRef.current || heldRef.current || document.hidden) return;
    const before = current.current,
      next = inputRunner(before, move);
    if (next === before) return;
    update(next);
    audio.current?.sfx(
      move === "left" || move === "right" ? "lane-switch" : move,
    );
  }
  useEffect(() => {
    audio.current = createAudio();
    alive.current = true;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const motion = () => setReduced(media.matches);
    media.addEventListener?.("change", motion);
    const hidden = () => {
      if (document.hidden) stopForInterruption();
    };
    const blur = () => stopForInterruption();
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", blur);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", blur);
      media.removeEventListener?.("change", motion);
      audio.current?.dispose();
      audio.current = null;
      pointer.current = null;
    };
  }, []);
  useEffect(() => {
    audio.current?.setMuted(muted || paused || held);
    if (paused) {
      pointer.current = null;
      current.current = clearBufferedInput(current.current);
      setState(current.current);
    }
  }, [muted, paused, held]);
  useEffect(() => {
    if (previousTokens.current.hintToken !== hintToken)
      report(
        "左右换道，上跳下滑。路口箭头变亮后，左右操作会预备转弯；可在到达前改正方向。短暂停顿或离开页面会安全暂停。",
      );
    if (previousTokens.current.undoToken !== undoToken)
      report("跑酷不能撤回时间；用“重来”开始新一局。");
    previousTokens.current = { hintToken, undoToken };
  }, [hintToken, undoToken]);
  useEffect(() => {
    report(
      freePlay
        ? "云端小路已经准备好了。按“开始奔跑”出发，先试试六段入门也很好。"
        : runnerLessons[level].caption,
    );
  }, []);
  useEffect(() => {
    let frame = 0,
      last = 0,
      lastUi = 0,
      lastDraw: RunnerState | null = null,
      lastWidth = 0,
      lastHeight = 0;
    if (canvas.current) {
      drawRunner(canvas.current, current.current, camera.current, 0, reduced);
      lastDraw = current.current;
      lastWidth = canvas.current.clientWidth;
      lastHeight = canvas.current.clientHeight;
    }
    const loop = (now: number) => {
      if (!alive.current) return;
      const elapsed = last ? (now - last) / 1000 : 0;
      last = now;
      const running =
        current.current.game.phase === "playing" &&
        !pausedRef.current &&
        !heldRef.current &&
        !document.hidden;
      if (running && elapsed > 0.25) stopForInterruption();
      else if (running) {
        const before = current.current,
          next = advanceRunner(before, elapsed);
        current.current = next;
        if (next.coins > before.coins) audio.current?.sfx("coin");
        if (
          next.game.phase === "gameOver" &&
          before.game.phase !== "gameOver"
        ) {
          if (freePlay) setBest(score.submit(runnerScore(next)));
          if (next.outcome === "finished" && !finished.current) {
            finished.current = true;
            callback.current.onComplete();
          } else audio.current?.sfx("crash");
          report(next.reason);
          setState(next);
        } else if (now - lastUi > 80) {
          setState(next);
          lastUi = now;
        }
      }
      if (canvas.current) {
        const node = canvas.current;
        if (
          running ||
          lastDraw !== current.current ||
          lastWidth !== node.clientWidth ||
          lastHeight !== node.clientHeight
        ) {
          drawRunner(
            node,
            current.current,
            camera.current,
            running ? Math.min(elapsed, 0.05) : 0,
            reduced,
          );
          lastDraw = current.current;
          lastWidth = node.clientWidth;
          lastHeight = node.clientHeight;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [freePlay, reduced]);
  const lesson = freePlay ? null : runnerLessons[level],
    turn = upcomingTurn(state),
    turnDistance = turn ? turn.z - state.game.distance : Infinity;
  const locked = paused || held || state.game.phase !== "playing",
    cue = nextCue(state),
    turnReady = turnDistance <= TURN_WINDOW;
  useEffect(() => {
    if (!locked && cue !== lastReport.current) {
      const semantic = cue.replace(/\d+ 米/, "前方");
      if (semantic !== lastReport.current) {
        lastReport.current = semantic;
        report(semantic);
      }
    }
  }, [cue, locked]);
  function key(e: KeyboardEvent<HTMLDivElement>) {
    if (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.repeat ||
      e.target instanceof HTMLButtonElement
    )
      return;
    const move = keyToIntent(e.code);
    if (move) {
      e.preventDefault();
      intent(move);
    }
  }
  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.target instanceof Element && e.target.closest("button")) return;
    if (!e.isPrimary) {
      pointer.current = null;
      return;
    }
    if (locked) return;
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* A canceled pointer no longer owns capture. */
    }
    e.currentTarget.focus({ preventScroll: true });
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    pointer.current = null;
    if (!p || p.id !== e.pointerId || locked) return;
    const move = swipeToIntent(e.clientX - p.x, e.clientY - p.y, 24);
    if (move) intent(move);
  }
  return (
    <section
      className="cloudrunner"
      data-phase={state.game.phase}
      data-outcome={state.outcome}
      data-distance={state.game.distance.toFixed(3)}
      data-lane={state.player.lane}
      data-action={state.player.mode}
      data-turns={state.turnCount}
      data-coins={state.coins}
      data-held={held}
    >
      <div className="cr-title">
        <div>
          <span>THE SKY COURIER</span>
          <h2>{lesson ? lesson.title : "沿着云路，跑向远方。"}</h2>
          <p>
            {lesson
              ? lesson.caption
              : "一次轻盈的云端远行。收集光点，把风景留在身后。"}
          </p>
        </div>
        <span className="cr-mode">
          <Route size={16} />
          {lesson ? "入门旅程" : "无尽漫游"}
        </span>
      </div>
      <div className="cr-hud" aria-label="奔跑数据">
        <div>
          <Route size={17} />
          <span>
            路程
            <strong>
              {Math.floor(state.game.distance)}
              <small>米</small>
            </strong>
          </span>
        </div>
        <div>
          <Coins size={17} />
          <span>
            光点<strong>{state.coins}</strong>
          </span>
        </div>
        <div>
          <Trophy size={17} />
          <span>
            {freePlay ? "本次 / 最佳" : "旅程目标"}
            <strong>
              {freePlay
                ? `${runnerScore(state)} / ${best}`
                : `${lesson!.length} 米`}
            </strong>
          </span>
        </div>
      </div>
      <div
        ref={stage}
        className="cr-stage"
        role="group"
        aria-label="云路跑道，方向键或 WASD 操作，也可使用下方按钮"
        tabIndex={0}
        onKeyDown={key}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={() => {
          pointer.current = null;
        }}
        onLostPointerCapture={() => {
          pointer.current = null;
        }}
      >
        <canvas
          ref={canvas}
          className="cr-canvas"
          aria-label="原创云端花园跑道，三条石路、光点和前方障碍"
          role="img"
        />
        {state.game.phase === "playing" && (
          <>
            <div className="cr-cue" aria-hidden="true">
              {cue}
            </div>
            {turn && turnDistance < TURN_NOTICE && (
              <div
                className={`cr-turn ${turnReady ? "ready" : ""}`}
                data-ready={turnReady}
              >
                <span>
                  {turn.direction === "left" ? <ArrowLeft /> : <ArrowRight />}
                </span>
                <strong>
                  {turnReady
                    ? state.queuedTurn
                      ? `已预备${state.queuedTurn === "left" ? "左" : "右"}转`
                      : "现在预备转弯"
                    : "前方路口"}
                </strong>
                <small>
                  {Math.max(0, Math.ceil(turnDistance))} 米 ·{" "}
                  {turnReady ? "方向仍可改正" : "箭头变亮后操作"}
                </small>
              </div>
            )}
          </>
        )}
        {state.game.phase === "start" && (
          <div className="cr-overlay">
            <div className="cr-sheet">
              <span className="cr-eyebrow">一封送往远方的信</span>
              <h3>{lesson ? "准备好这一段了吗？" : "云路，等你出发。"}</h3>
              <p>
                左右换道 · 上跳 · 下滑
                <br />
                路口变亮时，向箭头方向转弯
              </p>
              <button className="cr-primary" onClick={start} disabled={paused}>
                <Play size={19} />
                {lesson ? "开始这一段" : "开始奔跑"}
              </button>
              <small>点按下方按钮，或直接在画面上滑动</small>
            </div>
          </div>
        )}
        {held && state.game.phase === "playing" && !paused && (
          <div className="cr-overlay">
            <div className="cr-sheet">
              <span className="cr-eyebrow">风景会等你</span>
              <h3>已经安全暂停</h3>
              <p>{heldMessage}</p>
              <button className="cr-primary" onClick={resume} autoFocus>
                <Play size={19} />
                回到云路
              </button>
            </div>
          </div>
        )}
        {state.game.phase === "gameOver" && (
          <div className="cr-overlay">
            <div className="cr-sheet">
              <span className="cr-eyebrow">
                {state.outcome === "finished"
                  ? "这一程，顺利送达"
                  : "歇一歇，再出发"}
              </span>
              <h3>
                {state.outcome === "finished"
                  ? "抵达云端驿站！"
                  : "这次跑了 " + Math.floor(state.game.distance) + " 米"}
              </h3>
              <p>{state.reason}</p>
              <div className="cr-result">
                <strong>
                  {runnerScore(state)}
                  <small>分</small>
                </strong>
                <span>
                  {state.coins} 光点 · {state.turnCount} 次转弯
                </span>
              </div>
              {state.outcome === "finished" ? (
                <small>
                  {level < runnerLessons.length - 1
                    ? "用上方“下一关”继续旅程，或点“重来”再跑。"
                    : "六段已掌握！可以切换无尽漫游，或返回大厅。"}
                </small>
              ) : (
                <button
                  className="cr-primary"
                  onClick={start}
                  disabled={paused}
                >
                  <RotateCcw size={19} />
                  再跑一次
                </button>
              )}
            </div>
          </div>
        )}
        {state.game.phase === "playing" && !held && !paused && (
          <button
            className="cr-pause"
            aria-label="暂停奔跑"
            title="暂停奔跑"
            onClick={() =>
              stopForInterruption("歇一歇，云路会等你。准备好后再继续。")
            }
          >
            <Pause size={19} />
          </button>
        )}
        {state.game.phase === "playing" && (
          <span className="cr-live-score">
            {Math.floor(state.game.distance)} 米 · {state.coins} 光点
          </span>
        )}
        <span className="cr-lane">
          {state.player.lane === "left"
            ? "左道"
            : state.player.lane === "right"
              ? "右道"
              : "中道"}
          {state.player.mode === "jumping"
            ? " · 跳跃"
            : state.player.mode === "sliding"
              ? " · 滑铲"
              : ""}
        </span>
      </div>
      {lesson && (
        <div className="cr-progress">
          <span
            style={{
              width: `${Math.min(100, (state.game.distance / lesson.length) * 100)}%`,
            }}
          />
          <Flag size={15} />
        </div>
      )}
      <div className="cr-controls" role="group" aria-label="跑酷操作">
        <button
          disabled={locked}
          onClick={() => intent("left")}
          aria-label={turnReady ? "预备左转" : "向左换道"}
        >
          <ArrowLeft />
          <span>{turnReady ? "左转" : "向左"}</span>
        </button>
        <button
          disabled={locked}
          onClick={() => intent("jump")}
          aria-label="跳跃"
        >
          <ArrowUp />
          <span>跳跃</span>
        </button>
        <button
          disabled={locked}
          onClick={() => intent("slide")}
          aria-label="滑铲"
        >
          <ArrowDown />
          <span>滑铲</span>
        </button>
        <button
          disabled={locked}
          onClick={() => intent("right")}
          aria-label={turnReady ? "预备右转" : "向右换道"}
        >
          <ArrowRight />
          <span>{turnReady ? "右转" : "向右"}</span>
        </button>
      </div>
      <div className="cr-help">
        <p>
          <span className="cr-dot coral" />
          珊瑚矮栏：跳过 <span className="cr-dot mint" />
          薄荷横梁：滑过 <span className="cr-dot amber" />
          琥珀石柱：绕开
        </p>
        <p>
          方向键 / WASD / 空格 · Esc 暂停 · 手机上滑动或点按 ·{" "}
          {freePlay
            ? "最佳分数仅存本机；刷新后从起点再跑。"
            : "完成六段入门后，可以切换无尽漫游。"}
        </p>
      </div>
    </section>
  );
}
