"""Emit deterministic rule cases and every legal successor for TS differential tests."""
import json
import random
from oracle import Position, start, actions, play, key, result
from test_oracle import fixture


def cases():
    curated = [
        ('opening', start()),
        ('eight-neighbor-conversion', fixture([8], [16,17,18,23,25,30,31,32,33,48])),
        ('blocked-side-pass', fixture([0], [48], [47], 0)),
        ('pass-reaches-100', fixture([0], [48], [47], 99)),
        ('no-moves-count-before-counter', fixture([0,1], [48], [], 100)),
        ('elimination-before-counter', fixture([0], [], [48], 100)),
        ('zero-both', fixture([],[],[24],0)),
        ('terminal-full-board', Position.read('x'*25+'o'*24)),
        ('terminal-tie-with-gap', Position.read('x'*24+'o'*24+'#')),
        ('capture-does-not-reset', fixture([0], [17,48], halfmove=99)),
        ('last-opponent-conversion-at-100', fixture([0], [17], halfmove=99)),
        ('clone-source-alias', fixture([0,1,7], [48])),
        ('jump-over-gaps', fixture([0], [48], [2,14,16])),
        ('terminal-100-with-available-moves', Position.read(start().cells, halfmove=100)),
    ]
    yield from curated
    rng = random.Random(9504226)
    # Arbitrary positions exercise rule boundaries unreachable in short play.
    for i in range(220):
        alphabet = '....xxxooo#' if i % 3 else '.xxxooo#####'
        board = ''.join(rng.choice(alphabet) for _ in range(49))
        yield f'random-{i}', Position.read(board, rng.choice('xo'), rng.choice([0,1,50,98,99,100]))
    # Reachable trajectories, including corner opening and gap boards.
    for trial in range(12):
        p = start()
        if trial % 2:
            board = list(p.cells)
            for i in range(49):
                if board[i] == '.' and rng.random() < .18:
                    board[i] = '#'
            p = Position.read(board)
        for ply in range(65):
            yield f'game-{trial}-ply-{ply}', p
            moves = actions(p)
            if not moves: break
            p = play(p, rng.choice(moves))
    # Every occupancy of a four-cell square embedded among gaps, both turns.
    for code in range(3**4):
        k = code
        board = ['#']*49
        for i in [16,17,23,24]:
            board[i] = '.xo'[k % 3]; k //= 3
        for turn in 'xo':
            yield f'small-{code}-{turn}', Position.read(board, turn)


def compact_cases():
    rng = random.Random(9500037)
    for n in [3,4,5,6]:
        for trial in range(55):
            board = ['#'] * 49
            for r in range(n):
                for c in range(n):
                    board[r*7+c] = rng.choice('...xxxooo#')
            yield f'compact-{n}-{trial}', Position.read(board, rng.choice('xo'), rng.choice([0,98,99,100])), n


def external(p, size):
    data = p.json()
    data['cells'] = ''.join(p.cells[r*7+c] for r in range(size) for c in range(size))
    data['size'] = size
    return data


def external_key(move, size):
    return key((move[0], *(i//7*size+i%7 for i in move[1:])))


def emit():
    out=[]
    for name,p,size in [*((name,p,7) for name,p in cases()), *compact_cases()]:
        successors=[]
        for m in actions(p):
            q=play(p,m)
            successors.append({'action': external_key(m,size), 'after': external(q,size), 'result': result(q)})
        out.append({'name': name, 'position': external(p,size), 'result': result(p), 'successors': successors})
    print(json.dumps(out,separators=(',',':')))

if __name__ == '__main__':
    emit()
