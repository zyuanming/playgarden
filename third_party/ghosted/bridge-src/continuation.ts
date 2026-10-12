// SPDX-License-Identifier: GPL-3.0-only
// A bounded receipt for an already-observed native session, never a board save.
export type NativeSession = {progress: boolean[]; audioEnabled: boolean; saved: boolean};
export type Continuation = {nonce: string; fromSession: string; targetLevel: number; native: NativeSession};
const nonce = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9-]{16,80}$/.test(value);
export const isNativeSession = (value: unknown): value is NativeSession => {
    if (!value || typeof value !== "object") return false;
    const state = value as NativeSession;
    return Array.isArray(state.progress) && state.progress.length === 13 &&
        Array.from(state.progress).every(flag => typeof flag === "boolean") &&
        (!state.progress[12] || state.progress.slice(0, 12).every(Boolean)) &&
        typeof state.audioEnabled === "boolean" && typeof state.saved === "boolean";
};
export const isContinuation = (value: unknown): value is Continuation => {
    if (!value || typeof value !== "object") return false;
    const item = value as Continuation;
    return nonce(item.nonce) && nonce(item.fromSession) && Number.isInteger(item.targetLevel) &&
        item.targetLevel >= 1 && item.targetLevel <= 13 && isNativeSession(item.native);
};
export const observedNativeSession = (value: unknown): NativeSession | null => {
    if (!value || typeof value !== "object") return null;
    const state = value as {progress?: unknown; saved?: unknown; audio?: {enabled?: unknown}};
    const native = {progress: state.progress, saved: state.saved, audioEnabled: state.audio?.enabled};
    return isNativeSession(native) ? {progress: native.progress.slice(), saved: native.saved, audioEnabled: native.audioEnabled} : null;
};
export const copyContinuation = (value: Continuation): Continuation => ({nonce: value.nonce,
    fromSession: value.fromSession, targetLevel: value.targetLevel,
    native: {progress: value.native.progress.slice(), audioEnabled: value.native.audioEnabled, saved: value.native.saved}});
