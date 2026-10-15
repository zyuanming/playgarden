import { Canvas, Bitmap } from "./canvas.js";
import { OscType, Ramp, Sample } from "./sample.js";
import { Scene } from "./scene.js";


// Heh, class action
class Action {

    
    public keys : string[];
    public specialKeys : string[];


    constructor(keys : string[], specialKeys : string[]) {

        this.keys = Array.from(keys);
        this.specialKeys = Array.from(specialKeys);
    }
}


export const enum InputState {

    Up = 0,
    Down = 1,
    Released = 2,
    Pressed = 3,

    DownOrPressed = 1
};


export const enum TransitionType {
    None = 0,
    Fade = 1,
    Circle = 2,
};


export class ProgramEvent {


    private readonly canvas : Canvas;
    public readonly tick : number = 1.0;


    // Input
    private keys : Map<string, InputState>;
    private preventedKeys : string[];
    private specialKeys : Map<string, InputState>;
    private preventedSpecialKeys : string[];
    private actions : Map<number, Action>;
    private anyKeyPressed : boolean = false;
    private events = new AbortController();
    private paused = false;
    private disposed = false;
    private hostMuted = true;
    private masterGain: GainNode | undefined;
    private images = new Set<HTMLImageElement>();

    public clearInput(): void {
        this.keys.clear(); this.specialKeys.clear(); this.anyKeyPressed = false;
    }

    public input(code: string, key: string, down: boolean): void {
        if (this.disposed || this.paused) return;
        const physical = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Space", "Escape", "KeyR", "KeyZ", "Backspace"].includes(code);
        const special = ["r", "R", "z", "Z"].includes(key);
        // The original R/Z actions use the resulting character, including
        // keyboard layouts where that character occupies another physical key.
        if (!physical && !special) return;
        if (down && !this.hostMuted && this.audioEnabled) void this.audioContext?.resume().catch(() => {});
        const state = down ? InputState.Pressed : InputState.Released;
        if (physical) this.keyEvent(code, state);
        if (special) this.specialKeyEvent(key, state);
    }

    public setPaused(value: boolean): void {
        this.paused = value; this.clearInput();
        if (value) void this.audioContext?.suspend().catch(() => {});
        else if (!this.hostMuted && this.audioEnabled) void this.audioContext?.resume().catch(() => {});
    }

    public setHostMuted(value: boolean): void {
        this.hostMuted = value;
        this.applyAudio();
    }

    private applyAudio(): void {
        if (this.masterGain && this.audioContext)
            this.masterGain.gain.value = this.hostMuted || !this.audioEnabled ? 0 : 1;
        if (this.hostMuted || !this.audioEnabled) this.samples.forEach(sample => sample.stop());
    }

    public audioStatus() {
        return { state: this.audioContext?.state ?? 'uninitialized', hostMuted: this.hostMuted,
            enabled: this.audioEnabled, activeSamples: Array.from(this.samples.values()).filter(sample => sample.playing).length, effectiveGain: this.masterGain?.gain.value ?? 0 };
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.events.abort(); this.clearInput();
        this.images.forEach(image => { image.onload = null; image.onerror = null; });
        this.images.clear();
        this.samples.forEach(sample => sample.stop()); this.samples.clear();
        this.masterGain?.disconnect();
        void this.audioContext?.close().catch(() => {});
        this.activeScene?.dispose?.(); this.activeScene = undefined; this.scenes.clear();
    }


    // Asset manager
    private loadCount : number = 0;
    private assetCount : number = 0;
    private bitmaps : Map<number, Bitmap>;
    private samples : Map<number, Sample>;


    // Audio player
    private audioContext : AudioContext | undefined = undefined;
    private globalVolume : number;
    private audioEnabled : boolean;


    // Scene manager
    private scenes : Map<string, Scene>;
    // This is public for "faster" (well, "shorter" (in bytes) ) access
    public activeScene : Scene | undefined = undefined;
    public sceneName = "";


    public get screenWidth() : number {

        return this.canvas.width;
    }
    public get screenHeight() : number {

        return this.canvas.height;
    }

    public get anyPressed() : boolean {

        return this.anyKeyPressed; 
    }


    constructor(canvas : Canvas, globalVolume : number) {

        this.canvas = canvas;

        //
        // Input
        //
        this.keys = new Map<string, InputState> ();
        this.preventedKeys = new Array<string> ();

        this.specialKeys = new Map<string, InputState> ();
        this.preventedSpecialKeys = new Array<string> ();

        this.actions = new Map<number, Action> ();

        const handleKey = (e: KeyboardEvent, down: boolean) => {
            if (this.disposed || this.paused) return;
            if (down && (e.ctrlKey || e.metaKey || e.altKey)) { this.clearInput(); return; }
            if (down && e.repeat) return;
            if (down && !["Shift", "Control", "Alt", "Meta"].includes(e.key)) this.anyKeyPressed = true;
            if (this.preventedKeys.includes(e.code) || this.preventedSpecialKeys.includes(e.key)) e.preventDefault();
            this.input(e.code, e.key, down);
        };
        window.addEventListener('keydown', e => handleKey(e, true), {signal: this.events.signal});
        window.addEventListener('keyup', e => handleKey(e, false), {signal: this.events.signal});
        window.addEventListener('blur', () => this.clearInput(), {signal: this.events.signal});
        window.addEventListener('pointercancel', () => this.clearInput(), {signal: this.events.signal});

        // Assets
        this.bitmaps = new Map<number, Bitmap> ();
        this.samples = new Map<number, Sample> ();

        // Audio
        this.audioEnabled = true;
        this.globalVolume = globalVolume;

        // Scene manager
        this.scenes = new Map<string, Scene> ();
    }


    //
    // Input
    //


    private keyEvent(key : string, state : InputState) : void {

        if (this.keys.get(key) === state - 2)
            return;

        this.keys.set(key, state);
        this.anyKeyPressed ||= Boolean(state & 1);
    }


    private specialKeyEvent(key : string, state : InputState) : void {

        if (this.specialKeys.get(key) === state - 2)
            return;

        this.specialKeys.set(key, state);
        this.anyKeyPressed ||= Boolean(state & 1);
    }


    public updateInput() : void {

        for (const k of this.keys.keys()) {

            const v : InputState = this.keys.get(k) ?? InputState.Up;
            if (v > 1) {
                
                this.keys.set(k, v - 2);
            }
        }
        for (const k of this.specialKeys.keys()) {

            const v : InputState = this.specialKeys.get(k) ?? InputState.Up;
            if (v > 1) {
                
                this.specialKeys.set(k, v - 2);
            }
        }
        this.anyKeyPressed = false;
    }


    public addAction(index : number, keys : string[], 
        specialKeys : string[] = [], 
        prevent : boolean = true) : void {

        this.actions.set(index, new Action(keys, specialKeys));
        if (prevent) {

            this.preventedKeys.push(...keys);
            this.preventedSpecialKeys.push(...specialKeys);
        }
    }


    public getAction(index : number) : InputState {

        const a : Action | undefined = this.actions.get(index);
        if (a === undefined) {

            return InputState.Up;
        }

        for (const k of a.keys) {
            
            const state : InputState = this.keys.get(k) ?? InputState.Up;
            if (state != InputState.Up) {

                return state;
            }
        }

        for (const k of a.specialKeys) {
            
            const state : InputState = this.specialKeys.get(k) ?? InputState.Up;
            if (state != InputState.Up) {

                return state;
            }
        }
        
        return InputState.Up;
    }


    //
    // Assets
    //


    public addBitmap(index : number, bmp : Bitmap) : void {

        this.bitmaps.set(index, bmp);
    }


    public getBitmap(index : number) : Bitmap | undefined {

        return this.bitmaps.get(index);
    }


    public getSample(index : number) : Sample | undefined {

        return this.samples.get(index);
    }


    public loadBitmap(index : number, path : string) : void {

        ++ this.assetCount;

        const img : HTMLImageElement = new Image();
        this.images.add(img);
        img.onload = (_ : Event) : void => {

            if (this.disposed) return;
            ++ this.loadCount;
            this.bitmaps.set(index, img);
            this.images.delete(img);
        }
        img.onerror = () => {
            this.images.delete(img);
            if (!this.disposed) window.dispatchEvent(new CustomEvent('ghosted-error', {detail: '本地图像加载失败：' + path}));
        };
        img.src = path;
    }


    public loaded = () : boolean => this.loadCount >= this.assetCount;
    public loadedRatio = () : number => this.assetCount == 0 ? 1.0 : this.loadCount/this.assetCount;


    //
    // Audio player
    //

    public initialize() : void {

        if (this.disposed || this.audioContext) return;
        try { this.audioContext = new AudioContext(); } catch (_) { return; }
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.applyAudio();
        // Possibly redundant
        try {

            if (!this.paused && !this.hostMuted && this.audioEnabled) void this.audioContext.resume().catch(() => {});
        } catch(e){};
    }


    public createSample(index : number,
        sequence : number[], 
        baseVolume : number = 1.0,
        type : OscType = OscType.Square,
        ramp : Ramp = Ramp.Exponential,
        attackTime : number = 0.40) : void {

        if (this.audioContext) this.samples.set(index, new Sample(this.audioContext, sequence, baseVolume, type, ramp, attackTime, this.masterGain));
    }


    public playSample(index : number, volume : number = 0.60) : void {

        if (this.disposed || this.paused || this.hostMuted || !this.audioEnabled) {

            return;
        }
        try {

            this.getSample(index)?.play(volume*this.globalVolume);
        }
        catch (e) {}
    }


    public toggleAudio(state: boolean = !this.audioEnabled): boolean {
        this.audioEnabled = state; this.applyAudio();
        return this.audioEnabled;
    }


    public setGlobalVolume(vol : number) : void {

        this.globalVolume = vol;
    }


    public getAudioString = () : string => "AUDIO: " + (this.audioEnabled ? "ON " : "OFF");


    //
    // Scene manager
    //


    public addScene(name : string, scene : Scene, makeActive : boolean = false) : void {

        this.scenes.set(name, scene);
        if (this.activeScene === undefined || makeActive) {

            this.activeScene = scene;
            this.sceneName = name;
        }
    }


    public changeScene(newScene : string, event : ProgramEvent) : void {

        const scene : Scene | undefined = this.scenes.get(newScene);

        scene?.onChange?.(this.activeScene?.dispose?.(), event);
        this.activeScene = scene ?? this.activeScene;
        if (scene) {
            this.sceneName = newScene;
            window.dispatchEvent(new CustomEvent("ghosted-scene", {detail: newScene}));
        }
    }
    
}
