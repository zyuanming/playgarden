import { useState, useEffect } from "react";
import {
  Search,
  ArrowRight,
  Heart,
  Puzzle,
  Code2,
  Box,
  Github,
  Volume2,
  VolumeX,
  BarChart3,
  Brain,
  Hash,
  FlaskConical,
} from "lucide-react";
import { games } from "./lib/registry";
import { orderCatalog, type CatalogOrder } from "./lib/catalogOrder";
import {
  completeLevel,
  parseProgress,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
} from "./lib/progress";
import { CATEGORIES } from "./lib/catalog";
import type { GameId } from "./lib/types";
import { GameShell } from "./components/GameShell";
import { completionChime } from "./lib/sound";
export default function App() {
  const [progress, setProgress] = useState(() => {
    try {
      return parseProgress(
        localStorage.getItem(STORAGE_KEY) ??
          localStorage.getItem(LEGACY_STORAGE_KEY),
      );
    } catch {
      return parseProgress(null);
    }
  });
  const [storageError, setStorageError] = useState(false);
  const [selected, setSelected] = useState<GameId | null>(null);
  const [category, setCategory] = useState("全部");
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [difficulty, setDifficulty] = useState("全部难度");
  const [order, setOrder] = useState<CatalogOrder>("featured");
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [progress]);
  useEffect(
    () => setVisibleLimit(12),
    [category, query, favoritesOnly, difficulty, order],
  );
  function finish(id: GameId, l: number) {
    if (!progress.muted) completionChime();
    setProgress((p) => completeLevel(p, id, l));
  }
  const visible = orderCatalog(games, order, progress.completed).filter(
    (g) =>
      (category === "全部" || g.category === category) &&
      (!favoritesOnly || progress.favorites.includes(g.id)) &&
      (difficulty === "全部难度" || g.difficulty === difficulty) &&
      `${g.title}${g.category}${g.subtitle}`.includes(query),
  );
  return (
    <>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => {
            setSelected(null);
            setFavoritesOnly(false);
          }}
          aria-label="Playgarden 首页"
        >
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          Playgarden
        </button>
        <nav aria-label="主导航">
          <button
            className={!favoritesOnly && !selected ? "selected" : ""}
            onClick={() => {
              setSelected(null);
              setFavoritesOnly(false);
            }}
          >
            游戏大厅
          </button>
          <button
            className={favoritesOnly ? "selected" : ""}
            onClick={() => {
              setSelected(null);
              setFavoritesOnly(true);
            }}
          >
            我的收藏
          </button>
          <a
            href="https://github.com/zyuanming/playgarden"
            target="_blank"
            rel="noreferrer"
          >
            开源计划
          </a>
          <button
            className="icon-button sound-toggle"
            aria-label={progress.muted ? "开启声音" : "静音"}
            title="切换通关提示音"
            onClick={() => setProgress((p) => ({ ...p, muted: !p.muted }))}
          >
            {progress.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
        </nav>
      </header>
      {storageError && (
        <p className="storage-warning" role="status">
          此浏览器无法保存进度，当前仍可正常游玩。
        </p>
      )}
      {selected ? (
        <GameShell
          key={selected}
          id={selected}
          onBack={() => setSelected(null)}
          completed={progress.completed[selected]}
          onComplete={(l) => finish(selected, l)}
        />
      ) : (
        <main className="catalog">
          <section className="intro">
            <h1>
              {favoritesOnly ? "把喜欢留在这里" : "玩出一点新发现"}
              <span>。</span>
            </h1>
            <p>无广告 · 无账号 · 让好奇心自由生长。</p>
          </section>
          <div className="discovery">
            <label className="search">
              <Search size={23} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索你感兴趣的游戏…"
                aria-label="搜索游戏"
              />
            </label>
            <div className="filters">
              <div className="category-tabs">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    className={category === c ? "active" : ""}
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <select
                aria-label="筛选难度"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option>全部难度</option>
                <option>初级</option>
                <option>中级</option>
                <option>进阶</option>
              </select>
              <select
                aria-label="游戏排序"
                value={order}
                onChange={(event) =>
                  setOrder(event.target.value as CatalogOrder)
                }
              >
                <option value="featured">精选顺序</option>
                <option value="newest">最新加入</option>
                <option value="continue">继续挑战</option>
              </select>
            </div>
          </div>
          {order === "continue" && (
            <p className="catalog-sort-help">
              优先显示已经开始、尚未完成的游戏；进度只保存在这个浏览器。
            </p>
          )}
          <p className="catalog-count">
            {visible.length} 款可玩游戏 ·{" "}
            {visible.reduce((total, game) => total + game.levelCount, 0)} 个关卡
          </p>
          <section className="game-grid" aria-label="游戏列表">
            {visible.slice(0, visibleLimit).map((g) => {
              const Icon =
                g.category === "逻辑思维"
                  ? Puzzle
                  : g.category === "编程启蒙"
                    ? Code2
                    : g.category === "记忆观察"
                      ? Brain
                      : g.category === "数字推理"
                        ? Hash
                        : g.category === "科学实验"
                          ? FlaskConical
                          : Box;
              return (
                <article className="game-card" key={g.id}>
                  <button
                    className="card-art"
                    style={{
                      backgroundImage: `url(${g.artwork.url})`,
                      backgroundPosition: g.artwork.position,
                      backgroundSize: g.artwork.size,
                    }}
                    aria-label={`开始玩${g.title}`}
                    onClick={() => setSelected(g.id)}
                  />
                  <button
                    className={`favorite ${progress.favorites.includes(g.id) ? "saved" : ""}`}
                    aria-label={`${progress.favorites.includes(g.id) ? "取消收藏" : "收藏"}${g.title}`}
                    aria-pressed={progress.favorites.includes(g.id)}
                    onClick={() =>
                      setProgress((p) => ({
                        ...p,
                        favorites: p.favorites.includes(g.id)
                          ? p.favorites.filter((id) => id !== g.id)
                          : [...p.favorites, g.id],
                      }))
                    }
                  >
                    <Heart size={21} />
                  </button>
                  <div className="card-body">
                    <h2>{g.title}</h2>
                    <p>{g.subtitle}</p>
                    <div className="card-bottom">
                      <span className={`category ${g.tone}`}>
                        <Icon size={21} />
                        {g.category}
                      </span>
                      <span className="difficulty">
                        <BarChart3 size={20} />
                        {g.difficulty}
                      </span>
                      <button
                        className="primary"
                        onClick={() => setSelected(g.id)}
                      >
                        开始玩
                        <ArrowRight size={19} />
                      </button>
                    </div>
                    <div
                      className="card-progress"
                      aria-label={`已完成 ${progress.completed[g.id].length} 关`}
                    >
                      <span>
                        {Array.from(
                          { length: Math.min(g.levelCount, 12) },
                          (_, l) => l,
                        ).map((l) => (
                          <i
                            key={l}
                            className={
                              progress.completed[g.id].includes(l) ? "done" : ""
                            }
                          />
                        ))}
                      </span>
                      <small>
                        {progress.completed[g.id].length}/{g.levelCount} 关
                      </small>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
          {visibleLimit < visible.length && (
            <div className="load-more">
              <button onClick={() => setVisibleLimit((n) => n + 12)}>
                再看看更多游戏
              </button>
            </div>
          )}
          {!visible.length && (
            <div className="empty">
              <Heart size={30} />
              <h2>
                {favoritesOnly ? "还没有收藏的游戏" : "暂时没有匹配的游戏"}
              </h2>
              <p>
                {favoritesOnly
                  ? "点击游戏卡片上的爱心，把喜欢的游戏留在这里。"
                  : "换一个关键词，或者看看其他分类。"}
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("全部");
                  setDifficulty("全部难度");
                  setFavoritesOnly(false);
                }}
              >
                查看全部游戏
              </button>
            </div>
          )}
          <footer>
            <span />
            <a
              href="https://github.com/zyuanming/playgarden"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={23} />
              开源游戏，开放生长。
            </a>
            <span />
          </footer>
        </main>
      )}
    </>
  );
}

