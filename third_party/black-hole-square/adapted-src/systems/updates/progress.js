// Original: Copyright (c) 2021 Quinten Clause, MIT.
// Playgarden finite bounds/navigation reset: GPL-3.0-only.
import puzzleSystem from './puzzle.js';
import dataSystem from '../data.js';

let update = (entities, entity, time, delta) => {
    let solved = dataSystem.load('solved') || [];
    let sequence = (
        dataSystem.load('payed')
    ) ? entities.game.levels.wm : entities.game.levels.sequence;
    let current = entities.game.levels.current;
    let currentPuzzleId = sequence[current];
    let dots = [];
    let puzzleIds = [];
    sequence.forEach(puzzleId => {
        let puzzle = entities[puzzleId].puzzle;
        if (puzzle.grid.length) {
            let dot = 0;
            if (solved.indexOf(puzzleId) > -1) {
                dot = dot + 1;
            }
            if (puzzleId === currentPuzzleId) {
                dot = dot + 2;
            }
            dots.push(dot);
            puzzleIds.push(puzzleId);
        }
    });
    entity.progress.dots = dots;
    let x = entities.game.pointer.x - entities.game.canvas.gW / 2 + dots.length * 6;
    let y = entities.game.pointer.y - entities.game.canvas.gH / 2 - entity.position.y;
    if (y < 0 || y >= 8 || x < 0 || x >= dots.length * 12) {
        return;
    }
    entities.game.pointer.pointing = true;
    if (entities.game.pointer.justUp) {
        let target = (x / 12) | 0;
        let puzzleId = puzzleIds[target];
        if (!puzzleId) return;
        puzzleSystem.navigate(entities, sequence.indexOf(puzzleId));
    }
};

export default Object.freeze({
    update
});
