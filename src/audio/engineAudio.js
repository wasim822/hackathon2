// Tiny synthesized engine + tire screech + impact thumps (WebAudio, no files).
// Starts on first user gesture to satisfy autoplay rules. N toggles mute.

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.32;
    this.master.connect(ctx.destination);

    // engine: two detuned oscillators through a lowpass
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.18;
    this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    this.osc1.connect(this.filter); this.osc2.connect(g2); g2.connect(this.filter);
    this.filter.connect(this.engineGain); this.engineGain.connect(this.master);
    this.osc1.start(); this.osc2.start();

    // noise source for screech/impacts
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    this.screechFilter = ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass'; this.screechFilter.frequency.value = 1800; this.screechFilter.Q.value = 6;
    this.screechGain = ctx.createGain(); this.screechGain.gain.value = 0;
    noise.connect(this.screechFilter); this.screechFilter.connect(this.screechGain); this.screechGain.connect(this.master);
    noise.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
    return this.muted;
  }

  suspend(on) {
    if (!this.ctx) return;
    if (on) this.ctx.suspend(); else this.ctx.resume();
  }

  update(car, throttle) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = Math.abs(car.forwardSpeed);
    // fake gearbox: rpm rises within each gear band
    const bands = [0, 14, 26, 38, 50, 70];
    let gear = 0;
    while (gear < bands.length - 2 && v > bands[gear + 1]) gear++;
    const frac = (v - bands[gear]) / (bands[gear + 1] - bands[gear]);
    const rpm = 0.25 + Math.min(1, frac) * 0.75;
    const base = 45 + rpm * 110 + (car.onGround ? 0 : 30) + (car.wheelspin > 0.1 ? 25 : 0);
    this.osc1.frequency.setTargetAtTime(base, t, 0.05);
    this.osc2.frequency.setTargetAtTime(base * 0.5 + 1.5, t, 0.05);
    this.filter.frequency.setTargetAtTime(500 + throttle * 1400 + rpm * 600, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.1 + throttle * 0.12, t, 0.1);
    const slide = car.onGround ? Math.max(0, Math.abs(car.lateralSpeed) - 3) : 0;
    this.screechGain.gain.setTargetAtTime(Math.min(0.22, slide * 0.03), t, 0.06);
  }

  thump(strength) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(Math.min(0.9, strength * 0.06), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5, 0.4);
  }
}
