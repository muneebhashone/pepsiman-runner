import { SPAWN } from './constants.js';

export class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.scoreEl = document.getElementById('hud-score');
    this.coinsEl = document.getElementById('hud-coins');
    this.comboEl = document.getElementById('hud-combo');
    this.comboWrap = document.getElementById('hud-combo-wrap');
    this.speedEl = document.getElementById('hud-speed');
    this.speedBar = document.getElementById('hud-speed-bar');
    this.startOverlay = document.getElementById('overlay-start');
    this.gameOverOverlay = document.getElementById('overlay-gameover');
    this.pauseOverlay = document.getElementById('overlay-pause');
    this.hitFlash = document.getElementById('hit-flash');
    this.pickupFlash = document.getElementById('pickup-flash');
    this.floatLayer = document.getElementById('float-layer');
    this.tutorialHint = document.getElementById('tutorial-hint');
    this.finalScore = document.getElementById('final-score');
    this.finalSub = document.getElementById('final-sub');
    this.btnStart = document.getElementById('btn-start');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnResume = document.getElementById('btn-resume');
    this.btnPause = document.getElementById('btn-pause');
    this._onStart = null;
    this._onRetry = null;
    this._onResume = null;
    this._onPause = null;
    this._prevCombo = 1;
    this._comboPopTimer = 0;

    this.btnStart?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._onStart?.();
    });
    this.btnRetry?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._onRetry?.();
    });
    this.btnResume?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._onResume?.();
    });
    this.btnPause?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._onPause?.();
    });

    // tap anywhere on start overlay
    this.startOverlay?.addEventListener('click', () => {
      if (!this.startOverlay.classList.contains('hidden')) this._onStart?.();
    });

    // tap anywhere on game over to retry
    this.gameOverOverlay?.addEventListener('click', () => {
      if (!this.gameOverOverlay.classList.contains('hidden')) this._onRetry?.();
    });
  }

  onStart(fn) {
    this._onStart = fn;
  }

  onRetry(fn) {
    this._onRetry = fn;
  }

  onResume(fn) {
    this._onResume = fn;
  }

  onPause(fn) {
    this._onPause = fn;
  }

  showStart() {
    this.startOverlay?.classList.remove('hidden');
    this.gameOverOverlay?.classList.add('hidden');
    this.pauseOverlay?.classList.add('hidden');
    this.hud?.classList.add('dimmed');
  }

  hideOverlays() {
    this.startOverlay?.classList.add('hidden');
    this.gameOverOverlay?.classList.add('hidden');
    this.pauseOverlay?.classList.add('hidden');
    this.hud?.classList.remove('dimmed');
  }

  showPause() {
    this.pauseOverlay?.classList.remove('hidden');
    this.hud?.classList.add('dimmed');
  }

  hidePause() {
    this.pauseOverlay?.classList.add('hidden');
    this.hud?.classList.remove('dimmed');
  }

  showGameOver(score, coins, bestCombo) {
    if (this.finalScore) this.finalScore.textContent = String(Math.floor(score));
    if (this.finalSub) {
      this.finalSub.textContent = `${coins} cans · best combo ×${bestCombo}`;
    }
    this.gameOverOverlay?.classList.remove('hidden');
    this.hud?.classList.add('dimmed');
  }

  flashPickup(combo = 1) {
    if (!this.pickupFlash) return;
    const intensity = 0.12 + Math.min(combo, 8) * 0.02;
    this.pickupFlash.style.opacity = String(intensity);
    this.pickupFlash.classList.add('active');
    clearTimeout(this._pickupTimer);
    this._pickupTimer = setTimeout(() => {
      this.pickupFlash?.classList.remove('active');
      if (this.pickupFlash) this.pickupFlash.style.opacity = '0';
    }, 130);
  }

  popCan() {
    this.coinsEl?.classList.remove('pop');
    void this.coinsEl?.offsetWidth;
    this.coinsEl?.classList.add('pop');
    this.coinsEl?.closest('.stat-cans')?.classList.add('glow');
    clearTimeout(this._canPopTimer);
    this._canPopTimer = setTimeout(() => {
      this.coinsEl?.classList.remove('pop');
      this.coinsEl?.closest('.stat-cans')?.classList.remove('glow');
    }, 400);
  }

  floatPoints(pts, combo = 1) {
    if (!this.floatLayer) return;
    const wrap = document.createElement('div');
    wrap.className = 'float-pickup';
    const side = Math.random() > 0.5 ? 'right' : 'left';
    wrap.classList.add(side);

    const label = document.createElement('div');
    label.className = 'float-can-label';
    label.textContent = 'CAN!';

    const ptsEl = document.createElement('div');
    ptsEl.className = 'float-pts';
    ptsEl.textContent = `+${Math.floor(pts)}`;
    if (combo >= 3) {
      label.classList.add('hot');
      ptsEl.classList.add('hot');
    }

    wrap.appendChild(label);
    wrap.appendChild(ptsEl);
    this.floatLayer.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('rise'));
    setTimeout(() => wrap.remove(), 900);
  }
  floatNearMiss(pts) {
    if (!this.floatLayer) return;
    const wrap = document.createElement('div');
    wrap.className = 'float-pickup near-miss';
    wrap.classList.add(Math.random() > 0.5 ? 'right' : 'left');

    const label = document.createElement('div');
    label.className = 'float-can-label';
    label.textContent = 'CLOSE!';

    const ptsEl = document.createElement('div');
    ptsEl.className = 'float-pts';
    ptsEl.textContent = `+${Math.floor(pts)}`;

    wrap.appendChild(label);
    wrap.appendChild(ptsEl);
    this.floatLayer.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('rise'));
    setTimeout(() => wrap.remove(), 750);
  }

  flashHit(intensity = 1) {
    if (!this.hitFlash) return;
    this.hitFlash.style.opacity = String(0.35 + intensity * 0.45);
    this.hitFlash.classList.add('active');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this.hitFlash?.classList.remove('active');
      if (this.hitFlash) this.hitFlash.style.opacity = '0';
    }, 120);
  }

  flashTutorialHint(action) {
    if (!this.tutorialHint) return;
    clearTimeout(this._tutorialHintTimer);
    clearTimeout(this._tutorialHintChainTimer);
    this._showTutorialHint(action);
  }

  /** Schedule a follow-up hint (e.g. JUMP chained after GET READY for first sign). */
  scheduleTutorialHint(action, delayMs) {
    clearTimeout(this._tutorialHintChainTimer);
    this._tutorialHintChainTimer = setTimeout(() => {
      this._tutorialHintChainTimer = null;
      this._showTutorialHint(action);
    }, delayMs);
  }

  _showTutorialHint(action) {
    if (!this.tutorialHint) return;
    const isReady = action === 'ready';
    const isSlide = action === 'slide';
    const label = isReady ? 'GET READY' : isSlide ? 'SLIDE' : 'JUMP';
    const arrow = isReady ? '' : isSlide ? '↓' : '↑';
    this.tutorialHint.textContent = arrow ? `${arrow} ${label}` : label;
    this.tutorialHint.classList.remove('hidden', 'slide', 'jump', 'ready', 'flash');
    this.tutorialHint.classList.add(isReady ? 'ready' : isSlide ? 'slide' : 'jump', 'flash');
    this.tutorialHint.setAttribute('aria-hidden', 'false');
    clearTimeout(this._tutorialHintTimer);
    const duration = isReady ? SPAWN.tutorialHintReadyMs : SPAWN.tutorialHintVisibleMs;
    this._tutorialHintTimer = setTimeout(() => {
      this.tutorialHint?.classList.add('hidden');
      this.tutorialHint?.classList.remove('flash', 'slide', 'jump', 'ready');
      this.tutorialHint?.setAttribute('aria-hidden', 'true');
    }, duration);
  }

  popCombo() {
    this.comboWrap?.classList.remove('pop');
    void this.comboWrap?.offsetWidth;
    this.comboWrap?.classList.add('pop');
    this._comboPopTimer = 0.35;
  }

  pulseScore() {
    this.scoreEl?.classList.remove('pulse');
    void this.scoreEl?.offsetWidth;
    this.scoreEl?.classList.add('pulse');
  }

  update(stats, dt = 0) {
    if (this.scoreEl) this.scoreEl.textContent = String(Math.floor(stats.score));
    if (this.coinsEl) this.coinsEl.textContent = String(stats.coins);
    if (this.comboEl) this.comboEl.textContent = `×${stats.combo}`;
    if (this.comboWrap) {
      this.comboWrap.classList.toggle('hot', stats.combo >= 3);
      if (stats.combo > this._prevCombo) this.popCombo();
      this._prevCombo = stats.combo;
    }
    if (this.speedEl) this.speedEl.textContent = String(Math.round(stats.speed));
    if (this.speedBar) {
      const pct = Math.max(8, Math.min(100, stats.speedNorm * 100));
      this.speedBar.style.width = `${pct}%`;
      this.speedBar.classList.toggle('maxed', stats.speedNorm > 0.92);
    }

    if (this._comboPopTimer > 0) {
      this._comboPopTimer -= dt;
      if (this._comboPopTimer <= 0) this.comboWrap?.classList.remove('pop');
    }
  }

  resetHudAnim() {
    this._prevCombo = 1;
    this._comboPopTimer = 0;
    this.comboWrap?.classList.remove('pop', 'hot');
    this.scoreEl?.classList.remove('pulse');
    this.tutorialHint?.classList.add('hidden');
    this.tutorialHint?.classList.remove('flash', 'slide', 'jump', 'ready');
    this.tutorialHint?.setAttribute('aria-hidden', 'true');
    clearTimeout(this._tutorialHintTimer);
    clearTimeout(this._tutorialHintChainTimer);
  }
}
