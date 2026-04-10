/**
 * Call Center Audio System
 * - Voice announcement: "Call Center, Incoming Call"
 * - Professional ringtone using Web Audio API
 */

let audioCtx = null;
let ringtoneInterval = null;
let isRinging = false;

function getAudioContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// ── Voice Announcement ──
function speakAnnouncement(text = 'Call Center, Incoming Call') {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      console.warn('[Audio] SpeechSynthesis not available');
      resolve();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to pick a professional female voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Samantha') || // macOS
      v.name.includes('Zira') ||     // Windows
      v.name.includes('Google US English') ||
      (v.lang === 'en-US' && v.name.includes('Female'))
    );
    if (preferred) utterance.voice = preferred;

    utterance.onend = resolve;
    utterance.onerror = resolve;

    // Safety timeout
    setTimeout(resolve, 4000);

    window.speechSynthesis.speak(utterance);
  });
}

// ── Ringtone Generator ──
// Classic double-ring pattern: two short tones, pause, repeat
function playRingBurst(ctx) {
  const now = ctx.currentTime;
  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);
  gainNode.gain.setValueAtTime(0.3, now);

  // Ring 1 (0 - 0.4s)
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(440, now);
  osc1.connect(gainNode);
  gainNode.gain.setValueAtTime(0.3, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  osc1.start(now);
  osc1.stop(now + 0.4);

  // Ring 2 (0.5 - 0.9s)
  const gainNode2 = ctx.createGain();
  gainNode2.connect(ctx.destination);
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(480, now + 0.5);
  osc2.connect(gainNode2);
  gainNode2.gain.setValueAtTime(0, now);
  gainNode2.gain.setValueAtTime(0.3, now + 0.5);
  gainNode2.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
  osc2.start(now + 0.5);
  osc2.stop(now + 0.9);
}

function startRingtone() {
  if (isRinging) return;
  isRinging = true;

  const ctx = getAudioContext();
  playRingBurst(ctx);

  // Repeat every 3 seconds (ring-ring ... pause ... ring-ring)
  ringtoneInterval = setInterval(() => {
    if (!isRinging) return;
    try {
      const ctx = getAudioContext();
      playRingBurst(ctx);
    } catch (e) {
      console.warn('[Audio] Ringtone error:', e);
    }
  }, 3000);
}

function stopRingtone() {
  isRinging = false;
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

// ── Public API ──

/**
 * Play the full incoming call alert:
 * 1. Voice: "Call Center, Incoming Call"
 * 2. Ringtone loops until stopIncomingAlert() is called
 */
export async function playIncomingAlert() {
  try {
    // Ensure AudioContext is unlocked (needs prior user gesture)
    getAudioContext();

    // Speak first, then start ringtone
    await speakAnnouncement();
    startRingtone();
  } catch (err) {
    console.error('[Audio] Failed to play incoming alert:', err);
    // Fallback: at least try the ringtone
    try { startRingtone(); } catch (e) { /* silent */ }
  }
}

/**
 * Stop the ringtone (call answered, rejected, or caller hung up)
 */
export function stopIncomingAlert() {
  stopRingtone();
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Check if ringtone is currently playing
 */
export function isAlertPlaying() {
  return isRinging;
}
