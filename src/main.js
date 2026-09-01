const canvas = document.getElementById('game-canvas');
if (!canvas) {
  throw new Error('Missing #game-canvas');
}

function showBootError(err) {
  const overlay = document.getElementById('overlay-start');
  const btn = document.getElementById('btn-start');
  if (overlay) overlay.classList.remove('hidden');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Boot failed';
  }
  const panel = overlay?.querySelector('.panel');
  if (panel) {
    const msg = document.createElement('p');
    msg.className = 'boot-error';
    msg.style.color = '#ff6b6b';
    msg.textContent = `Failed to start: ${err?.message ?? err}`;
    panel.prepend(msg);
  }
  console.error('Pepsiman Runner boot failed', err);
}

let bootFailed = false;
function onBootError(err) {
  if (bootFailed) return;
  bootFailed = true;
  showBootError(err);
}

window.addEventListener('error', (ev) => {
  onBootError(ev.error ?? new Error(ev.message));
});
window.addEventListener('unhandledrejection', (ev) => {
  onBootError(ev.reason);
});

let game;
import('./game/Game.js')
  .then(({ Game }) => {
    try {
      game = new Game(canvas);
      window.__pepsimanGame = game;
      console.info('Pepsiman Runner ready — click Start Run');
    } catch (err) {
      onBootError(err);
    }
  })
  .catch(onBootError);
