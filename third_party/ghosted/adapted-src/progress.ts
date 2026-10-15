

let saved = true;
export const progressSaved = () => saved;

const KEY : string = "playgarden.ghosted.original-progress.v1";


export const loadProgress = (carried?: {progress: boolean[]; saved: boolean}) : boolean[] => {

    // Only the authenticated bootstrap supplies this already-earned native state.
    // Copy it without claiming that unavailable persistent storage succeeded.
    if (carried) { saved = carried.saved; return carried.progress.slice(0, 13); }
    saved = true;

    const progress : boolean[] = (new Array<boolean> (13)).fill(false);

    try {

        const raw = window.localStorage.getItem(KEY);
        if (raw === null || !/^[01]{12,13}$/.test(raw)) return progress;
        for (let i = 0; i < raw.length; ++i) progress[i] = raw[i] === "1";
        if (!progress.slice(0, 12).every(Boolean)) progress[12] = false;

    }
    catch(e){ saved = false; }
    return progress;
}


export const storeProgress = (progress : boolean[]) : void => {

    try {

        const targetStr : string = Array.from({length: 13}, (_, i) => progress[i] === true ? "1" : "0").join("");
        window["localStorage"]["setItem"](KEY, targetStr);
        saved = true;

    } catch(e){ saved = false; };
}
