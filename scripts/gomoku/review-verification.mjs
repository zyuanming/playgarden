import * as L from '../../src/games/gomokuLogic.ts';
import * as A from '../../src/games/gomokuAi.ts';

let checks = 0;
function assert(condition, message) {
  checks++;
  if (!condition) throw new Error(message);
}
const coord = (x, y) => 15 * y + x;

// A six-stone overline is first achieved by filling its internal hole.
const overline = [
  coord(1, 3), coord(0, 0), coord(2, 3), coord(2, 0),
  coord(3, 3), coord(4, 0), coord(5, 3), coord(6, 0),
  coord(6, 3), coord(8, 0), coord(4, 3),
];
const win = L.replayMoves(overline);
assert(win?.winner === 1, 'overline winner');
assert(win.winningLines[0].length === 6, 'whole overline');
assert(L.replayMoves([...overline, 100]) === null, 'reject post-win');

const threat = L.replayMoves([112, 0, 114, 1, 128, 2, 144, 3]);
assert(threat && threat.winner === null, 'threat position');
const snap = JSON.stringify(threat);
for (const options of [
  { nodeBudget: 0 },
  { timeMs: 0 },
  { nodeBudget: NaN },
  { now: () => NaN },
  { now: () => { throw Error('clock'); } },
]) {
  const result = A.chooseMove(threat, 'steady', options);
  assert(result.move === 4, 'zero-budget edge forced block ' + JSON.stringify(result));
  assert(snap === JSON.stringify(threat), 'immutable input');
}

const ownWin = L.replayMoves([0, 112, 1, 114, 2, 128, 3, 144]);
assert(A.chooseMove(ownWin, 'steady', { nodeBudget: 0, timeMs: 0 }).move === 4,
  'own immediate win before budget');

const play = L.playMove(threat, 4);
assert(play !== threat && play.board !== threat.board && play.moves !== threat.moves,
  'immutable move arrays');
assert(JSON.stringify(threat) === snap, 'unchanged move input');
assert(L.isValidPosition(play), 'move valid');
assert(JSON.stringify(L.undoMoves(play, 1)) === JSON.stringify(threat), 'undo replay');

const invalid = [
  null,
  {},
  { ...threat, turn: 2 },
  { ...threat, winner: 2 },
  { ...threat, draw: true },
  { ...threat, board: Array(225) },
  { ...threat, moves: [...threat.moves, 0] },
  { ...threat, winningLines: [[0]] },
];
for (const value of invalid) assert(!L.isValidPosition(value), 'invalid state accepted');

let seed = 1997;
const random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
let games = 0;
let positions = 0;
for (let n = 0; n < 30; n++) {
  let position = L.emptyPosition();
  for (let turn = 0; turn < 120 && !position.winner && !position.draw; turn++) {
    const moves = position.board.map((stone, index) => stone === 0 ? index : -1)
      .filter(index => index >= 0);
    const move = moves[Math.floor(random() * moves.length)];
    const original = JSON.stringify(position);
    const next = L.playMove(position, move);
    assert(next !== position, 'legal move rejected');
    assert(original === JSON.stringify(position), 'random input mutated');
    assert(L.isValidPosition(next), 'random state invalid');
    if (turn % 10 === 0) {
      const options = { nodeBudget: 20, timeMs: 2000, now: () => 0 };
      const result = A.chooseMove(next, 'steady', options);
      assert(result.move === null
        ? next.winner !== null || next.draw
        : next.board[result.move] === 0, 'AI legality');
      assert(result.nodes <= 20, 'node bound');
      assert(JSON.stringify(result) === JSON.stringify(A.chooseMove(next, 'steady', options)),
        'AI determinism');
    }
    position = next;
    positions++;
  }
  games++;
}

const position = L.replayMoves([112, 113, 97, 127, 126, 98]);
const depth1 = A.chooseMove(position, 'steady', { nodeBudget: 16, now: () => 0, timeMs: 2000 });
assert(depth1.depth === 1, 'depth1 exact cap');
for (let cap = 17; cap < 32; cap++) {
  const choice = A.chooseMove(position, 'steady', { nodeBudget: cap, now: () => 0, timeMs: 2000 });
  assert(choice.depth === 1, 'partial depth2 discarded');
  assert(choice.move === depth1.move, 'last completed move retained');
}

console.log(JSON.stringify({ checks, games, positions, depth1, allPassed: true }));
