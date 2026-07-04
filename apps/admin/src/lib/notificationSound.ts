/**
 * Plays a short three-note chime when a new online order arrives.
 * Uses WebAudio so no audio asset is needed. Browsers may block audio
 * until the user has interacted with the page — errors are swallowed.
 */
export function playNewOrderChime(): void {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6 — major arpeggio

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;

            const t = ctx.currentTime + i * 0.15;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.55);
        });

        // Free the context once the chime is done
        setTimeout(() => ctx.close().catch(() => {}), 1500);
    } catch {
        /* audio unavailable or blocked — ignore */
    }
}
