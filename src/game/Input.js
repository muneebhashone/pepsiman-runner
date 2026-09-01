import { INPUT } from './constants.js';

/**
 * Keyboard + mobile swipe input for lane / jump / slide.
 * Buffers one queued lane change for Subway-Surfers-style chaining.
 */
export class Input {
  constructor(target = window) {
    this.target = target;
    this.laneDelta = 0;
    this.jump = false;
    this.slide = false;
    this._laneBuffer = 0;
    this._keys = new Set();
    this._touchStart = null;
    this._boundKeyDown = (e) => this._onKeyDown(e);
    this._boundKeyUp = (e) => this._onKeyUp(e);
    this._boundTouchStart = (e) => this._onTouchStart(e);
    this._boundTouchEnd = (e) => this._onTouchEnd(e);
    this.enabled = true;
    /** @type {((action: 'jump' | 'slide') => void) | null} */
    this.onAction = null;
  }

  setActionCallback(fn) {
    this.onAction = fn;
  }

  attach() {
    this.target.addEventListener('keydown', this._boundKeyDown);
    this.target.addEventListener('keyup', this._boundKeyUp);
    this.target.addEventListener('touchstart', this._boundTouchStart, { passive: true });
    this.target.addEventListener('touchend', this._boundTouchEnd, { passive: true });
  }

  detach() {
    this.target.removeEventListener('keydown', this._boundKeyDown);
    this.target.removeEventListener('keyup', this._boundKeyUp);
    this.target.removeEventListener('touchstart', this._boundTouchStart);
    this.target.removeEventListener('touchend', this._boundTouchEnd);
  }

  _queueLane(delta) {
    const next = this.laneDelta + this._laneBuffer + delta;
    const clamped = Math.max(-INPUT.laneBufferMax, Math.min(INPUT.laneBufferMax, next));
    const used = this.laneDelta + this._laneBuffer;
    const remaining = clamped - used;
    if (remaining > 0) this._laneBuffer += remaining;
    else if (remaining < 0) this._laneBuffer += remaining;
  }

  _onKeyDown(e) {
    if (!this.enabled) return;
    const k = e.code;
    if (this._keys.has(k)) return;
    this._keys.add(k);
    if (k === 'ArrowLeft' || k === 'KeyA') this._queueLane(-1);
    if (k === 'ArrowRight' || k === 'KeyD') this._queueLane(1);
    if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') {
      this.onAction?.('jump');
      this.jump = true;
    }
    if (k === 'ArrowDown' || k === 'KeyS') {
      this.onAction?.('slide');
      this.slide = true;
    }
  }

  _onKeyUp(e) {
    this._keys.delete(e.code);
  }

  _onTouchStart(e) {
    if (!this.enabled || !e.changedTouches?.length) return;
    const t = e.changedTouches[0];
    this._touchStart = { x: t.clientX, y: t.clientY, t: performance.now() };
  }

  _onTouchEnd(e) {
    if (!this.enabled || !this._touchStart || !e.changedTouches?.length) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - this._touchStart.x;
    const dy = t.clientY - this._touchStart.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const elapsed = performance.now() - this._touchStart.t;
    const min = INPUT.swipeMin;
    if (elapsed > INPUT.swipeMaxMs || Math.max(adx, ady) < min) {
      this._touchStart = null;
      return;
    }
    if (adx > ady * 1.15) {
      this._queueLane(dx > 0 ? 1 : -1);
    } else {
      if (dy < 0) {
        this.onAction?.('jump');
        this.jump = true;
      } else {
        this.onAction?.('slide');
        this.slide = true;
      }
    }
    this._touchStart = null;
  }

  /**
   * Returns consumed input and drains lane buffer into laneDelta when ready.
   * @param {boolean} canAcceptLane — false while mid-switch with full buffer
   */
  consume(canAcceptLane = true) {
    let laneDelta = this.laneDelta;
    if (canAcceptLane && this._laneBuffer !== 0) {
      const buf = Math.sign(this._laneBuffer);
      this._laneBuffer -= buf;
      laneDelta += buf;
    }
    const out = {
      laneDelta,
      jump: this.jump,
      slide: this.slide,
    };
    this.laneDelta = 0;
    this.jump = false;
    this.slide = false;
    return out;
  }

  hasBufferedLane() {
    return this._laneBuffer !== 0;
  }

  reset() {
    this.laneDelta = 0;
    this.jump = false;
    this.slide = false;
    this._laneBuffer = 0;
    this._keys.clear();
    this._touchStart = null;
  }
}
