import { MISSIONS } from "./constants.js";

const POOL = [
  {
    id: "cans20",
    label: "Collect 20 cans",
    type: "cans",
    target: 20,
    score: 50,
    fizz: 0.05,
  },
  {
    id: "cans35",
    label: "Collect 35 cans",
    type: "cans",
    target: 35,
    score: 80,
    fizz: 0.05,
  },
  {
    id: "slides5",
    label: "Clear 5 slide gates",
    type: "slides",
    target: 5,
    score: 60,
    fizz: 0.05,
  },
  {
    id: "jumps8",
    label: "Jump 8 obstacles",
    type: "jumps",
    target: 8,
    score: 70,
    fizz: 0.05,
  },
  {
    id: "nohit30",
    label: "30s without a hit",
    type: "nohit",
    target: 30,
    score: 60,
    fizz: 0.05,
  },
  {
    id: "near3",
    label: "3 close calls",
    type: "nearmiss",
    target: 3,
    score: 50,
    fizz: 0.05,
  },
  {
    id: "combo5",
    label: "Reach a ×5 combo",
    type: "combo",
    target: 5,
    score: 100,
    fizz: 0.05,
  },
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
    const rewards = [];
    if (!hitThisFrame) {
      this._nohitT += dt;
      for (const m of this.active) {
        if (m.done || m.type !== "nohit") continue;
        m.progress = Math.min(m.target, this._nohitT);
        if (m.progress >= m.target) {
          m.done = true;
          rewards.push({ score: m.score, fizz: m.fizz, label: m.label });
        }
      }
    } else {
      this._nohitT = 0;
      for (const m of this.active) {
        if (m.type === "nohit" && !m.done) m.progress = 0;
      }
    }
    return rewards;
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
      if (m.done || m.type !== "combo") continue;
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
