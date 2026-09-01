import { MISSIONS, FIZZ } from './constants.js';

const POOL = [
  { id: 'cans20', label: '20 cans', type: 'cans', target: 20, score: 120, fizz: 0.12 },
  { id: 'cans35', label: '35 cans', type: 'cans', target: 35, score: 200, fizz: 0.15 },
  { id: 'slides5', label: '5 slides', type: 'slides', target: 5, score: 100, fizz: 0.1 },
  { id: 'jumps8', label: '8 jumps', type: 'jumps', target: 8, score: 90, fizz: 0.1 },
  { id: 'nohit8', label: '8s no-hit', type: 'nohit', target: 8, score: 150, fizz: 0.14 },
  { id: 'near3', label: '3 near-miss', type: 'nearmiss', target: 3, score: 110, fizz: 0.12 },
  { id: 'combo5', label: '×5 combo', type: 'combo', target: 5, score: 130, fizz: 0.13 },
];

function shufflePick(n, rng = Math.random) {
  const copy = [...POOL];
  const out = [];
  while (out.length < n && copy.length) {
    const i = (rng() * copy.length) | 0;
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

/** Three rotating Pepsi missions per run — local progress, score + fizz on complete. */
export class Missions {
  constructor() {
    this.active = [];
    this._nohitT = 0;
    this._rng = Math.random;
  }

  reset() {
    this._rng = Math.random;
    this.active = shufflePick(MISSIONS.perRun, this._rng).map((m) => ({
      ...m,
      progress: 0,
      done: false,
    }));
    this._nohitT = 0;
  }

  update(dt, hitThisFrame = false) {
    if (!hitThisFrame) {
      this._nohitT += dt;
      for (const m of this.active) {
        if (m.done || m.type !== 'nohit') continue;
        m.progress = Math.min(m.target, this._nohitT);
      }
    } else {
      this._nohitT = 0;
      for (const m of this.active) {
        if (m.type === 'nohit' && !m.done) m.progress = 0;
      }
    }
  }

  bump(type, amount = 1) {
    const rewards = [];
    for (const m of this.active) {
      if (m.done || m.type !== type) continue;
      m.progress = Math.min(m.target, m.progress + amount);
      if (m.progress >= m.target) {
        m.done = true;
        rewards.push({ score: m.score, fizz: m.fizz, label: m.label });
      }
    }
    return rewards;
  }

  checkCombo(combo) {
    const rewards = [];
    for (const m of this.active) {
      if (m.done || m.type !== 'combo') continue;
      if (combo >= m.target) {
        m.progress = m.target;
        m.done = true;
        rewards.push({ score: m.score, fizz: m.fizz, label: m.label });
      } else {
        m.progress = Math.max(m.progress, combo);
      }
    }
    return rewards;
  }

  snapshot() {
    return this.active.map((m) => ({
      label: m.label,
      progress: m.progress,
      target: m.target,
      done: m.done,
    }));
  }
}
