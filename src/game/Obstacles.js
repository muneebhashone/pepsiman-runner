import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, LANES, SPAWN, WORLD, PLAYER, NEAR_MISS } from './constants.js';

const TYPES = ['barrier', 'rail', 'sign', 'truck', 'barrel', 'pepsiWide', 'mover', 'ramp'];
const WARMUP_TYPES = ['rail', 'sign'];
const BLOCK_TYPES = ['truck', 'pepsiWide', 'mover'];
const POOL_SIZE = 48;

/** Forced post-tutorial rotation — every colliding verb appears before weights matter */
const ROTATION_TABLE = [
  { kind: 'single', type: 'barrier' },
  { kind: 'single', type: 'rail' },
  { kind: 'single', type: 'sign' },
  { kind: 'single', type: 'truck' },
  { kind: 'barrelChain' },
  { kind: 'pepsiWide' },
  { kind: 'single', type: 'mover' },
  { kind: 'single', type: 'ramp' },
  { kind: 'combo', types: ['rail', 'barrier'], gap: 0.25 },
  { kind: 'single', type: 'barrier' },
  { kind: 'single', type: 'sign' },
  { kind: 'single', type: 'truck' },
  { kind: 'barrelChain' },
  { kind: 'single', type: 'mover' },
  { kind: 'single', type: 'ramp' },
  { kind: 'combo', types: ['sign', 'rail'], gap: 5.8 },
  { kind: 'pepsiWide' },
  { kind: 'single', type: 'rail' },
  { kind: 'single', type: 'truck' },
  { kind: 'combo', types: ['ramp', 'barrel'], gap: 0.2 },
];

function actionMode(type) {
  if (type === 'rail') return 'slide';
  if (type === 'ramp') return 'ramp';
  if (BLOCK_TYPES.includes(type)) return 'block';
  return 'jump';
}

function speedNorm(speed) {
  return Math.min(1, (speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase));
}

function pickLanes(n, rng) {
  const lanes = [0, 1, 2];
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  return lanes.slice(0, n);
}

function pickVerticalType(rng) {
  const roll = rng();
  if (roll < 0.5) return 'rail';
  if (roll < 0.82) return 'sign';
  return 'barrier';
}

const TUTORIAL_LANE = 1;
const POST_WARMUP_SEQUENCE = ['rail', 'sign', 'rail', 'sign', 'rail', 'sign', 'rail', 'sign'];

function typeForLane(lane, openLane, rng, warmup, warmupIndex = 0) {
  if (warmup) return WARMUP_TYPES[warmupIndex % WARMUP_TYPES.length];
  if (lane === openLane) {
    if (rng() < SPAWN.verticalObstacleBias) return pickVerticalType(rng);
    return TYPES[(rng() * TYPES.length) | 0];
  }
  if (rng() < SPAWN.verticalObstacleBias * 0.85) return pickVerticalType(rng);
  const blockTypes = ['barrier', 'truck', 'sign', 'rail'];
  return blockTypes[(rng() * blockTypes.length) | 0];
}

const SLIDE_TYPES = ['rail'];

/** Red telegraph only for hazards that kill on contact; slide rails use magenta accent */
function telegraphColorsFor(type) {
  const core = COLORS.pepsiRed;
  const glow = SLIDE_TYPES.includes(type) ? COLORS.telegraphSlideGlow : COLORS.telegraphGlow;
  return { core, glow };
}

function makeTelegraphMat(color, opacity = 0) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  return mat;
}

function makeTelegraphGlowMat(color, opacity = 0) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  return mat;
}

function layFlatOnRoad(mesh) {
  mesh.rotation.set(-Math.PI / 2, 0, 0);
}

function setTelMaterial(mesh, color, glow = false) {
  if (mesh.material?.dispose) mesh.material.dispose();
  mesh.material = glow ? makeTelegraphGlowMat(color) : makeTelegraphMat(color);
}

function chevronGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.38, 0);
  shape.lineTo(0, 0.5);
  shape.lineTo(0.38, 0);
  shape.lineTo(0.2, 0);
  shape.lineTo(0, 0.24);
  shape.lineTo(-0.2, 0);
  shape.lineTo(-0.38, 0);
  return new THREE.ShapeGeometry(shape);
}

export class Obstacles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.pool = [];
    this.telPool = [];
    this.telOuterPool = [];
    this.shadowPool = [];
    this.chevronPool = [];
    this.nextZ = SPAWN.runwayZ;
    this.patternsSpawned = 0;
    this.postWarmupPatterns = 0;
    this.rotationIndex = 0;
    this.spawnHistory = [];
    this._rotationLogged = false;
    this._nearMissCooldown = 0;
    this._pulseT = 0;
    this._rng = Math.random;
    this._hintSlideShown = false;
    this._hintJumpShown = false;
    this._getReadyRailShown = false;
    this._getReadySignShown = false;
    this._spawnedFirstTutorialRail = false;
    this._spawnedFirstTutorialSign = false;
    this._railHintState = 'idle';
    this._signHintState = 'idle';
    this._railReadyStartMs = 0;
    this._signReadyStartMs = 0;
    this._railVerbStartMs = 0;
    this._signVerbStartMs = 0;
    this._railVerbFading = false;
    this._signVerbFading = false;
    this._graceSlideUsed = false;
    this._graceJumpUsed = false;
    this._pendingGraceRetry = null;
    this._graceRetryTimer = null;
    this._lastPlayerZ = 0;
    this._lastSpeed = 0;
    this._onTutorialHint = null;
    this._onTutorialGrace = null;
    this._cueGate = null;

    this._geo = {
      barrier: new THREE.BoxGeometry(1.75, 1.25, 0.55),
      rail: new THREE.BoxGeometry(2.1, 0.28, 1.15),
      sign: new THREE.BoxGeometry(1.85, 1.05, 0.5),
      truckCab: new THREE.BoxGeometry(2.05, 1.75, 1.55),
      truckBody: new THREE.BoxGeometry(2.15, 2.25, 3.6),
      barrelRoll: new THREE.CylinderGeometry(0.42, 0.42, 1.1, 10),
      wideBody: new THREE.BoxGeometry(3.2, 2.1, 1.2),
      ramp: new THREE.BoxGeometry(2.2, 0.35, 2.4),
      wheel: new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8),
      tel: new THREE.PlaneGeometry(SPAWN.telegraphStripWidth, SPAWN.telegraphStripLength),
      telOuter: new THREE.PlaneGeometry(
        SPAWN.telegraphStripWidth * 1.18,
        SPAWN.telegraphStripLength * 1.12
      ),
      shadow: new THREE.PlaneGeometry(1.3, 1.8),
      chevron: chevronGeometry(),
    };
    this._mats = {
      barrier: new THREE.MeshStandardMaterial({
        color: COLORS.barrier,
        emissive: COLORS.barrier,
        emissiveIntensity: 0.35,
        metalness: 0.35,
        roughness: 0.4,
      }),
      railDark: new THREE.MeshStandardMaterial({
        color: 0x1a2228,
        metalness: 0.55,
        roughness: 0.45,
        emissive: 0x0a1018,
        emissiveIntensity: 0.15,
      }),
      rail: new THREE.MeshStandardMaterial({
        color: COLORS.rail,
        metalness: 0.7,
        roughness: 0.3,
        emissive: 0x334455,
        emissiveIntensity: 0.2,
      }),
      sign: new THREE.MeshStandardMaterial({
        color: COLORS.sign,
        emissive: COLORS.sign,
        emissiveIntensity: 0.25,
        metalness: 0.15,
        roughness: 0.55,
      }),
      signFrame: new THREE.MeshStandardMaterial({
        color: COLORS.signFrame,
        emissive: COLORS.signFrame,
        emissiveIntensity: 0.55,
        metalness: 0.35,
        roughness: 0.4,
      }),
      truckCab: new THREE.MeshStandardMaterial({
        color: COLORS.truckCab,
        metalness: 0.55,
        roughness: 0.3,
      }),
      truckBody: new THREE.MeshStandardMaterial({
        color: 0xd8e4f8,
        emissive: COLORS.pepsiBlue,
        emissiveIntensity: 0.15,
        metalness: 0.5,
        roughness: 0.35,
      }),
      barrel: new THREE.MeshStandardMaterial({
        color: COLORS.pepsiRed,
        emissive: COLORS.pepsiRed,
        emissiveIntensity: 0.35,
        metalness: 0.45,
        roughness: 0.35,
      }),
      wideTruck: new THREE.MeshStandardMaterial({
        color: COLORS.truckTrailer,
        emissive: COLORS.pepsiRed,
        emissiveIntensity: 0.28,
        metalness: 0.5,
        roughness: 0.32,
      }),
      ramp: new THREE.MeshStandardMaterial({
        color: COLORS.neonCyan,
        emissive: COLORS.neonCyan,
        emissiveIntensity: 0.55,
        metalness: 0.35,
        roughness: 0.28,
      }),
      wheel: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }),
      stripe: new THREE.MeshStandardMaterial({ color: 0x111111 }),
      railStripe: new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xffaa00,
        emissiveIntensity: 0.85,
      }),
      railStripeDark: new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: 0x050505,
        emissiveIntensity: 0.2,
      }),
      signTop: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.65,
      }),
      signFace: new THREE.MeshStandardMaterial({
        color: 0xf8fbff,
        emissive: 0xd0e8ff,
        emissiveIntensity: 0.55,
        metalness: 0.05,
        roughness: 0.35,
      }),
      signPole: new THREE.MeshStandardMaterial({
        color: 0x556677,
        metalness: 0.6,
        roughness: 0.35,
      }),
      telegraph: makeTelegraphMat(COLORS.telegraph),
      telegraphOuter: makeTelegraphGlowMat(COLORS.telegraphGlow),
      shadow: new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    };

    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new THREE.Group();
      mesh.visible = false;
      this.scene.add(mesh);
      this.pool.push(mesh);

      const tel = new THREE.Mesh(this._geo.tel, makeTelegraphMat(COLORS.pepsiRed));
      layFlatOnRoad(tel);
      tel.visible = false;
      tel.frustumCulled = false;
      tel.renderOrder = 48;
      this.scene.add(tel);
      this.telPool.push(tel);

      const telOuter = new THREE.Mesh(this._geo.telOuter, makeTelegraphGlowMat(COLORS.telegraphGlow));
      layFlatOnRoad(telOuter);
      telOuter.visible = false;
      telOuter.frustumCulled = false;
      telOuter.renderOrder = 47;
      this.scene.add(telOuter);
      this.telOuterPool.push(telOuter);

      const sh = new THREE.Mesh(this._geo.shadow, this._mats.shadow.clone());
      layFlatOnRoad(sh);
      sh.visible = false;
      sh.frustumCulled = false;
      this.scene.add(sh);
      this.shadowPool.push(sh);
    }

    const chevCount = POOL_SIZE * SPAWN.telegraphChevronCount;
    for (let i = 0; i < chevCount; i++) {
      const chev = new THREE.Mesh(this._geo.chevron, makeTelegraphMat(COLORS.pepsiRed));
      layFlatOnRoad(chev);
      chev.visible = false;
      chev.frustumCulled = false;
      chev.renderOrder = 49;
      this.scene.add(chev);
      this.chevronPool.push(chev);
    }
  }

  setTutorialHintCallback(fn) {
    this._onTutorialHint = fn;
  }

  setTutorialGraceCallback(fn) {
    this._onTutorialGrace = fn;
  }

  setTutorialCueGate(gate) {
    this._cueGate = gate;
  }

  /** Advance per-kind state when the UI cue queue finishes a beat. */
  onTutorialCueComplete(action, kind) {
    const isRail = kind === 'rail';
    const stateKey = isRail ? '_railHintState' : '_signHintState';
    const fadeKey = isRail ? '_railVerbFading' : '_signVerbFading';

    if (action === 'ready' && this[stateKey] === 'ready') {
      this._enterTutorialVerb(isRail);
      if (isRail) this._hintSlideShown = true;
      else this._hintJumpShown = true;
      return;
    }
    if (action === 'again' && this[stateKey] === 'retryBeat') {
      this._enterTutorialVerb(isRail);
      return;
    }
    if (action === 'slide' && isRail && this[stateKey] === 'verb') {
      this[stateKey] = 'done';
      this[fadeKey] = false;
      return;
    }
    if (action === 'jump' && !isRail && this[stateKey] === 'verb') {
      this[stateKey] = 'done';
      this[fadeKey] = false;
    }
  }

  _emitTutorialHint(action, kind) {
    if (action != null && action !== 'fade') {
      const isRail = kind === 'rail';
      const isSign = kind === 'sign';
      if (action === 'slide' || (action === 'ready' && isRail)) {
        if (this._railHintState === 'done') return;
      }
      if (action === 'jump' || (action === 'ready' && isSign)) {
        if (this._signHintState === 'done') return;
      }
      if (action === 'again') {
        const forRail = isRail && this._railHintState === 'retryBeat';
        const forSign = isSign && this._signHintState === 'retryBeat';
        if (!forRail && !forSign) return;
      }
    }
    this._onTutorialHint?.(action, kind);
  }

  /** Re-flash verb hint after tutorial grace (bypasses one-shot shown guard). */
  _scheduleGraceRetry(kind) {
    const isRail = kind === 'rail';
    const stateKey = isRail ? '_railHintState' : '_signHintState';
    const readyMsKey = isRail ? '_railReadyStartMs' : '_signReadyStartMs';
    const fadeKey = isRail ? '_railVerbFading' : '_signVerbFading';

    this[stateKey] = 'retryBeat';
    this[readyMsKey] = performance.now();
    this[fadeKey] = false;
    this._emitTutorialHint('again', kind);
  }

  /** Let the current cue finish before showing AGAIN. */
  _queueGraceRetry(kind) {
    clearTimeout(this._graceRetryTimer);
    this._pendingGraceRetry = kind;
    if (this._cueGate?.isBusy?.()) {
      this._cueGate.whenIdle(() => this._flushGraceRetry());
      return;
    }
    this._flushGraceRetry();
  }

  _flushGraceRetry() {
    const kind = this._pendingGraceRetry;
    this._pendingGraceRetry = null;
    this._graceRetryTimer = null;
    if (!kind) return;
    this._scheduleGraceRetry(kind);
  }

  _firstTutorialTtc(isRail) {
    const playerZ = this._lastPlayerZ;
    const speed = this._lastSpeed;
    if (playerZ == null || speed <= 0.1) return null;
    for (const it of this.items) {
      if (!it.alive) continue;
      if (isRail ? it.isFirstTutorialRail : it.isFirstTutorialSign) {
        const dist = it.z - playerZ;
        if (dist > 0) return dist / speed;
        return 0;
      }
    }
    return null;
  }

  _markTutorialDone(isRail) {
    const stateKey = isRail ? '_railHintState' : '_signHintState';
    const fadeKey = isRail ? '_railVerbFading' : '_signVerbFading';
    this[stateKey] = 'done';
    this[fadeKey] = false;
    return true;
  }

  /** True when correct input should dismiss the on-screen tutorial cue. */
  canDismissTutorialOnInput(kind) {
    const isRail = kind === 'slide';
    const stateKey = isRail ? '_railHintState' : '_signHintState';
    const state = this[stateKey];
    return state === 'verb' || state === 'ready' || state === 'retryBeat';
  }

  markTutorialDismissed(kind) {
    const isRail = kind === 'slide';
    return this._markTutorialDone(isRail);
  }

  /** Dismiss when correct input or pose during any active first-tutorial window. */
  _tryDismissTutorial(kind) {
    const isRail = kind === 'slide';
    const stateKey = isRail ? '_railHintState' : '_signHintState';
    const state = this[stateKey];
    if (state === 'verb') return this._markTutorialDone(isRail);
    return false;
  }

  /** Timed GET READY → verb sequence for first tutorial rail/sign. */
  _updateFirstTutorialHint(kind, ttc) {
    const isRail = kind === 'rail';
    const stateKey = isRail ? '_railHintState' : '_signHintState';
    const readyMsKey = isRail ? '_railReadyStartMs' : '_signReadyStartMs';
    let state = this[stateKey];

    if (state === 'done') return;

    if (state === 'idle') {
      if (ttc > this._tutorialHintStartTtc()) return;
      this[stateKey] = 'ready';
      this[readyMsKey] = performance.now();
      if (isRail) this._getReadyRailShown = true;
      else this._getReadySignShown = true;
      this._emitTutorialHint('ready', kind);
      return;
    }

    // ready / retryBeat / verb lifecycles are driven by the UI cue queue callbacks.
  }

  _enterTutorialVerb(isRail) {
    const stateKey = isRail ? '_railHintState' : '_signHintState';
    const verbMsKey = isRail ? '_railVerbStartMs' : '_signVerbStartMs';
    const fadeKey = isRail ? '_railVerbFading' : '_signVerbFading';
    const kind = isRail ? 'rail' : 'sign';
    this[stateKey] = 'verb';
    this[verbMsKey] = performance.now();
    this[fadeKey] = false;
    this._emitTutorialHint(isRail ? 'slide' : 'jump', kind);
  }

  /** Dismiss on consumed input — only correct verb while its beat is active. */
  onTutorialInputConsumed(kind) {
    return this.canDismissTutorialOnInput(kind);
  }

  onTutorialCorrectAction(kind) {
    this._tryDismissTutorial(kind);
  }

  /** Dismiss if player is already in the correct pose when verb appears. */
  checkTutorialPoseDismiss(sliding, jumping, playerZ, speed) {
    this._lastPlayerZ = playerZ;
    this._lastSpeed = speed;
    if (sliding && this._railHintState === 'verb') return 'slide';
    if (jumping && this._signHintState === 'verb') return 'jump';
    return null;
  }

  _tutorialHintStartTtc() {
    return SPAWN.tutorialHintReadyStartSec + 0.35;
  }

  _minTutorialSpawnZ(playerZ, speed) {
    return playerZ + speed * SPAWN.tutorialHintMinSpawnTtcSec;
  }

  _jumpClearY(type) {
    return type === 'sign' ? 0.95 : 0.85;
  }

  _inTutorial(playerZ) {
    return (
      this._inWarmup(playerZ) ||
      this.postWarmupPatterns < SPAWN.postWarmupTutorialPatterns
    );
  }

  _countActiveBlockers(playerZ, range = 90) {
    let n = 0;
    for (const it of this.items) {
      if (!it.alive) continue;
      if (it.z > playerZ - 8 && it.z < playerZ + range) n++;
    }
    return n;
  }

  _inWarmup(playerZ) {
    return (
      playerZ < SPAWN.runwayZ ||
      playerZ < SPAWN.obstacleWarmupZ ||
      this.patternsSpawned < SPAWN.warmupPatternCount
    );
  }

  _pruneSpawnHistory(playerZ, speed) {
    const windowZ = speed * SPAWN.varietyWindowSec;
    const cutoff = playerZ - windowZ * 0.25;
    this.spawnHistory = this.spawnHistory.filter((h) => h.z > cutoff);
    while (this.spawnHistory.length > SPAWN.varietyHistorySize) {
      this.spawnHistory.shift();
    }
  }

  _recentModes() {
    const modes = new Set();
    for (const h of this.spawnHistory) modes.add(h.mode);
    return modes;
  }

  _recordSpawn(z, type) {
    this.spawnHistory.push({ z, type, mode: actionMode(type) });
    while (this.spawnHistory.length > SPAWN.varietyHistorySize) {
      this.spawnHistory.shift();
    }
  }

  _pickBlockedLane(rng) {
    return pickLanes(1, rng)[0];
  }

  _placeSingle(z, type, rng) {
    const blocked = this._pickBlockedLane(rng);
    const placed = this._acquire(type, blocked, z);
    if (!placed) return z;
    if (type === 'mover') this._initMoverSweep(placed, blocked, rng);
    this._recordSpawn(z, type);
    return z;
  }

  _initMoverSweep(item, startLane, rng) {
    const endLane = startLane === 0 ? 2 : startLane === 2 ? 0 : rng() > 0.5 ? 2 : 0;
    item.moverStartLane = startLane;
    item.moverEndLane = endLane;
    item.moverPhase = 0;
    item.lane = startLane;
  }

  _spawnBarrelChain(z, rng) {
    const blocked = this._pickBlockedLane(rng);
    const count = 2 + (rng() > 0.45 ? 1 : 0);
    const spacing = 4.2;
    let maxZ = z;
    for (let i = 0; i < count; i++) {
      const zz = z + i * spacing;
      const p = this._acquire('barrel', blocked, zz);
      if (p) {
        maxZ = Math.max(maxZ, zz);
        this._recordSpawn(zz, 'barrel');
      }
    }
    return maxZ;
  }

  /** Block two lanes — one open gap forces a lane read */
  _spawnPepsiWideGap(z, rng) {
    const open = (rng() * 3) | 0;
    let maxZ = z;
    for (let lane = 0; lane < 3; lane++) {
      if (lane === open) continue;
      const p = this._acquire('pepsiWide', lane, z);
      if (p) {
        maxZ = Math.max(maxZ, z);
        this._recordSpawn(z, 'pepsiWide');
      }
    }
    return maxZ;
  }

  _spawnCombo(z, types, gap, rng) {
    const blocked = this._pickBlockedLane(rng);
    let maxZ = z;
    for (let i = 0; i < types.length; i++) {
      const zz = z + (i === 0 ? 0 : gap);
      const p = this._acquire(types[i], blocked, zz);
      if (p) {
        maxZ = Math.max(maxZ, zz);
        if (types[i] === 'mover') this._initMoverSweep(p, blocked, rng);
        this._recordSpawn(zz, types[i]);
      }
    }
    return maxZ;
  }

  _spawnRotationEntry(z, entry) {
    const rng = this._rng;
    if (entry.kind === 'barrelChain') return this._spawnBarrelChain(z, rng);
    if (entry.kind === 'pepsiWide') return this._spawnPepsiWideGap(z, rng);
    if (entry.kind === 'combo') return this._spawnCombo(z, entry.types, entry.gap ?? 0.25, rng);
    return this._placeSingle(z, entry.type, rng);
  }

  _logRotationDebug() {
    if (this._rotationLogged) return;
    const recent = this.spawnHistory.slice(-SPAWN.rotationTableLength);
    const types = new Set(recent.map((h) => h.type));
    console.info(
      `[Obstacles] Post-tutorial rotation — ${types.size} distinct types in ${recent.length} spawns:`,
      [...types].sort().join(', ')
    );
    this._rotationLogged = true;
  }

  getRotationDistinctCount() {
    const recent = this.spawnHistory.slice(-SPAWN.rotationTableLength);
    return new Set(recent.map((h) => h.type)).size;
  }

  /** Force jump/slide/block variety within rolling window */
  _varietyType(rng, playerZ, speed) {
    const modes = this._recentModes();
    const needSlide = !modes.has('slide');
    const needJump = !modes.has('jump');
    const needBlock = !modes.has('block');
    if (needSlide && needJump) return rng() < 0.5 ? 'rail' : rng() < 0.6 ? 'sign' : 'barrel';
    if (needSlide) return 'rail';
    if (needJump) return rng() < 0.55 ? 'sign' : 'barrel';
    if (needBlock) return rng() < 0.45 ? 'truck' : rng() < 0.7 ? 'pepsiWide' : 'mover';
    const roll = rng();
    if (roll < 0.2) return 'rail';
    if (roll < 0.38) return 'sign';
    if (roll < 0.52) return 'barrel';
    if (roll < 0.66) return 'barrier';
    if (roll < 0.8) return 'truck';
    if (roll < 0.9) return 'pepsiWide';
    return rng() < 0.6 ? 'mover' : 'ramp';
  }

  /** Lanes without an obstacle near z (for collectible placement). */
  openLanesNear(z, tolerance = 5) {
    const blocked = new Set();
    for (const it of this.items) {
      if (!it.alive) continue;
      if (Math.abs(it.z - z) < tolerance) blocked.add(it.lane);
    }
    const open = [];
    for (let i = 0; i < LANES.length; i++) {
      if (!blocked.has(i)) open.push(i);
    }
    return open.length ? open : [1];
  }

  _ensureTelMesh(pool, geo, color, renderOrder, glow = false) {
    let mesh = pool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(geo, makeTelegraphMat(color));
      layFlatOnRoad(mesh);
      mesh.frustumCulled = false;
      mesh.renderOrder = renderOrder;
      this.scene.add(mesh);
    }
    setTelMaterial(mesh, color, glow);
    layFlatOnRoad(mesh);
    return mesh;
  }

  _ensureChevron(coreColor) {
    let chev = this.chevronPool.pop();
    if (!chev) {
      chev = new THREE.Mesh(this._geo.chevron, makeTelegraphMat(coreColor));
      layFlatOnRoad(chev);
      chev.frustumCulled = false;
      chev.renderOrder = 49;
      this.scene.add(chev);
    }
    setTelMaterial(chev, coreColor, false);
    layFlatOnRoad(chev);
    return chev;
  }

  _ensureItemTelegraphs(it) {
    const colors = it.telColors ?? telegraphColorsFor(it.type);
    it.telColors = colors;
    const laneX = LANES[it.lane];

    if (!it.tel) {
      it.tel = this._ensureTelMesh(this.telPool, this._geo.tel, colors.core, 48, false);
      it.tel.visible = false;
      this._applyTelColors(it.tel, colors);
    }
    if (!it.telOuter) {
      it.telOuter = this._ensureTelMesh(
        this.telOuterPool,
        this._geo.telOuter,
        colors.glow,
        47,
        true
      );
      it.telOuter.visible = false;
      this._applyTelOuterColors(it.telOuter, colors);
    }
    if (!it.chevrons?.length) {
      it.chevrons = [];
      for (let ci = 0; ci < SPAWN.telegraphChevronCount; ci++) {
        const chev = this._ensureChevron(colors.core);
        chev.visible = false;
        chev.position.set(laneX, 0.09, it.z);
        this._applyTelColors(chev, colors);
        it.chevrons.push(chev);
      }
    }
  }

  _applyTelColors(mesh, colors) {
    mesh.material.color.setHex(colors.core);
    mesh.material.opacity = 0;
  }

  _applyTelOuterColors(mesh, colors) {
    mesh.material.color.setHex(colors.glow);
    mesh.material.opacity = 0;
  }

  _buildMesh(type) {
    const g = new THREE.Group();
    let hit = { w: 1.0, h: 0.95, d: 0.45, y: 0.55, mode: 'block' };

    if (type === 'barrier') {
      // Striped mid-height block — jump over; never cylinder-shaped
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.35, 0.58), this._mats.stripe);
      base.position.y = 0.18;
      g.add(base);
      const m = new THREE.Mesh(this._geo.barrier, this._mats.barrier);
      m.position.y = 0.95;
      m.castShadow = true;
      g.add(m);
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.6), this._mats.stripe);
      s.position.y = 1.15;
      g.add(s);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.6), this._mats.railStripe);
      s2.position.y = 0.72;
      g.add(s2);
      hit = { w: 1.2, h: 1.05, d: 0.48, y: 0.95, mode: 'jump' };
    } else if (type === 'rail') {
      // Overhead hazard — tall posts + thick striped bar reads from far away
      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.85, 0.24), this._mats.railDark);
      postL.position.set(-1.18, 1.42, 0);
      const postR = postL.clone();
      postR.position.x = 1.18;
      g.add(postL, postR);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.58, 0.38), this._mats.railDark);
      bar.position.y = 2.72;
      bar.castShadow = true;
      g.add(bar);
      for (let si = 0; si < 7; si++) {
        const stripeMat = si % 2 === 0 ? this._mats.railStripe : this._mats.railStripeDark;
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.14), stripeMat);
        stripe.position.set(-1.02 + si * 0.34, 2.72, 0.24);
        g.add(stripe);
      }
      const hang = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.12, 0.16), this._mats.railDark);
      hang.position.y = 2.38;
      g.add(hang);
      hit = { w: 2.15, h: 0.52, d: 1.1, y: 2.72, mode: 'slide' };
    } else if (type === 'sign') {
      // Low vault sign — short poles, bright face, orange frame; distinct from overhead rail
      const poleL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.88, 0.18), this._mats.signPole);
      poleL.position.set(-0.92, 0.44, 0);
      const poleR = poleL.clone();
      poleR.position.x = 0.92;
      g.add(poleL, poleR);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.28, 0.18), this._mats.signFrame);
      frame.position.y = 0.98;
      g.add(frame);
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.1, 0.12), this._mats.sign);
      m.position.set(0, 0.98, 0.12);
      m.castShadow = true;
      g.add(m);
      const face = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.95, 0.08), this._mats.signFace);
      face.position.set(0, 0.98, 0.2);
      g.add(face);
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.18, 0.14), this._mats.signTop);
      top.position.y = 1.58;
      g.add(top);
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.14, 0.6), this._mats.signPole);
      base.position.y = 0.07;
      g.add(base);
      hit = { w: 1.85, h: 1.1, d: 0.45, y: 0.95, mode: 'jump' };
    } else if (type === 'barrel') {
      const barrel = new THREE.Mesh(this._geo.barrelRoll, this._mats.barrel);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.y = 0.42;
      barrel.castShadow = false;
      g.add(barrel);
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.44, 0.12, 10),
        this._mats.railStripe
      );
      band.rotation.z = Math.PI / 2;
      band.position.y = 0.42;
      g.add(band);
      hit = { w: 1.05, h: 0.9, d: 1.05, y: 0.42, mode: 'jump' };
    } else if (type === 'pepsiWide') {
      const body = new THREE.Mesh(this._geo.wideBody, this._mats.wideTruck);
      body.position.set(0, 1.15, 0);
      body.castShadow = false;
      g.add(body);
      const logo = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.9, 0.08),
        this._mats.truckBody
      );
      logo.position.set(0, 1.2, 0.62);
      g.add(logo);
      for (const [wx, wz] of [
        [-1.2, 0.35],
        [1.2, 0.35],
        [-1.2, -0.35],
        [1.2, -0.35],
      ]) {
        const w = new THREE.Mesh(this._geo.wheel, this._mats.wheel);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.32, wz);
        g.add(w);
      }
      hit = { w: 2.4, h: 2.0, d: 1.15, y: 1.15, mode: 'block' };
    } else if (type === 'mover') {
      const cab = new THREE.Mesh(this._geo.truckCab, this._mats.truckCab);
      cab.position.set(0, 1.15, 0.8);
      g.add(cab);
      const body = new THREE.Mesh(this._geo.truckBody, this._mats.truckBody);
      body.position.set(0, 1.35, -0.35);
      g.add(body);
      for (const [wx, wz] of [
        [-0.85, 0.9],
        [0.85, 0.9],
        [-0.85, -1.1],
        [0.85, -1.1],
      ]) {
        const w = new THREE.Mesh(this._geo.wheel, this._mats.wheel);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.32, wz);
        g.add(w);
      }
      hit = { w: 1.65, h: 1.95, d: 2.35, y: 1.15, mode: 'block' };
      g.userData.mover = true;
    } else if (type === 'ramp') {
      const ramp = new THREE.Mesh(this._geo.ramp, this._mats.ramp);
      ramp.position.set(0, 0.18, 0);
      ramp.rotation.x = -0.22;
      g.add(ramp);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.35), this._mats.signFrame);
      lip.position.set(0, 0.32, 1.1);
      g.add(lip);
      hit = { w: 2.0, h: 0.35, d: 2.2, y: 0.2, mode: 'ramp' };
    } else {
      // Boxy delivery truck — lane change only; no cylinder silhouettes
      const cab = new THREE.Mesh(this._geo.truckCab, this._mats.truckCab);
      cab.position.set(0, 1.15, 1.55);
      cab.castShadow = true;
      g.add(cab);
      const body = new THREE.Mesh(this._geo.truckBody, this._mats.truckBody);
      body.position.set(0, 1.35, -0.55);
      body.castShadow = true;
      g.add(body);
      const wheelGeo = this._geo.wheel;
      const wheelMat = this._mats.wheel;
      for (const [wx, wz] of [
        [-0.85, 1.2],
        [0.85, 1.2],
        [-0.85, -1.4],
        [0.85, -1.4],
      ]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.32, wz);
        g.add(w);
      }
      hit = { w: 1.65, h: 1.95, d: 2.35, y: 1.15, mode: 'block' };
    }
    g.userData.hit = hit;
    return g;
  }

  _acquire(type, lane, z) {
    try {
    let mesh = this.pool.pop();
    if (!mesh) {
      mesh = this._buildMesh(type);
      this.scene.add(mesh);
    } else {
      mesh.clear();
      const built = this._buildMesh(type);
      built.children.forEach((c) => mesh.add(c));
      mesh.userData.hit = built.userData.hit;
    }

    const colors = telegraphColorsFor(type);

    const tel = this._ensureTelMesh(this.telPool, this._geo.tel, colors.core, 48, false);
    tel.visible = false;
    layFlatOnRoad(tel);
    tel.position.set(LANES[lane], 0.08, z);
    tel.scale.set(1, 1, 1);
    this._applyTelColors(tel, colors);

    const telOuter = this._ensureTelMesh(
      this.telOuterPool,
      this._geo.telOuter,
      colors.glow,
      47,
      true
    );
    telOuter.visible = false;
    layFlatOnRoad(telOuter);
    telOuter.position.set(LANES[lane], 0.07, z);
    telOuter.scale.set(1, 1, 1);
    this._applyTelOuterColors(telOuter, colors);

    const shadow = this.shadowPool.pop();
    if (shadow) {
      shadow.visible = false;
      shadow.material.opacity = 0;
      shadow.rotation.set(-Math.PI / 2, 0, 0);
      shadow.scale.set(1, 1, 1);
      shadow.position.set(LANES[lane], 0.06, z);
      const scale =
        type === 'sign' ? 1.05 : type === 'rail' ? 0.55 : type === 'truck' ? 1.25 : 0.9;
      shadow.scale.set(scale, scale * (type === 'sign' ? 0.85 : 1), 1);
    }

    const chevrons = [];
    for (let ci = 0; ci < SPAWN.telegraphChevronCount; ci++) {
      const chev = this._ensureChevron(colors.core);
      chev.visible = false;
      layFlatOnRoad(chev);
      chev.position.set(LANES[lane], 0.09, z);
      chev.scale.set(1, 1, 1);
      this._applyTelColors(chev, colors);
      chevrons.push(chev);
    }

    mesh.position.set(LANES[lane], 0, z);
    mesh.visible = true;
    const hit = mesh.userData.hit;

    const item = {
      type,
      lane,
      z,
      mesh,
      hit,
      alive: true,
      collisionDisabled: false,
      tel,
      telOuter,
      shadow,
      chevrons,
      telColors: colors,
      moverPhase: type === 'mover' ? 0 : 0,
      moverStartLane: type === 'mover' ? lane : undefined,
      moverEndLane: undefined,
      moverLane: lane,
    };
    this.items.push(item);
    return item;
    } catch (e) {
      console.error('_acquire failed', type, lane, z, e);
      return null;
    }
  }

  _release(item) {
    item.alive = false;
    item.mesh.visible = false;
    this.pool.push(item.mesh);
    if (item.tel) {
      item.tel.visible = false;
      item.tel.scale.set(1, 1, 1);
      this.telPool.push(item.tel);
      item.tel = null;
    }
    if (item.telOuter) {
      item.telOuter.visible = false;
      item.telOuter.scale.set(1, 1, 1);
      this.telOuterPool.push(item.telOuter);
      item.telOuter = null;
    }
    if (item.shadow) {
      item.shadow.visible = false;
      item.shadow.scale.set(1, 1, 1);
      this.shadowPool.push(item.shadow);
      item.shadow = null;
    }
    if (item.chevrons) {
      for (const chev of item.chevrons) {
        chev.visible = false;
        chev.scale.set(1, 1, 1);
        this.chevronPool.push(chev);
      }
      item.chevrons = [];
    }
  }

  _spawnPattern(z, diff, playerZ, speed) {
    const rng = this._rng;
    const warmup = this._inWarmup(playerZ);
    const tutorial = this._inTutorial(playerZ);
    this._pruneSpawnHistory(playerZ, speed);
    let maxSpawnZ = z;

    if (
      !tutorial &&
      this._countActiveBlockers(playerZ) >= SPAWN.maxConcurrentBlockers
    ) {
      return maxSpawnZ;
    }

    // After center tutorial: cycle the full obstacle kit in a fixed table
    if (!warmup && !tutorial) {
      const entry = ROTATION_TABLE[this.rotationIndex % ROTATION_TABLE.length];
      this.rotationIndex += 1;
      maxSpawnZ = Math.max(maxSpawnZ, this._spawnRotationEntry(z, entry));
      this.patternsSpawned += 1;
      if (this.rotationIndex >= SPAWN.rotationTableLength) {
        this._logRotationDebug();
      }
      return maxSpawnZ;
    }

    const pastEarlyDoubles =
      this.patternsSpawned >= SPAWN.warmupPatternCount + SPAWN.earlyNoDoublePatterns;
    const doubleChance =
      warmup || tutorial || !pastEarlyDoubles
        ? 0
        : SPAWN.doubleChanceBase + (SPAWN.doubleChanceMax - SPAWN.doubleChanceBase) * diff;
    const count = warmup || tutorial ? 1 : rng() < doubleChance ? 2 : 1;
    const blocked = tutorial
      ? [TUTORIAL_LANE]
      : pickLanes(count, rng);
    const open = [0, 1, 2].find((l) => !blocked.includes(l));

    const placedTypes = [];
    for (let bi = 0; bi < blocked.length; bi++) {
      const lane = blocked[bi];
      let type;
      if (tutorial) {
        if (warmup) {
          type = WARMUP_TYPES[this.patternsSpawned % WARMUP_TYPES.length];
        } else {
          type = POST_WARMUP_SEQUENCE[this.postWarmupPatterns % POST_WARMUP_SEQUENCE.length];
        }
      } else if (!warmup && bi === 0) {
        type = this._varietyType(rng, playerZ, speed);
      } else {
        type = typeForLane(lane, open, rng, warmup, this.patternsSpawned);
      }
      if (!warmup && count === 2 && blocked.length === 2) {
        const other = blocked.find((l) => l !== lane);
        const otherType = placedTypes[0] ?? typeForLane(other, open, rng, false);
        if (otherType === 'barrier' && type === 'barrier') {
          type = rng() > 0.5 ? 'sign' : 'rail';
        }
        if (otherType === 'truck' && type === 'truck') {
          type = rng() > 0.5 ? 'sign' : 'rail';
        }
        if (otherType === 'rail' && type === 'rail') {
          type = rng() > 0.5 ? 'barrier' : 'sign';
        }
        if (otherType === 'sign' && type === 'sign') {
          type = rng() > 0.5 ? 'rail' : 'barrier';
        }
      }
      const zOff = !warmup && count === 2 && rng() > 0.7 ? (rng() - 0.5) * 1.5 : 0;
      let spawnZ = z + zOff;
      if (tutorial && warmup && lane === TUTORIAL_LANE) {
        spawnZ = Math.max(spawnZ, this._minTutorialSpawnZ(playerZ, speed));
      }
      const placed = this._acquire(type, lane, spawnZ);
      if (!placed) continue;
      maxSpawnZ = Math.max(maxSpawnZ, spawnZ);
      placed.nearMissed = false;
      if (tutorial && warmup && lane === TUTORIAL_LANE) {
        if (type === 'rail' && !this._spawnedFirstTutorialRail) {
          placed.isFirstTutorialRail = true;
          this._spawnedFirstTutorialRail = true;
        } else if (type === 'sign' && !this._spawnedFirstTutorialSign) {
          placed.isFirstTutorialSign = true;
          this._spawnedFirstTutorialSign = true;
        }
      }
      placedTypes.push(type);
      this._recordSpawn(spawnZ, type);
    }
    if (!warmup && tutorial && this.postWarmupPatterns < SPAWN.postWarmupTutorialPatterns) {
      this.postWarmupPatterns += 1;
    }
    this.patternsSpawned += 1;
    return maxSpawnZ;
  }

  /** Readable pattern kit: gate, combo verbs, barrel timing, ramp */
  _spawnSpecialPattern(z, playerZ, speed) {
    const rng = this._rng;
    if (this._countActiveBlockers(playerZ) >= SPAWN.maxConcurrentBlockers) return null;
    const blocked = pickLanes(1, rng)[0];
    const roll = rng();
    let maxZ = z;

    const place = (type, lane, zz) => {
      const p = this._acquire(type, lane, zz);
      if (p) {
        maxZ = Math.max(maxZ, zz);
        this._recordSpawn(zz, type);
      }
    };

    if (roll < 0.26) {
      place('rail', blocked, z);
      place('barrier', blocked, z + 0.2);
    } else if (roll < 0.5) {
      place('sign', blocked, z);
      place('rail', blocked, z + 5.8);
    } else if (roll < 0.72) {
      place('rail', blocked, z);
      place('sign', blocked, z + 5.8);
    } else if (roll < 0.86) {
      place('barrel', blocked, z);
    } else if (roll < 0.93) {
      place('mover', blocked, z);
    } else {
      place('ramp', blocked, z);
    }
    return maxZ;
  }

  _gapForSpeed(speed, playerZ) {
    const diff = speedNorm(speed);
    const wideCutoff = SPAWN.warmupPatternCount + SPAWN.postWarmupWideGapCount;
    if (
      this.patternsSpawned <= SPAWN.obstacleTutorialWideGapCount ||
      this.patternsSpawned <= wideCutoff
    ) {
      return (
        SPAWN.obstacleTutorialGapMin +
        this._rng() * (SPAWN.obstacleTutorialGapMax - SPAWN.obstacleTutorialGapMin)
      );
    }
    if (this._inWarmup(playerZ)) {
      return (
        SPAWN.obstacleWarmupGapMin +
        this._rng() * (SPAWN.obstacleWarmupGapMax - SPAWN.obstacleWarmupGapMin)
      );
    }
    const min = SPAWN.obstacleMinGap - diff * SPAWN.obstacleGapTighten * 12;
    const max = SPAWN.obstacleMaxGap - diff * SPAWN.obstacleGapTighten * 10;
    return min + this._rng() * Math.max(6, max - min);
  }

  _minAhead(speed) {
    const diff = speedNorm(speed);
    const leadDist = speed * SPAWN.telegraphLead;
    const reaction = SPAWN.telegraphReactionMargin + diff * 6;
    return Math.max(SPAWN.minSpawnAhead + diff * 12, leadDist + reaction);
  }

  update(dt, playerZ, speed) {
    this._lastPlayerZ = playerZ;
    this._lastSpeed = speed;
    this._pulseT += dt;
    if (this._nearMissCooldown > 0) this._nearMissCooldown -= dt;
    const diff = speedNorm(speed);
    const horizonDist = WORLD.segmentLength * WORLD.segmentsAhead * 0.9;
    const horizon = playerZ + horizonDist;
    const minAhead = this._minAhead(speed);
    const runwayZ = SPAWN.runwayZ;

    // Keep runway empty until near its end, but always allow pre-seeding
    // obstacles from runwayZ onward into the horizon so threats exist on arrival.
    if (playerZ < runwayZ - 5) {
      this.nextZ = Math.max(this.nextZ, runwayZ);
    } else {
      this.nextZ = Math.max(this.nextZ, Math.max(runwayZ, playerZ + minAhead));
    }

    // Always fill horizon (pre-seed from runwayZ while still on runway)
    while (this.nextZ < playerZ + horizonDist) {
      if (this._countActiveBlockers(playerZ) >= SPAWN.maxConcurrentBlockers + 1) {
        break;
      }
      if (this.nextZ < runwayZ) {
        this.nextZ = runwayZ;
        if (this.nextZ >= playerZ + horizonDist) break;
      }
      try {
        const placedZ = this._spawnPattern(this.nextZ, diff, playerZ, speed);
        this.nextZ = placedZ + this._gapForSpeed(speed, playerZ);
      } catch (e) {
        console.error(e);
        this.nextZ += 20;
      }
    }

    // Safety: if somehow empty past runway, force visible blockers ahead
    if (
      playerZ > runwayZ + 10 &&
      this.items.filter((i) => i.alive).length === 0
    ) {
      try {
        this._acquire('barrier', 1, playerZ + 25);
        this._acquire('rail', 0, playerZ + 40);
        this._acquire('sign', 2, playerZ + 55);
        this.nextZ = Math.max(this.nextZ, playerZ + 75);
      } catch (e) {
        console.error(e);
      }
    }

    const leadDist = speed * SPAWN.telegraphLead;
    const gap = SPAWN.telegraphObstacleGap;
    const minAlpha = SPAWN.telegraphMinAlpha;
    const rampDist = speed * SPAWN.telegraphRampSec;
    const pulse = 0.82 + Math.sin(this._pulseT * 11) * 0.18;
    const blink = 0.9 + Math.sin(this._pulseT * 14) * 0.1;
    const stripLen = SPAWN.telegraphStripLength;

    for (const it of this.items) {
      if (!it.alive) continue;
      this._ensureItemTelegraphs(it);

      const dist = it.z - playerZ;
      const inWarn = dist > 0 && dist <= leadDist + 2;
      let laneX = LANES[it.lane];
      const colors = it.telColors;

      // Lane-sweeping truck — telegraphed cross-lane hazard
      if (it.type === 'mover') {
        it.moverPhase += dt * 0.92;
        const start = it.moverStartLane ?? it.lane;
        const end = it.moverEndLane ?? (start === 0 ? 2 : 0);
        const u = (Math.sin(it.moverPhase) + 1) * 0.5;
        const lx = THREE.MathUtils.lerp(LANES[start], LANES[end], u);
        it.mesh.position.set(lx, 0, it.z);
        laneX = lx;
        let nearest = 0;
        let best = Math.abs(LANES[0] - lx);
        for (let li = 1; li < LANES.length; li++) {
          const d = Math.abs(LANES[li] - lx);
          if (d < best) {
            best = d;
            nearest = li;
          }
        }
        it.lane = nearest;
      } else {
        it.mesh.position.set(laneX, 0, it.z);
      }

      if (it.type === 'barrel') {
        it.mesh.children[0].rotation.x += dt * 7;
      }

      if (dist > 0 && speed > 0.1) {
        const ttc = dist / speed;
        if (it.isFirstTutorialRail) this._updateFirstTutorialHint('rail', ttc);
        if (it.isFirstTutorialSign) this._updateFirstTutorialHint('sign', ttc);
      } else {
        if (it.isFirstTutorialRail && this._railHintState !== 'idle' && this._railHintState !== 'done') {
          this._updateFirstTutorialHint('rail', 0);
        }
        if (it.isFirstTutorialSign && this._signHintState !== 'idle' && this._signHintState !== 'done') {
          this._updateFirstTutorialHint('sign', 0);
        }
      }

      const stripEndZ = it.z - gap;
      const stripStartZ = stripEndZ - stripLen;
      const stripCenterZ = stripStartZ + stripLen * 0.5;
      const showStrip = inWarn;

      let alpha = 0;
      if (showStrip) {
        if (dist <= rampDist) {
          const rampUrg = 1 - dist / rampDist;
          alpha = minAlpha + (1 - minAlpha) * rampUrg ** 0.65;
        } else {
          alpha = minAlpha;
        }
        alpha = Math.min(1, alpha * blink);
      }

      layFlatOnRoad(it.tel);
      it.tel.visible = showStrip && alpha > 0.02;
      it.tel.material.opacity = alpha;
      it.tel.material.color.setHex(colors.core);
      it.tel.position.set(laneX, 0.08, stripCenterZ);
      it.tel.scale.set(1, 1, 1);

      layFlatOnRoad(it.telOuter);
      it.telOuter.visible = showStrip && alpha > 0.02;
      it.telOuter.material.opacity = showStrip ? Math.min(1, alpha * 0.32 * pulse) : 0;
      it.telOuter.material.color.setHex(colors.glow);
      it.telOuter.position.set(laneX, 0.07, stripCenterZ);
      it.telOuter.scale.set(1.02, 1.02, 1);

      if (it.shadow) {
        layFlatOnRoad(it.shadow);
        const shadowUrg = showStrip ? 1 - Math.min(dist, rampDist) / rampDist : 0;
        it.shadow.visible = showStrip && alpha > 0.02;
        it.shadow.material.opacity = showStrip ? 0.08 + 0.16 * Math.max(0, shadowUrg) : 0;
        it.shadow.position.set(laneX, 0.06, stripEndZ - stripLen * 0.12);
      }

      for (let ci = 0; ci < it.chevrons.length; ci++) {
        const chev = it.chevrons[ci];
        layFlatOnRoad(chev);
        const t = (ci + 0.5) / it.chevrons.length;
        const chevZ = stripStartZ + stripLen * t;
        const chevDist = it.z - chevZ;
        const chevRamp = chevDist <= rampDist ? 1 - chevDist / rampDist : 0;
        const chevPulse = 0.75 + Math.sin(this._pulseT * 13 + ci * 0.85) * 0.25;
        const chevVisible = showStrip && chevZ >= stripStartZ && chevZ <= stripEndZ;
        chev.visible = chevVisible && alpha > 0.02;
        chev.material.opacity = chevVisible
          ? Math.min(1, (minAlpha + (1 - minAlpha) * chevRamp ** 0.5) * chevPulse)
          : 0;
        chev.material.color.setHex(colors.core);
        chev.position.set(laneX, 0.09, chevZ);
        const s = 0.85 + Math.max(0, chevRamp) * 0.45;
        chev.scale.set(s, s, 1);
      }
    }

    while (this.items.length && this.items[0].z < playerZ - 14) {
      this._release(this.items.shift());
    }
  }

  checkRamp(playerBox, playerLane) {
    for (const it of this.items) {
      if (!it.alive || it.type !== 'ramp') continue;
      const hx = it.mesh.position.x;
      const dx = Math.abs(playerBox.x - hx);
      const dz = Math.abs(playerBox.z - it.z);
      if (it.lane !== playerLane) continue;
      if (dx < 1.05 && dz < 1.6 && playerBox.z < it.z + 0.8) return true;
    }
    return false;
  }

  destroyObstacle(it) {
    if (!it?.alive) return;
    const idx = this.items.indexOf(it);
    this._release(it);
    if (idx >= 0) this.items.splice(idx, 1);
  }

  collide(playerBox, jumping, sliding) {
    const shrink = SPAWN.hitboxShrink;
    const pw = playerBox.w * shrink;
    const ph = playerBox.h * shrink;
    const pd = playerBox.d * shrink;
    const pyMin = playerBox.y - ph * 0.5;
    const pyMax = playerBox.y + ph * 0.5;

    for (const it of this.items) {
      if (!it.alive || it.collisionDisabled) continue;
      const hx = it.mesh.position.x;
      const hz = it.z;
      const hy = it.hit.y;
      const hw = it.hit.w * shrink;
      const hh = it.hit.h * shrink;
      const hd = it.hit.d * shrink;
      const dx = Math.abs(playerBox.x - hx);
      const dz = Math.abs(playerBox.z - hz);
      if (dx >= (pw + hw) * 0.5 || dz >= (pd + hd) * 0.5) continue;

      if (it.hit.mode === 'slide') {
        if (sliding) continue;
        if (it.isFirstTutorialRail === true && !this._graceSlideUsed) {
          this._graceSlideUsed = true;
          it.collisionDisabled = true;
          this._queueGraceRetry('rail');
          this._onTutorialGrace?.('slide');
          continue;
        }
        return it;
      }

      if (it.hit.mode === 'ramp') continue;

      if (it.hit.mode === 'jump') {
        const clearY = this._jumpClearY(it.type);
        if (jumping && playerBox.y > clearY) continue;
        if (it.isFirstTutorialSign === true && !this._graceJumpUsed) {
          this._graceJumpUsed = true;
          it.collisionDisabled = true;
          this._queueGraceRetry('sign');
          this._onTutorialGrace?.('jump');
          continue;
        }
        return it;
      }

      const oyMin = hy - hh * 0.5;
      const oyMax = hy + hh * 0.5;
      if (pyMax > oyMin && pyMin < oyMax) return it;
    }
    return null;
  }

  /**
   * Detect narrow avoids — player used correct action in same lane, just cleared obstacle.
   * Returns bonus points or 0.
   */
  checkNearMiss(playerBox, jumping, sliding, playerZ, playerLane) {
    if (this._nearMissCooldown > 0) return 0;
    const shrink = SPAWN.hitboxShrink;
    const pw = playerBox.w * shrink;
    const pd = playerBox.d * shrink;

    for (const it of this.items) {
      if (!it.alive || it.nearMissed) continue;
      const dz = playerZ - it.z;
      if (dz < 0.3 || dz > NEAR_MISS.proximityZ) continue;

      const hx = it.mesh.position.x;
      const dx = Math.abs(playerBox.x - hx);
      if (dx > NEAR_MISS.proximityX) continue;
      if (it.lane !== playerLane) continue;

      const avoided =
        (it.hit.mode === 'slide' && sliding) ||
        (it.hit.mode === 'jump' && jumping && playerBox.y > this._jumpClearY(it.type)) ||
        (it.hit.mode === 'block' && it.lane !== playerLane);
      if (!avoided) continue;

      const hw = it.hit.w * shrink;
      const hd = it.hit.d * shrink;
      if (dx >= (pw + hw) * 0.42 || dz > (pd + hd) * 0.55) continue;

      it.nearMissed = true;
      this._nearMissCooldown = NEAR_MISS.cooldown;
      return NEAR_MISS.scoreBonus;
    }
    return 0;
  }

  clearAllTutorialHints() {
    clearTimeout(this._graceRetryTimer);
    this._graceRetryTimer = null;
    this._pendingGraceRetry = null;
    this._railHintState = 'idle';
    this._signHintState = 'idle';
    this._railVerbFading = false;
    this._signVerbFading = false;
    this._onTutorialHint?.(null);
  }

  reset() {
    while (this.items.length) this._release(this.items.shift());
    this.nextZ = SPAWN.runwayZ;
    this.patternsSpawned = 0;
    this.postWarmupPatterns = 0;
    this.rotationIndex = 0;
    this.spawnHistory = [];
    this._rotationLogged = false;
    this._nearMissCooldown = 0;
    this._pulseT = 0;
    this._rng = Math.random;
    this._hintSlideShown = false;
    this._hintJumpShown = false;
    this._getReadyRailShown = false;
    this._getReadySignShown = false;
    this._spawnedFirstTutorialRail = false;
    this._spawnedFirstTutorialSign = false;
    this._railHintState = 'idle';
    this._signHintState = 'idle';
    this._railReadyStartMs = 0;
    this._signReadyStartMs = 0;
    this._railVerbStartMs = 0;
    this._signVerbStartMs = 0;
    this._railVerbFading = false;
    this._signVerbFading = false;
    this._graceSlideUsed = false;
    this._graceJumpUsed = false;
    this._pendingGraceRetry = null;
    clearTimeout(this._graceRetryTimer);
    this._graceRetryTimer = null;
    this._onTutorialHint?.(null);
  }
}
