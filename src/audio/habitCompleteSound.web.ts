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

/** Soft two-tone chime via Web Audio (no asset decode on web). */
export async function playHabitCompleteChime(): Promise<void> {
  const ctx = getContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => undefined);
  }

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  gain.connect(ctx.destination);

  for (const [index, frequency] of [784, 1175].entries()) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const toneGain = ctx.createGain();
    toneGain.gain.value = index === 0 ? 0.7 : 0.45;
    osc.connect(toneGain);
    toneGain.connect(gain);
    const start = now + index * 0.08;
    osc.start(start);
    osc.stop(start + 0.22);
  }
}

export async function warmupHabitCompleteChime(): Promise<void> {
  getContext();
}
