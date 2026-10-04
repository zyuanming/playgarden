import { Suspense, useState, useEffect } from "react";
import {
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  Lightbulb,
  Undo2,
  Check,
  ArrowRight,
} from "lucide-react";
import { games } from "../lib/registry";
import type { GameId } from "../lib/types";
export function GameShell({
  id,
  onBack,
  onComplete,
  completed,
}: {
  id: GameId;
  onBack: () => void;
  onComplete: (level: number) => void;
  completed: number[];
}) {
  const game = games.find((g) => g.id === id)!;
  const [level, setLevel] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reset, setReset] = useState(0);
  const [hint, setHint] = useState(0);
  const [undo, setUndo] = useState(0);
  const [status, setStatus] = useState("");
  const [won, setWon] = useState(false);
  const Game = game.component;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPaused((p) => !p);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  function changeLevel(l: number) {
    setLevel(l);
    setWon(false);
    setPaused(false);
    setHint(0);
    setUndo(0);
    setReset((r) => r + 1);
  }
  return (
    <main className="game-main">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={18} />
        返回游戏大厅
      </button>
      <div className="game-heading">
        <div>
          <span className={`category ${game.tone}`}>{game.category}</span>
          <h1>{game.title}</h1>
        </div>
        <div className="level-tabs" aria-label="选择关卡">
          {[0, 1, 2].map((l) => (
            <button
              key={l}
              className={level === l ? "active" : ""}
              aria-pressed={level === l}
              onClick={() => changeLevel(l)}
            >
              {completed.includes(l) && <Check size={15} />}第 {l + 1} 关
            </button>
          ))}
        </div>
      </div>
      <div className="game-toolbar">
        <button onClick={() => setPaused((p) => !p)}>
          {paused ? <Play size={17} /> : <Pause size={17} />}
          {paused ? "继续" : "暂停"}
        </button>
        <button
          onClick={() => {
            setReset((r) => r + 1);
            setWon(false);
            setPaused(false);
          }}
        >
          <RotateCcw size={17} />
          重来
        </button>
        <button disabled={paused || won} onClick={() => setUndo((u) => u + 1)}>
          <Undo2 size={17} />
          撤销
        </button>
        <button disabled={paused} onClick={() => setHint((h) => h + 1)}>
          <Lightbulb size={17} />
          提示
        </button>
        <span>第 {level + 1} / 3 关</span>
      </div>
      <div className="game-surface">
        <Suspense fallback={<p className="loading">正在准备游戏…</p>}>
          <Game
            key={`${level}:${reset}`}
            level={level}
            paused={paused}
            resetToken={reset}
            hintToken={hint}
            undoToken={undo}
            onComplete={() => {
              setWon(true);
              onComplete(level);
            }}
            onStatus={setStatus}
          />
        </Suspense>
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
        {won && (
          <button
            className="primary"
            onClick={() => (level < 2 ? changeLevel(level + 1) : onBack())}
          >
            {level < 2 ? "下一关" : "返回大厅"}
            <ArrowRight size={18} />
          </button>
        )}
      </div>
      <p className="privacy-note">
        进度仅保存在当前浏览器。随时休息，不需要赶时间。
      </p>
    </main>
  );
}
