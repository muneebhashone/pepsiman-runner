/**
 * Keyboard + mobile swipe input for lane / jump / slide.
 */
export class Input {
  constructor(target = window) {
    this.target = target;
    this.laneDelta = 0;
    this.jump = false;
    this.slide = false;
    this._keys = new Set();
    this._touchStart = null;
    this._boundKeyDown = (e) => this._onKeyDown(e);
    this._boundKeyUp = (e) => this._onKeyUp(e);
    this._boundTouchStart = (e) => this._onTouchStart(e);
    this._boundTouchEnd = (e) => this._onTouchEnd(e);
    this.enabled = true;
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

  _onKeyDown(e) {
    if (!this.enabled) return;
    const k = e.code;
    if (this._keys.has(k)) return;
    this._keys.add(k);
    if (k === 'ArrowLeft' || k === 'KeyA') this.laneDelta -= 1;
    if (k === 'ArrowRight' || k === 'KeyD') this.laneDelta += 1;
    if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') this.jump = true;
    if (k === 'ArrowDown' || k === 'KeyS') this.slide = true;
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
    const min = 28;
    if (Math.max(adx, ady) < min) {
      this._touchStart = null;
      return;
    }
    if (adx > ady) {
      this.laneDelta += dx > 0 ? 1 : -1;
    } else {
      if (dy < 0) this.jump = true;
      else this.slide = true;
    }
    this._touchStart = null;
  }

  consume() {
    const out = {
      laneDelta: this.laneDelta,
      jump: this.jump,
      slide: this.slide,
    };
    this.laneDelta = 0;
    this.jump = false;
    this.slide = false;
    return out;
  }

  reset() {
    this.laneDelta = 0;
    this.jump = false;
    this.slide = false;
    this._keys.clear();
    this._touchStart = null;
  }
}
