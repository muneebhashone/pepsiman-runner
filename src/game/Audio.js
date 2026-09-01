/**
 * Procedural WebAudio — whoosh, jump, land, sparkle, crash, game over. No assets.
 */
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._started = false;
    this._rushLoop = null;
    this._rushGain = null;
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
    f.frequency.setValueAtTime(280, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.08);
    f.Q.value = 4;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    this._env(g, 0.006, 0.03, 0.4, 0.12, 0.38);

    // noise air layer
    const bufLen = Math.floor(this.ctx.sampleRate * 0.14);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 800;
    const ng = this.ctx.createGain();
    this._env(ng, 0.004, 0.02, 0.3, 0.1, 0.18);

    const p = this.ctx.createStereoPanner?.();
    osc.connect(f);
    f.connect(g);
    noise.connect(nf);
    nf.connect(ng);
    if (p) {
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      ng.connect(p);
      p.connect(this.master);
    } else {
      g.connect(this.master);
      ng.connect(this.master);
    }
    osc.start(t);
    osc.stop(t + 0.22);
    noise.start(t);
    noise.stop(t + 0.18);
  }

  nearMissWhoosh() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(680, t);
    f.frequency.exponentialRampToValueAtTime(2200, t + 0.08);
    f.Q.value = 4.2;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.14);
    this._env(g, 0.003, 0.03, 0.42, 0.12, 0.38);
    osc.connect(f);
    f.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  jump() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.09);
    this._env(g, 0.003, 0.04, 0.32, 0.09, 0.32);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);

    // upward whoosh layer
    const wOsc = this.ctx.createOscillator();
    const wg = this.ctx.createGain();
    const wf = this.ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.setValueAtTime(400, t);
    wf.frequency.exponentialRampToValueAtTime(1800, t + 0.1);
    wf.Q.value = 2;
    wOsc.type = 'sine';
    wOsc.frequency.setValueAtTime(300, t);
    wOsc.frequency.exponentialRampToValueAtTime(900, t + 0.1);
    this._env(wg, 0.004, 0.03, 0.25, 0.08, 0.16);
    wOsc.connect(wf);
    wf.connect(wg);
    wg.connect(this.master);
    wOsc.start(t);
    wOsc.stop(t + 0.16);
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

    // percussive pop
    const popOsc = this.ctx.createOscillator();
    const popG = this.ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(880 + combo * 30, t);
    popOsc.frequency.exponentialRampToValueAtTime(220, t + 0.06);
    this._env(popG, 0.001, 0.02, 0.15, 0.05, 0.28);
    popOsc.connect(popG);
    popG.connect(this.master);
    popOsc.start(t);
    popOsc.stop(t + 0.1);

    const base = 480 + Math.min(combo, 12) * 68;
    const notes = [1, 1.26, 1.5, 2];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i < 2 ? 'sine' : 'triangle';
      const freq = base * notes[i];
      osc.frequency.setValueAtTime(freq, t + i * 0.022);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.7, t + i * 0.022 + 0.1);
      this._env(g, 0.002, 0.025, 0.28, 0.06, 0.2 - i * 0.035);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t + i * 0.022);
      osc.stop(t + 0.22);
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

  rushStinger() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const notes = [392, 523, 659, 784];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      const freq = notes[i];
      osc.frequency.setValueAtTime(freq, t + i * 0.05);
      this._env(g, 0.004, 0.06, 0.35, 0.14, 0.22);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2400;
      osc.connect(f);
      f.connect(g);
      g.connect(this.master);
      osc.start(t + i * 0.05);
      osc.stop(t + 0.45);
    }
  }

  startRushLoop() {
    if (!this._started || !this.enabled || this._rushLoop) return;
    const t = this._t();
    this._rushGain = this.ctx.createGain();
    this._rushGain.gain.value = 0.0001;
    this._rushGain.connect(this.master);

    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    oscA.type = 'square';
    oscB.type = 'triangle';
    oscA.frequency.value = 110;
    oscB.frequency.value = 165;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.value = 6.5;
    lfoG.gain.value = 0.08;
    lfo.connect(lfoG);
    lfoG.connect(this._rushGain.gain);
    oscA.connect(f);
    oscB.connect(f);
    f.connect(this._rushGain);
    oscA.start(t);
    oscB.start(t);
    lfo.start(t);
    this._rushGain.gain.exponentialRampToValueAtTime(0.14, t + 0.12);
    this._rushLoop = { oscA, oscB, lfo, f, gain: this._rushGain };
  }

  stopRushLoop() {
    if (!this._rushLoop || !this.ctx) return;
    const t = this._t();
    const { oscA, oscB, lfo, f, gain } = this._rushLoop;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    const stopAt = t + 0.2;
    oscA.stop(stopAt);
    oscB.stop(stopAt);
    lfo.stop(stopAt);
    try {
      f.disconnect();
      gain.disconnect();
    } catch {
      /* already disconnected */
    }
    this._rushLoop = null;
    this._rushGain = null;
  }

  rushSmash() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.1);
    this._env(g, 0.002, 0.03, 0.2, 0.08, 0.28);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  missionComplete() {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(990, t + 0.12);
    this._env(g, 0.003, 0.04, 0.3, 0.1, 0.2);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  comboShout(level = 1) {
    if (!this._started || !this.enabled) return;
    const t = this._t();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const base = 320 + level * 90;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.08);
    this._env(g, 0.002, 0.03, 0.25, 0.08, 0.16 + level * 0.04);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.18);
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
