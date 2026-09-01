/**
 * Lightweight cue-queue regression checks (no browser required).
 * Run: node scripts/test-cue-queue.mjs
 */
import { SPAWN } from '../src/game/constants.js';

// Minimal DOM shim for UI cue queue
function makeEl() {
  return {
    textContent: '',
    classList: {
      _c: new Set(['hidden']),
      remove(...cls) {
        for (const c of cls) this._c.delete(c);
      },
      add(...cls) {
        for (const c of cls) this._c.add(c);
      },
      contains(c) {
        return this._c.has(c);
      },
      toggle() {},
    },
    style: { transition: '' },
    offsetWidth: 0,
    setAttribute() {},
    getAttribute: () => null,
  };
}

class CueQueueHarness {
  constructor() {
    this.tutorialHint = makeEl();
    this._cueQueue = [];
    this._cueActive = null;
    this._cueGen = 0;
    this._cueTimers = { hold: null, fade: null };
    this._cueIdleWaiters = [];
    this._onCueComplete = null;
    this._tutorialHintAction = null;
    this.completed = [];
    this.now = 0;
  }

  tick(ms) {
    this.now += ms;
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

  enqueueTutorialCue(action, kind = null) {
    if (!action || action === 'fade') return;
    if (action === 'ready' && this._shouldDropReady()) return;
    this._cueQueue.push({ action, kind });
    this._drainCueQueue();
  }

  _holdMs(action) {
    if (action === 'ready') return SPAWN.tutorialHintReadyBeforeVerbSec * 1000;
    if (action === 'again') return SPAWN.tutorialHintRetryBeatSec * 1000;
    return SPAWN.tutorialHintVerbVisibleSec * 1000;
  }

  _fadeAfter(action) {
    return action === 'slide' || action === 'jump';
  }

  _drainCueQueue() {
    if (this._cueActive) return;
    const next = this._cueQueue.shift();
    if (!next) return;
    this._startCue(next.action, next.kind);
  }

  _startCue(action, kind) {
    const gen = ++this._cueGen;
    this._cueActive = { action, kind, gen, startedAt: this.now };
    this._tutorialHintAction = action;
    this.tutorialHint.textContent = action === 'slide' ? '↓ SLIDE' : action;
    this.tutorialHint.classList.remove('hidden');
    const pop = SPAWN.tutorialHintVerbPopSec * 1000;
    const hold = this._holdMs(action);
    const fade = this._fadeAfter(action) ? SPAWN.tutorialHintVerbFadeSec * 1000 : 0;
    this._cueActive.endsAt = this.now + pop + hold + fade;
    this._cueActive.holdEndsAt = this.now + pop + hold;
    setTimeout(() => {
      if (this._cueActive?.gen !== gen) return;
      if (fade > 0) {
        this._cueActive.fading = true;
        setTimeout(() => this._finishCue(gen), fade + 50);
      } else this._finishCue(gen);
    }, pop + hold + 16);
  }

  _finishCue(gen) {
    if (this._cueActive?.gen !== gen) return;
    const { action, kind } = this._cueActive;
    this.completed.push({ action, kind, at: this.now });
    this._cueActive = null;
    this._tutorialHintAction = null;
    this.tutorialHint.textContent = '';
    this.tutorialHint.classList.add('hidden');
    this._onCueComplete?.(action, kind);
    this._drainCueQueue();
  }

  isCueBusy() {
    return Boolean(this._cueActive) || this._cueQueue.length > 0;
  }

  clearTutorialHint() {
    this._cueGen++;
    this._cueQueue = [];
    this._cueActive = null;
    this._tutorialHintAction = null;
    this.tutorialHint.textContent = '';
    this.tutorialHint.classList.add('hidden');
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testVerbHold() {
  const q = new CueQueueHarness();
  q.enqueueTutorialCue('slide', 'rail');
  const holdMs = SPAWN.tutorialHintVerbPopSec * 1000 + SPAWN.tutorialHintVerbVisibleSec * 1000;
  await sleep(holdMs - 50);
  assert(q._cueActive?.action === 'slide', 'slide should still be active before hold ends');
  assert(q.tutorialHint.textContent.includes('SLIDE'), 'slide text visible during hold');
  await sleep(500);
  assert(q.completed.some((c) => c.action === 'slide'), 'slide should complete after hold+fade');
  assert(q.tutorialHint.textContent === '', 'textContent cleared after cue');
  console.log('PASS verb hold >= 1.6s and text cleared');
}

async function testNoPreemption() {
  const q = new CueQueueHarness();
  q.enqueueTutorialCue('again', 'rail');
  q.enqueueTutorialCue('ready', 'sign'); // should drop
  q.enqueueTutorialCue('slide', 'rail');
  await sleep(50);
  assert(q._cueActive?.action === 'again', 'again owns hint first');
  const againMs =
    SPAWN.tutorialHintVerbPopSec * 1000 + SPAWN.tutorialHintRetryBeatSec * 1000 + 50;
  await sleep(againMs);
  assert(q.completed[0]?.action === 'again', 'again completes before slide');
  assert(q._cueActive?.action === 'slide', 'slide follows without ready interrupt');
  console.log('PASS queue ordering: AGAIN → SLIDE, GET READY dropped');
}

async function testGraceSequence() {
  const q = new CueQueueHarness();
  const events = [];
  q._onCueComplete = (a, k) => events.push(a);
  q.enqueueTutorialCue('slide', 'rail');
  await sleep(
    (SPAWN.tutorialHintVerbPopSec + SPAWN.tutorialHintVerbVisibleSec + SPAWN.tutorialHintVerbFadeSec) *
      1000 +
      100
  );
  q.enqueueTutorialCue('again', 'rail');
  q.enqueueTutorialCue('slide', 'rail');
  await sleep(50);
  assert(q._cueActive?.action === 'again', 'grace AGAIN starts after prior slide finished');
  await sleep(
    (SPAWN.tutorialHintVerbPopSec + SPAWN.tutorialHintRetryBeatSec) * 1000 + 100
  );
  assert(q._cueActive?.action === 'slide', 'grace SLIDE follows AGAIN');
  console.log('PASS grace path AGAIN then verb queued');
}

async function testClearOnDismiss() {
  const q = new CueQueueHarness();
  q.enqueueTutorialCue('jump', 'sign');
  q.clearTutorialHint();
  assert(q.tutorialHint.textContent === '', 'clearTutorialHint empties textContent');
  assert(!q.isCueBusy(), 'queue idle after clear');
  console.log('PASS clearTutorialHint clears textContent');
}

(async () => {
  await testVerbHold();
  await testNoPreemption();
  await testGraceSequence();
  await testClearOnDismiss();
  console.log('\nAll cue-queue checks passed.');
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
