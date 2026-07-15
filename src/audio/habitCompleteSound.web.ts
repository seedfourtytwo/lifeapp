let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

/**
 * Soft singing-bowl chime via Web Audio (matches native habitComplete.wav feel).
 * Long decay; not a short UI “ding”.
 */
export async function playHabitCompleteChime(): Promise<void> {
  const ctx = getContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => undefined);
  }

  const now = ctx.currentTime;
  const duration = 2.4;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.28, now + 0.04);
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  master.connect(ctx.destination);

  // G4 fundamental with quiet inharmonic overtones (bowl-like).
  const partials: { frequency: number; gain: number }[] = [
    { frequency: 392, gain: 0.7 },
    { frequency: 392 * 2.01, gain: 0.28 },
    { frequency: 392 * 2.76, gain: 0.14 },
    { frequency: 392 * 4.05, gain: 0.06 },
  ];

  for (const partial of partials) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = partial.frequency;
    const toneGain = ctx.createGain();
    toneGain.gain.value = partial.gain;
    osc.connect(toneGain);
    toneGain.connect(master);
    osc.start(now);
    osc.stop(now + duration);
  }
}

export async function warmupHabitCompleteChime(): Promise<void> {
  getContext();
}
