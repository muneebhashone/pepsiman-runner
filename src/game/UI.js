export class UI {
  constructor() {
    this.scoreEl = document.getElementById('hud-score');
    this.coinsEl = document.getElementById('hud-coins');
    this.comboEl = document.getElementById('hud-combo');
    this.comboWrap = document.getElementById('hud-combo-wrap');
    this.speedEl = document.getElementById('hud-speed');
    this.speedBar = document.getElementById('hud-speed-bar');
    this.startOverlay = document.getElementById('overlay-start');
    this.gameOverOverlay = document.getElementById('overlay-gameover');
    this.finalScore = document.getElementById('final-score');
    this.finalSub = document.getElementById('final-sub');
    this.btnStart = document.getElementById('btn-start');
    this.btnRetry = document.getElementById('btn-retry');
    this._onStart = null;
    this._onRetry = null;
    this.btnStart?.addEventListener('click', () => this._onStart?.());
    this.btnRetry?.addEventListener('click', () => this._onRetry?.());
  }

  onStart(fn) {
    this._onStart = fn;
  }

  onRetry(fn) {
    this._onRetry = fn;
  }

  showStart() {
    this.startOverlay?.classList.remove('hidden');
    this.gameOverOverlay?.classList.add('hidden');
  }

  hideOverlays() {
    this.startOverlay?.classList.add('hidden');
    this.gameOverOverlay?.classList.add('hidden');
  }

  showGameOver(score, coins, bestCombo) {
    if (this.finalScore) this.finalScore.textContent = String(Math.floor(score));
    if (this.finalSub) {
      this.finalSub.textContent = `${coins} cans · best combo x${bestCombo}`;
    }
    this.gameOverOverlay?.classList.remove('hidden');
  }

  update(stats) {
    if (this.scoreEl) this.scoreEl.textContent = String(Math.floor(stats.score));
    if (this.coinsEl) this.coinsEl.textContent = String(stats.coins);
    if (this.comboEl) this.comboEl.textContent = `x${stats.combo}`;
    if (this.comboWrap) {
      this.comboWrap.classList.toggle('hot', stats.combo >= 3);
    }
    if (this.speedEl) this.speedEl.textContent = String(Math.round(stats.speed));
    if (this.speedBar) {
      const pct = Math.max(8, Math.min(100, stats.speedNorm * 100));
      this.speedBar.style.width = `${pct}%`;
    }
  }
}
