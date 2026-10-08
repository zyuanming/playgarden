import { LicenseLinks } from "./LicenseLinks";
import "./gameMode.css";
import { Suspense, useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  Lightbulb,
  Undo2,
  ArrowRight,
} from "lucide-react";
import { games } from "../lib/registry";
import { GameBoundary } from "./GameBoundary";
import type { GameId } from "../lib/types";
export function GameShell({
  id,
  onBack,
  onComplete,
  completed,
  muted = false,
}: {
  id: GameId;
  onBack: () => void;
  onComplete: (level: number) => void;
  completed: number[];
  muted?: boolean;
}) {
  const game = games.find((g) => g.id === id)!;
  const [freePlay, setFreePlay] = useState(() => {
    if (game.endless) return true;
    if (!game.freePlay) return false;
    try {
      return localStorage.getItem(`${game.resumeKey}.mode`) !== "practice";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (game.freePlay)
      try {
        localStorage.setItem(
          `${game.resumeKey}.mode`,
          freePlay ? "free" : "practice",
        );
      } catch {
        /* Best effort. */
      }
  }, [game.freePlay, game.resumeKey, freePlay]);
  const [level, setLevel] = useState(() => {
    if (game.resumeKey)
      try {
        const raw = localStorage.getItem(`${game.resumeKey}.selected`);
        const saved = raw === null ? -1 : Number(raw);
        if (
          Number.isInteger(saved) &&
          saved >= 0 &&
          saved < game.levelCount &&
          !completed.includes(saved)
        )
          return saved;
      } catch {
        /* Local storage can be disabled. */
      }
    return (
      Array.from({ length: game.levelCount }, (_, i) => i).find(
        (i) => !completed.includes(i),
      ) ?? 0
    );
  });
  useEffect(() => {
    if (game.resumeKey && !game.endless)
      try {
        localStorage.setItem(`${game.resumeKey}.selected`, String(level));
      } catch {
        /* Best-effort resume. */
      }
  }, [game.resumeKey, level]);
  const [paused, setPaused] = useState(false);
  const [reset, setReset] = useState(0);
  const [freshStart, setFreshStart] = useState(false);
  const [hint, setHint] = useState(0);
  const [undo, setUndo] = useState(0);
  const [status, setStatus] = useState("");
  const [won, setWon] = useState(false);
  const Game = game.component;
  const mainRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const advanceRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    mainRef.current?.scrollIntoView?.({ block: "start", behavior: "auto" });
    headingRef.current?.focus({ preventScroll: true });
  }, [id, level]);
  useEffect(() => {
    if (!won) return;
    advanceRef.current?.scrollIntoView?.({
      block: "nearest",
      behavior: "auto",
    });
    advanceRef.current?.focus({ preventScroll: true });
  }, [won]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !e.repeat &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      )
        setPaused((p) => !p);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  function changeLevel(l: number) {
    setFreshStart(false);
    setLevel(l);
    setWon(false);
    setPaused(false);
    setHint(0);
    setUndo(0);
    setReset((r) => r + 1);
  }
  return (
    <main ref={mainRef} className="game-main" data-game={id} data-level={level}>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={18} />
        返回游戏大厅
      </button>
      <div className="game-heading">
        <div>
          <span className={`category ${game.tone}`}>{game.category}</span>
          <h1 ref={headingRef} tabIndex={-1}>
            {game.title}
          </h1>
        </div>
        {!freePlay && (
          <div className="level-picker">
            <label htmlFor="game-level">选择关卡</label>
            <select
              id="game-level"
              value={level}
              onChange={(event) => changeLevel(Number(event.target.value))}
            >
              {Array.from({ length: game.levelCount }, (_, l) => (
                <option key={l} value={l}>
                  第 {l + 1} 关{completed.includes(l) ? " · 已完成" : ""}
                </option>
              ))}
            </select>
            <span>
              {completed.filter((l) => l < game.levelCount).length}/
              {game.levelCount} 已完成
            </span>
          </div>
        )}
      </div>
      {game.freePlay && !game.endless && (
        <div className="game-mode-picker" role="group" aria-label="游玩方式">
          <button
            aria-pressed={freePlay}
            onClick={() => {
              if (freePlay) return;
              setFreePlay(true);
              setWon(false);
              setPaused(false);
              setFreshStart(false);
              setHint(0);
              setUndo(0);
            }}
          >
            {game.modeLabels?.free ?? "自由对弈"}
          </button>
          <button
            aria-pressed={!freePlay}
            onClick={() => {
              if (!freePlay) return;
              setFreePlay(false);
              setWon(false);
              setPaused(false);
              setFreshStart(false);
              setHint(0);
              setUndo(0);
            }}
          >
            {game.modeLabels?.practice ?? "棋形练习"}
          </button>
        </div>
      )}
      <div className="game-toolbar">
        <button onClick={() => setPaused((p) => !p)}>
          {paused ? <Play size={17} /> : <Pause size={17} />}
          {paused ? "继续" : "暂停"}
        </button>
        <button
          onClick={() => {
            if (game.resumeKey)
              try {
                localStorage.removeItem(
                  `${game.resumeKey}.round.${freePlay ? "free" : level}`,
                );
              } catch {
                /* The module still receives the reset token. */
              }
            setFreshStart(true);
            setReset((r) => r + 1);
            setWon(false);
            setPaused(false);
          }}
        >
          <RotateCcw size={17} />
          重来
        </button>
        <button
          disabled={paused || won || game.allowUndo === false}
          title={
            game.allowUndo === false
              ? "实时游戏不能撤销；可使用重来"
              : undefined
          }
          onClick={() => setUndo((u) => u + 1)}
        >
          <Undo2 size={17} />
          撤销
        </button>
        <button disabled={paused} onClick={() => setHint((h) => h + 1)}>
          <Lightbulb size={17} />
          提示
        </button>
        <span>
          {freePlay ? (
            (game.freePlayCaption ?? "完整对局")
          ) : (
            <>
              第 {level + 1} / {game.levelCount} 关
            </>
          )}
        </span>
      </div>
      {won && (
        <div className="game-win-banner" aria-label="通关操作">
          <p>
            <strong>第 {level + 1} 关完成了！</strong>
            <span>可以继续挑战，也可以随时休息。</span>
          </p>
          <button
            ref={advanceRef}
            className="primary"
            onClick={() =>
              level < game.levelCount - 1 ? changeLevel(level + 1) : onBack()
            }
          >
            {level < game.levelCount - 1 ? "下一关" : "返回大厅"}
            <ArrowRight size={18} />
          </button>
        </div>
      )}
      <div className="game-surface">
        <GameBoundary
          key={`${id}:${freePlay}:${level}:${reset}`}
          onBack={onBack}
        >
          <Suspense fallback={<p className="loading">正在准备游戏…</p>}>
            <Game
              key={`${freePlay}:${level}:${reset}`}
              level={level}
              freePlay={freePlay}
              paused={paused}
              muted={muted}
              resetToken={reset}
              freshStart={freshStart}
              hintToken={hint}
              undoToken={undo}
              onComplete={() => {
                if (freePlay) return;
                if (game.resumeKey)
                  try {
                    localStorage.setItem(
                      `${game.resumeKey}.selected`,
                      String(Math.min(level + 1, game.levelCount - 1)),
                    );
                  } catch {
                    /* Best effort. */
                  }
                setWon(true);
                onComplete(level);
              }}
              onStatus={setStatus}
            />
          </Suspense>
        </GameBoundary>
        {paused && (
          <div className="pause-overlay">
            <Pause size={36} />
            <h2>休息一下，也很好。</h2>
            <button className="primary" onClick={() => setPaused(false)}>
              <Play size={18} />
              继续游戏
            </button>
          </div>
        )}
      </div>
      <div
        className={`status ${won ? "success" : ""}`}
        role="status"
        aria-live="polite"
      >
        <p>{status}</p>
      </div>
      {game.source.kind === "adapted" && (
        <p className="privacy-note" aria-label="游戏源码来源">
          改编自{" "}
          <a href={game.source.url} target="_blank" rel="noreferrer">
            {game.source.author} 的 {game.source.workTitle ?? "Slant"}
          </a>{" "}
          · 固定版本 {game.source.commit.slice(0, 7)} ·{" "}
          <a href={game.source.notice} target="_blank" rel="noreferrer">
            完整 {game.source.license} 许可
          </a>
          <br />
          {game.source.notes}
        </p>
      )}
      <p className="privacy-note">
        进度仅保存在当前浏览器。随时休息，不需要赶时间。
      </p>
      <LicenseLinks />
    </main>
  );
}
