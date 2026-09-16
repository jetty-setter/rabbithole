/** Optional, explicit-opt-in sonification of the signal sequence's own
 *  intensity values -- never framed as "the sound of the Wow! Signal"
 *  (there is no recording of one; radio astronomy isn't audible). A
 *  restrained two-oscillator drone: intensity drives amplitude and a
 *  narrow pitch range, with a second, detuned oscillator fading in only
 *  at higher intensity for a little harmonic density near the peak. No
 *  autoplay -- created and started only from the user's own click, which
 *  is also what satisfies the browser's audio-context-needs-a-gesture
 *  policy. */
export class Sonifier {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gain2: GainNode | null = null;

  start() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 220;

    const gain2 = ctx.createGain();
    gain2.gain.value = 0;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 220 * 1.5;
    osc2.connect(gain2);
    gain2.connect(gain);

    osc1.connect(gain);
    osc1.start();
    osc2.start();

    this.ctx = ctx;
    this.gain = gain;
    this.osc1 = osc1;
    this.osc2 = osc2;
    this.gain2 = gain2;
  }

  /** intensity: 0..1 normalized reading. Called on every stage tick while
   *  sonification is enabled; ramps rather than jumps to avoid clicks. */
  update(intensity: number) {
    if (!this.ctx || !this.gain || !this.osc1 || !this.osc2 || !this.gain2) return;
    const t = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, intensity));
    // Restrained: quiet even at peak, narrow pitch band, no sci-fi beeps.
    const targetGain = clamped * 0.05;
    const targetFreq = 196 + clamped * 110; // ~G3 to ~D5, narrow and eerie
    const targetGain2 = clamped > 0.55 ? (clamped - 0.55) * 0.06 : 0;
    this.gain.gain.linearRampToValueAtTime(targetGain, t + 0.08);
    this.osc1.frequency.linearRampToValueAtTime(targetFreq, t + 0.08);
    this.gain2.gain.linearRampToValueAtTime(targetGain2, t + 0.08);
  }

  stop() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.osc1?.stop(ctx.currentTime + 0.1);
    this.osc2?.stop(ctx.currentTime + 0.1);
    window.setTimeout(() => ctx.close().catch(() => {}), 200);
    this.ctx = null;
    this.gain = null;
    this.osc1 = null;
    this.osc2 = null;
    this.gain2 = null;
  }
}
