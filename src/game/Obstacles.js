import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { COLORS, LANES, SPAWN, WORLD, PLAYER, NEAR_MISS } from './constants.js';

const TYPES = ['barrier', 'rail', 'sign', 'truck'];
const WARMUP_TYPES = ['rail', 'sign'];
const POOL_SIZE = 48;

function actionMode(type) {
  if (type === 'rail') return 'slide';
  if (type === 'truck') return 'block';
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
const POST_WARMUP_SEQUENCE = ['rail', 'sign', 'rail', 'sign', 'rail', 'sign'];

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
    this.spawnHistory = [];
    this._nearMissCooldown = 0;
    this._pulseT = 0;
    this._rng = Math.random;

    this._geo = {
      barrier: new THREE.BoxGeometry(1.75, 1.25, 0.55),
      rail: new THREE.BoxGeometry(2.1, 0.28, 1.15),
      sign: new THREE.BoxGeometry(1.85, 1.05, 0.5),
      truckCab: new THREE.BoxGeometry(2.05, 1.75, 1.55),
      truckBody: new THREE.BoxGeometry(2.15, 2.25, 3.6),
      tel: new THREE.PlaneGeometry(SPAWN.telegraphStripWidth, SPAWN.telegraphStripLength),
      telOuter: new THREE.PlaneGeometry(SPAWN.telegraphStripWidth * 1.55, SPAWN.telegraphStripLength * 1.4),
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
      stripe: new THREE.MeshStandardMaterial({ color: 0x111111 }),
      railStripe: new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xffaa00,
        emissiveIntensity: 0.5,
      }),
      signTop: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.35,
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

  /** Force jump/slide variety within rolling window */
  _varietyType(rng, playerZ, speed) {
    const modes = this._recentModes();
    const needSlide = !modes.has('slide');
    const needJump = !modes.has('jump');
    if (needSlide && needJump) return rng() < 0.5 ? 'rail' : rng() < 0.6 ? 'sign' : 'barrier';
    if (needSlide) return 'rail';
    if (needJump) return rng() < 0.55 ? 'sign' : 'barrier';
    const roll = rng();
    if (roll < 0.28) return 'rail';
    if (roll < 0.52) return 'sign';
    if (roll < 0.72) return 'barrier';
    return 'truck';
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
      // Low overhead rail — slide under; tall posts + thin bar
      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.15, 0.14), this._mats.rail);
      postL.position.set(-0.95, 1.08, 0);
      const postR = postL.clone();
      postR.position.x = 0.95;
      g.add(postL, postR);
      const m = new THREE.Mesh(this._geo.rail, this._mats.rail);
      m.position.y = 2.05;
      m.castShadow = true;
      g.add(m);
      const warn = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.12, 0.18), this._mats.railStripe);
      warn.position.y = 2.18;
      g.add(warn);
      hit = { w: 1.45, h: 0.32, d: 0.9, y: 2.05, mode: 'slide' };
    } else if (type === 'sign') {
      // High overhead board on pole — jump; flat rectangular sign, not can-shaped
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.35, 0.16), this._mats.signPole);
      pole.position.y = 1.18;
      g.add(pole);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.15, 0.12), this._mats.signFrame);
      frame.position.y = 2.15;
      g.add(frame);
      const m = new THREE.Mesh(this._geo.sign, this._mats.sign);
      m.position.y = 2.15;
      m.castShadow = true;
      g.add(m);
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.18, 0.55), this._mats.signTop);
      top.position.y = 2.72;
      g.add(top);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), this._mats.signPole);
      legL.position.set(-0.55, 0.28, 0);
      const legR = legL.clone();
      legR.position.x = 0.55;
      g.add(legL, legR);
      hit = { w: 1.45, h: 1.05, d: 0.45, y: 2.15, mode: 'jump' };
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
      const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
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
    tel.visible = true;
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
    telOuter.visible = true;
    layFlatOnRoad(telOuter);
    telOuter.position.set(LANES[lane], 0.07, z);
    telOuter.scale.set(1, 1, 1);
    this._applyTelOuterColors(telOuter, colors);

    const shadow = this.shadowPool.pop();
    if (shadow) {
      shadow.visible = true;
      shadow.material.opacity = 0;
      shadow.rotation.set(-Math.PI / 2, 0, 0);
      shadow.scale.set(1, 1, 1);
      shadow.position.set(LANES[lane], 0.06, z);
      const scale =
        type === 'sign' ? 1.15 : type === 'rail' ? 0.65 : type === 'truck' ? 1.25 : 0.9;
      shadow.scale.set(scale, scale * (type === 'sign' ? 1.2 : 1), 1);
    }

    const chevrons = [];
    for (let ci = 0; ci < SPAWN.telegraphChevronCount; ci++) {
      const chev = this._ensureChevron(colors.core);
      chev.visible = true;
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
      tel,
      telOuter,
      shadow,
      chevrons,
      telColors: colors,
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

    if (
      !tutorial &&
      this._countActiveBlockers(playerZ) >= SPAWN.maxConcurrentBlockers
    ) {
      return;
    }

    const doubleChance = warmup || tutorial
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
      const placed = this._acquire(type, lane, z + zOff);
      if (!placed) continue;
      placed.nearMissed = false;
      placedTypes.push(type);
      this._recordSpawn(z + zOff, type);
    }
    if (!warmup && tutorial && this.postWarmupPatterns < SPAWN.postWarmupTutorialPatterns) {
      this.postWarmupPatterns += 1;
    }
    this.patternsSpawned += 1;
  }

  _gapForSpeed(speed, playerZ) {
    const diff = speedNorm(speed);
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
        this._spawnPattern(this.nextZ, diff, playerZ, speed);
        this.nextZ += this._gapForSpeed(speed, playerZ);
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
    const pulse = 0.82 + Math.sin(this._pulseT * 11) * 0.18;
    const blink = 0.9 + Math.sin(this._pulseT * 14) * 0.1;
    const baseLength = SPAWN.telegraphStripLength;
    const stripLen = leadDist;

    for (const it of this.items) {
      if (!it.alive) continue;
      this._ensureItemTelegraphs(it);

      const dist = it.z - playerZ;
      const inWarn = dist > 0 && dist <= leadDist + 2;
      const urgency = inWarn ? 1 - Math.min(dist, leadDist) / leadDist : 0;
      const laneX = LANES[it.lane];
      const colors = it.telColors;

      const stripEndZ = it.z - gap;
      const stripStartZ = stripEndZ - leadDist;
      const stripCenterZ = stripStartZ + stripLen * 0.5;
      const showStrip = inWarn;
      const widthScale = 1 + urgency * 0.04;
      const lengthScale = stripLen / baseLength;
      const alpha = showStrip
        ? Math.min(1, (minAlpha + (1 - minAlpha) * urgency ** 0.7) * blink)
        : 0;

      layFlatOnRoad(it.tel);
      it.tel.visible = showStrip && alpha > 0.02;
      it.tel.material.opacity = alpha;
      it.tel.material.color.setHex(colors.core);
      it.tel.position.set(laneX, 0.08, stripCenterZ);
      it.tel.scale.set(widthScale, lengthScale, 1);

      layFlatOnRoad(it.telOuter);
      it.telOuter.visible = showStrip && alpha > 0.02;
      it.telOuter.material.opacity = showStrip ? Math.min(1, alpha * 0.55 * pulse) : 0;
      it.telOuter.material.color.setHex(colors.glow);
      it.telOuter.position.set(laneX, 0.07, stripCenterZ);
      it.telOuter.scale.set(widthScale * 1.06, lengthScale * 1.04, 1);

      if (it.shadow) {
        layFlatOnRoad(it.shadow);
        it.shadow.visible = showStrip && alpha > 0.02;
        it.shadow.material.opacity = showStrip ? 0.12 + 0.22 * urgency : 0;
        it.shadow.position.set(laneX, 0.06, stripStartZ + stripLen * 0.72);
      }

      for (let ci = 0; ci < it.chevrons.length; ci++) {
        const chev = it.chevrons[ci];
        layFlatOnRoad(chev);
        const t = (ci + 0.55) / it.chevrons.length;
        const chevZ = stripStartZ + stripLen * t;
        const chevUrg = showStrip ? 1 - (it.z - chevZ) / leadDist : 0;
        const chevPulse = 0.75 + Math.sin(this._pulseT * 13 + ci * 0.85) * 0.25;
        const chevVisible = showStrip && chevZ >= stripStartZ && chevZ <= stripEndZ;
        chev.visible = chevVisible;
        chev.material.opacity = chevVisible
          ? Math.min(1, (minAlpha + (1 - minAlpha) * chevUrg ** 0.5) * chevPulse)
          : 0;
        chev.material.color.setHex(colors.core);
        chev.position.set(laneX, 0.09, chevZ);
        const s = 1 + Math.max(0, chevUrg) * 0.75;
        chev.scale.set(s, s, 1);
      }
    }

    while (this.items.length && this.items[0].z < playerZ - 14) {
      this._release(this.items.shift());
    }
  }

  collide(playerBox, jumping, sliding) {
    const shrink = SPAWN.hitboxShrink;
    const pw = playerBox.w * shrink;
    const ph = playerBox.h * shrink;
    const pd = playerBox.d * shrink;

    for (const it of this.items) {
      if (!it.alive) continue;
      const hx = it.mesh.position.x;
      const hz = it.z;
      const hy = it.hit.y;
      const hw = it.hit.w * shrink;
      const hh = it.hit.h * shrink;
      const hd = it.hit.d * shrink;
      const dx = Math.abs(playerBox.x - hx);
      const dz = Math.abs(playerBox.z - hz);
      if (dx >= (pw + hw) * 0.5 || dz >= (pd + hd) * 0.5) continue;

      if (it.hit.mode === 'slide' && sliding) continue;
      if (it.hit.mode === 'jump' && jumping && playerBox.y > (it.type === 'sign' ? 1.2 : 0.85)) continue;

      const dy = Math.abs(playerBox.y - hy);
      if (dy < (ph + hh) * 0.5) return it;
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
        (it.hit.mode === 'jump' && jumping && playerBox.y > (it.type === 'sign' ? 1.2 : 0.85)) ||
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

  reset() {
    while (this.items.length) this._release(this.items.shift());
    this.nextZ = SPAWN.runwayZ;
    this.patternsSpawned = 0;
    this.postWarmupPatterns = 0;
    this.spawnHistory = [];
    this._nearMissCooldown = 0;
    this._pulseT = 0;
    this._rng = Math.random;
  }
}
