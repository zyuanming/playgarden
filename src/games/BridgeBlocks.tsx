import { useEffect, useState } from "react";
import type { GameProps } from "../lib/types";
import { bridgeLevels, bridgeConnected, type Tile } from "./bridgeLogic";
import { BridgeScene } from "../components/BridgeScene";
export default function BridgeBlocks({
  level,
  paused,
  resetToken,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = bridgeLevels[level];
  const [tiles, setTiles] = useState(config.tiles);
  const [history, setHistory] = useState<Tile[][]>([]);
  const won = bridgeConnected(tiles, config.size);
  useEffect(() => {
    setTiles(config.tiles);
    setHistory([]);
    onStatus("旋转桥块，让白色道路从左岸连续连接到右岸。");
  }, [level, resetToken]);
  useEffect(() => {
    if (hintToken) onStatus(config.hint);
  }, [hintToken]);
  useEffect(() => {
    if (undoToken)
      setHistory((h) => {
        if (h.length) setTiles(h[h.length - 1]);
        return h.slice(0, -1);
      });
  }, [undoToken]);
  useEffect(() => {
    if (won) {
      onStatus("桥梁连通了！一条完整的道路连接了两岸。");
      onComplete();
    }
  }, [won]);
  return (
    <div className="puzzle-layout">
      <div>
        <BridgeScene tiles={tiles} won={won} />
        <div className="bridge-editor board" aria-label="可操作的桥面俯视图">
          <span className="bank left">起点</span>
          <div className="bridge-grid">
            {Array.from({ length: 25 }, (_, i) => {
              const x = i % 5,
                y = Math.floor(i / 5),
                idx = tiles.findIndex((t) => t.x === x && t.y === y),
                tile = tiles[idx];
              return tile ? (
                <button
                  key={i}
                  disabled={paused || won}
                  aria-label={`${x + 1} 列 ${y + 1} 行桥块，旋转`}
                  onClick={() => {
                    setHistory((h) => [...h, tiles]);
                    setTiles((ts) =>
                      ts.map((t, j) =>
                        j === idx
                          ? { ...t, rotation: (t.rotation + 1) % 4 }
                          : t,
                      ),
                    );
                  }}
                >
                  <svg
                    viewBox="0 0 60 60"
                    style={{ transform: `rotate(${tile.rotation * 90}deg)` }}
                    aria-hidden="true"
                  >
                    <path
                      d={tile.kind === "straight" ? "M0 30H60" : "M60 30H30V60"}
                      stroke="#fff5db"
                      strokeWidth="14"
                      fill="none"
                    />
                  </svg>
                </button>
              ) : (
                <div key={i} className="water" />
              );
            })}
          </div>
          <span className="bank right">终点</span>
        </div>
      </div>
      <aside className="game-notes">
        <span className="mini-label">旋转 · 连接 · 空间</span>
        <h3>给想象力搭座桥。</h3>
        <p>
          上面是实时 3D 预览，下面是可操作的俯视图。点击桥块，顺时针旋转 90°。
        </p>
        <div className="note">
          <strong>通关规则</strong>
          <p>
            相邻的白色道路必须相接，从左侧起点一路走到右侧终点。桥面可以绕路，但不能断开。
          </p>
        </div>
        <p className="muted">
          键盘：Tab 选择桥块，Enter 或空格旋转。无需拖拽，触屏也能玩。
        </p>
      </aside>
    </div>
  );
}
