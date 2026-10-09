// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  cipherAlphabet,
  cipherLettersLevels,
  cipherWon,
  cipherHint,
  assignCipher,
  type CipherMap,
} from "./cipherLettersLogic";
import "./cipherLetters.css";
export default function CipherLetters(p: GameProps) {
  return <CipherRound key={`${p.level}:${p.resetToken}`} {...p} />;
}
function CipherRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const lesson = cipherLettersLevels[level] ?? cipherLettersLevels[0];
  const [history, setHistory] = useState<CipherMap[]>([{}]),
    [selected, setSelected] = useState(lesson.keys[0]),
    [message, setMessage] = useState(
      "先选一个密文字母，再选它代表的真字母。相同密文会一起展开。",
    );
  const map = history.at(-1)!,
    won = cipherWon(lesson, map),
    locked = paused || won;
  const live = useRef({ history, map, locked, selected });
  live.current = { history, map, locked, selected };
  const tokens = useRef({ hintToken, undoToken }),
    done = useRef(false),
    callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  function report(s: string) {
    setMessage(s);
    callbacks.current.onStatus(s);
  }
  function change(next: CipherMap) {
    const h = [...live.current.history, next];
    live.current = {
      ...live.current,
      history: h,
      map: next,
      locked: paused || cipherWon(lesson, next),
    };
    setHistory(h);
  }
  function assign(value: string) {
    const now = live.current;
    if (now.locked) return;
    const next = assignCipher(lesson, now.map, now.selected, value);
    if (!next) {
      const owner = Object.entries(now.map).find(
        ([key, v]) => key !== now.selected && v === value,
      )?.[0];
      report(
        owner
          ? `${value} 已被密文 ${owner} 使用。先选 ${owner} 并清除映射，才能重新分配。`
          : "这个映射已经存在。",
      );
      return;
    }
    change(next);
    report(`${now.selected} → ${value}。每个相同的密文字母都一起改变了。`);
  }
  function clear() {
    const now = live.current;
    if (now.locked || !now.map[now.selected]) return;
    const next = { ...now.map };
    delete next[now.selected];
    change(next);
    report(`已清除 ${now.selected} 的映射，其他字母保持原样。`);
  }
  useEffect(() => {
    callbacks.current.onStatus(lesson.clue);
  }, []);
  useEffect(() => {
    if (won && !paused && !done.current) {
      done.current = true;
      report("花信读通了！每个字母都找到了唯一的对应。");
      callbacks.current.onComplete();
    }
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const hint = cipherHint(lesson, map);
    if (hint) {
      setSelected(hint.occupied ?? hint.key);
      report(
        hint.occupied
          ? `先清除密文 ${hint.occupied} 的 ${hint.value}；然后把密文 ${hint.key} 对应到 ${hint.value}。`
          : `一条可靠线索：密文 ${hint.key} 代表 ${hint.value}。请在字母键盘上自己选它。`,
      );
    }
  }, [hintToken]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    if (history.length > 1) {
      setHistory(history.slice(0, -1));
      report("已撤销上一次映射修改。");
    } else report("还没有映射修改可以撤销。");
  }, [undoToken]);
  return (
    <div
      className="ciph-game"
      data-cipher-game
      data-cipher-won={won}
      data-cipher-map={JSON.stringify(map)}
    >
      <section className="ciph-desk">
        <header>
          <div>
            <span>THE SECRET GARDEN POST</span>
            <h3>{lesson.title}</h3>
          </div>
          <b>
            {level + 1}
            <small> / 8</small>
          </b>
        </header>
        <p className="ciph-clue">{lesson.clue}</p>
        <div className="ciph-letter" aria-label="加密花信，密文在上，解读在下">
          {lesson.encrypted.split(" ").map((word, wi) => (
            <div className="ciph-word" key={wi}>
              {[...word].map((c, i) => (
                <button
                  type="button"
                  key={i}
                  disabled={locked}
                  onClick={() => setSelected(c)}
                  className={selected === c ? "selected" : ""}
                  aria-label={`密文 ${c}，${map[c] ? `已对应 ${map[c]}` : "尚未解读"}`}
                >
                  <small>{c}</small>
                  <strong>{map[c] ?? "·"}</strong>
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="ciph-section">01 · 选择密文字母</p>
        <div className="ciph-codes">
          {lesson.keys.map((key) => (
            <button
              type="button"
              key={key}
              data-cipher-key={key}
              aria-label={`密文 ${key}`}
              aria-pressed={selected === key}
              disabled={locked}
              onClick={() => setSelected(key)}
            >
              {key}
              <span>↓</span>
              <strong>{map[key] ?? "·"}</strong>
            </button>
          ))}
        </div>
        <div className="ciph-selection">
          <span>
            正在解读 <b>{selected}</b> → <b>{map[selected] ?? "?"}</b>
          </span>
          <button
            type="button"
            disabled={locked || !map[selected]}
            onClick={clear}
          >
            清除映射
          </button>
        </div>
        <p className="ciph-section">02 · 选择真实字母</p>
        <div
          className="ciph-keyboard"
          role="group"
          tabIndex={0}
          aria-label="真实字母键盘，A至Z"
          onKeyDown={(e) => {
            if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
            if (/^[a-z]$/i.test(e.key)) {
              e.preventDefault();
              e.stopPropagation();
              assign(e.key.toUpperCase());
            }
          }}
        >
          {[...cipherAlphabet].map((c) => {
            const owner = Object.entries(map).find(
              ([key, v]) => key !== selected && v === c,
            )?.[0];
            return (
              <button
                type="button"
                key={c}
                data-cipher-value={c}
                disabled={locked}
                className={owner ? "occupied" : ""}
                aria-label={`真字母 ${c}${owner ? `，已分配给 ${owner}` : ""}`}
                onClick={() => assign(c)}
              >
                {c}
                <small>{owner ?? " "}</small>
              </button>
            );
          })}
        </div>
        <p className="ciph-message" role="status">
          {paused ? "花信暂停解读，所有映射保留。" : message}
        </p>
      </section>
      <aside className="ciph-notes">
        <span>一次映射，处处生效</span>
        <h3>
          字母换了外衣，
          <br />
          规律没有改变。
        </h3>
        <ol>
          <li>每个密文字母始终代表同一个真字母。</li>
          <li>不同密文不能同时占用同一个真字母。</li>
          <li>单词之间的空格保持不变。结合中文线索，解出整句花信。</li>
        </ol>
        <p>
          可以随时改映射；若字母已被占用，先清除旧映射。填满还不够，句子必须完整解开才算成功。
        </p>
        <details>
          <summary>提示、键盘与撤销</summary>
          <p>
            提示说明当前需要修正的一组映射，不自动填答案。Tab
            选密文，再点真实字母；字母键盘取得焦点后可以直接按
            A–Z。撤销恢复上一份完整映射，重来清空本关。没有计时或猜错惩罚。
          </p>
        </details>
        <p className="ciph-fine">
          八封短句为本项目编写的日常英文练习，不是名人引语，也不是加密安全教程。
        </p>
      </aside>
    </div>
  );
}
