// Original synthesized completion chime; no media downloads or external audio.
export function completionChime() {
  try {
    const audio = new AudioContext();
    const now = audio.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const osc = audio.createOscillator(),
        gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, now + i * 0.11);
      gain.gain.linearRampToValueAtTime(0.055, now + i * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.25);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.28);
    });
    setTimeout(() => {
      void audio.close();
    }, 900);
  } catch {
    /* Audio unavailable: keep gameplay fully usable. */
  }
}
