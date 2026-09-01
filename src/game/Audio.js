/**
 * Procedural WebAudio — whoosh, jump, land, sparkle, crash, game over. No assets.
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
    this.master.gain.value = 0.38;
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

  _connect(node) {
    node.connect(this.master);
  }

  whoosh(pan = 0) {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(320, t);
    f.frequency.exponentialRampToValueAtTime(2200, t + 0.1);
    f.Q.value = 3;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.2);
    this._env(g, 0.008, 0.04, 0.35, 0.14, 0.24);
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
    osc.stop(t + 0.28);
  }

  jump() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(580, t + 0.1);
    this._env(g, 0.004, 0.05, 0.28, 0.1, 0.22);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  slide() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const bufferSize = this.ctx.sampleRate * 0.22;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.2);
    const g = this.ctx.createGain();
    this._env(g, 0.008, 0.07, 0.35, 0.12, 0.2);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.24);
  }

  land() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.14);
    this._env(g, 0.002, 0.04, 0.22, 0.14, 0.38);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);

    // subtle noise thump
    const bufLen = Math.floor(this.ctx.sampleRate * 0.06);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const ng = this.ctx.createGain();
    this._env(ng, 0.001, 0.02, 0.1, 0.04, 0.12);
    src.connect(ng);
    ng.connect(this.master);
    src.start(t);
    src.stop(t + 0.08);
  }

  pickup(combo = 1) {
    if (!this._started || !this.enabled) return;
    this.canSparkle(combo);
  }

  canSparkle(combo = 1) {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const base = 480 + Math.min(combo, 8) * 48;
    const notes = [1, 1.25, 1.5];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      const freq = base * notes[i];
      osc.frequency.setValueAtTime(freq, t + i * 0.025);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.6, t + i * 0.025 + 0.09);
      this._env(g, 0.002, 0.03, 0.25, 0.07, 0.17 - i * 0.04);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t + i * 0.025);
      osc.stop(t + 0.2);
    }
  }

  crash() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const bufferSize = this.ctx.sampleRate * 0.38;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.4);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 620;
    const g = this.ctx.createGain();
    this._env(g, 0.004, 0.1, 0.35, 0.22, 0.48);
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.32);
    this._env(og, 0.004, 0.07, 0.28, 0.22, 0.28);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    osc.connect(og);
    og.connect(this.master);
    src.start(t);
    src.stop(t + 0.38);
    osc.start(t);
    osc.stop(t + 0.38);
  }

  gameOver() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.55);
    this._env(g, 0.01, 0.15, 0.4, 0.35, 0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.55);
    osc.connect(f);
    f.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.7);

    // soft chord tail
    const chord = [0.5, 0.62, 0.75];
    for (let i = 0; i < chord.length; i++) {
      const o = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 110 * chord[i];
      this._env(cg, 0.05, 0.2, 0.3, 0.4, 0.08);
      o.connect(cg);
      cg.connect(this.master);
      o.start(t + 0.12);
      o.stop(t + 0.9);
    }
  }

  startSting() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.08);
    this._env(g, 0.005, 0.04, 0.2, 0.08, 0.12);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 600;
    f.Q.value = 1.2;
    osc.connect(f);
    f.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}
