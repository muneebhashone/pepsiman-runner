import * as THREE from "three";
import { buildObstacle } from "./ObstacleArt.js";
import { COLORS, LANES, SPAWN, WORLD, PLAYER, NEAR_MISS } from "./constants.js";

const TYPES = [
  "barrier",
  "rail",
  "sign",
  "truck",
  "barrel",
  "pepsiWide",
  "mover",
  "ramp",
];
const WARMUP_TYPES = ["rail", "sign"];
const BLOCK_TYPES = ["truck", "pepsiWide", "mover"];
const POOL_SIZE = 48;

/** Forced post-tutorial rotation — every colliding verb appears before weights matter */
const ROTATION_TABLE = [
  { kind: "single", type: "truck" },
  { kind: "single", type: "mover" },
  { kind: "barrelChain" },
  { kind: "pepsiWide" },
  { kind: "single", type: "ramp" },
  { kind: "single", type: "barrier" },
  { kind: "single", type: "rail" },
  { kind: "single", type: "sign" },
  { kind: "combo", types: ["rail", "barrier"], gap: 0.25 },
  { kind: "single", type: "barrier" },
  { kind: "single", type: "sign" },
  { kind: "single", type: "truck" },
  { kind: "barrelChain" },
  { kind: "single", type: "mover" },
  { kind: "single", type: "sign" },
  { kind: "combo", types: ["sign", "rail"], gap: 5.8 },
  { kind: "pepsiWide" },
  { kind: "single", type: "rail" },
  { kind: "single", type: "truck" },
  { kind: "combo", types: ["ramp", "barrel"], gap: 0.2 },
];

function actionMode(type) {
  if (type === "rail") return "slide";
  if (type === "ramp") return "ramp";
  if (BLOCK_TYPES.includes(type)) return "block";
  return "jump";
}

function speedNorm(speed) {
  return Math.min(
    1,
    (speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase),
  );
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
  if (roll < 0.5) return "rail";
  if (roll < 0.82) return "sign";
  return "barrier";
}

const TUTORIAL_LANE = 1;
const POST_WARMUP_SEQUENCE = [
  "rail",
  "sign",
  "rail",
  "sign",
  "rail",
  "sign",
  "rail",
  "sign",
];

function typeForLane(lane, openLane, rng, warmup, warmupIndex = 0) {
  if (warmup) return WARMUP_TYPES[warmupIndex % WARMUP_TYPES.length];
  if (lane === openLane) {
    if (rng() < SPAWN.verticalObstacleBias) return pickVerticalType(rng);
    return TYPES[(rng() * TYPES.length) | 0];
  }
  if (rng() < SPAWN.verticalObstacleBias * 0.85) return pickVerticalType(rng);
  const blockTypes = ["barrier", "truck", "sign", "rail"];
  return blockTypes[(rng() * blockTypes.length) | 0];
}

const SLIDE_TYPES = ["rail"];

/** Red telegraph only for hazards that kill on contact; slide rails use magenta accent */
function telegraphColorsFor(type) {
  const core = type === "rail" ? 0xffbd46 : COLORS.pepsiBlue;
  const glow = SLIDE_TYPES.includes(type)
    ? COLORS.telegraphSlideGlow
    : COLORS.telegraphGlow;
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
    this._railHintState = "idle";
    this._signHintState = "idle";
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
    this._wasInWarmup = true;
    this._rotationBandPack = false;
    this._onTutorialHint = null;
    this._onTutorialGrace = null;
    this._cueGate = null;

    this._geo = {
      tel: new THREE.PlaneGeometry(
        SPAWN.telegraphStripWidth,
        SPAWN.telegraphStripLength,
      ),
      telOuter: new THREE.PlaneGeometry(
        SPAWN.telegraphStripWidth * 1.18,
        SPAWN.telegraphStripLength * 1.12,
      ),
      shadow: new THREE.PlaneGeometry(1.3, 1.8),
      chevron: chevronGeometry(),
    };
    this._mats = {
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

      const tel = new THREE.Mesh(
        this._geo.tel,
        makeTelegraphMat(COLORS.pepsiRed),
      );
      layFlatOnRoad(tel);
      tel.visible = false;
      tel.frustumCulled = false;
      tel.renderOrder = 48;
      this.scene.add(tel);
      this.telPool.push(tel);

      const telOuter = new THREE.Mesh(
        this._geo.telOuter,
        makeTelegraphGlowMat(COLORS.telegraphGlow),
      );
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
      const chev = new THREE.Mesh(
        this._geo.chevron,
        makeTelegraphMat(COLORS.pepsiRed),
      );
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
    const isRail = kind === "rail";
    const stateKey = isRail ? "_railHintState" : "_signHintState";
    const fadeKey = isRail ? "_railVerbFading" : "_signVerbFading";

    if (action === "ready" && this[stateKey] === "ready") {
      this._enterTutorialVerb(isRail);
      if (isRail) this._hintSlideShown = true;
      else this._hintJumpShown = true;
      return;
    }
    if (action === "again" && this[stateKey] === "retryBeat") {
      this._enterTutorialVerb(isRail);
      return;
    }
    if (action === "slide" && isRail && this[stateKey] === "verb") {
      this[stateKey] = "done";
      this[fadeKey] = false;
      return;
    }
    if (action === "jump" && !isRail && this[stateKey] === "verb") {
      this[stateKey] = "done";
      this[fadeKey] = false;
    }
  }

  _emitTutorialHint(action, kind) {
    if (action != null && action !== "fade") {
      const isRail = kind === "rail";
      const isSign = kind === "sign";
      if (action === "slide" || (action === "ready" && isRail)) {
        if (this._railHintState === "done") return;
      }
      if (action === "jump" || (action === "ready" && isSign)) {
        if (this._signHintState === "done") return;
      }
      if (action === "again") {
        const forRail = isRail && this._railHintState === "retryBeat";
        const forSign = isSign && this._signHintState === "retryBeat";
        if (!forRail && !forSign) return;
      }
    }
    this._onTutorialHint?.(action, kind);
  }

  /** Re-flash verb hint after tutorial grace (bypasses one-shot shown guard). */
  _scheduleGraceRetry(kind) {
    const isRail = kind === "rail";
    const stateKey = isRail ? "_railHintState" : "_signHintState";
    const readyMsKey = isRail ? "_railReadyStartMs" : "_signReadyStartMs";
    const fadeKey = isRail ? "_railVerbFading" : "_signVerbFading";

    this[stateKey] = "retryBeat";
    this[readyMsKey] = performance.now();
    this[fadeKey] = false;
    this._emitTutorialHint("again", kind);
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
    const stateKey = isRail ? "_railHintState" : "_signHintState";
    const fadeKey = isRail ? "_railVerbFading" : "_signVerbFading";
    this[stateKey] = "done";
    this[fadeKey] = false;
    return true;
  }

  /** True when correct input should dismiss the on-screen tutorial cue. */
  canDismissTutorialOnInput(kind) {
    const isRail = kind === "slide";
    const stateKey = isRail ? "_railHintState" : "_signHintState";
    const state = this[stateKey];
    return state === "verb" || state === "ready" || state === "retryBeat";
  }

  markTutorialDismissed(kind) {
    const isRail = kind === "slide";
    return this._markTutorialDone(isRail);
  }

  /** Dismiss when correct input or pose during any active first-tutorial window. */
  _tryDismissTutorial(kind) {
    const isRail = kind === "slide";
    const stateKey = isRail ? "_railHintState" : "_signHintState";
    const state = this[stateKey];
    if (state === "verb") return this._markTutorialDone(isRail);
    return false;
  }

  /** Timed GET READY → verb sequence for first tutorial rail/sign. */
  _updateFirstTutorialHint(kind, ttc) {
    const isRail = kind === "rail";
    const stateKey = isRail ? "_railHintState" : "_signHintState";
    const readyMsKey = isRail ? "_railReadyStartMs" : "_signReadyStartMs";
    let state = this[stateKey];

    if (state === "done") return;

    if (state === "idle") {
      if (ttc > this._tutorialHintStartTtc()) return;
      this[stateKey] = "ready";
      this[readyMsKey] = performance.now();
      if (isRail) this._getReadyRailShown = true;
      else this._getReadySignShown = true;
      this._emitTutorialHint("ready", kind);
      return;
    }

    // ready / retryBeat / verb lifecycles are driven by the UI cue queue callbacks.
  }

  _enterTutorialVerb(isRail) {
    const stateKey = isRail ? "_railHintState" : "_signHintState";
    const verbMsKey = isRail ? "_railVerbStartMs" : "_signVerbStartMs";
    const fadeKey = isRail ? "_railVerbFading" : "_signVerbFading";
    const kind = isRail ? "rail" : "sign";
    this[stateKey] = "verb";
    this[verbMsKey] = performance.now();
    this[fadeKey] = false;
    this._emitTutorialHint(isRail ? "slide" : "jump", kind);
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
    if (sliding && this._railHintState === "verb") return "slide";
    if (jumping && this._signHintState === "verb") return "jump";
    return null;
  }

  _tutorialHintStartTtc() {
    return SPAWN.tutorialHintReadyStartSec + 0.35;
  }

  _minTutorialSpawnZ(playerZ, speed) {
    return playerZ + speed * SPAWN.tutorialHintMinSpawnTtcSec;
  }

  _jumpClearY(type) {
    return type === "sign" ? 0.95 : 0.85;
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
    return playerZ < SPAWN.runwayZ || playerZ < SPAWN.obstacleWarmupZ;
  }

  _inRotation(playerZ) {
    return !this._inWarmup(playerZ) && !this._inTutorial(playerZ);
  }

  /** Drop leftover warmup rail/sign so rotation kit can pack the contact band. */
  _recycleWarmupBand(playerZ) {
    const recycleZ = playerZ + SPAWN.warmupRecycleAhead;
    let nearestTeach = null;
    let nearestLead = Infinity;
    for (const it of this.items) {
      if (!it.alive) continue;
      if (it.isFirstTutorialRail || it.isFirstTutorialSign) continue;
      if (it.type !== "rail" && it.type !== "sign") continue;
      if (it.z <= playerZ) continue;
      const lead = it.z - playerZ;
      if (lead < nearestLead) {
        nearestLead = lead;
        nearestTeach = it;
      }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it.alive) continue;
      if (it.isFirstTutorialRail || it.isFirstTutorialSign) continue;
      if (it.type !== "rail" && it.type !== "sign") continue;
      if (it.z <= playerZ) continue;
      if (it === nearestTeach && it.z <= recycleZ) continue;
      if (it.z > recycleZ) {
        this._release(it);
        this.items.splice(i, 1);
      }
    }
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
    if (type === "mover") this._initMoverSweep(placed, blocked, rng);
    this._recordSpawn(z, type);
    return z;
  }

  _initMoverSweep(item, startLane, rng) {
    const endLane =
      startLane === 0 ? 2 : startLane === 2 ? 0 : rng() > 0.5 ? 2 : 0;
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
      const p = this._acquire("barrel", blocked, zz);
      if (p) {
        maxZ = Math.max(maxZ, zz);
        this._recordSpawn(zz, "barrel");
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
      const p = this._acquire("pepsiWide", lane, z);
      if (p) {
        maxZ = Math.max(maxZ, z);
        this._recordSpawn(z, "pepsiWide");
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
        if (types[i] === "mover") this._initMoverSweep(p, blocked, rng);
        this._recordSpawn(zz, types[i]);
      }
    }
    return maxZ;
  }

  _spawnRotationEntry(z, entry) {
    const rng = this._rng;
    if (entry.kind === "barrelChain") return this._spawnBarrelChain(z, rng);
    if (entry.kind === "pepsiWide") return this._spawnPepsiWideGap(z, rng);
    if (entry.kind === "combo")
      return this._spawnCombo(z, entry.types, entry.gap ?? 0.25, rng);
    return this._placeSingle(z, entry.type, rng);
  }

  _logRotationDebug() {
    if (this._rotationLogged) return;
    const recent = this.spawnHistory.slice(-SPAWN.rotationTableLength);
    const types = new Set(recent.map((h) => h.type));
    console.debug(
      `[Obstacles] Post-tutorial rotation — ${types.size} distinct types in ${recent.length} spawns:`,
      [...types].sort().join(", "),
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
    const needSlide = !modes.has("slide");
    const needJump = !modes.has("jump");
    const needBlock = !modes.has("block");
    if (needSlide && needJump)
      return rng() < 0.5 ? "rail" : rng() < 0.6 ? "sign" : "barrel";
    if (needSlide) return "rail";
    if (needJump) return rng() < 0.55 ? "sign" : "barrel";
    if (needBlock)
      return rng() < 0.45 ? "truck" : rng() < 0.7 ? "pepsiWide" : "mover";
    const roll = rng();
    if (roll < 0.2) return "rail";
    if (roll < 0.38) return "sign";
    if (roll < 0.52) return "barrel";
    if (roll < 0.66) return "barrier";
    if (roll < 0.8) return "truck";
    if (roll < 0.9) return "pepsiWide";
    return rng() < 0.6 ? "mover" : "ramp";
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
      it.tel = this._ensureTelMesh(
        this.telPool,
        this._geo.tel,
        colors.core,
        48,
        false,
      );
      it.tel.visible = false;
      this._applyTelColors(it.tel, colors);
    }
    if (!it.telOuter) {
      it.telOuter = this._ensureTelMesh(
        this.telOuterPool,
        this._geo.telOuter,
        colors.glow,
        47,
        true,
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

  _ensureMoverDestTelegraphs(it) {
    if (it.type !== "mover") return;
    const colors = it.telColors ?? telegraphColorsFor(it.type);
    const endLane = it.moverEndLane ?? it.lane;
    const destX = LANES[endLane];

    if (!it.destTel) {
      it.destTel = this._ensureTelMesh(
        this.telPool,
        this._geo.tel,
        colors.core,
        48,
        false,
      );
      it.destTel.visible = false;
      this._applyTelColors(it.destTel, colors);
    }
    if (!it.destTelOuter) {
      it.destTelOuter = this._ensureTelMesh(
        this.telOuterPool,
        this._geo.telOuter,
        colors.glow,
        47,
        true,
      );
      it.destTelOuter.visible = false;
      this._applyTelOuterColors(it.destTelOuter, colors);
    }
    if (!it.destChevrons?.length) {
      it.destChevrons = [];
      for (let ci = 0; ci < SPAWN.telegraphChevronCount; ci++) {
        const chev = this._ensureChevron(colors.core);
        chev.visible = false;
        chev.position.set(destX, 0.09, it.z);
        this._applyTelColors(chev, colors);
        it.destChevrons.push(chev);
      }
    }
  }

  _layoutTelegraphStrip(
    it,
    laneX,
    tel,
    telOuter,
    chevrons,
    dist,
    showStrip,
    alpha,
    colors,
    pulse,
    rampDist,
    minAlpha,
    stripLen,
    gap,
  ) {
    const stripEndZ = it.z - gap;
    const stripStartZ = stripEndZ - stripLen;
    const stripCenterZ = stripStartZ + stripLen * 0.5;

    layFlatOnRoad(tel);
    tel.visible = showStrip && alpha > 0.02;
    tel.material.opacity = alpha;
    tel.material.color.setHex(colors.core);
    tel.position.set(laneX, 0.08, stripCenterZ);
    tel.scale.set(1, 1, 1);

    layFlatOnRoad(telOuter);
    telOuter.visible = showStrip && alpha > 0.02;
    telOuter.material.opacity = showStrip
      ? Math.min(1, alpha * 0.32 * pulse)
      : 0;
    telOuter.material.color.setHex(colors.glow);
    telOuter.position.set(laneX, 0.07, stripCenterZ);
    telOuter.scale.set(1.02, 1.02, 1);

    for (let ci = 0; ci < chevrons.length; ci++) {
      const chev = chevrons[ci];
      layFlatOnRoad(chev);
      const t = (ci + 0.5) / chevrons.length;
      const chevZ = stripStartZ + stripLen * t;
      const chevDist = it.z - chevZ;
      const chevRamp = chevDist <= rampDist ? 1 - chevDist / rampDist : 0;
      const chevPulse = 0.75 + Math.sin(this._pulseT * 13 + ci * 0.85) * 0.25;
      const chevVisible =
        showStrip && chevZ >= stripStartZ && chevZ <= stripEndZ;
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

  _releaseMoverDestTelegraphs(item) {
    if (item.destTel) {
      item.destTel.visible = false;
      item.destTel.scale.set(1, 1, 1);
      this.telPool.push(item.destTel);
      item.destTel = null;
    }
    if (item.destTelOuter) {
      item.destTelOuter.visible = false;
      item.destTelOuter.scale.set(1, 1, 1);
      this.telOuterPool.push(item.destTelOuter);
      item.destTelOuter = null;
    }
    if (item.destChevrons) {
      for (const chev of item.destChevrons) {
        chev.visible = false;
        chev.scale.set(1, 1, 1);
        this.chevronPool.push(chev);
      }
      item.destChevrons = [];
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
    return buildObstacle(type);
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
        [...built.children].forEach((c) => mesh.add(c));
        mesh.userData.hit = built.userData.hit;
      }

      const colors = telegraphColorsFor(type);

      const tel = this._ensureTelMesh(
        this.telPool,
        this._geo.tel,
        colors.core,
        48,
        false,
      );
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
        true,
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
          type === "sign"
            ? 1.05
            : type === "rail"
              ? 0.55
              : type === "truck"
                ? 1.25
                : 0.9;
        shadow.scale.set(scale, scale * (type === "sign" ? 0.85 : 1), 1);
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
        moverPhase: type === "mover" ? 0 : 0,
        moverStartLane: type === "mover" ? lane : undefined,
        moverEndLane: undefined,
        moverLane: lane,
      };
      this.items.push(item);
      return item;
    } catch (e) {
      console.error("_acquire failed", type, lane, z, e);
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
    this._releaseMoverDestTelegraphs(item);
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
      this.patternsSpawned >=
      SPAWN.warmupPatternCount + SPAWN.earlyNoDoublePatterns;
    const doubleChance =
      warmup || tutorial || !pastEarlyDoubles
        ? 0
        : SPAWN.doubleChanceBase +
          (SPAWN.doubleChanceMax - SPAWN.doubleChanceBase) * diff;
    const count = warmup || tutorial ? 1 : rng() < doubleChance ? 2 : 1;
    const blocked = tutorial ? [TUTORIAL_LANE] : pickLanes(count, rng);
    const open = [0, 1, 2].find((l) => !blocked.includes(l));

    const placedTypes = [];
    for (let bi = 0; bi < blocked.length; bi++) {
      const lane = blocked[bi];
      let type;
      if (tutorial) {
        if (warmup) {
          type = WARMUP_TYPES[this.patternsSpawned % WARMUP_TYPES.length];
        } else {
          type =
            POST_WARMUP_SEQUENCE[
              this.postWarmupPatterns % POST_WARMUP_SEQUENCE.length
            ];
        }
      } else if (!warmup && bi === 0) {
        type = this._varietyType(rng, playerZ, speed);
      } else {
        type = typeForLane(lane, open, rng, warmup, this.patternsSpawned);
      }
      if (!warmup && count === 2 && blocked.length === 2) {
        const other = blocked.find((l) => l !== lane);
        const otherType =
          placedTypes[0] ?? typeForLane(other, open, rng, false);
        if (otherType === "barrier" && type === "barrier") {
          type = rng() > 0.5 ? "sign" : "rail";
        }
        if (otherType === "truck" && type === "truck") {
          type = rng() > 0.5 ? "sign" : "rail";
        }
        if (otherType === "rail" && type === "rail") {
          type = rng() > 0.5 ? "barrier" : "sign";
        }
        if (otherType === "sign" && type === "sign") {
          type = rng() > 0.5 ? "rail" : "barrier";
        }
      }
      const zOff =
        !warmup && count === 2 && rng() > 0.7 ? (rng() - 0.5) * 1.5 : 0;
      let spawnZ = z + zOff;
      if (tutorial && warmup && lane === TUTORIAL_LANE) {
        spawnZ = Math.max(spawnZ, this._minTutorialSpawnZ(playerZ, speed));
      }
      const placed = this._acquire(type, lane, spawnZ);
      if (!placed) continue;
      maxSpawnZ = Math.max(maxSpawnZ, spawnZ);
      placed.nearMissed = false;
      if (tutorial && warmup && lane === TUTORIAL_LANE) {
        if (type === "rail" && !this._spawnedFirstTutorialRail) {
          placed.isFirstTutorialRail = true;
          this._spawnedFirstTutorialRail = true;
        } else if (type === "sign" && !this._spawnedFirstTutorialSign) {
          placed.isFirstTutorialSign = true;
          this._spawnedFirstTutorialSign = true;
        }
      }
      placedTypes.push(type);
      this._recordSpawn(spawnZ, type);
    }
    if (
      !warmup &&
      tutorial &&
      this.postWarmupPatterns < SPAWN.postWarmupTutorialPatterns
    ) {
      this.postWarmupPatterns += 1;
    }
    this.patternsSpawned += 1;
    return maxSpawnZ;
  }

  /** Readable pattern kit: gate, combo verbs, barrel timing, ramp */
  _spawnSpecialPattern(z, playerZ, speed) {
    const rng = this._rng;
    if (this._countActiveBlockers(playerZ) >= SPAWN.maxConcurrentBlockers)
      return null;
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
      place("rail", blocked, z);
      place("barrier", blocked, z + 0.2);
    } else if (roll < 0.5) {
      place("sign", blocked, z);
      place("rail", blocked, z + 5.8);
    } else if (roll < 0.72) {
      place("rail", blocked, z);
      place("sign", blocked, z + 5.8);
    } else if (roll < 0.86) {
      place("barrel", blocked, z);
    } else if (roll < 0.93) {
      place("mover", blocked, z);
    } else {
      place("ramp", blocked, z);
    }
    return maxZ;
  }

  _gapForSpeed(speed, playerZ) {
    const diff = speedNorm(speed);
    if (this._inWarmup(playerZ)) {
      return (
        SPAWN.obstacleWarmupGapMin +
        this._rng() * (SPAWN.obstacleWarmupGapMax - SPAWN.obstacleWarmupGapMin)
      );
    }
    if (
      this._rotationBandPack &&
      this._inRotation(playerZ) &&
      this.rotationIndex > 0 &&
      this.rotationIndex < SPAWN.rotationPackCount
    ) {
      if (this.rotationIndex === 4) {
        return (
          SPAWN.rotationRampGapMin +
          this._rng() * (SPAWN.rotationRampGapMax - SPAWN.rotationRampGapMin)
        );
      }
      return (
        SPAWN.rotationGapMin +
        this._rng() * (SPAWN.rotationGapMax - SPAWN.rotationGapMin)
      );
    }
    const wideCutoff = SPAWN.warmupPatternCount + SPAWN.postWarmupWideGapCount;
    if (
      this._inTutorial(playerZ) &&
      (this.patternsSpawned <= SPAWN.obstacleTutorialWideGapCount ||
        this.patternsSpawned <= wideCutoff)
    ) {
      return (
        SPAWN.obstacleTutorialGapMin +
        this._rng() *
          (SPAWN.obstacleTutorialGapMax - SPAWN.obstacleTutorialGapMin)
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

  /** Spawn fill horizon — contact-time band, not WORLD.segmentsAhead (360m).
   *  At speed 19: horizon ≈120m → first rotation truck ~110m ahead at warmup end (z≈105)
   *  → contact t≈11s; ramp (5th entry, ~43m gaps) contact t≈20s. */
  _spawnHorizon(speed) {
    const diff = speedNorm(speed);
    const segmentLead = WORLD.segmentLength * SPAWN.patternLookahead;
    return THREE.MathUtils.clamp(
      segmentLead + diff * 8,
      SPAWN.obstacleSpawnAheadMin,
      SPAWN.obstacleSpawnAheadMax,
    );
  }

  /** Target lead for first post-warmup rotation entry when warmup ends. */
  _spawnAheadLead(speed) {
    const diff = speedNorm(speed);
    // ~55–70m so truck+mover+barrel fit inside the ~120m contact horizon.
    return THREE.MathUtils.clamp(
      SPAWN.obstacleSpawnAheadMin + diff * 10,
      SPAWN.obstacleSpawnAheadMin,
      70,
    );
  }

  update(dt, playerZ, speed) {
    this._lastPlayerZ = playerZ;
    this._lastSpeed = speed;
    this._pulseT += dt;
    if (this._nearMissCooldown > 0) this._nearMissCooldown -= dt;
    const diff = speedNorm(speed);
    const horizonDist = this._spawnHorizon(speed);
    const minAhead = this._minAhead(speed);
    const runwayZ = SPAWN.runwayZ;
    const inWarmup = this._inWarmup(playerZ);

    // Pull spawn cursor into contact-time band when rotation phase begins.
    if (this._wasInWarmup && !inWarmup) {
      this._recycleWarmupBand(playerZ);
      this.nextZ = playerZ + this._spawnAheadLead(speed);
      this._rotationBandPack = true;
    }
    this._wasInWarmup = inWarmup;

    if (
      this._rotationBandPack &&
      this.rotationIndex >= SPAWN.rotationPackCount
    ) {
      this._rotationBandPack = false;
    }

    // Keep runway empty until near its end, but always allow pre-seeding
    // obstacles from runwayZ onward into the horizon so threats exist on arrival.
    if (playerZ < runwayZ - 5) {
      this.nextZ = Math.max(this.nextZ, runwayZ);
    } else if (
      this._rotationBandPack &&
      this.rotationIndex < SPAWN.rotationPackCount
    ) {
      this.nextZ = Math.max(this.nextZ, runwayZ);
    } else {
      this.nextZ = Math.max(this.nextZ, Math.max(runwayZ, playerZ + minAhead));
    }

    // Fill only the contact-time horizon (~80–140m), not the full world pool (~360m).
    while (this.nextZ < playerZ + horizonDist) {
      if (
        this._countActiveBlockers(playerZ) >=
        SPAWN.maxConcurrentBlockers + 1
      ) {
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
        this._acquire("barrier", 1, playerZ + 25);
        this._acquire("rail", 0, playerZ + 40);
        this._acquire("sign", 2, playerZ + 55);
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
      if (it.type === "mover") {
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

      if (it.type === "barrel") {
        it.mesh.children[0].rotation.x += dt * 7;
      }

      if (dist > 0 && speed > 0.1) {
        const ttc = dist / speed;
        if (it.isFirstTutorialRail) this._updateFirstTutorialHint("rail", ttc);
        if (it.isFirstTutorialSign) this._updateFirstTutorialHint("sign", ttc);
      } else {
        if (
          it.isFirstTutorialRail &&
          this._railHintState !== "idle" &&
          this._railHintState !== "done"
        ) {
          this._updateFirstTutorialHint("rail", 0);
        }
        if (
          it.isFirstTutorialSign &&
          this._signHintState !== "idle" &&
          this._signHintState !== "done"
        ) {
          this._updateFirstTutorialHint("sign", 0);
        }
      }

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

      const stripEndZ = it.z - gap;
      this._layoutTelegraphStrip(
        it,
        laneX,
        it.tel,
        it.telOuter,
        it.chevrons,
        dist,
        showStrip,
        alpha,
        colors,
        pulse,
        rampDist,
        minAlpha,
        stripLen,
        gap,
      );

      if (it.shadow) {
        layFlatOnRoad(it.shadow);
        const shadowUrg = showStrip
          ? 1 - Math.min(dist, rampDist) / rampDist
          : 0;
        it.shadow.visible = showStrip && alpha > 0.02;
        it.shadow.material.opacity = showStrip
          ? 0.08 + 0.16 * Math.max(0, shadowUrg)
          : 0;
        it.shadow.position.set(laneX, 0.06, stripEndZ - stripLen * 0.12);
      }

      if (it.type === "mover") {
        const start = it.moverStartLane ?? it.lane;
        const end = it.moverEndLane ?? (start === 0 ? 2 : 0);
        if (start !== end) {
          this._ensureMoverDestTelegraphs(it);
          const destLeadDist = THREE.MathUtils.clamp(
            speed * SPAWN.moverDestTelegraphLeadSec,
            SPAWN.moverDestTelegraphMinDist,
            SPAWN.moverDestTelegraphMaxDist,
          );
          const showDestStrip = dist > 0 && dist <= destLeadDist;
          let destAlpha = 0;
          if (showDestStrip) {
            const nearDist = Math.min(rampDist, destLeadDist * 0.28);
            if (dist <= nearDist) {
              const rampUrg = nearDist > 0.01 ? 1 - dist / nearDist : 1;
              destAlpha = minAlpha + (1 - minAlpha) * rampUrg ** 0.65;
            } else {
              const span = destLeadDist - nearDist;
              const farU = span > 0.01 ? (destLeadDist - dist) / span : 1;
              destAlpha = minAlpha * (0.38 + 0.62 * farU);
            }
            destAlpha = Math.min(1, destAlpha * blink);
          }
          this._layoutTelegraphStrip(
            it,
            LANES[end],
            it.destTel,
            it.destTelOuter,
            it.destChevrons,
            dist,
            showDestStrip,
            destAlpha,
            colors,
            pulse,
            rampDist,
            minAlpha,
            stripLen,
            gap,
          );
        }
      }
    }

    while (this.items.length && this.items[0].z < playerZ - 14) {
      this._release(this.items.shift());
    }
  }

  checkRamp(playerBox, playerLane) {
    for (const it of this.items) {
      if (!it.alive || it.type !== "ramp") continue;
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
      const sweptZ = THREE.MathUtils.clamp(
        hz,
        playerBox.previousZ ?? playerBox.z,
        playerBox.z,
      );
      const dz = Math.abs(sweptZ - hz);
      if (dx >= (pw + hw) * 0.5 || dz >= (pd + hd) * 0.5) continue;

      if (it.hit.mode === "slide") {
        if (sliding) continue;
        if (it.isFirstTutorialRail === true && !this._graceSlideUsed) {
          this._graceSlideUsed = true;
          it.collisionDisabled = true;
          this._queueGraceRetry("rail");
          this._onTutorialGrace?.("slide");
          continue;
        }
        return it;
      }

      if (it.hit.mode === "ramp") continue;

      if (it.hit.mode === "jump") {
        const clearY = this._jumpClearY(it.type);
        if (jumping && playerBox.y > clearY) continue;
        if (it.isFirstTutorialSign === true && !this._graceJumpUsed) {
          this._graceJumpUsed = true;
          it.collisionDisabled = true;
          this._queueGraceRetry("sign");
          this._onTutorialGrace?.("jump");
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
        (it.hit.mode === "slide" && sliding) ||
        (it.hit.mode === "jump" &&
          jumping &&
          playerBox.y > this._jumpClearY(it.type)) ||
        (it.hit.mode === "block" && it.lane !== playerLane);
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
    this._railHintState = "idle";
    this._signHintState = "idle";
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
    this._railHintState = "idle";
    this._signHintState = "idle";
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
    this._wasInWarmup = true;
    this._rotationBandPack = false;
    this._onTutorialHint?.(null);
  }
}
