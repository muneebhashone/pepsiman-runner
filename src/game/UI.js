import { SPAWN, SCORE, FIZZ } from './constants.js';

const STORAGE_KEY = 'pepsiman-runner-v1';

export function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { highScore: 0, bestCombo: 1, totalCans: 0, topScores: [] };
    const p = JSON.parse(raw);
    return {
      highScore: Number(p.highScore) || 0,
      bestCombo: Number(p.bestCombo) || 1,
      totalCans: Number(p.totalCans) || 0,
      topScores: Array.isArray(p.topScores)
        ? p.topScores.map((n) => Number(n) || 0).filter((n) => n > 0).slice(0, 3)
        : [],
    };
  } catch {
    return { highScore: 0, bestCombo: 1, totalCans: 0, topScores: [] };
  }
}

export function savePersisted(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

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
    this.fizzFill = document.getElementById('hud-fizz-fill');
    this.fizzRush = document.getElementById('hud-rush');
    this.missionsEl = document.getElementById('hud-missions');
    this.comboShout = document.getElementById('combo-shout');
    this.finalCompare = document.getElementById('final-compare');
    this.finalSoClose = document.getElementById('final-so-close');
    this.finalScore = document.getElementById('final-score');
    this.finalSub = document.getElementById('final-sub');
    this.finalStats = document.getElementById('final-stats');
    this.finalTopScores = document.getElementById('final-top-scores');
    this.rushWash = document.getElementById('rush-wash');
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
    this._tutorialHintAction = null;
    this._cueQueue = [];
    this._cueActive = null;
    this._cueGen = 0;
    this._cueTimers = { pop: null, hold: null, fade: null };
    this._cueIdleWaiters = [];
    this._onCueComplete = null;

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

  setTutorialCueCompleteCallback(fn) {
    this._onCueComplete = fn;
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

  showGameOver(score, coins, bestCombo, meta = {}) {
    const pts = Math.floor(score);
    const dist = Math.floor(meta.distance ?? 0);
    const combo = Math.floor(bestCombo);
    const best = Math.floor(meta.highScore ?? 0);
    const runBestCombo = Math.floor(meta.allTimeBestCombo ?? combo);

    if (this.finalScore) this.finalScore.textContent = String(pts);
    if (this.finalSub) {
      this.finalSub.textContent = `Score ${pts} · ${Math.floor(coins)} cans · combo ×${combo}`;
    }
    if (this.finalStats) {
      this.finalStats.textContent = `${dist} m run · best combo ever ×${runBestCombo} · high ${best}`;
    }
    if (this.finalTopScores && meta.topScores?.length) {
      this.finalTopScores.textContent = `Top 3: ${meta.topScores.map((s) => Math.floor(s)).join(' · ')}`;
      this.finalTopScores.classList.remove('hidden');
    } else if (this.finalTopScores) {
      this.finalTopScores.classList.add('hidden');
    }
    if (this.finalCompare) {
      const high = best;
      const diff = high - pts;
      if (high > 0) {
        this.finalCompare.textContent =
          diff > 0 ? `${diff} pts from your best (${high})` : 'NEW HIGH SCORE!';
        this.finalCompare.classList.remove('hidden');
      } else {
        this.finalCompare.classList.add('hidden');
      }
    }
    if (this.finalSoClose) {
      const show =
        meta.soClose ||
        meta.diedDuringRush ||
        (meta.highScore > 0 && score >= meta.highScore * 0.9 && score < meta.highScore);
      this.finalSoClose.classList.toggle('hidden', !show);
      if (show && meta.diedDuringRush) {
        this.finalSoClose.textContent = 'RUSH ENDED — SO CLOSE!';
      } else if (show) {
        this.finalSoClose.textContent = 'SO CLOSE!';
      }
    }
    this.gameOverOverlay?.classList.remove('hidden');
    this.hud?.classList.add('dimmed');
  }

  updateFizz(level, rushActive) {
    if (this.fizzFill) this.fizzFill.style.width = `${Math.round(level * 100)}%`;
    if (this.fizzRush) this.fizzRush.classList.toggle('hidden', !rushActive);
    const track = this.fizzFill?.parentElement;
    if (track) {
      track.classList.toggle('rush-hot', rushActive);
      track.classList.toggle(
        'rush-ready',
        !rushActive && level >= FIZZ.readyPulseAt
      );
    }
    if (this.rushWash) {
      this.rushWash.classList.toggle('active', rushActive);
    }
  }

  updateMissions(missions) {
    if (!this.missionsEl) return;
    this.missionsEl.innerHTML = '';
    for (const m of missions) {
      const chip = document.createElement('div');
      chip.className = 'mission-chip' + (m.done ? ' done' : '');
      const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
      chip.textContent = m.done ? `✓ ${m.label}` : `${m.label} ${pct}%`;
      this.missionsEl.appendChild(chip);
    }
  }

  shoutCombo(combo) {
    if (!this.comboShout) return;
    let text = '';
    if (combo >= SCORE.shoutPerfect) text = 'PEPSI PERFECT';
    else if (combo >= SCORE.shoutWow) text = 'WOW';
    else if (combo >= SCORE.shoutNice) text = 'NICE';
    if (!text) return;
    this.comboShout.textContent = text;
    this.comboShout.classList.remove('show');
    void this.comboShout.offsetWidth;
    this.comboShout.classList.add('show');
  }

  floatMission(label) {
    if (!this.floatLayer) return;
    const wrap = document.createElement('div');
    wrap.className = 'float-pickup near-miss';
    wrap.classList.add('right');
    const labelEl = document.createElement('div');
    labelEl.className = 'float-can-label';
    labelEl.textContent = `MISSION: ${label}`;
    wrap.appendChild(labelEl);
    this.floatLayer.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('rise'));
    setTimeout(() => wrap.remove(), 900);
  }

  floatRush() {
    if (!this.floatLayer) return;
    const wrap = document.createElement('div');
    wrap.className = 'float-pickup';
    wrap.classList.add('left');
    const label = document.createElement('div');
    label.className = 'float-can-label hot';
    label.textContent = 'PEPSI RUSH!';
    wrap.appendChild(label);
    this.floatLayer.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('rise'));
    setTimeout(() => wrap.remove(), 1100);
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

  floatNiceTry() {
    if (!this.floatLayer) return;
    const wrap = document.createElement('div');
    wrap.className = 'float-pickup near-miss';
    wrap.classList.add('left');

    const label = document.createElement('div');
    label.className = 'float-can-label';
    label.textContent = 'NICE TRY';

    wrap.appendChild(label);
    this.floatLayer.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('rise'));
    setTimeout(() => wrap.remove(), 900);
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
    this.enqueueTutorialCue(action);
  }

  /** Queue a tutorial cue — only one owns #tutorial-hint until its lifecycle completes. */
  enqueueTutorialCue(action, kind = null) {
    if (!action || action === 'fade') return;
    if (action === 'ready' && this._shouldDropReady()) return;
    this._cueQueue.push({ action, kind });
    this._drainCueQueue();
  }

  _shouldDropReady() {
    const verb = (a) => a === 'slide' || a === 'jump';
    if (this._cueActive) {
      const a = this._cueActive.action;
      if (verb(a) || a === 'again' || a === 'ready') return true;
    }
    if (this._cueQueue.some((c) => c.action === 'ready')) return true;
    if (this._cueQueue.some((c) => verb(c.action))) return true;
    return false;
  }

  _isVerb(action) {
    return action === 'slide' || action === 'jump';
  }

  _holdMs(action) {
    if (action === 'ready') return SPAWN.tutorialHintReadyBeforeVerbSec * 1000;
    if (action === 'again') return SPAWN.tutorialHintRetryBeatSec * 1000;
    return SPAWN.tutorialHintVerbVisibleSec * 1000;
  }

  _fadeAfter(action) {
    return this._isVerb(action);
  }

  _drainCueQueue() {
    if (this._cueActive) return;
    const next = this._cueQueue.shift();
    if (!next) {
      this._notifyCueIdle();
      return;
    }
    this._startCue(next.action, next.kind);
  }

  _startCue(action, kind) {
    if (!this.tutorialHint) return;
    const gen = ++this._cueGen;
    this._cueActive = { action, kind, gen };
    this._tutorialHintAction = action;
    this._tutorialHintDismissed = false;

    const isReady = action === 'ready';
    const isAgain = action === 'again';
    const isSlide = action === 'slide';
    const label = isReady ? 'GET READY' : isAgain ? 'AGAIN' : isSlide ? 'SLIDE' : 'JUMP';
    const arrow = isReady || isAgain ? '' : isSlide ? '↓' : '↑';
    this.tutorialHint.textContent = arrow ? `${arrow} ${label}` : label;
    this.tutorialHint.classList.remove(
      'hidden',
      'slide',
      'jump',
      'ready',
      'again',
      'flash',
      'hold',
      'pop',
      'fade-out'
    );
    const tone = isReady || isAgain ? (isAgain ? 'again' : 'ready') : isSlide ? 'slide' : 'jump';
    this.tutorialHint.classList.add('hold', tone, 'pop');
    this.tutorialHint.setAttribute('aria-hidden', 'false');
    void this.tutorialHint.offsetWidth;

    const popMs = SPAWN.tutorialHintVerbPopSec * 1000;
    const holdMs = this._holdMs(action);
    const fadeMs = this._fadeAfter(action) ? SPAWN.tutorialHintVerbFadeSec * 1000 : 0;

    this._clearCueTimers();

    const startHoldClock = () => {
      if (this._cueActive?.gen !== gen) return;
      this._cueActive.holdSettledAt = performance.now();
      this._cueTimers.hold = setTimeout(() => {
        if (this._cueActive?.gen !== gen) return;
        if (fadeMs > 0) this._beginCueFade(gen, fadeMs);
        else this._finishCue(gen);
      }, holdMs);
    };

    let holdClockStarted = false;
    const onPopSettled = () => {
      if (holdClockStarted || this._cueActive?.gen !== gen) return;
      holdClockStarted = true;
      this.tutorialHint?.removeEventListener('animationend', onPopSettled);
      clearTimeout(this._cueTimers.pop);
      this._cueTimers.pop = null;
      startHoldClock();
    };

    this.tutorialHint.addEventListener('animationend', onPopSettled);
    // Wall-clock fallback if animationend does not fire (e.g. reduced motion).
    this._cueTimers.pop = setTimeout(onPopSettled, popMs + 32);
  }

  _beginCueFade(gen, fadeMs) {
    if (!this.tutorialHint || this._cueActive?.gen !== gen) return;
    this.tutorialHint.classList.remove('hold', 'pop');
    this.tutorialHint.classList.add('fade-out');
    clearTimeout(this._cueTimers.fade);
    this._cueTimers.fade = setTimeout(() => this._finishCue(gen), fadeMs + 50);
  }

  _finishCue(gen) {
    if (this._cueActive?.gen !== gen) return;
    const { action, kind } = this._cueActive;
    this._cueActive = null;
    this._tutorialHintAction = null;
    this._hideCueDOM();
    this._onCueComplete?.(action, kind);
    this._drainCueQueue();
  }

  _hideCueDOM() {
    if (!this.tutorialHint) return;
    this.tutorialHint.style.transition = 'none';
    this.tutorialHint.textContent = '';
    this.tutorialHint.classList.add('hidden');
    this.tutorialHint.classList.remove(
      'hold',
      'pop',
      'flash',
      'fade-out',
      'slide',
      'jump',
      'ready',
      'again'
    );
    this.tutorialHint.setAttribute('aria-hidden', 'true');
    void this.tutorialHint.offsetWidth;
    this.tutorialHint.style.transition = '';
  }

  _clearCueTimers() {
    clearTimeout(this._cueTimers.pop);
    clearTimeout(this._cueTimers.hold);
    clearTimeout(this._cueTimers.fade);
    this._cueTimers.pop = null;
    this._cueTimers.hold = null;
    this._cueTimers.fade = null;
  }

  isCueBusy() {
    return Boolean(this._cueActive) || this._cueQueue.length > 0;
  }

  whenCueIdle(cb) {
    if (!this.isCueBusy()) {
      cb();
      return;
    }
    this._cueIdleWaiters.push(cb);
  }

  _notifyCueIdle() {
    if (this.isCueBusy()) return;
    const waiters = this._cueIdleWaiters.splice(0);
    for (const cb of waiters) cb();
  }

  /** @deprecated Use enqueueTutorialCue */
  setTutorialHint(action) {
    this.enqueueTutorialCue(action);
  }

  /** @deprecated Lifecycle owned by cue queue */
  fadeTutorialHint() {}

  clearTutorialHint() {
    if (!this.tutorialHint) return;
    this._cueGen++;
    this._cueQueue = [];
    this._cueActive = null;
    this._tutorialHintAction = null;
    this._tutorialHintDismissed = true;
    this._clearCueTimers();
    this._hideCueDOM();
    this._notifyCueIdle();
  }

  isTutorialHintVisible() {
    return Boolean(this._cueActive);
  }

  matchesTutorialAction(action) {
    if (!this._cueActive) return false;
    if (action === 'slide') return this._cueActive.action === 'slide';
    if (action === 'jump') return this._cueActive.action === 'jump';
    return false;
  }

  /** @deprecated Use enqueueTutorialCue via obstacle callback */
  scheduleTutorialHint(action, delayMs) {
    clearTimeout(this._tutorialHintChainTimer);
    this._tutorialHintChainTimer = setTimeout(() => {
      this._tutorialHintChainTimer = null;
      this.enqueueTutorialCue(action);
    }, delayMs);
  }

  _showTutorialHint(action) {
    this.enqueueTutorialCue(action);
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
      this.speedBar.classList.toggle('rush', stats.rushActive);
    }

    if (stats.fizzLevel != null) {
      this.updateFizz(stats.fizzLevel, stats.rushActive);
      if (this.scoreEl && stats.rushActive) {
        this.scoreEl.classList.add('rush-mult');
      } else {
        this.scoreEl?.classList.remove('rush-mult');
      }
    }
    if (stats.missions) this.updateMissions(stats.missions);

    if (this._comboPopTimer > 0) {
      this._comboPopTimer -= dt;
      if (this._comboPopTimer <= 0) this.comboWrap?.classList.remove('pop');
    }
  }

  resetHudAnim() {
    this._prevCombo = 1;
    this._comboPopTimer = 0;
    this._tutorialHintAction = null;
    this._tutorialHintDismissed = false;
    this.clearTutorialHint();
  }
}
