/**
 * Tiny WebAudio synth — whooshes, pickups, thumps. No external assets.
 */
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._started = false;
  }

  async ensure() {
    if (this._started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this._started = true;
  }

  _t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  _env(gain, a, d, s, r, peak = 1) {
    const t = this._t();
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + a);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
  }

  whoosh(pan = 0) {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
    f.Q.value = 2.5;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);
    this._env(g, 0.01, 0.05, 0.4, 0.12, 0.22);
    const p = this.ctx.createStereoPanner?.();
    osc.connect(f);
    f.connect(g);
    if (p) {
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      p.connect(this.master);
    } else {
      g.connect(this.master);
    }
    osc.start(t);
    osc.stop(t + 0.25);
  }

  jump() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.12);
    this._env(g, 0.005, 0.06, 0.3, 0.1, 0.2);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  slide() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.18);
    const g = this.ctx.createGain();
    this._env(g, 0.01, 0.08, 0.4, 0.1, 0.18);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.22);
  }

  land() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    this._env(g, 0.002, 0.05, 0.25, 0.12, 0.35);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  pickup(combo = 1) {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const base = 520 + Math.min(combo, 8) * 40;
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(base * (i === 0 ? 1 : 1.5), t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.8 * (i === 0 ? 1 : 1.25), t + 0.08);
      this._env(g, 0.002, 0.04, 0.3, 0.08, 0.16 - i * 0.04);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t + i * 0.02);
      osc.stop(t + 0.18);
    }
  }

  crash() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = this.ctx.createGain();
    this._env(g, 0.005, 0.1, 0.4, 0.2, 0.45);
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    this._env(og, 0.005, 0.08, 0.3, 0.2, 0.25);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    osc.connect(og);
    og.connect(this.master);
    src.start(t);
    src.stop(t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  }
}
