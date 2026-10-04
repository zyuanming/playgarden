import { useState, type KeyboardEvent } from "react";
import type { GameProps } from "../lib/types";
import {
  createCubeNetBoard,
  cubeNetLevels,
  cubeNetCertificates,
  cubeNetWon,
  describeCubeNet,
  foldCubeNet,
  NET_FACE_NAMES,
  oppositeNormals,
  placeNetFace,
  solveCubeNet,
} from "./cubeNetLogic";
import { useSpatialRound } from "./spatialConstructionRound";
import SpatialConstructionScene from "./SpatialConstructionScene";
import "./spatialConstructionGames.css";
export default function CubeNetWorkshop(props: GameProps) {
  return <NetRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function NetRound(props: GameProps) {
  const level = cubeNetLevels[props.level] ?? cubeNetLevels[0],
    certificate = cubeNetCertificates[props.level] ?? cubeNetCertificates[0];
  const [selected, setSelected] = useState<number | null>(null),
    [folded, setFolded] = useState(false);
  const position = (p: number) =>
    `第 ${Math.floor(p / level.size) + 1} 行、第 ${(p % level.size) + 1} 列`;
  const round = useSpatialRound(
    props,
    createCubeNetBoard(level),
    (board) => cubeNetWon(level, board),
    (board) => {
      const search = solveCubeNet(level, board),
        found = search.board;
      if (found) {
        const face = board.findIndex((p) => p === -1);
        return {
          face,
          cell: found[face],
          message: `找到一种完整方案：选择 ${NET_FACE_NAMES[face]} 面，再放在${position(found[face])}。这是一种可行方案，不是唯一位置。`,
        };
      }
      // A published solution certificate provides an honest repair step; never label this as forced.
      const face = board.findIndex(
        (p, f) =>
          p >= 0 && p !== certificate[f] && level.fixed[f] === undefined,
      );
      return face >= 0
        ? {
            face,
            cell: board[face],
            message: `${search.status === "limit" ? "搜索达到 30,000 节点上限，还不能判定当前构造。" : "保持所有已放位置，无法补成符合要求的纸盒。"}若想沿示例答案调整，可先选 ${NET_FACE_NAMES[face]} 面，再“收回所选面”；这不表示该面在所有答案中都错。`,
          }
        : {
            message:
              "本次搜索达到上限，暂时没有找到下一步。试着用对面配对检查当前构造。",
          };
    },
    "先选 A–F 纸面，再点一格摆放；已经摆好的面也能移动。六面沿边连通，折起来不能重叠。",
    "六面成功合拢，指定的对面也配对正确！你完成了纸盒设计。",
  );
  const fold = foldCubeNet(level.size, round.board),
    count = round.board.filter((p) => p >= 0).length;
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, cell: number) {
    const delta: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -level.size,
      ArrowDown: level.size,
    };
    if (!(event.key in delta) || round.frozen) return;
    event.preventDefault();
    const next = cell + delta[event.key];
    if (
      next < 0 ||
      next >= level.size ** 2 ||
      (event.key === "ArrowLeft" && cell % level.size === 0) ||
      (event.key === "ArrowRight" && cell % level.size === level.size - 1)
    )
      return;
    event.currentTarget
      .closest(".sc-game")
      ?.querySelector<HTMLButtonElement>(`[data-net-cell="${next}"]`)
      ?.focus();
  }
  function place(cell: number) {
    if (round.frozen) return;
    const occupant = round.board.indexOf(cell);
    if (selected === null) {
      if (occupant >= 0 && level.fixed[occupant] === undefined)
        setSelected(occupant);
      else round.setFeedback("先选择一片可移动的纸面，再点击空格放置。");
      return;
    }
    if (
      !level.allowed.includes(cell) ||
      (occupant >= 0 && occupant !== selected)
    ) {
      round.setFeedback(
        "这个格子不能放置。请选择浅色空格，已有的纸面不会被覆盖。",
      );
      return;
    }
    round.change(
      (board) => placeNetFace(level, board, selected, cell),
      `${NET_FACE_NAMES[selected]} 面已移到${position(cell)}。`,
    );
  }
  return (
    <div className="puzzle-layout sc-game" data-spatial-game="cube-net">
      <section className="sc-workbench" aria-label="立方纸模工作台">
        <header className="sc-heading">
          <div>
            <span className="mini-label">
              CUBE NET WORKSHOP · 第 {props.level + 1} 关
            </span>
            <h3>{level.title}</h3>
          </div>
          <span className="sc-badge">六面成盒</span>
        </header>
        <div className="sc-stats">
          <span>
            已摆纸面 <b data-net-count={count}>{count} / 6</b>
          </span>
          <span>
            当前选择{" "}
            <b>
              {selected === null ? "请选择" : `${NET_FACE_NAMES[selected]} 面`}
            </b>
          </span>
        </div>
        <div className="sc-face-tray" role="group" aria-label="选择纸面">
          {NET_FACE_NAMES.map((name, face) => (
            <button
              type="button"
              key={name}
              data-net-face={face}
              data-position={round.board[face]}
              className={`sc-face sc-face-${face} ${selected === face ? "sc-selected" : ""} ${round.hinted?.face === face && !props.paused ? "sc-hinted" : ""}`}
              disabled={round.frozen || level.fixed[face] !== undefined}
              aria-pressed={selected === face}
              aria-label={`${name} 面${level.fixed[face] !== undefined ? "，锁定" : round.board[face] < 0 ? "，未摆放" : `，在${position(round.board[face])}`}`}
              onClick={() => setSelected(selected === face ? null : face)}
            >
              <b>{name}</b>
              <small>
                {level.fixed[face] !== undefined
                  ? "锁定"
                  : round.board[face] < 0
                    ? "待放"
                    : "已放"}
              </small>
            </button>
          ))}
        </div>
        <div
          className="sc-net-grid"
          role="group"
          aria-label="纸模放置网格"
          style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)` }}
        >
          {Array.from({ length: level.size ** 2 }, (_, cell) => {
            const face = round.board.indexOf(cell),
              allowed = level.allowed.includes(cell),
              fixed = face >= 0 && level.fixed[face] !== undefined;
            return (
              <button
                type="button"
                key={cell}
                data-net-cell={cell}
                data-face={face < 0 ? "" : NET_FACE_NAMES[face]}
                className={`sc-net-cell ${!allowed ? "sc-blocked" : ""} ${face >= 0 ? `sc-face-${face}` : ""} ${selected === face && face >= 0 ? "sc-selected" : ""} ${round.hinted?.cell === cell && !props.paused ? "sc-hinted" : ""}`}
                disabled={round.frozen}
                aria-disabled={!allowed || fixed || round.frozen}
                aria-label={`${position(cell)}，${!allowed ? "禁放格" : face < 0 ? "空格" : `${NET_FACE_NAMES[face]} 面${fixed ? "，锁定" : ""}`}`}
                onKeyDown={(e) => keyboard(e, cell)}
                onClick={() => place(cell)}
              >
                <b aria-hidden="true">
                  {face >= 0 ? NET_FACE_NAMES[face] : allowed ? "＋" : "▧"}
                </b>
                <small>
                  {Math.floor(cell / level.size) + 1},{(cell % level.size) + 1}
                  {fixed ? " 锁" : ""}
                </small>
              </button>
            );
          })}
        </div>
        <div className="sc-actions">
          <button
            type="button"
            data-net-action="remove"
            disabled={
              round.frozen || selected === null || round.board[selected] < 0
            }
            onClick={() => {
              if (selected !== null)
                round.change(
                  (board) => placeNetFace(level, board, selected, -1),
                  `${NET_FACE_NAMES[selected]} 面已收回托盘。`,
                );
            }}
          >
            收回所选面
          </button>
          <button
            type="button"
            data-net-action="clear"
            disabled={round.frozen || selected === null}
            onClick={() => setSelected(null)}
          >
            取消选择
          </button>
        </div>
        {level.opposites.length > 0 && (
          <div className="sc-pairings" aria-label="指定对面">
            {level.opposites.map(([a, b]) => {
              const known = fold.frames[a] && fold.frames[b],
                ok =
                  known &&
                  oppositeNormals(
                    fold.frames[a]!.normal,
                    fold.frames[b]!.normal,
                  );
              return (
                <span
                  key={`${a}:${b}`}
                  data-net-pair={`${a}:${b}`}
                  data-matched={Boolean(ok && fold.consistent && fold.distinct)}
                >
                  {NET_FACE_NAMES[a]} ↔ {NET_FACE_NAMES[b]} 对面{" "}
                  {known && fold.consistent && fold.distinct
                    ? ok
                      ? "✓"
                      : "待调整"
                    : "待观察"}
                </span>
              );
            })}
          </div>
        )}
        <p className="sc-inspection" data-net-inspection>
          {describeCubeNet(level, round.board)}
        </p>
        <p className="sc-feedback" role="status" aria-live="polite">
          {props.paused ? "已暂停，纸面位置与选择已保留。" : round.feedback}
        </p>
      </section>
      <aside className="game-notes sc-notes">
        <span className="mini-label">折叠 · 相邻 · 对面</span>
        <h3>
          一张平面纸，
          <br />
          六个空间方向。
        </h3>
        <p>
          每对相邻格共享一条折边。把纸片向内折
          90°，六个面必须分别朝向六个不同方向，恰好围成立方体。
        </p>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{level.idea}</p>
        </div>
        <div className="sc-preview-controls">
          <button
            type="button"
            data-net-action="preview"
            aria-pressed={folded}
            disabled={props.paused}
            onClick={() => setFolded(!folded)}
          >
            {folded ? "查看平铺纸面" : "试折当前纸面"}
          </button>
        </div>
        <SpatialConstructionScene
          model={{ kind: "net", size: level.size, board: round.board, folded }}
          paused={props.paused}
        />
        <p className="sc-small">
          预览上的 1–6 个点依次对应 A–F
          面。纸片不连通或折边矛盾时保留平铺视图。没有自动动画。
        </p>
        <ul>
          <li>只在浅色格放置；深色锁定面不能移动。</li>
          <li>角碰角不连通，两个面也不能放进同一格。</li>
          <li>任何满足网格与对面要求的合法展开图都会通过。</li>
        </ul>
        <p className="muted">
          Tab 选择面与格；Enter /
          空格操作；方向键在网格移动。不需要拖动。撤销恢复上次位置；提示不会代替你摆放。
        </p>
      </aside>
    </div>
  );
}
