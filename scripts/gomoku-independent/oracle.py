"""Independent, exhaustive freestyle-Gomoku oracle. No product imports.

Five-cell windows are the primary truth source. Runs longer than five therefore
win naturally, including an overline created by filling its interior gap.
"""
from dataclasses import dataclass
from typing import Iterable

SIZE = 15
AREA = SIZE * SIZE
AXES = ((0, 1), (1, 0), (1, 1), (1, -1))
WINDOWS = tuple(
    tuple((r + k * dr) * SIZE + c + k * dc for k in range(5))
    for r in range(SIZE) for c in range(SIZE) for dr, dc in AXES
    if 0 <= r + 4 * dr < SIZE and 0 <= c + 4 * dc < SIZE
)


def valid_board(board):
    return len(board) == AREA and all(type(v) is int and v in (0, 1, 2) for v in board)


def winners(board):
    if not valid_board(board):
        raise ValueError('invalid board')
    return {board[w[0]] for w in WINDOWS if board[w[0]] and all(board[i] == board[w[0]] for i in w)}


def immediate_wins(board, player):
    """Every empty point that completes a >=5 line, without candidate pruning."""
    if player not in (1, 2) or not valid_board(board):
        raise ValueError('invalid board or player')
    result = set()
    for window in WINDOWS:
        values = [board[i] for i in window]
        if values.count(player) == 4 and values.count(0) == 1:
            result.add(window[values.index(0)])
    return sorted(result)


def maximal_winning_lines(board, player):
    lines = []
    for dr, dc in AXES:
        for r in range(SIZE):
            for c in range(SIZE):
                if board[r * SIZE + c] != player:
                    continue
                pr, pc = r - dr, c - dc
                if 0 <= pr < SIZE and 0 <= pc < SIZE and board[pr * SIZE + pc] == player:
                    continue
                line = []
                rr, cc = r, c
                while 0 <= rr < SIZE and 0 <= cc < SIZE and board[rr * SIZE + cc] == player:
                    line.append(rr * SIZE + cc)
                    rr, cc = rr + dr, cc + dc
                if len(line) >= 5:
                    lines.append(line)
    return lines


@dataclass(frozen=True)
class State:
    board: tuple[int, ...] = (0,) * AREA
    moves: tuple[int, ...] = ()
    to_move: int = 1
    winner: int = 0
    draw: bool = False

    @property
    def terminal(self):
        return bool(self.winner or self.draw)

    def play(self, index):
        if self.terminal:
            raise ValueError('game already ended')
        if type(index) is not int or not 0 <= index < AREA:
            raise ValueError('invalid index')
        if self.board[index]:
            raise ValueError('occupied point')
        next_board = list(self.board)
        next_board[index] = self.to_move
        next_winners = winners(next_board)
        winner = self.to_move if self.to_move in next_winners else 0
        return State(tuple(next_board), self.moves + (index,), 3 - self.to_move,
                     winner, not winner and not any(v == 0 for v in next_board))

    def undo(self, count=1):
        if type(count) is not int or not 0 <= count <= len(self.moves):
            raise ValueError('invalid undo count')
        return replay(self.moves[:-count] if count else self.moves)


def replay(moves: Iterable[int]):
    state = State()
    for move in moves:
        state = state.play(move)
    return state


def objective_satisfied(state, move, objective, exhaustive_two=True):
    """Exact objectives. Immediate victory does not count as defend/fork/two.

    defend: there was an opponent immediate win, and this nonwinning move
      removes all their immediate wins.
    fork: nonwinning move leaves >=2 own immediate winning points and no
      opponent immediate win.
    two: nonwinning move guarantees victory on the next own turn for EVERY
      legal opponent response. First apply the provably equivalent fork
      predicate, then optionally enumerate all opponent moves as a second check.
    """
    if state.terminal or type(move) is not int or not 0 <= move < AREA or state.board[move]:
        return False
    player, opponent = state.to_move, 3 - state.to_move
    after = state.play(move)
    if objective == 'win':
        return after.winner == player
    if objective not in ('defend', 'fork', 'two') or after.terminal:
        return False
    if immediate_wins(after.board, opponent):
        return False
    if objective == 'defend':
        return bool(immediate_wins(state.board, opponent))
    if len(immediate_wins(after.board, player)) < 2:
        return False
    if objective == 'fork' or not exhaustive_two:
        return True
    for reply, cell in enumerate(after.board):
        if cell:
            continue
        next_state = after.play(reply)
        if next_state.terminal or not immediate_wins(next_state.board, player):
            return False
    return True


def all_solutions(state, objective):
    return [m for m, cell in enumerate(state.board)
            if not cell and objective_satisfied(state, m, objective)]


def branches_for(state, move):
    """Complete depth-three certificate, including remote opponent replies."""
    player = state.to_move
    after = state.play(move)
    if after.terminal:
        return []
    branches = []
    for reply, cell in enumerate(after.board):
        if cell:
            continue
        responded = after.play(reply)
        wins = immediate_wins(responded.board, player) if not responded.terminal else []
        branches.append({'opponentMove': reply, 'winningMoves': wins})
    return branches


def dihedral_signatures(board, normalize_translation=False, swap_colors=False):
    points = [(i // SIZE, i % SIZE, v) for i, v in enumerate(board) if v]
    signatures = []
    for flip in (False, True):
        for turns in range(4):
            transformed = []
            for r, c, value in points:
                if flip:
                    c = SIZE - 1 - c
                for _ in range(turns):
                    r, c = c, SIZE - 1 - r
                transformed.append((r, c, 3 - value if swap_colors else value))
            if normalize_translation and transformed:
                minr, minc = min(p[0] for p in transformed), min(p[1] for p in transformed)
                transformed = [(r - minr, c - minc, v) for r, c, v in transformed]
            signatures.append(tuple(sorted(transformed)))
    return signatures


def canonical(board, normalize_translation=False, color_neutral=False):
    signatures = dihedral_signatures(board, normalize_translation)
    if color_neutral:
        signatures += dihedral_signatures(board, normalize_translation, True)
    return min(signatures)
