import { generateAssets } from "./assetgenerator.js";
import { Align, Canvas } from "./canvas.js";
import { ProgramEvent } from "./event.js";
import { Game } from "./game.js";
import { Action, BitmapAsset, SoundEffect } from "./mnemonics.js";
import { Program } from "./program.js";
import { LevelMenu } from "./levelmenu.js";
import { TitleScreen } from "./titlescreen.js";
import { loadProgress, progressSaved } from "./progress.js";
import { Ending } from "./ending.js";
import { ControlGuide } from "./controlguide.js";


const initialScreen = (canvas : Canvas) : void => {

    canvas.clear("#000000");
    canvas.drawText(BitmapAsset.RawFont, "PRESS ANY KEY", canvas.width/2, canvas.height/2 - 4, -1, 0, Align.Center);
}


const onloadEvent = (event : ProgramEvent) : void => {

    // Note: WASD is disabled as it might overlap with R and Z
    // keys on some less common keyboard layouts
    event.addAction(Action.Left, ["ArrowLeft"]); //, "KeyA"]);
    event.addAction(Action.Right, ["ArrowRight"]); //,"KeyD"]);
    event.addAction(Action.Up, ["ArrowUp"]); //,"KeyW"]);
    event.addAction(Action.Down, ["ArrowDown"]); //, "KeyS"]);
    event.addAction(Action.Choose, ["Space", "Enter"]);
    event.addAction(Action.Pause, ["Escape", "Enter"]);
    event.addAction(Action.Restart, [], ["r", "R"]);
    event.addAction(Action.Undo, ["Backspace"], ["z", "Z"]);
    event.addAction(Action.Back, ["Escape"]);

    generateAssets(event);

    event.playSample(SoundEffect.Select);
}


export const startGame = (selectedLevel: number, direct: boolean,
    carried?: {progress: boolean[]; audioEnabled: boolean; saved: boolean}) => {
    const completedLevels = loadProgress(carried);
    const unlocked = completedLevels.slice(0, 12).every(Boolean);
    const startDirectly = direct && (selectedLevel !== 13 || unlocked);
    const title = new TitleScreen(completedLevels);
    const menu = new LevelMenu(completedLevels, selectedLevel);
    const game = new Game(completedLevels);
    let current: ProgramEvent;
    const program = new Program(192, 576, 192, 576, 0.60);
    try { program.run((event) => {
        current = event;
        event.toggleAudio(carried?.audioEnabled ?? true);
        event.loadBitmap(BitmapAsset.RawFont, "f.png");
        event.loadBitmap(BitmapAsset.RawGameArt, "g.png");
        event.addScene("t", title, !startDirectly);
        event.addScene("c", new ControlGuide());
        event.addScene("ls", menu);
        event.addScene("g", game, startDirectly);
        event.addScene("e", new Ending());
    }, initialScreen, onloadEvent, startDirectly, startDirectly ? selectedLevel : undefined);
    } catch (error) { program.dispose(); throw error; }
    return {program, snapshot: () => ({...program.status(), scene: current.sceneName,
        progress: completedLevels.slice(0, 13), saved: progressSaved(),
        title: title.snapshot(), menu: menu.snapshot(), game: game.snapshot()})};
};
