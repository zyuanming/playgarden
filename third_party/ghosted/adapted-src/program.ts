import { ProgramEvent } from "./event.js";
import { Canvas, Bitmap } from "./canvas.js";


export class Program {

    private canvas : Canvas;
    private event : ProgramEvent;
    
    private timeSum : number = 0.0;
    private oldTime : number = 0.0;

    private initialized : boolean = false;
    private paused = false;
    private disposed = false;
    private frameId = 0;
    private resumeFrame: (() => void) | undefined;
    private frames = 0;
    private autoInitialize = false;
    private initialLevel: number | undefined;

    public setPaused(value: boolean): void {
        if (this.disposed || value === this.paused) return;
        this.paused = value;
        this.event.setPaused(value);
        if (value) cancelAnimationFrame(this.frameId);
        else {
            this.timeSum = 0;
            this.oldTime = performance.now();
            this.resumeFrame?.();
        }
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        cancelAnimationFrame(this.frameId);
        this.event.dispose();
        this.canvas.dispose();
        this.resumeFrame = undefined;
    }

    public status() {
        return { paused: this.paused, disposed: this.disposed, initialized: this.initialized, assetsLoaded: this.event.loaded(),
            frames: this.frames, audio: this.event.audioStatus() };
    }

    public setMuted(value: boolean): void { this.event.setHostMuted(value); }
    public clearInput(): void { this.event.clearInput(); }
    public input(code: string, key: string, down: boolean): void {
        if (!this.disposed && !this.paused) this.event.input(code, key, down);
    }


    constructor(canvasMinWidth : number,  canvasMaxWidth : number,
        canvasMinHeight : number,  canvasMaxHeight : number,
        audioBaseVolume : number = 0.60) {

        this.canvas = new Canvas(null,
            canvasMinWidth, canvasMinHeight,
            canvasMaxWidth, canvasMaxHeight,
            (index : number) : Bitmap => this.event.getBitmap(index), true);
        this.event = new ProgramEvent(this.canvas, audioBaseVolume); 
    }



    private drawLoadingScreen(canvas : Canvas) : void {

        const OUTLINE : number = 1;
        const WIDTH : number  = 80;
        const HEIGHT : number  = 12;

        canvas.clear("#000000");
        const p : number = this.event.loadedRatio();

        const dx : number = canvas.width/2 - WIDTH/2;
        const dy : number = canvas.height/2 - HEIGHT/2;

        canvas.fillRect(dx, dy, WIDTH, HEIGHT, "#ffffff");
        canvas.fillRect(dx + OUTLINE, dy + OUTLINE, WIDTH - OUTLINE*2, HEIGHT - OUTLINE*2, "#000000");
        canvas.fillRect(dx + OUTLINE*2, dy + OUTLINE*2, (WIDTH - OUTLINE*4)*p, HEIGHT - OUTLINE*4, "#ffffff");
        
    }


    private loop(ts : number, 
        initialScreen : (canvas : Canvas) => void, 
        onLoad : (event : ProgramEvent) => void) : void {

        if (this.disposed || this.paused) return;
        const MAX_REFRESH_COUNT : number = 5; 
        const BASE_FRAME_TIME : number = 1000.0/60.0;
    
        const frameTime : number = BASE_FRAME_TIME*this.event.tick;
        const loaded : boolean = this.event.loaded();

        this.timeSum = Math.min(this.timeSum + (ts - this.oldTime), MAX_REFRESH_COUNT*frameTime);
        this.oldTime = ts;

        let firstFrame : boolean = true;
        for (; this.timeSum >= frameTime; this.timeSum -= frameTime) {

            if (this.initialized) {

                this.event.activeScene?.update(this.event);
                this.frames++;
                if (this.paused || this.disposed) break;
                // this.transition.update(this.event);
            }

            if (loaded && !this.initialized) {
                
                if (this.event.anyPressed || this.autoInitialize) {

                    this.initialized = true;
                    this.event.initialize();
                    onLoad(this.event);
                    this.event.activeScene?.onChange?.(this.initialLevel, this.event);
                    this.event.updateInput();
                    break;
                }
            }
                
            if (firstFrame) {

                this.event.updateInput();
                firstFrame = false;
            }
        }
            
        if (loaded) {
                
            if (!this.initialized) {

                initialScreen(this.canvas);
            }
            else {

                this.event.activeScene?.redraw(this.canvas);
                // this.transition.draw(this.canvas);
            }
        }
        else {

            this.drawLoadingScreen(this.canvas);
        }
        if (!this.disposed && !this.paused) this.frameId = window.requestAnimationFrame(ts => this.loop(ts, initialScreen, onLoad));
    }


    public run(initialEvent : (event : ProgramEvent) => void,
        initialScreen : (canvas : Canvas) => void,
        onLoad : (event : ProgramEvent) => void,
        autoInitialize = false, initialLevel?: number) : void {

        this.autoInitialize = autoInitialize;
        this.initialLevel = initialLevel;
        initialEvent(this.event);
        this.oldTime = performance.now();
        this.resumeFrame = () => { this.frameId = requestAnimationFrame(ts => this.loop(ts, initialScreen, onLoad)); };
        this.resumeFrame();
    }
}
