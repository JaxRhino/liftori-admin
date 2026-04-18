/**
 * Shared chat sound effects.
 *
 * All sounds respect the same mute flag (`liftori_ring_muted`) used by the
 * incoming-call ring, so a single mute toggle silences everything.
 */

const isMuted = () => {
  try {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('liftori_ring_muted') === '1'
    );
  } catch {
    return false;
  }
};

/**
 * Short filtered noise burst — a "swoosh" on message send.
 * ~200ms, bandpass sweep from 4kHz down to 400Hz with a quick attack/decay.
 */
export function playSendSwoosh() {
  if (isMuted()) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Duration of the whole swoosh
    const duration = 0.2;
    const now = ctx.currentTime;

    // 1) White noise source
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.max(1, Math.floor(duration * sampleRate));
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Light amplitude — the filter + gain will shape it.
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // 2) Bandpass filter sweeping top-down for the "whoosh" feel
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.8;
    filter.frequency.setValueAtTime(4200, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + duration);

    // 3) Short attack / quick decay envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration + 0.01);

    // Let the context get garbage-collected after it's done.
    source.onended = () => {
      try { ctx.close(); } catch { /* no-op */ }
    };
  } catch {
    /* audio context not available — fail silent */
  }
}
