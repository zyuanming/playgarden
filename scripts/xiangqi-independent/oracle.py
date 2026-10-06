"""Independent, deliberately simple Xiangqi reference rules.

Original verifier code. Coordinates are (file 0..8, rank 0..9), red at rank 0.
Uses geometric source/destination predicates and board copies; no mailbox,
upstream move offsets, product code, or external engine dependencies.
The optional casual result policy is explicitly not full WXF adjudication.
"""
from dataclasses import dataclass
import json
import re
import sys

START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r - - 0 1'
ALL = tuple((x, y) for y in range(10) for x in range(9))
MAX_SAFE_INTEGER = 9007199254740991


def side(p):
    return 'r' if p.isupper() else 'b'


def opposite(s):
    return 'b' if s == 'r' else 'r'


def coord(s):
    if not re.fullmatch(r'[a-i][0-9]', s):
        raise ValueError('invalid square')
    return ord(s[0]) - ord('a'), int(s[1])


def name(q):
    return chr(ord('a') + q[0]) + str(q[1])


def local_rank(q, s):
    return q[1] if s == 'r' else 9 - q[1]


def palace(q, s):
    return 3 <= q[0] <= 5 and 0 <= local_rank(q, s) <= 2


def elephant_home_squares(s):
    # Independent graph reachability from the original c-file elephant.
    reached = {(2, 0)}
    todo = [(2, 0)]
    while todo:
        x, y = todo.pop()
        for dx in (-2, 2):
            for dy in (-2, 2):
                q = x + dx, y + dy
                if 0 <= q[0] < 9 and 0 <= q[1] <= 4 and q not in reached:
                    reached.add(q)
                    todo.append(q)
    return reached if s == 'r' else {(x, 9-y) for x, y in reached}


@dataclass
class Position:
    board: dict
    turn: str = 'r'
    halfmove: int = 0
    fullmove: int = 1

    @classmethod
    def parse(cls, fen, placement=True):
        if not isinstance(fen, str):
            raise ValueError('FEN must be text')
        parts = fen.split()
        if len(parts) != 6:
            raise ValueError('FEN must contain six fields')
        rows, turn, a, b, hm, fm = parts
        if turn not in ('r', 'w', 'b') or a != '-' or b != '-':
            raise ValueError('invalid FEN metadata')
        if not re.fullmatch(r'(0|[1-9][0-9]*)', hm) or not re.fullmatch(r'[1-9][0-9]*', fm):
            raise ValueError('invalid FEN counters')
        if max(int(hm), int(fm)) > MAX_SAFE_INTEGER:
            raise ValueError('FEN counters exceed exact JavaScript integer range')
        rows = rows.split('/')
        if len(rows) != 10:
            raise ValueError('FEN must contain ten ranks')
        board = {}
        for y, row in zip(range(9, -1, -1), rows):
            x, prev_digit = 0, False
            for c in row:
                if c in '123456789':
                    if prev_digit:
                        raise ValueError('consecutive run lengths')
                    x += int(c)
                    prev_digit = True
                elif c in 'rnbakcpRNBAKCP':
                    if x >= 9:
                        raise ValueError('rank too wide')
                    board[x, y] = c
                    x += 1
                    prev_digit = False
                else:
                    raise ValueError('invalid FEN board character')
            if x != 9:
                raise ValueError('rank has wrong width')
        for s in ('r', 'b'):
            group = [(q, p.lower()) for q,p in board.items() if side(p) == s]
            if sum(p == 'k' for q,p in group) != 1:
                raise ValueError('each side must have exactly one general')
            for p, cap in [('a',2),('b',2),('n',2),('r',2),('c',2),('p',5)]:
                if sum(v == p for q,v in group) > cap:
                    raise ValueError('too many pieces')
            if placement:
                for q,p in group:
                    r = local_rank(q, s)
                    if p == 'k' and not palace(q, s):
                        raise ValueError('general outside palace')
                    if p == 'a' and (not palace(q,s) or (q[0]+r)%2 != 1):
                        raise ValueError('advisor outside reachable palace points')
                    if p == 'b' and q not in elephant_home_squares(s):
                        raise ValueError('elephant outside reachable home points')
                    if p == 'p' and (r < 3 or (r < 5 and q[0]%2)):
                        raise ValueError('soldier outside reachable points')
        return cls(board, 'r' if turn == 'w' else turn, int(hm), int(fm))

    def fen(self):
        rows = []
        for y in range(9, -1, -1):
            row, run = '', 0
            for x in range(9):
                p = self.board.get((x,y))
                if p is None:
                    run += 1
                else:
                    if run:
                        row += str(run)
                        run = 0
                    row += p
            if run:
                row += str(run)
            rows.append(row)
        return '/'.join(rows) + f' {self.turn} - - {self.halfmove} {self.fullmove}'

    def between(self, a, b):
        if a[0] == b[0]:
            return sum((a[0], y) in self.board for y in range(min(a[1],b[1])+1,max(a[1],b[1])))
        if a[1] == b[1]:
            return sum((x, a[1]) in self.board for x in range(min(a[0],b[0])+1,max(a[0],b[0])))
        return None

    def reaches(self, a, b, attack=False):
        """Piece movement/capture geometry, with the flying-general attack added."""
        if a == b or b not in ALL or a not in self.board:
            return False
        piece = self.board[a]
        s, p = side(piece), piece.lower()
        dx, dy = b[0]-a[0], b[1]-a[1]
        ax, ay = abs(dx), abs(dy)
        target = self.board.get(b)
        if p == 'r':
            return self.between(a,b) == 0
        if p == 'c':
            return self.between(a,b) == (1 if target is not None or attack else 0)
        if p == 'n':
            if (ax,ay) not in ((2,1),(1,2)):
                return False
            leg = (a[0]+dx//2,a[1]) if ax == 2 else (a[0],a[1]+dy//2)
            return leg not in self.board
        if p == 'b':
            return ax == ay == 2 and local_rank(b,s) < 5 and (a[0]+dx//2,a[1]+dy//2) not in self.board
        if p == 'a':
            return ax == ay == 1 and palace(b,s)
        if p == 'k':
            if attack and target and target.lower() == 'k' and a[0] == b[0] and self.between(a,b) == 0:
                return True
            return ax+ay == 1 and palace(b,s)
        if p == 'p':
            forward = 1 if s == 'r' else -1
            return (dx == 0 and dy == forward) or (dy == 0 and ax == 1 and local_rank(a,s) >= 5)
        return False

    def checked(self, s=None):
        s = s or self.turn
        general = next((q for q,p in self.board.items() if p.lower() == 'k' and side(p) == s), None)
        if general is None:
            raise ValueError('general missing')
        return any(side(p) != s and self.reaches(q,general,attack=True) for q,p in self.board.items())

    def applied(self, move):
        a, b = coord(move[:2]), coord(move[2:])
        board = self.board.copy()
        captured = b in board
        board[b] = board.pop(a)
        return Position(board, opposite(self.turn), 0 if captured else self.halfmove+1, self.fullmove+(self.turn == 'b'))

    def legal_moves(self):
        out = []
        for a,p in self.board.items():
            if side(p) != self.turn:
                continue
            for b in ALL:
                target = self.board.get(b)
                if target and (side(target) == self.turn or target.lower() == 'k'):
                    continue
                if self.reaches(a,b):
                    move = name(a)+name(b)
                    if not self.applied(move).checked(self.turn):
                        out.append(move)
        return sorted(out)

    def played(self, move):
        if move not in self.legal_moves():
            raise ValueError('illegal move: '+str(move))
        return self.applied(move)

    def result(self, prior_keys=()):
        if not self.legal_moves():
            return {'winner':opposite(self.turn),'reason':'checkmate' if self.checked() else 'stalemate'}
        if self.key() in prior_keys and sum(k == self.key() for k in prior_keys)+1 >= 3:
            return {'winner':None,'reason':'repetition'}
        if self.halfmove >= 120:
            return {'winner':None,'reason':'no-capture'}
        return None

    def key(self):
        return ' '.join(self.fen().split()[:2])

    def perft(self, depth):
        if depth < 0 or type(depth) is not int:
            raise ValueError('depth must be a nonnegative integer')
        if depth == 0:
            return 1
        moves = self.legal_moves()
        return len(moves) if depth == 1 else sum(self.applied(m).perft(depth-1) for m in moves)


def from_pieces(pieces, turn='r', halfmove=0, fullmove=1):
    return Position({coord(q):p for q,p in pieces.items()},turn,halfmove,fullmove)


if __name__ == '__main__':
    for line in sys.stdin:
        request = json.loads(line)
        try:
            position = Position.parse(request.get('fen',START))
            for move in request.get('moves',[]):
                position = position.played(move)
            result = {'fen':position.fen(),'moves':position.legal_moves(),'check':position.checked(),'result':position.result()}
            if 'depth' in request:
                result['perft'] = position.perft(request['depth'])
            print(json.dumps(result,ensure_ascii=False),flush=True)
        except ValueError as e:
            print(json.dumps({'error':str(e)}),flush=True)
