"""Independent Ataxx oracle: Python integers, never imports the product engine.

Rules read from kz04px/libataxx at 4226c26dd11a1f74be708882ece6fd9dc96c767b.
Unlike upstream's padded 8x8 bitboard and the product's array representation,
this uses contiguous 49-bit sets and precomputed coordinate neighborhoods.
Clone move identities are destination-only; UI source aliases are equivalent.
"""
from dataclasses import dataclass
from functools import lru_cache

SIDE = 7
ALL = (1 << 49) - 1
NEAR = tuple(sum(1 << q for q in range(49) if max(abs(i//7-q//7), abs(i%7-q%7)) == 1) for i in range(49))
FAR = tuple(sum(1 << q for q in range(49) if max(abs(i//7-q//7), abs(i%7-q%7)) == 2) for i in range(49))


def bits(n):
    while n:
        p = n & -n
        yield p.bit_length() - 1
        n ^= p


@dataclass(frozen=True)
class Position:
    x: int
    o: int
    gaps: int = 0
    turn: str = 'x'
    halfmove: int = 0
    ply: int = 0

    @classmethod
    def read(cls, cells, turn='x', halfmove=0, ply=0):
        s = ''.join(cells).replace('/', '')
        assert len(s) == 49 and set(s) <= set('xo.#')
        return cls(*(sum(1 << i for i, c in enumerate(s) if c == token) for token in 'xo#'), turn, halfmove, ply)

    @property
    def cells(self):
        return ''.join('x' if self.x >> i & 1 else 'o' if self.o >> i & 1 else '#' if self.gaps >> i & 1 else '.' for i in range(49))

    def json(self):
        return {'cells': self.cells, 'turn': self.turn, 'halfmove': self.halfmove, 'ply': self.ply}


def placements(p, side=None):
    mine = p.x if (side or p.turn) == 'x' else p.o
    empty = ALL ^ (p.x | p.o | p.gaps)
    clones = 0
    jumps = []
    for i in bits(mine):
        clones |= NEAR[i] & empty
        jumps.extend(('j', i, j) for j in bits(FAR[i] & empty))
    return [('c', j) for j in bits(clones)] + jumps


def result(p):
    # Count-based results take precedence even when the halfmove clock is 100.
    if not p.x or not p.o or (not placements(p, 'x') and not placements(p, 'o')):
        margin = p.x.bit_count() - p.o.bit_count()
        return 'x' if margin > 0 else 'o' if margin < 0 else 'draw'
    return 'draw' if p.halfmove >= 100 else None


def actions(p):
    if result(p):
        return []
    return placements(p) or [('p',)]


def play(p, move):
    if move not in actions(p):
        raise ValueError('Illegal move or terminal position')
    next_turn = 'o' if p.turn == 'x' else 'x'
    if move == ('p',):
        return Position(p.x, p.o, p.gaps, next_turn, p.halfmove + 1, p.ply + 1)
    dest = move[-1]
    mine, theirs = (p.x, p.o) if p.turn == 'x' else (p.o, p.x)
    if move[0] == 'j':
        mine &= ~(1 << move[1])
    captured = NEAR[dest] & theirs
    mine |= (1 << dest) | captured
    theirs &= ~captured
    x, o = (mine, theirs) if p.turn == 'x' else (theirs, mine)
    return Position(x, o, p.gaps, next_turn, 0 if move[0] == 'c' else p.halfmove + 1, p.ply + 1)


def key(move):
    return ':'.join(map(str, move))


def unkey(s):
    fields = s.split(':')
    return (fields[0], *(int(v) for v in fields[1:]))


def d4(cells):
    """All square symmetries; no swapping player colors."""
    result = []
    for mirror in range(2):
        for rotation in range(4):
            out = [''] * 49
            for i, c in enumerate(cells):
                r, col = divmod(i, 7)
                if mirror:
                    col = 6 - col
                for _ in range(rotation):
                    r, col = col, 6 - r
                out[r * 7 + col] = c
            result.append(''.join(out))
    return result


def start():
    return Position.read('x.....o' + '.'*35 + 'o.....x')
