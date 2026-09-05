import { FIZZ } from './constants.js';

/** Pepsi Fizz meter — near-misses and can streaks fill the bar; full = PEPSI RUSH. */
export class FizzMeter {
  constructor() {
    this.level = 0;
    this.rushT = 0;
    this.cooldownT = 0;
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
    if (this.isRush || this.cooldownT > 0) return false;
    this.level = Math.min(FIZZ.max, this.level + amount);
    if (this.level >= FIZZ.max) {
      this.startRush();
      return true;
    }
    return false;
  }

  onCanPickup() {
    if (this.isRush || this.cooldownT > 0) return false;
    this._streakCount += 1;
    this._streakT = FIZZ.streakWindow;
    const bonus = Math.min(FIZZ.streakCap, this._streakCount * FIZZ.perCanStreak);
    return this.add(FIZZ.perCan + bonus);
  }

  onNearMiss() {
    if (this.isRush) return false;
    return this.add(FIZZ.perNearMiss);
  }

  startRush() {
    if (this.isRush || this.cooldownT > 0) return false;
    this.level = FIZZ.max;
    this.rushT = FIZZ.rushDuration;
    this._streakCount = 0;
    this._streakT = 0;
    return true;
  }

  endRush() {
    this.rushT = 0;
    this.cooldownT = FIZZ.rechargeDelay;
    this.level = FIZZ.emptyAfterRush;
    this._streakCount = 0;
    this._streakT = 0;
  }

  update(dt) {
    if (this.isRush) {
      this.rushT = Math.max(0, this.rushT - dt);
      this.level = Math.max(FIZZ.emptyAfterRush, this.rushT / FIZZ.rushDuration);
      if (this.rushT <= 0) this.endRush();
      return;
    }

    this.cooldownT = Math.max(0, this.cooldownT - dt);

    if (this._streakT > 0) {
      this._streakT -= dt;
      if (this._streakT <= 0) this._streakCount = 0;
    }
  }

  reset() {
    this.level = 0;
    this.rushT = 0;
    this.cooldownT = 0;
    this._streakT = 0;
    this._streakCount = 0;
  }

  onHit() {
    if (this.isRush) return;
    this.level = Math.max(0, this.level - FIZZ.hitPenalty);
    this._streakT = 0;
    this._streakCount = 0;
  }
}
