import { FIZZ } from './constants.js';

/** Pepsi Fizz meter — near-misses and can streaks fill the bar; full = PEPSI RUSH. */
export class FizzMeter {
  constructor() {
    this.level = 0;
    this.rushT = 0;
    this._streakT = 0;
    this._streakCount = 0;
  }

  get isRush() {
    return this.rushT > 0;
  }

  get rushNorm() {
    return this.isRush ? this.rushT / FIZZ.rushDuration : 0;
  }

  add(amount) {
    if (this.isRush) return false;
    this.level = Math.min(FIZZ.max, this.level + amount);
    if (this.level >= FIZZ.max) {
      this.startRush();
      return true;
    }
    return false;
  }

  onCanPickup() {
    this._streakCount += 1;
    this._streakT = FIZZ.streakWindow;
    const bonus = Math.min(FIZZ.streakCap, this._streakCount * FIZZ.perCanStreak);
    return this.add(FIZZ.perCan + bonus);
  }

  onNearMiss() {
    return this.add(FIZZ.perNearMiss);
  }

  startRush() {
    this.level = FIZZ.max;
    this.rushT = FIZZ.rushDuration;
    this._streakCount = 0;
    this._streakT = 0;
  }

  update(dt) {
    if (this._streakT > 0) {
      this._streakT -= dt;
      if (this._streakT <= 0) this._streakCount = 0;
    }
    if (this.rushT > 0) {
      this.rushT -= dt;
      if (this.rushT <= 0) {
        this.rushT = 0;
        this.level = FIZZ.emptyAfterRush;
      }
    }
  }

  reset() {
    this.level = 0;
    this.rushT = 0;
    this._streakT = 0;
    this._streakCount = 0;
  }
}
