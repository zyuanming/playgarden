// SPDX-License-Identifier: GPL-3.0-only
// Original procedural percussion. No upstream samples or encoded recordings.
export function createBeatrixAudio() {
  let context: AudioContext | null = null;
  let enabled = true;
  let unavailable = false;
  const voices = new Set<AudioScheduledSourceNode>();
  let strikes = 0;
  async function unlock(): Promise<boolean> {
    if (!context) { try { context = new AudioContext(); } catch { unavailable = true; return false; } }
    const current = context;
    if (current.state === 'suspended') { try { await current.resume(); } catch { return false; } }
    return current.state === 'running';
  }
  function silence() {
    for (const voice of voices) { try { voice.stop(); } catch {} }
    voices.clear();
  }
  function tone(frequency: number, duration: number, gain: number, end?: number, type: OscillatorType = 'sine') {
    if (!context) return;
    const now = context.currentTime, osc = context.createOscillator(), envelope = context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, now);
    if (end) osc.frequency.exponentialRampToValueAtTime(end, now + duration);
    envelope.gain.setValueAtTime(0.0001, now); envelope.gain.exponentialRampToValueAtTime(gain, now + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(envelope).connect(context.destination); voices.add(osc);
    osc.onended = () => { voices.delete(osc); osc.disconnect(); envelope.disconnect(); };
    osc.start(now); osc.stop(now + duration + 0.01);
  }
  function noise(duration: number, frequency: number, gain: number, type: BiquadFilterType = 'highpass') {
    if (!context) return;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate), data = buffer.getChannelData(0);
    let seed = 0xbead1234;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain(), now = context.currentTime;
    source.buffer = buffer; filter.type = type; filter.frequency.value = frequency;
    envelope.gain.setValueAtTime(gain, now); envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(envelope).connect(context.destination); voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    source.start(now); source.stop(now + duration);
  }
  function play(instruments: readonly string[]) {
    if (!enabled || !context || context.state !== 'running') return;
    for (const instrument of instruments) {
      strikes++;
      switch (instrument) {
        case 'BD': tone(130, 0.2, 0.16, 38); break;
        case 'SD': tone(180, 0.09, 0.045, 85, 'triangle'); noise(0.12, 1100, 0.065); break;
        case 'HH': noise(0.045, 6200, 0.055); break;
        case 'HO': noise(0.25, 5100, 0.05); break;
        case 'BLO': tone(200, 0.13, 0.10, 100); break;
        case 'BME': tone(290, 0.10, 0.09, 180); break;
        case 'BHI': tone(400, 0.08, 0.08, 270); break;
        case 'TAM': noise(0.14, 4100, 0.045, 'bandpass'); tone(2300, 0.045, 0.018); break;
        case 'RIM': tone(1700, 0.035, 0.07, undefined, 'triangle'); break;
        case 'CLA': tone(2300, 0.06, 0.07); break;
        case 'COW': tone(560, 0.12, 0.04, undefined, 'square'); tone(845, 0.1, 0.02); break;
        case 'ME': tone(490, 0.13, 0.04); tone(1225, 0.08, 0.018); break;
        case 'GUI': noise(0.18, 1600, 0.06, 'bandpass'); break;
      }
    }
  }
  return { unlock, play, silence, setEnabled(value: boolean) { enabled = value; if (!value) silence(); },
    snapshot: () => ({ state: context?.state ?? (unavailable ? 'unavailable' : 'not-created'), voices: voices.size, strikes, enabled }),
    dispose() { silence(); if (context) void context.close().catch(() => {}); context = null; },
  };
}
