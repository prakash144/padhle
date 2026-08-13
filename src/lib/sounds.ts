/**
 * Completion chimes for the Focus timer, synthesized with the Web Audio API —
 * no audio files to download, so a session-complete chime never waits on the
 * network and works offline. Tones are plain oscillator melodies; swapping in
 * a user-picked tone later just means registering a new ToneId preset here.
 */

export type ToneId = "focusComplete" | "shortBreakEnd" | "longBreakEnd" | "sessionComplete";

interface Note {
  freq: number;
  at: number; // seconds from tone start
  dur: number;
  gain?: number;
  type?: OscillatorType;
}

// Each tone is a short, distinct melody so the student knows "focus done",
// "short break done" and "long break done" apart by ear.
const TONES: Record<ToneId, Note[]> = {
  // Focus block finished → break begins: soft rising three-note "ding".
  focusComplete: [
    { freq: 523.25, at: 0, dur: 0.35, gain: 0.16 }, // C5
    { freq: 659.25, at: 0.14, dur: 0.35, gain: 0.16 }, // E5
    { freq: 783.99, at: 0.28, dur: 0.5, gain: 0.15 }, // G5
  ],
  // Short break over → back to focus: bright, quick, high.
  shortBreakEnd: [
    { freq: 1046.5, at: 0, dur: 0.22, gain: 0.15, type: "triangle" }, // C6
    { freq: 1318.51, at: 0.09, dur: 0.25, gain: 0.13, type: "triangle" }, // E6
  ],
  // Long break over → fresh block: warmer, deeper, slower arpeggio.
  longBreakEnd: [
    { freq: 392, at: 0, dur: 0.5, gain: 0.16 }, // G4
    { freq: 493.88, at: 0.2, dur: 0.5, gain: 0.15 }, // B4
    { freq: 587.33, at: 0.4, dur: 0.6, gain: 0.14 }, // D5
  ],
  // Whole session wrapped up → final resolved chord.
  sessionComplete: [
    { freq: 659.25, at: 0, dur: 0.4, gain: 0.16, type: "triangle" }, // E5
    { freq: 659.25, at: 0.18, dur: 0.4, gain: 0.15, type: "triangle" },
    { freq: 987.77, at: 0.36, dur: 0.55, gain: 0.13, type: "triangle" }, // B5
  ],
};

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  // Browsers suspend the context until a user gesture resumes it. We resume on
  // demand here so a completing timer can still chime if the user returned
  // after switching tabs (the context was already primed at Start).
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function playNotes(notes: Note[]): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + 0.02;
  notes.forEach((n) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.freq, t0 + n.at);
    const end = t0 + n.at + n.dur;
    gain.gain.setValueAtTime(0.0001, t0 + n.at);
    gain.gain.exponentialRampToValueAtTime(n.gain ?? 0.16, t0 + n.at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0 + n.at);
    osc.stop(end + 0.05);
  });
}

/** Creates/resumes the AudioContext during a user gesture (Start focus) so
 *  later completion chimes aren't blocked by autoplay policies. */
export function primeAudio(): void {
  getCtx();
}

export function playTone(tone: ToneId): void {
  playNotes(TONES[tone]);
}

export function setSoundMuted(value: boolean): void {
  muted = value;
}

export function isSoundMuted(): boolean {
  return muted;
}